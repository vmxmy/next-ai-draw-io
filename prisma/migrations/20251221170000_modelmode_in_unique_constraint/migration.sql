-- Remove mode config fields from User table
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_fastModeConfigId_fkey";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_maxModeConfigId_fkey";
DROP INDEX IF EXISTS "User_fastModeConfigId_idx";
DROP INDEX IF EXISTS "User_maxModeConfigId_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "fastModeConfigId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "maxModeConfigId";

-- Add modelMode column to ProviderConfig (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ProviderConfig' AND column_name = 'modelMode') THEN
        ALTER TABLE "ProviderConfig" ADD COLUMN "modelMode" TEXT NOT NULL DEFAULT 'fast';
    END IF;
END $$;

-- Drop old unique constraint
DROP INDEX IF EXISTS "ProviderConfig_userId_provider_name_key";

-- Create new unique constraint with modelMode
CREATE UNIQUE INDEX "ProviderConfig_userId_provider_name_modelMode_key"
ON "ProviderConfig"("userId", "provider", "name", "modelMode");

-- Add index on modelMode
CREATE INDEX IF NOT EXISTS "ProviderConfig_modelMode_idx" ON "ProviderConfig"("modelMode");
