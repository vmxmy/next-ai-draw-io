import { PrismaAdapter } from "@next-auth/prisma-adapter"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GitHubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
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

function getOptionalEnv(name: string): string | undefined {
    return process.env[name] || undefined
}

const credentialsSchema = z.object({
    phone: z.string().min(4),
    code: z.string().min(4),
})

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(db),
    debug:
        process.env.NEXTAUTH_DEBUG === "true" ||
        process.env.NODE_ENV === "development",
    logger: {
        error(code, metadata) {
            console.error("[next-auth][error]", code, metadata)
        },
        warn(code) {
            console.warn("[next-auth][warn]", code)
        },
        debug(code, metadata) {
            if (process.env.NEXTAUTH_DEBUG === "true") {
                console.debug("[next-auth][debug]", code, metadata)
            }
        },
    },
    providers: ((): any[] => {
        const providers: any[] = []

        // 添加手机验证码登录 Provider
        providers.push(
            CredentialsProvider({
                id: "phone",
                name: "Phone",
                credentials: {
                    phone: { label: "Phone", type: "tel" },
                    code: { label: "Verification Code", type: "text" },
                },
                async authorize(credentials) {
                    const parsed = credentialsSchema.safeParse(credentials)
                    if (!parsed.success) {
                        return null
                    }

                    const { phone, code } = parsed.data
                    const normalizedPhone = normalizePhoneNumber(phone)

                    if (!isValidPhoneNumber(normalizedPhone)) {
                        return null
                    }

                    const user = await db.user.findUnique({
                        where: { phone: normalizedPhone },
                    })

                    if (!user) {
                        return null
                    }

                    const verifyResult = await verifySmsCode(
                        normalizedPhone,
                        code,
                        SMS_VERIFICATION_PURPOSES.LOGIN_PHONE,
                    )

                    if (!verifyResult.ok) {
                        return null
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        phone: user.phone,
                    }
                },
            }),
        )

        const githubId = getOptionalEnv("GITHUB_ID")
        const githubSecret = getOptionalEnv("GITHUB_SECRET")
        if (githubId && githubSecret) {
            providers.push(
                GitHubProvider({
                    clientId: githubId,
                    clientSecret: githubSecret,
                }),
            )
        }

        const googleId = getOptionalEnv("GOOGLE_ID")
        const googleSecret = getOptionalEnv("GOOGLE_SECRET")
        if (googleId && googleSecret) {
            providers.push(
                GoogleProvider({
                    clientId: googleId,
                    clientSecret: googleSecret,
                }),
            )
        }

        return providers
    })(),
    pages: {
        signIn: "/auth/signin",
        error: "/auth/error",
    },
    callbacks: {
        session: ({ session, user }) => {
            if (session.user) {
                session.user.id = user.id
            }
            return session
        },
    },
}
