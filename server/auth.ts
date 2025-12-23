import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { Prisma } from "@prisma/client"
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

const BOOTSTRAP_SUPERADMIN_LOCK_KEY = "bootstrap.superAdminAssigned"

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
    events: {
        async signIn({ user }) {
            try {
                await bootstrapSuperAdminIfNeeded(user)
            } catch (error) {
                console.error(
                    "[auth][bootstrap] Failed to bootstrap admin:",
                    error,
                )
            }
        },
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

function isBootstrapAdminEnabled(): boolean {
    return process.env.BOOTSTRAP_ADMIN_ENABLED === "true"
}

function parseBootstrapAllowlist(): string[] {
    return (process.env.BOOTSTRAP_ADMIN_ALLOWLIST || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
}

function userMatchesBootstrapAllowlist(user: {
    email?: string | null
    phone?: string | null
}): boolean {
    const allowlist = parseBootstrapAllowlist()
    if (allowlist.length === 0) return true

    const email = user.email?.trim() || ""
    const phone = user.phone?.trim() || ""

    return allowlist.includes(email) || allowlist.includes(phone)
}

async function ensureSuperAdminRole(
    tx: Prisma.TransactionClient,
): Promise<{ roleId: string; permissionId: string }> {
    const permission = await tx.permission.upsert({
        where: { name: "*" },
        update: {
            resource: "*",
            action: "*",
            description: "所有权限（超级管理员专用）",
        },
        create: {
            name: "*",
            resource: "*",
            action: "*",
            description: "所有权限（超级管理员专用）",
        },
    })

    const role = await tx.role.upsert({
        where: { name: "superAdmin" },
        update: {
            displayName: "超级管理员",
            description: "拥有所有权限，可管理系统的所有方面",
        },
        create: {
            name: "superAdmin",
            displayName: "超级管理员",
            description: "拥有所有权限，可管理系统的所有方面",
        },
    })

    const roleWithPerms = await tx.role.findUnique({
        where: { id: role.id },
        include: { permissions: true },
    })

    const hasWildcard = roleWithPerms?.permissions.some((p) => p.name === "*")
    if (!hasWildcard) {
        await tx.role.update({
            where: { id: role.id },
            data: {
                permissions: {
                    connect: [{ id: permission.id }],
                },
            },
        })
    }

    return { roleId: role.id, permissionId: permission.id }
}

/**
 * Bootstrap：当系统尚未分配过 superAdmin 时，
 * 将首个“成功登录”的用户授予 superAdmin。
 *
 * 安全控制：
 * - 仅在 BOOTSTRAP_ADMIN_ENABLED=true 时启用
 * - 可用 BOOTSTRAP_ADMIN_ALLOWLIST 限制可领取首个 superAdmin 的邮箱/手机号
 * - 使用 SystemConfig 作为一次性锁，避免并发抢占导致多用户同时成为首个 superAdmin
 */
async function bootstrapSuperAdminIfNeeded(user: {
    id: string
    email?: string | null
    phone?: string | null
}): Promise<void> {
    if (!isBootstrapAdminEnabled()) return
    if (!userMatchesBootstrapAllowlist(user)) return

    const didBootstrap = await db.$transaction(async (tx) => {
        const existing = await tx.userRole.findFirst({
            where: { role: { name: "superAdmin" } },
            select: { id: true },
        })
        if (existing) return false

        try {
            await tx.systemConfig.create({
                data: {
                    key: BOOTSTRAP_SUPERADMIN_LOCK_KEY,
                    category: "general",
                    description:
                        "Bootstrap lock: first superAdmin role assignment",
                    value: {
                        userId: user.id,
                        email: user.email || null,
                        phone: user.phone || null,
                        createdAt: new Date().toISOString(),
                    },
                },
            })
        } catch (error) {
            // 已被其他并发登录抢先写入锁
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            ) {
                return false
            }
            throw error
        }

        const { roleId } = await ensureSuperAdminRole(tx)

        await tx.userRole.upsert({
            where: {
                userId_roleId: {
                    userId: user.id,
                    roleId,
                },
            },
            update: {},
            create: {
                userId: user.id,
                roleId,
            },
        })

        return true
    })

    if (didBootstrap) {
        console.log(
            `[auth][bootstrap] Granted superAdmin to first user: ${user.id}`,
        )
    }
}
