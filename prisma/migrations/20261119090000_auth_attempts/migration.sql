-- CreateEnum
CREATE TYPE "AttemptKind" AS ENUM ('LOGIN', 'REGISTER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "kind" "AttemptKind" NOT NULL,
    "key" TEXT NOT NULL,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthAttempt_kind_key_createdAt_idx" ON "AuthAttempt"("kind", "key", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_kind_ip_createdAt_idx" ON "AuthAttempt"("kind", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_createdAt_idx" ON "AuthAttempt"("createdAt");

