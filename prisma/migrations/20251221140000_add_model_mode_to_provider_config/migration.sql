-- Add modelMode column to ProviderConfig
ALTER TABLE "ProviderConfig" ADD COLUMN "modelMode" TEXT NOT NULL DEFAULT 'fast';

-- Drop old unique constraint
DROP INDEX IF EXISTS "ProviderConfig_userId_provider_name_key";

-- For existing data: keep only one record per user (the most recently updated one) as 'fast'
-- Delete duplicates keeping only the latest per user
DELETE FROM "ProviderConfig" a
USING "ProviderConfig" b
WHERE a."userId" = b."userId"
  AND a."updatedAt" < b."updatedAt";

-- Add new unique constraint (userId + modelMode)
CREATE UNIQUE INDEX "ProviderConfig_userId_modelMode_key" ON "ProviderConfig"("userId", "modelMode");

-- Add index on modelMode
CREATE INDEX "ProviderConfig_modelMode_idx" ON "ProviderConfig"("modelMode");
