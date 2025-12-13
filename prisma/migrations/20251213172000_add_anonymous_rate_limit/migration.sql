-- CreateTable
CREATE TABLE "AnonymousRateLimit" (
    "ipHash" TEXT NOT NULL,
    "bucketType" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "count" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnonymousRateLimit_pkey" PRIMARY KEY ("ipHash","bucketType","bucketKey")
);

-- CreateIndex
CREATE INDEX "AnonymousRateLimit_bucketType_bucketKey_idx" ON "AnonymousRateLimit"("bucketType", "bucketKey");

-- CreateIndex
CREATE INDEX "AnonymousRateLimit_ipHash_updatedAt_idx" ON "AnonymousRateLimit"("ipHash", "updatedAt");
