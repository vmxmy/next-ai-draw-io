import { createHash } from "node:crypto"
import { db } from "@/server/db"
import { withDbRetry } from "@/server/db-retry"

type RateLimitBucketType = "day-requests" | "day-tokens" | "minute-tokens"

export class QuotaExceededError extends Error {
    status = 429 as const
    constructor(message: string) {
        super(message)
        this.name = "QuotaExceededError"
    }
}

function getUtcDayKey(now = new Date()): string {
    return now.toISOString().slice(0, 10)
}

function getMinuteKey(nowMs = Date.now()): string {
    return Math.floor(nowMs / 60_000).toString()
}

function hashIp(ip: string): string {
    const salt = process.env.RATE_LIMIT_SALT || ""
    return createHash("sha256").update(`${salt}${ip}`).digest("hex")
}

export function getClientIpFromHeaders(headers: Headers): string {
    const vercel = headers.get("x-vercel-forwarded-for")
    if (vercel) return vercel.split(",")[0]?.trim() || "unknown"

    const forwardedFor = headers.get("x-forwarded-for")
    if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown"

    const realIp = headers.get("x-real-ip")
    if (realIp) return realIp.trim() || "unknown"

    return "unknown"
}

interface QuotaLimits {
    dailyRequestLimit: number
    dailyTokenLimit: number
    tpmLimit: number
}

export interface QuotaContext {
    userId?: string
    ipHash: string
    tier: string
    limits: QuotaLimits
}

/**
 * 从数据库获取用户的配额限制
 * - 登录用户：返回用户等级配置
 * - 匿名用户：返回 anonymous 等级配置
 */
async function getUserQuotaLimits(userId?: string): Promise<{
    tier: string
    limits: QuotaLimits
}> {
    // 登录用户：从数据库获取用户等级
    if (userId) {
        const user = await withDbRetry(() =>
            db.user.findUnique({
                where: { id: userId },
                select: { tier: true, tierExpiresAt: true },
            }),
        )

        // 检查等级是否过期（如有设置）
        let effectiveTier = user?.tier || "free"
        if (user?.tierExpiresAt && user.tierExpiresAt < new Date()) {
            effectiveTier = "free" // 过期后降级为 free
        }

        const tierConfig = await withDbRetry(() =>
            db.tierConfig.findUnique({
                where: { tier: effectiveTier },
            }),
        )

        if (!tierConfig) {
            throw new Error(
                `Tier configuration not found for tier: ${effectiveTier}`,
            )
        }

        if (!tierConfig.enabled) {
            throw new Error(`Tier "${effectiveTier}" is currently disabled`)
        }

        return {
            tier: effectiveTier,
            limits: {
                dailyRequestLimit: tierConfig.dailyRequestLimit,
                dailyTokenLimit: Number(tierConfig.dailyTokenLimit),
                tpmLimit: tierConfig.tpmLimit,
            },
        }
    }

    // 匿名用户：使用 anonymous 等级配置
    const anonymousConfig = await withDbRetry(() =>
        db.tierConfig.findUnique({
            where: { tier: "anonymous" },
        }),
    )

    if (!anonymousConfig) {
        throw new Error("Anonymous tier configuration not found")
    }

    if (!anonymousConfig.enabled) {
        throw new Error("Anonymous tier is currently disabled")
    }

    return {
        tier: "anonymous",
        limits: {
            dailyRequestLimit: anonymousConfig.dailyRequestLimit,
            dailyTokenLimit: Number(anonymousConfig.dailyTokenLimit),
            tpmLimit: anonymousConfig.tpmLimit,
        },
    }
}

/**
 * 读取用户或匿名 IP 的配额使用量
 */
async function readQuotaCount({
    userId,
    ipHash,
    bucketType,
    bucketKey,
}: {
    userId?: string
    ipHash: string
    bucketType: RateLimitBucketType
    bucketKey: string
}): Promise<bigint> {
    return withDbRetry(async () => {
        if (userId) {
            const row = await db.userQuotaUsage.findUnique({
                where: {
                    userId_bucketType_bucketKey: {
                        userId,
                        bucketType,
                        bucketKey,
                    },
                },
                select: { count: true },
            })
            return row?.count ?? 0n
        } else {
            const row = await db.anonymousRateLimit.findUnique({
                where: {
                    ipHash_bucketType_bucketKey: {
                        ipHash,
                        bucketType,
                        bucketKey,
                    },
                },
                select: { count: true },
            })
            return row?.count ?? 0n
        }
    })
}

/**
 * 增加用户或匿名 IP 的配额使用量
 */
