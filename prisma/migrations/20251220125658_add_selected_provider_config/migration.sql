-- AlterTable
ALTER TABLE "User" ADD COLUMN     "selectedProviderConfigId" TEXT;

-- CreateIndex
CREATE INDEX "User_selectedProviderConfigId_idx" ON "User"("selectedProviderConfigId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_selectedProviderConfigId_fkey" FOREIGN KEY ("selectedProviderConfigId") REFERENCES "ProviderConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
