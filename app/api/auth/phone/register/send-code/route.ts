import { NextResponse } from "next/server"
import { z } from "zod"
import {
    isValidPhoneNumber,
    normalizePhoneNumber,
} from "@/lib/validation/phone"
import { db } from "@/server/db"
import { sendPhoneRegistrationCode } from "@/server/services/sms/verification"

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

        // 检查手机号是否已被注册
        const existing = await db.user.findUnique({
            where: { phone: normalized },
            select: { id: true },
        })

        if (existing) {
            return NextResponse.json({ error: "PHONE_IN_USE" }, { status: 409 })
        }

        const { code, resendAvailableAt } =
            await sendPhoneRegistrationCode(normalized)

        return NextResponse.json({
            success: true,
            resendAvailableAt,
            debugCode: process.env.NODE_ENV !== "production" ? code : undefined,
        })
    } catch (error) {
        console.error("[auth][phone][register][send-code]", error)
        return NextResponse.json({ error: "SMS_FAILED" }, { status: 502 })
    }
}