async function incrementQuotaCount({
    userId,
    ipHash,
    bucketType,
    bucketKey,
    delta,
}: {
    userId?: string
    ipHash: string
    bucketType: RateLimitBucketType
    bucketKey: string
    delta: bigint
}) {
    if (delta <= 0n) return

    return withDbRetry(async () => {
        if (userId) {
            await db.userQuotaUsage.upsert({
                where: {
                    userId_bucketType_bucketKey: {
                        userId,
                        bucketType,
                        bucketKey,
                    },
                },
                create: { userId, bucketType, bucketKey, count: delta },
                update: { count: { increment: delta } },
            })
        } else {
            await db.anonymousRateLimit.upsert({
                where: {
                    ipHash_bucketType_bucketKey: {
                        ipHash,
                        bucketType,
                        bucketKey,
                    },
                },
                create: { ipHash, bucketType, bucketKey, count: delta },
                update: { count: { increment: delta } },
            })
        }
    })
}

/**
 * 主函数：强制执行配额限制
 * 返回配额上下文，供后续记录使用
 */
export async function enforceQuotaLimit({
    headers,
    userId,
    bypassBYOK,
}: {
    headers: Headers
    userId?: string
    bypassBYOK: boolean
}): Promise<QuotaContext | null> {
    // BYOK 用户绕过所有限额
    if (bypassBYOK) return null

    const ip = getClientIpFromHeaders(headers)
    const ipHash = hashIp(ip)

    // 获取配额限制
    const { tier, limits } = await getUserQuotaLimits(userId)
    const { dailyRequestLimit, dailyTokenLimit, tpmLimit } = limits

    // 如果所有限额都为 0，表示无限制
    const enabled = dailyRequestLimit > 0 || dailyTokenLimit > 0 || tpmLimit > 0
    if (!enabled) return null

    const dayKey = getUtcDayKey()
    const minuteKey = getMinuteKey()

    try {
        // 读取当前使用量
        const [dayRequests, dayTokens, minuteTokens] = await Promise.all([
            dailyRequestLimit > 0
                ? readQuotaCount({
                      userId,
                      ipHash,
                      bucketType: "day-requests",
                      bucketKey: dayKey,
                  })
                : Promise.resolve(0n),
            dailyTokenLimit > 0
                ? readQuotaCount({
                      userId,
                      ipHash,
                      bucketType: "day-tokens",
                      bucketKey: dayKey,
                  })
                : Promise.resolve(0n),
            tpmLimit > 0
                ? readQuotaCount({
                      userId,
                      ipHash,
                      bucketType: "minute-tokens",
                      bucketKey: minuteKey,
                  })
                : Promise.resolve(0n),
        ])

        // 检查是否超限
        if (dailyRequestLimit > 0 && dayRequests >= BigInt(dailyRequestLimit)) {
            throw new QuotaExceededError(
                `已达到今日请求次数上限（${dailyRequestLimit}），请明天再试或升级您的等级。`,
            )
        }
        if (dailyTokenLimit > 0 && dayTokens >= BigInt(dailyTokenLimit)) {
            throw new QuotaExceededError(
                `已达到今日 Token 上限（${dailyTokenLimit}），请明天再试或升级您的等级。`,
            )
        }
        if (tpmLimit > 0 && minuteTokens >= BigInt(tpmLimit)) {
            throw new QuotaExceededError(
                `触发 Token/分钟 限制（${tpmLimit}），请稍后 60 秒再试。`,
            )
        }

        // 增加请求计数
        if (dailyRequestLimit > 0) {
            await incrementQuotaCount({
                userId,
                ipHash,
                bucketType: "day-requests",
                bucketKey: dayKey,
                delta: 1n,
            })
        }

        return { userId, ipHash, tier, limits }
    } catch (error) {
        // Fail-open：避免数据库故障导致服务完全不可用
        const failOpen = process.env.RATE_LIMIT_FAIL_OPEN !== "false"
        if (failOpen && !(error instanceof QuotaExceededError)) {
            console.warn("[quota-enforcement] Error, failing open:", error)
            return null
        }
        throw error
    }
}

/**
 * 记录 Token 使用量
 */
export async function recordTokenUsage({
    context,
    tokens,
}: {
    context: QuotaContext | null
    tokens: number
}) {
    if (!context) return
    if (tokens <= 0) return

    const { userId, ipHash, limits } = context
    const { dailyTokenLimit, tpmLimit } = limits

    if (dailyTokenLimit === 0 && tpmLimit === 0) return

    const delta = BigInt(Math.max(0, Math.floor(tokens)))
    if (delta <= 0n) return

    const dayKey = getUtcDayKey()
    const minuteKey = getMinuteKey()

    try {
        await Promise.all([
            dailyTokenLimit > 0
                ? incrementQuotaCount({
                      userId,
                      ipHash,
                      bucketType: "day-tokens",
                      bucketKey: dayKey,
                      delta,
                  })
                : Promise.resolve(),
            tpmLimit > 0
                ? incrementQuotaCount({
                      userId,
                      ipHash,
                      bucketType: "minute-tokens",
                      bucketKey: minuteKey,
                      delta,
                  })
                : Promise.resolve(),
        ])
    } catch (error) {
        const failOpen = process.env.RATE_LIMIT_FAIL_OPEN !== "false"
        if (failOpen) {
            console.warn("[quota-enforcement] Token recording failed:", error)
            return
        }
        throw error
    }
}
