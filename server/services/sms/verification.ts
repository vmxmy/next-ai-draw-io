import { createHash, randomInt } from "crypto"
import { db } from "@/server/db"

const CODE_LENGTH = 6
const RESEND_WINDOW_SECONDS = 60
const TTL_MINUTES = 10

export const SMS_VERIFICATION_PURPOSES = {
    REGISTER_PHONE: "register_phone",
    LOGIN_PHONE: "login_phone",
} as const

export type SmsVerificationPurpose =
    (typeof SMS_VERIFICATION_PURPOSES)[keyof typeof SMS_VERIFICATION_PURPOSES]

const hashCode = (code: string) =>
    createHash("sha256").update(code).digest("hex")

const generateCode = () =>
    randomInt(0, 10 ** CODE_LENGTH)
        .toString()
        .padStart(CODE_LENGTH, "0")

async function sendSmsMessage(phone: string, message: string) {
    // 开发环境：直接在控制台输出验证码
    if (process.env.NODE_ENV !== "production") {
        console.log(`[SMS] Sending to ${phone}: ${message}`)
        return
    }

    // 生产环境：这里可以集成真实的 SMS 服务提供商
    // 例如：Twilio, Aliyun SMS, Tencent Cloud SMS 等
    // TODO: 集成 SMS 服务提供商
    console.warn("[SMS] SMS service not configured in production")
}

export async function sendPhoneLoginCode(phone: string) {
    return issueVerificationCode(phone, SMS_VERIFICATION_PURPOSES.LOGIN_PHONE)
}

export async function sendPhoneRegistrationCode(phone: string) {
    return issueVerificationCode(
        phone,
        SMS_VERIFICATION_PURPOSES.REGISTER_PHONE,
    )
}

async function issueVerificationCode(
    phone: string,
    purpose: SmsVerificationPurpose,
) {
    const code = generateCode()
    const message = `【AI Draw.io】Your verification code is ${code}, valid for ${TTL_MINUTES} minutes. Do not share it with anyone.`

    await sendSmsMessage(phone, message)

    const now = Date.now()
    const expiresAt = new Date(now + TTL_MINUTES * 60 * 1000)

    // 删除旧的未使用的验证码，创建新的验证码
    await Promise.all([
        db.smsVerificationCode.deleteMany({
            where: {
                phone,
                purpose,
            },
        }),
        db.smsVerificationCode.create({
            data: {
                phone,
                purpose,
                codeHash: hashCode(code),
                expiresAt,
            },
        }),
    ])

    return { code, resendAvailableAt: now + RESEND_WINDOW_SECONDS * 1000 }
}

export type VerifySmsCodeResult =
    | { ok: true }
    | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "USED" | "INVALID" }

export async function verifySmsCode(
    phone: string,
    code: string,
    purpose: SmsVerificationPurpose,
): Promise<VerifySmsCodeResult> {
    const record = await db.smsVerificationCode.findFirst({
        where: { phone, purpose },
        orderBy: { createdAt: "desc" },
    })

    if (!record) {
        return { ok: false, reason: "NOT_FOUND" }
    }

    if (record.verifiedAt) {
        return { ok: false, reason: "USED" }
    }

    if (record.expiresAt < new Date()) {
        return { ok: false, reason: "EXPIRED" }
    }

    if (hashCode(code) !== record.codeHash) {
        await db.smsVerificationCode.update({
            where: { id: record.id },
            data: { attemptCount: { increment: 1 } },
        })
        return { ok: false, reason: "INVALID" }
    }

    // 验证成功：标记为已验证，删除其他旧的验证码
    await Promise.all([
        db.smsVerificationCode.update({
            where: { id: record.id },
            data: { verifiedAt: new Date() },
        }),
        db.smsVerificationCode.deleteMany({
            where: {
                phone,
                purpose,
                NOT: { id: record.id },
            },
        }),
    ])

    return { ok: true }
}
