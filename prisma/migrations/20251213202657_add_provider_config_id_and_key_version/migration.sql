/*
  Warnings:

  - The required column `id` was added to the `ProviderConfig` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "ProviderConfig" ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "keyVersion" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "ProviderConfig_keyVersion_idx" ON "ProviderConfig"("keyVersion");
