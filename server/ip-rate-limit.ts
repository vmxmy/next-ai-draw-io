import { createHash } from "node:crypto"
import { db } from "@/server/db"

type RateLimitBucketType = "day-requests" | "day-tokens" | "minute-tokens"

export class AnonymousIpRateLimitError extends Error {
    status = 429 as const
    constructor(message: string) {
        super(message)
        this.name = "AnonymousIpRateLimitError"
    }
}

function getLimitNumber(name: string): number {
    const raw = process.env[name]
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
}

function getUtcDayKey(now = new Date()): string {
    return now.toISOString().slice(0, 10)
}

function getMinuteKey(nowMs = Date.now()): string {
    return Math.floor(nowMs / 60_000).toString()
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

function hashIp(ip: string): string {
    const salt = process.env.RATE_LIMIT_SALT || ""
    return createHash("sha256").update(`${salt}${ip}`).digest("hex")
}

function shouldFailOpen(): boolean {
    // 默认 fail-open，避免限流表未迁移/数据库短暂不可用导致聊天接口全挂。
    return process.env.RATE_LIMIT_FAIL_OPEN !== "false"
}

async function readCount({
    ipHash,
    bucketType,
    bucketKey,
}: {
    ipHash: string
    bucketType: RateLimitBucketType
    bucketKey: string
}): Promise<bigint> {
    const row = await db.anonymousRateLimit.findUnique({
        where: {
            ipHash_bucketType_bucketKey: { ipHash, bucketType, bucketKey },
        },
        select: { count: true },
    })
    return row?.count ?? 0n
}

async function incrementCount({
    ipHash,
    bucketType,
    bucketKey,
    delta,
}: {
    ipHash: string
    bucketType: RateLimitBucketType
    bucketKey: string
    delta: bigint
}) {
    if (delta <= 0n) return
    await db.anonymousRateLimit.upsert({
        where: {
            ipHash_bucketType_bucketKey: { ipHash, bucketType, bucketKey },
        },
        create: { ipHash, bucketType, bucketKey, count: delta },
        update: { count: { increment: delta } },
        select: { count: true },
    })
}

export async function enforceAnonymousIpRateLimit({
    headers,
    bypass,
}: {
    headers: Headers
    bypass: boolean
}): Promise<{ enabled: boolean; ipHash: string } | null> {
    if (bypass) return null

    const dailyRequestLimit = getLimitNumber("DAILY_REQUEST_LIMIT")
    const dailyTokenLimit = getLimitNumber("DAILY_TOKEN_LIMIT")
    const tpmLimit = getLimitNumber("TPM_LIMIT")
    const enabled = dailyRequestLimit > 0 || dailyTokenLimit > 0 || tpmLimit > 0
    if (!enabled) return null

    const ip = getClientIpFromHeaders(headers)
    const ipHash = hashIp(ip)
    const dayKey = getUtcDayKey()
    const minuteKey = getMinuteKey()

    try {
        const [dayRequests, dayTokens, minuteTokens] = await Promise.all([
            dailyRequestLimit > 0
                ? readCount({
                      ipHash,
                      bucketType: "day-requests",
                      bucketKey: dayKey,
                  })
                : Promise.resolve(0n),
            dailyTokenLimit > 0
                ? readCount({
                      ipHash,
                      bucketType: "day-tokens",
                      bucketKey: dayKey,
                  })
                : Promise.resolve(0n),
            tpmLimit > 0
                ? readCount({
                      ipHash,
                      bucketType: "minute-tokens",
                      bucketKey: minuteKey,
                  })
                : Promise.resolve(0n),
        ])

        if (dailyRequestLimit > 0 && dayRequests >= BigInt(dailyRequestLimit)) {
            throw new AnonymousIpRateLimitError(
                "已达到今日请求次数上限，请明天再试或配置自己的 API Key。",
            )
        }
        if (dailyTokenLimit > 0 && dayTokens >= BigInt(dailyTokenLimit)) {
            throw new AnonymousIpRateLimitError(
                "已达到今日 Token 上限，请明天再试或配置自己的 API Key。",
            )
        }
        if (tpmLimit > 0 && minuteTokens >= BigInt(tpmLimit)) {
            throw new AnonymousIpRateLimitError(
                "触发 Token/分钟 限制，请稍后 60 秒再试或配置自己的 API Key。",
            )
        }

        if (dailyRequestLimit > 0) {
            await incrementCount({
                ipHash,
                bucketType: "day-requests",
                bucketKey: dayKey,
                delta: 1n,
            })
        }

        return { enabled: true, ipHash }
    } catch (error) {
        if (!shouldFailOpen()) throw error
        console.warn("[rate-limit] skipped due to error:", error)
        return null
    }
}

export async function recordAnonymousIpTokenUsage({
    ipHash,
    tokens,
}: {
    ipHash: string
    tokens: number
}) {
    const dailyTokenLimit = getLimitNumber("DAILY_TOKEN_LIMIT")
    const tpmLimit = getLimitNumber("TPM_LIMIT")
    const enabled = dailyTokenLimit > 0 || tpmLimit > 0
    if (!enabled) return

    const delta = BigInt(Math.max(0, Math.floor(tokens)))
    if (delta <= 0n) return

    const dayKey = getUtcDayKey()
    const minuteKey = getMinuteKey()

    try {
        await Promise.all([
            dailyTokenLimit > 0
                ? incrementCount({
                      ipHash,
                      bucketType: "day-tokens",
                      bucketKey: dayKey,
                      delta,
                  })
                : Promise.resolve(),
            tpmLimit > 0
                ? incrementCount({
                      ipHash,
                      bucketType: "minute-tokens",
                      bucketKey: minuteKey,
                      delta,
                  })
                : Promise.resolve(),
        ])
    } catch (error) {
        if (!shouldFailOpen()) throw error
        console.warn("[rate-limit] token usage not recorded:", error)
    }
}
