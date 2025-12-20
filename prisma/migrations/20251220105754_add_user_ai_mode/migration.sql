-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiMode" TEXT NOT NULL DEFAULT 'system_default';

-- CreateIndex
CREATE INDEX "User_aiMode_idx" ON "User"("aiMode");
