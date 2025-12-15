-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tier" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "tierExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TierConfig" (
    "tier" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dailyRequestLimit" INTEGER NOT NULL DEFAULT 0,
    "dailyTokenLimit" BIGINT NOT NULL DEFAULT 0,
    "tpmLimit" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierConfig_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "UserQuotaUsage" (
    "userId" TEXT NOT NULL,
    "bucketType" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "count" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserQuotaUsage_pkey" PRIMARY KEY ("userId","bucketType","bucketKey")
);

-- CreateIndex
CREATE INDEX "TierConfig_enabled_sortOrder_idx" ON "TierConfig"("enabled", "sortOrder");

-- CreateIndex
CREATE INDEX "UserQuotaUsage_bucketType_bucketKey_idx" ON "UserQuotaUsage"("bucketType", "bucketKey");

-- CreateIndex
CREATE INDEX "UserQuotaUsage_userId_updatedAt_idx" ON "UserQuotaUsage"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "User_tier_idx" ON "User"("tier");

-- CreateIndex
CREATE INDEX "User_tierExpiresAt_idx" ON "User"("tierExpiresAt");

-- AddForeignKey
ALTER TABLE "UserQuotaUsage" ADD CONSTRAINT "UserQuotaUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
