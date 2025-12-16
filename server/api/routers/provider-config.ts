import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { decryptApiKey, encryptApiKey } from "@/server/encryption"

// Provider 枚举（与 lib/ai-providers.ts 对齐）
const providerEnum = z.enum([
    "bedrock",
    "openai",
    "anthropic",
    "google",
    "azure",
    "ollama",
    "openrouter",
    "deepseek",
    "siliconflow",
])

// Base URL 白名单配置（防止 SSRF 攻击）
const ALLOWED_BASE_URLS: Record<string, string[] | RegExp> = {
    openai: ["https://api.openai.com"],
    anthropic: ["https://api.anthropic.com"],
    google: [
        "https://generativelanguage.googleapis.com",
        "https://ai.google.dev",
    ],
    azure: /^https:\/\/[a-z0-9-]+\.openai\.azure\.com$/i,
    ollama: /^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\d+)?$/,
    openrouter: ["https://openrouter.ai"],
    deepseek: ["https://api.deepseek.com"],
    siliconflow: ["https://api.siliconflow.com", "https://api.siliconflow.cn"],
}

/**
 * 验证 Base URL 是否在允许的白名单中
 * 防止 SSRF 攻击和访问内部资源
 */
function validateBaseUrl(provider: string, baseUrl: string): boolean {
    if (!baseUrl) return true // 空值允许（使用默认）

    const allowed = ALLOWED_BASE_URLS[provider]
    if (!allowed) {
        // Provider 不在白名单中，拒绝自定义 base URL
        return false
    }

    try {
        const url = new URL(baseUrl)

        // 安全检查：禁止非 HTTPS（除了 localhost 的 ollama）
        if (url.protocol !== "https:") {
            const isLocalhost =
                url.hostname === "localhost" ||
                url.hostname === "127.0.0.1" ||
                url.hostname === "::1"
            if (!(provider === "ollama" && isLocalhost)) {
                return false
            }
        }

        // 禁止内部网络地址
        const hostname = url.hostname.toLowerCase()
        const forbiddenPatterns = [
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[01])\./,
            /^192\.168\./,
            /^169\.254\./,
            /\.local$/,
            /\.internal$/,
        ]

        for (const pattern of forbiddenPatterns) {
            if (pattern.test(hostname)) {
                // 例外：ollama 允许 localhost
                if (
                    !(
                        provider === "ollama" &&
                        hostname.match(/^(localhost|127\.0\.0\.1|::1)$/)
                    )
                ) {
                    return false
                }
            }
        }

        // 检查白名单
        if (Array.isArray(allowed)) {
            return allowed.some((allowedUrl) => baseUrl.startsWith(allowedUrl))
        }
        return allowed.test(baseUrl)
    } catch {
        return false
    }
}

// 输入验证 Schema（增强安全性）
const upsertInputSchema = z
    .object({
        provider: providerEnum,
        apiKey: z
            .string()
            .min(1)
            .max(1000, "API key too long")
            .regex(
                /^[A-Za-z0-9_\-./:+=]+$/,
                "API key contains invalid characters",
            )
            .optional(),
        baseUrl: z.string().url().max(500).optional().or(z.literal("")),
        modelId: z.string().max(200).optional(),
    })
    .refine(
        (data) => {
            if (data.baseUrl && data.baseUrl !== "") {
                return validateBaseUrl(data.provider, data.baseUrl)
            }
            return true
        },
        {
            message: "Base URL not allowed for this provider",
            path: ["baseUrl"],
        },
    )

/**
 * 生成 API Key 的脱敏预览
 * 例如：sk-proj-1234567890abcdef -> sk-***def
 */
function generateApiKeyPreview(apiKey: string): string {
    if (apiKey.length <= 8) return "***"

    const prefix = apiKey.slice(0, 3)
    const suffix = apiKey.slice(-3)

    return `${prefix}***${suffix}`
}

