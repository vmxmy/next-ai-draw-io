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

// 输入验证 Schema
const upsertInputSchema = z.object({
    provider: providerEnum,
    apiKey: z.string().min(1).optional(),
    baseUrl: z.string().url().optional().or(z.literal("")),
    modelId: z.string().optional(),
})

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
                    })
                    apiKeyPreview = generateApiKeyPreview(decrypted)
                } catch (error) {
                    console.error(
                        "[provider-config] Failed to decrypt API key:",
                        error,
                    )
                    // 解密失败时仍返回配置，但标记 hasApiKey = false
                }
            }

            return {
                provider: config.provider,
                hasApiKey: !!config.encryptedApiKey,
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
                baseUrl: true,
                modelId: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
        })

        return configs.map((config) => {
            let apiKeyPreview: string | undefined
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
                    })
                    apiKeyPreview = generateApiKeyPreview(decrypted)
                } catch {
                    // 静默失败，跳过解密错误的记录
                }
            }

            return {
                provider: config.provider,
                hasApiKey: !!config.encryptedApiKey,
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
            } = {}

            if (input.apiKey) {
                const encrypted = encryptApiKey(input.apiKey)
                encryptedData = {
                    encryptedApiKey: encrypted.encryptedData,
                    encryptionIv: encrypted.iv,
                    authTag: encrypted.authTag,
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
