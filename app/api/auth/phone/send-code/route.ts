import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import {
    isValidPhoneNumber,
    normalizePhoneNumber,
} from "@/lib/validation/phone"
import { sendPhoneLoginCode } from "@/server/services/sms/verification"

const requestSchema = z.object({
    phone: z.string().min(4).max(32),
})

// SMS 发送速率限制配置
const SMS_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 小时
const SMS_RATE_LIMIT_MAX_REQUESTS = 5 // 每小时每 IP 最多 5 次

// 简单的内存缓存，用于速率限制
// 注意：在多实例部署时需要使用 Redis 等分布式缓存
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>()

function getClientIp(request: Request): string {
    const forwardedFor = request.headers.get("x-forwarded-for")
    if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown"
    const realIp = request.headers.get("x-real-ip")
    if (realIp) return realIp.trim() || "unknown"
    return "unknown"
}

function hashIp(ip: string): string {
    const salt = process.env.RATE_LIMIT_SALT || ""
    return createHash("sha256").update(`sms:${salt}${ip}`).digest("hex")
}

function checkSmsRateLimit(ipHash: string): {
    allowed: boolean
    retryAfter?: number
} {
    const now = Date.now()
    const record = ipRequestCounts.get(ipHash)

    // 清理过期记录
    if (record && now >= record.resetAt) {
        ipRequestCounts.delete(ipHash)
    }

    const current = ipRequestCounts.get(ipHash)
    if (!current) {
        ipRequestCounts.set(ipHash, {
            count: 1,
            resetAt: now + SMS_RATE_LIMIT_WINDOW_MS,
        })
        return { allowed: true }
    }

    if (current.count >= SMS_RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.ceil((current.resetAt - now) / 1000)
        return { allowed: false, retryAfter }
    }

    current.count++
    return { allowed: true }
}

export async function POST(request: Request) {
    try {
        // IP 速率限制检查
        const ip = getClientIp(request)
        const ipHash = hashIp(ip)
        const rateLimit = checkSmsRateLimit(ipHash)

        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: "RATE_LIMITED",
                    message: `请求过于频繁，请 ${rateLimit.retryAfter} 秒后重试`,
                    retryAfter: rateLimit.retryAfter,
                },
                { status: 429 },
            )
        }

        const body = await request.json().catch(() => null)
        const parsed = requestSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: "INVALID_PAYLOAD" },
                { status: 400 },
            )
        }

        const normalized = normalizePhoneNumber(parsed.data.phone)
        if (!isValidPhoneNumber(normalized)) {
            return NextResponse.json(
                { error: "INVALID_PHONE" },
                { status: 400 },
            )
        }

        // 统一发送验证码，不检查用户是否存在（支持自动注册）
        const { code, resendAvailableAt } = await sendPhoneLoginCode(normalized)

        return NextResponse.json({
            success: true,
            resendAvailableAt,
            debugCode: process.env.NODE_ENV !== "production" ? code : undefined,
        })
    } catch (error) {
        console.error("[auth][phone][send-code]", error)
        return NextResponse.json({ error: "SMS_FAILED" }, { status: 502 })
    }
}
