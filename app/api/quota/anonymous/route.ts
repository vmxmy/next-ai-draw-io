import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { getClientIpFromHeaders } from "@/server/quota-enforcement"

function hashIp(ip: string): string {
    const salt = process.env.RATE_LIMIT_SALT || ""
    return createHash("sha256").update(`${salt}${ip}`).digest("hex")
}

function getUtcDayKey(now = new Date()): string {
    return now.toISOString().slice(0, 10)
}

function getMinuteKey(nowMs = Date.now()): string {
    return Math.floor(nowMs / 60_000).toString()
}

export async function GET(request: Request) {
    try {
        // 获取客户端 IP 并哈希
        const ip = getClientIpFromHeaders(new Headers(request.headers))
        const ipHash = hashIp(ip)

        // 获取 anonymous 等级配置
        const anonymousConfig = await db.tierConfig.findUnique({
            where: { tier: "anonymous" },
        })

        if (!anonymousConfig) {
            return NextResponse.json(
                { error: "Anonymous tier configuration not found" },
                { status: 500 },
            )
        }

        const dayKey = getUtcDayKey()
        const minuteKey = getMinuteKey()

        // 查询当前使用量
        const [dayRequests, dayTokens, minuteTokens] = await Promise.all([
            db.anonymousRateLimit.findUnique({
                where: {
                    ipHash_bucketType_bucketKey: {
                        ipHash,
                        bucketType: "day-requests",
                        bucketKey: dayKey,
                    },
                },
                select: { count: true },
            }),
            db.anonymousRateLimit.findUnique({
                where: {
                    ipHash_bucketType_bucketKey: {
                        ipHash,
                        bucketType: "day-tokens",
                        bucketKey: dayKey,
                    },
                },
                select: { count: true },
            }),
            db.anonymousRateLimit.findUnique({
                where: {
                    ipHash_bucketType_bucketKey: {
                        ipHash,
                        bucketType: "minute-tokens",
                        bucketKey: minuteKey,
                    },
                },
                select: { count: true },
            }),
        ])

        return NextResponse.json({
            config: {
                dailyRequestLimit: anonymousConfig.dailyRequestLimit,
                dailyTokenLimit: Number(anonymousConfig.dailyTokenLimit),
                tpmLimit: anonymousConfig.tpmLimit,
            },
            usage: {
                dailyRequests: Number(dayRequests?.count ?? 0n),
                dailyTokens: Number(dayTokens?.count ?? 0n),
                minuteTokens: Number(minuteTokens?.count ?? 0n),
            },
        })
    } catch (error) {
        console.error("[api/quota/anonymous] Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch quota information" },
            { status: 500 },
        )
    }
}
