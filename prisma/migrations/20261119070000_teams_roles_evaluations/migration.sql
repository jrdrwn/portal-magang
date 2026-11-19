-- Role: ADMIN lama menjadi SUPER_ADMIN, tambah TEAM_ADMIN.
ALTER TYPE "Role" RENAME VALUE 'ADMIN' TO 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE 'TEAM_ADMIN' BEFORE 'INTERN';

-- Jenis magang
CREATE TYPE "InternshipType" AS ENUM ('MANDIRI', 'MAGANGHUB');

-- Tim
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- Admin tim
ALTER TABLE "User" ADD COLUMN "teamId" TEXT;
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pendaftaran: divisi (teks bebas) diganti relasi ke tim.
ALTER TABLE "Registration"
    ADD COLUMN "teamId" TEXT,
    ADD COLUMN "type" "InternshipType" NOT NULL DEFAULT 'MANDIRI',
    ADD COLUMN "graduationYear" INTEGER;

-- Buat tim dari divisi yang sudah ada agar data lama tidak hilang.
INSERT INTO "Team" ("id", "name", "isOpen", "updatedAt")
SELECT 'team_' || md5("division"), "division", true, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "division" FROM "Registration") d
ON CONFLICT ("name") DO NOTHING;

UPDATE "Registration" r SET "teamId" = t."id"
FROM "Team" t WHERE t."name" = r."division";

ALTER TABLE "Registration" ALTER COLUMN "teamId" SET NOT NULL;
ALTER TABLE "Registration" DROP COLUMN "division";
CREATE INDEX "Registration_teamId_idx" ON "Registration"("teamId");
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Evaluasi bulanan
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "internId" TEXT NOT NULL,
    "evaluatorId" TEXT,
    "month" DATE NOT NULL,
    "discipline" INTEGER NOT NULL,
    "workQuality" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "initiative" INTEGER NOT NULL,
    "teamwork" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Evaluation_registrationId_month_key" ON "Evaluation"("registrationId", "month");
CREATE INDEX "Evaluation_internId_idx" ON "Evaluation"("internId");
CREATE INDEX "Evaluation_month_idx" ON "Evaluation"("month");
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_internId_fkey" FOREIGN KEY ("internId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
