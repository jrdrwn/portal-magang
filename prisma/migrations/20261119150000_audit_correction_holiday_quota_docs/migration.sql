-- CreateEnum
CREATE TYPE "HolidayKind" AS ENUM ('NATIONAL', 'JOINT_LEAVE', 'OFFICE');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('CV', 'COVER_LETTER');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "checkInPhotoKey" TEXT,
ADD COLUMN     "checkOutPhotoKey" TEXT,
ADD COLUMN     "correctedAt" TIMESTAMP(3),
ADD COLUMN     "correctedById" TEXT,
ADD COLUMN     "correctionReason" TEXT;

-- AlterTable
ALTER TABLE "OfficeSetting" ADD COLUMN     "requireSelfie" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "workDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "quota" INTEGER,
ADD COLUMN     "regClosesAt" DATE,
ADD COLUMN     "regOpensAt" DATE;

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "HolidayKind" NOT NULL DEFAULT 'NATIONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "teamId" TEXT,
    "summary" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Document_fileKey_key" ON "Document"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "Document_registrationId_kind_key" ON "Document"("registrationId", "kind");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_teamId_createdAt_idx" ON "AuditLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Libur nasional & cuti bersama 2026 (SKB Menag, Menaker, MenPAN-RB No. 1497/2/45 Tahun 2025).
INSERT INTO "Holiday" ("id", "date", "name", "kind") VALUES
  ('hol_20260101', '2026-01-01', 'Tahun Baru Masehi', 'NATIONAL'),
  ('hol_20260116', '2026-01-16', 'Isra Mikraj Nabi Muhammad SAW', 'NATIONAL'),
  ('hol_20260216', '2026-02-16', 'Cuti bersama Tahun Baru Imlek', 'JOINT_LEAVE'),
  ('hol_20260217', '2026-02-17', 'Tahun Baru Imlek 2577 Kongzili', 'NATIONAL'),
  ('hol_20260318', '2026-03-18', 'Cuti bersama Hari Suci Nyepi', 'JOINT_LEAVE'),
  ('hol_20260319', '2026-03-19', 'Hari Suci Nyepi Tahun Baru Saka 1948', 'NATIONAL'),
  ('hol_20260320', '2026-03-20', 'Cuti bersama Idul Fitri 1447 H', 'JOINT_LEAVE'),
  ('hol_20260321', '2026-03-21', 'Idul Fitri 1447 H', 'NATIONAL'),
  ('hol_20260322', '2026-03-22', 'Idul Fitri 1447 H', 'NATIONAL'),
  ('hol_20260323', '2026-03-23', 'Cuti bersama Idul Fitri 1447 H', 'JOINT_LEAVE'),
  ('hol_20260324', '2026-03-24', 'Cuti bersama Idul Fitri 1447 H', 'JOINT_LEAVE'),
  ('hol_20260403', '2026-04-03', 'Wafat Yesus Kristus', 'NATIONAL'),
  ('hol_20260405', '2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)', 'NATIONAL'),
  ('hol_20260501', '2026-05-01', 'Hari Buruh Internasional', 'NATIONAL'),
  ('hol_20260514', '2026-05-14', 'Kenaikan Yesus Kristus', 'NATIONAL'),
  ('hol_20260515', '2026-05-15', 'Cuti bersama Kenaikan Yesus Kristus', 'JOINT_LEAVE'),
  ('hol_20260527', '2026-05-27', 'Idul Adha 1447 H', 'NATIONAL'),
  ('hol_20260528', '2026-05-28', 'Cuti bersama Idul Adha 1447 H', 'JOINT_LEAVE'),
  ('hol_20260531', '2026-05-31', 'Hari Raya Waisak 2570 BE', 'NATIONAL'),
  ('hol_20260601', '2026-06-01', 'Hari Lahir Pancasila', 'NATIONAL'),
  ('hol_20260616', '2026-06-16', 'Tahun Baru Islam 1448 H', 'NATIONAL'),
  ('hol_20260817', '2026-08-17', 'Hari Kemerdekaan Republik Indonesia', 'NATIONAL'),
  ('hol_20260825', '2026-08-25', 'Maulid Nabi Muhammad SAW', 'NATIONAL'),
  ('hol_20261224', '2026-12-24', 'Cuti bersama Hari Raya Natal', 'JOINT_LEAVE'),
  ('hol_20261225', '2026-12-25', 'Hari Raya Natal', 'NATIONAL')
ON CONFLICT ("date") DO NOTHING;
