-- Drop modelMode related constraints and column from ProviderConfig
DROP INDEX IF EXISTS "ProviderConfig_userId_modelMode_key";
DROP INDEX IF EXISTS "ProviderConfig_modelMode_idx";
ALTER TABLE "ProviderConfig" DROP COLUMN IF EXISTS "modelMode";

-- Add mode config fields to User table
ALTER TABLE "User" ADD COLUMN "fastModeConfigId" TEXT;
ALTER TABLE "User" ADD COLUMN "maxModeConfigId" TEXT;

-- Add foreign key constraints
ALTER TABLE "User" ADD CONSTRAINT "User_fastModeConfigId_fkey" FOREIGN KEY ("fastModeConfigId") REFERENCES "ProviderConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_maxModeConfigId_fkey" FOREIGN KEY ("maxModeConfigId") REFERENCES "ProviderConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "User_fastModeConfigId_idx" ON "User"("fastModeConfigId");
CREATE INDEX "User_maxModeConfigId_idx" ON "User"("maxModeConfigId");
