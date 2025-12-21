-- Restore userId + provider + name unique constraint
CREATE UNIQUE INDEX "ProviderConfig_userId_provider_name_key" ON "ProviderConfig"("userId", "provider", "name");
