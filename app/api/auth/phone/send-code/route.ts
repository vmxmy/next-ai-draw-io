import { NextResponse } from "next/server"
import { z } from "zod"
import {
    isValidPhoneNumber,
    normalizePhoneNumber,
} from "@/lib/validation/phone"
import { db } from "@/server/db"
import { sendPhoneLoginCode } from "@/server/services/sms/verification"

const requestSchema = z.object({
    phone: z.string().min(4).max(32),
})

export async function POST(request: Request) {
    try {
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
