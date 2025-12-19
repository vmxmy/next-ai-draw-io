-- Provider 默认配置目录（系统级）
CREATE TABLE "ProviderCatalog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "compatibility" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "defaultBaseUrl" TEXT,
    "defaultModelId" TEXT,
    "defaultHeaders" JSONB,
    "defaultParams" JSONB,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCatalog_pkey" PRIMARY KEY ("id")
);

-- Unique key for provider catalog
CREATE UNIQUE INDEX "ProviderCatalog_key_key" ON "ProviderCatalog"("key");
CREATE INDEX "ProviderCatalog_isActive_idx" ON "ProviderCatalog"("isActive");

-- ProviderConfig: 统一凭证 + 多连接 + 默认连接
ALTER TABLE "ProviderConfig" RENAME COLUMN "encryptedApiKey" TO "encryptedCredentials";
ALTER TABLE "ProviderConfig" RENAME COLUMN "encryptionIv" TO "credentialsIv";
ALTER TABLE "ProviderConfig" RENAME COLUMN "authTag" TO "credentialsAuthTag";
ALTER TABLE "ProviderConfig" RENAME COLUMN "keyVersion" TO "credentialsVersion";

ALTER TABLE "ProviderConfig"
    ADD COLUMN "name" TEXT NOT NULL DEFAULT 'default',
    ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "headers" JSONB,
    ADD COLUMN "extraConfig" JSONB,
    ADD COLUMN "credentialType" TEXT NOT NULL DEFAULT 'apiKey',
    ADD COLUMN "orgId" TEXT,
    ADD COLUMN "apiVersion" TEXT,
    ADD COLUMN "region" TEXT,
    ADD COLUMN "resourceName" TEXT;

-- 旧数据标记为默认连接
UPDATE "ProviderConfig" SET "isDefault" = true;
-- 如果无凭证，设置为 none
UPDATE "ProviderConfig"
SET "credentialType" = CASE
    WHEN "encryptedCredentials" IS NULL THEN 'none'
    ELSE 'apiKey'
END;

-- 更新索引与唯一约束
DROP INDEX IF EXISTS "ProviderConfig_userId_provider_key";
DROP INDEX IF EXISTS "ProviderConfig_keyVersion_idx";

CREATE UNIQUE INDEX "ProviderConfig_userId_provider_name_key"
    ON "ProviderConfig"("userId", "provider", "name");
CREATE INDEX "ProviderConfig_provider_idx" ON "ProviderConfig"("provider");
CREATE INDEX "ProviderConfig_credentialsVersion_idx"
    ON "ProviderConfig"("credentialsVersion");

-- 同一用户同一 provider 仅允许一个默认连接
CREATE UNIQUE INDEX "ProviderConfig_userId_provider_default_key"
    ON "ProviderConfig"("userId", "provider")
    WHERE "isDefault" = true;