export const providerConfigRouter = createTRPCRouter({
    /**
     * 获取特定 provider 的配置
     */
    get: protectedProcedure
        .input(z.object({ provider: providerEnum }))
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            const config = await ctx.db.providerConfig.findUnique({
                where: {
                    userId_provider: {
                        userId,
                        provider: input.provider,
                    },
                },
                select: {
                    provider: true,
                    encryptedApiKey: true,
                    encryptionIv: true,
                    authTag: true,
                    keyVersion: true,
                    baseUrl: true,
                    modelId: true,
                    updatedAt: true,
                },
            })

            if (!config) {
                return null
            }

            // 解密 API Key 用于生成预览（不返回完整密钥）
            let apiKeyPreview: string | undefined
            let decryptionFailed = false
            if (
                config.encryptedApiKey &&
                config.encryptionIv &&
                config.authTag
            ) {
                try {
                    const decrypted = decryptApiKey({
                        encryptedData: config.encryptedApiKey,
                        iv: config.encryptionIv,
                        authTag: config.authTag,
                        keyVersion: config.keyVersion,
                    })
                    apiKeyPreview = generateApiKeyPreview(decrypted)
                } catch (error) {
                    console.error(
                        "[provider-config] Failed to decrypt API key:",
                        error,
                    )
                    decryptionFailed = true
                }
            }

            return {
                provider: config.provider,
                hasApiKey: !!config.encryptedApiKey,
                decryptionFailed,
                apiKeyPreview,
                baseUrl: config.baseUrl || undefined,
                modelId: config.modelId || undefined,
                updatedAt: config.updatedAt,
            }
        }),

    /**
     * 获取所有已保存的 provider 配置
     */
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.user.id

        const configs = await ctx.db.providerConfig.findMany({
            where: { userId },
            select: {
                provider: true,
                encryptedApiKey: true,
                encryptionIv: true,
                authTag: true,
                keyVersion: true,
                baseUrl: true,
                modelId: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
        })

        return configs.map((config) => {
            let apiKeyPreview: string | undefined
            let decryptionFailed = false
            if (
                config.encryptedApiKey &&
                config.encryptionIv &&
                config.authTag
            ) {
                try {
                    const decrypted = decryptApiKey({
                        encryptedData: config.encryptedApiKey,
                        iv: config.encryptionIv,
                        authTag: config.authTag,
                        keyVersion: config.keyVersion,
                    })
                    apiKeyPreview = generateApiKeyPreview(decrypted)
                } catch (error) {
                    console.error(
                        "[provider-config] Decryption failed for provider:",
                        config.provider,
                        error,
                    )
                    decryptionFailed = true
                }
            }

            return {
                provider: config.provider,
                hasApiKey: !!config.encryptedApiKey,
                decryptionFailed,
                apiKeyPreview,
                baseUrl: config.baseUrl || undefined,
                modelId: config.modelId || undefined,
                updatedAt: config.updatedAt,
            }
        })
    }),

    /**
     * 保存/更新 provider 配置
     */
    upsert: protectedProcedure
        .input(upsertInputSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            // 加密 API Key（如果提供）
            let encryptedData: {
                encryptedApiKey?: string
                encryptionIv?: string
                authTag?: string
                keyVersion?: number
            } = {}

            if (input.apiKey) {
                const encrypted = encryptApiKey(input.apiKey)
                encryptedData = {
                    encryptedApiKey: encrypted.encryptedData,
                    encryptionIv: encrypted.iv,
                    authTag: encrypted.authTag,
                    keyVersion: encrypted.keyVersion,
                }
            }

            const config = await ctx.db.providerConfig.upsert({
                where: {
                    userId_provider: {
                        userId,
                        provider: input.provider,
                    },
                },
                create: {
                    userId,
                    provider: input.provider,
                    ...encryptedData,
                    baseUrl: input.baseUrl || null,
                    modelId: input.modelId || null,
                },
                update: {
                    // 只更新提供的字段
                    ...(input.apiKey ? encryptedData : {}),
                    ...(input.baseUrl !== undefined
                        ? { baseUrl: input.baseUrl || null }
                        : {}),
                    ...(input.modelId !== undefined
                        ? { modelId: input.modelId || null }
                        : {}),
                },
                select: {
                    provider: true,
                    updatedAt: true,
                },
            })

            return {
                ok: true,
                provider: config.provider,
                updatedAt: config.updatedAt,
            }
        }),

    /**
     * 删除 provider 配置
     */
    delete: protectedProcedure
        .input(z.object({ provider: providerEnum }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            await ctx.db.providerConfig.delete({
                where: {
                    userId_provider: {
                        userId,
                        provider: input.provider,
                    },
                },
            })

            return { ok: true }
        }),
})
