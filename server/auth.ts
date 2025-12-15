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
    session: {
        strategy: "jwt",
    },
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

                    // 验证验证码
                    const verifyResult = await verifySmsCode(
                        normalizedPhone,
                        code,
                        SMS_VERIFICATION_PURPOSES.LOGIN_PHONE,
                    )

                    if (!verifyResult.ok) {
                        return null
                    }

                    // 查找或创建用户（自动注册）
                    let user = await db.user.findUnique({
                        where: { phone: normalizedPhone },
                    })

                    if (!user) {
                        // 用户不存在，自动创建
                        user = await db.user.create({
                            data: {
                                phone: normalizedPhone,
                                name: `用户${normalizedPhone.slice(-4)}`,
                            },
                        })
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
        async jwt({ token, user, account }) {
            // 初次登录时，将用户信息添加到 token
            if (user) {
                token.id = user.id
                token.phone = user.phone
            }
            // OAuth 登录时，从数据库获取 phone 信息
            if (account && account.provider !== "phone" && token.id) {
                const dbUser = await db.user.findUnique({
                    where: { id: token.id as string },
                    select: { phone: true },
                })
                if (dbUser) {
                    token.phone = dbUser.phone
                }
            }
            return token
        },
        session: ({ session, token }) => {
            if (session.user && token) {
                session.user.id = token.id as string
                session.user.phone = token.phone as string | null
            }
            return session
        },
    },
}
