-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "SmsVerificationCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "SmsVerificationCode_phone_purpose_createdAt_idx" ON "SmsVerificationCode"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "SmsVerificationCode_expiresAt_idx" ON "SmsVerificationCode"("expiresAt");
