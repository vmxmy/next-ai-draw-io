import { NextResponse } from "next/server"
import { z } from "zod"
import {
    isValidPhoneNumber,
    normalizePhoneNumber,
} from "@/lib/validation/phone"
import { db } from "@/server/db"
import {
    SMS_VERIFICATION_PURPOSES,
    verifySmsCode,
} from "@/server/services/sms/verification"

const registerSchema = z.object({
    phone: z.string().min(4).max(32),
    code: z.string().min(4).max(10),
    name: z.string().trim().min(1).max(100).optional(),
})

export async function POST(request: Request) {
    try {
        const payload = await request.json().catch(() => null)
        const parsed = registerSchema.safeParse(payload)

        if (!parsed.success) {
            const issue = parsed.error.issues[0]
            return NextResponse.json(
                {
                    error: "INVALID_PAYLOAD",
                    detail: issue?.message,
                    field: issue?.path?.join("."),
                },
                { status: 400 },
            )
        }

        const normalizedPhone = normalizePhoneNumber(parsed.data.phone)
        if (!isValidPhoneNumber(normalizedPhone)) {
            return NextResponse.json(
                { error: "INVALID_PHONE" },
                { status: 400 },
            )
        }

        // 检查手机号是否已被注册
        const existing = await db.user.findUnique({
            where: { phone: normalizedPhone },
            select: { id: true },
        })

        if (existing) {
            return NextResponse.json({ error: "PHONE_IN_USE" }, { status: 409 })
        }

        // 验证验证码
        const verification = await verifySmsCode(
            normalizedPhone,
            parsed.data.code.trim(),
            SMS_VERIFICATION_PURPOSES.REGISTER_PHONE,
        )

        if (!verification.ok) {
            const errorCode =
                verification.reason === "EXPIRED"
                    ? "CODE_EXPIRED"
                    : verification.reason === "USED"
                      ? "CODE_USED"
                      : verification.reason === "NOT_FOUND"
                        ? "CODE_NOT_FOUND"
                        : "CODE_INVALID"
            return NextResponse.json({ error: errorCode }, { status: 400 })
        }

        const normalizedName =
            parsed.data.name && parsed.data.name.trim().length > 0
                ? parsed.data.name.trim()
                : null

        // 创建用户
        const user = await db.user.create({
            data: {
                phone: normalizedPhone,
                name: normalizedName,
            },
            select: {
                id: true,
                phone: true,
                name: true,
                email: true,
            },
        })

        return NextResponse.json({
            success: true,
            message: "REGISTERED",
            user,
        })
    } catch (error) {
        console.error("[auth][phone][register]", error)
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
    }
}
