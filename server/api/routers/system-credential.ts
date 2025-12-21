import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { decryptCredentials, encryptCredentials } from "@/server/encryption"
import { clearCredentialCache } from "@/server/system-config"

// Provider 枚举
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
    "openai_compatible",
])

type ProviderType = z.infer<typeof providerEnum>

/**
 * 系统凭证 TRPC Router
 * 管理系统级 Provider 凭证（支持每个 Provider 多套凭证）
 */
export const systemCredentialRouter = createTRPCRouter({
    /**
     * 管理员：获取所有凭证列表
     */
    adminList: protectedProcedure
        .input(
            z
                .object({
                    provider: providerEnum.optional(),
                })
                .optional()
                .nullable(),
        )
        .query(async ({ ctx, input }) => {
            // TODO: 添加管理员权限检查
            console.log(
                "[systemCredential.adminList] Called with input:",
                input,
            )

            try {
                const where = input?.provider
                    ? { provider: input.provider }
                    : {}

                const credentials = await ctx.db.systemCredential.findMany({
                    where,
                    orderBy: [
                        { provider: "asc" },
                        { isDefault: "desc" },
                        { name: "asc" },
                    ],
                    select: {
                        id: true,
                        provider: true,
                        name: true,
                        baseUrl: true,
                        credentialType: true,
                        region: true,
                        resourceName: true,
                        isDefault: true,
                        isDisabled: true,
                        createdAt: true,
                        updatedAt: true,
                        // 不返回加密字段，只返回是否有凭证
                        encryptedCredentials: true,
                    },
                })

                return credentials.map((cred) => ({
                    ...cred,
                    hasCredentials: Boolean(cred.encryptedCredentials),
                    encryptedCredentials: undefined, // 移除加密数据
                }))
            } catch (error) {
                console.error("[systemCredential.adminList] Error:", error)
                throw error
            }
        }),

    /**
     * 管理员：获取单个凭证详情
     */
    adminGet: protectedProcedure
        .input(
            z.object({
                provider: providerEnum,
                name: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const credential = await ctx.db.systemCredential.findUnique({
                where: {
                    provider_name: {
                        provider: input.provider,
                        name: input.name || "default",
                    },
                },
                select: {
                    id: true,
                    provider: true,
                    name: true,
                    baseUrl: true,
                    credentialType: true,
                    region: true,
                    resourceName: true,
                    isDefault: true,
                    isDisabled: true,
                    encryptedCredentials: true,
                },
            })

            if (!credential) {
                return null
            }

            return {
                ...credential,
                hasCredentials: Boolean(credential.encryptedCredentials),
                // 返回 API Key 预览（仅显示最后 4 位）
                apiKeyPreview: credential.encryptedCredentials
                    ? "********"
                    : undefined,
                encryptedCredentials: undefined,
            }
        }),

    /**
     * 管理员：创建或更新凭证
     */
    adminUpsert: protectedProcedure
        .input(
            z.object({
                provider: providerEnum,
                name: z.string().default("default"),
                apiKey: z.string().optional(), // 新的 API Key（可选，不传则保留原有）
                baseUrl: z.string().optional(),
                credentialType: z.string().default("apiKey"),
                region: z.string().optional(),
                resourceName: z.string().optional(),
                isDefault: z.boolean().default(false),
                isDisabled: z.boolean().default(false),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // TODO: 添加管理员权限检查

            const { provider, name, apiKey, ...rest } = input

            // 准备更新数据
            const updateData: Record<string, unknown> = {
                baseUrl: rest.baseUrl || null,
                credentialType: rest.credentialType,
                region: rest.region || null,
                resourceName: rest.resourceName || null,
                isDefault: rest.isDefault,
                isDisabled: rest.isDisabled,
            }

            // 如果提供了新的 API Key，加密存储
            if (apiKey) {
                const encrypted = encryptCredentials(JSON.stringify({ apiKey }))
                updateData.encryptedCredentials = encrypted.encryptedData
                updateData.credentialsIv = encrypted.iv
                updateData.credentialsAuthTag = encrypted.authTag
                updateData.credentialsVersion = encrypted.keyVersion
            }

            // 如果设为默认，先取消该 provider 其他凭证的默认状态
            if (rest.isDefault) {
                await ctx.db.systemCredential.updateMany({
                    where: {
                        provider,
                        name: { not: name },
                        isDefault: true,
                    },
                    data: { isDefault: false },
                })
            }

            const result = await ctx.db.systemCredential.upsert({
                where: {
                    provider_name: { provider, name },
                },
                update: updateData,
                create: {
                    provider,
                    name,
                    ...updateData,
                } as any,
            })

            // 清除缓存
            clearCredentialCache(provider, name)

            return {
                id: result.id,
                provider: result.provider,
                name: result.name,
                isDefault: result.isDefault,
            }
        }),

    /**
     * 管理员：删除凭证
     */
    adminDelete: protectedProcedure
        .input(
            z.object({
                provider: providerEnum,
                name: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // TODO: 添加管理员权限检查

            // 防止删除正在使用的默认凭证
            const credential = await ctx.db.systemCredential.findUnique({
                where: {
                    provider_name: {
                        provider: input.provider,
                        name: input.name,
                    },
                },
            })

            if (!credential) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "凭证不存在",
                })
            }

            await ctx.db.systemCredential.delete({
                where: {
                    provider_name: {
                        provider: input.provider,
                        name: input.name,
                    },
                },
            })

            // 清除缓存
            clearCredentialCache(input.provider, input.name)

            return { success: true }
        }),

    /**
     * 管理员：设置默认凭证
     */
    adminSetDefault: protectedProcedure
        .input(
            z.object({
                provider: providerEnum,
                name: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // 取消该 provider 其他凭证的默认状态
            await ctx.db.systemCredential.updateMany({
                where: {
                    provider: input.provider,
                    isDefault: true,
                },
                data: { isDefault: false },
            })

            // 设置新的默认凭证
            const result = await ctx.db.systemCredential.update({
                where: {
                    provider_name: {
                        provider: input.provider,
                        name: input.name,
                    },
                },
                data: { isDefault: true },
            })

            // 清除该 provider 所有凭证的缓存（因为默认状态改变了）
            clearCredentialCache(input.provider)

            return {
                id: result.id,
                provider: result.provider,
                name: result.name,
            }
        }),

    /**
     * 内部：获取解密后的凭证（仅供服务端使用）
     * 注意：此方法不应暴露给客户端
     */
    getDecryptedCredential: protectedProcedure
        .input(
            z.object({
                provider: providerEnum,
                name: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            // 查找指定凭证，或该 provider 的默认凭证
            let credential = input.name
                ? await ctx.db.systemCredential.findUnique({
                      where: {
                          provider_name: {
                              provider: input.provider,
                              name: input.name,
                          },
                      },
                  })
                : await ctx.db.systemCredential.findFirst({
                      where: {
                          provider: input.provider,
                          isDefault: true,
                          isDisabled: false,
                      },
                  })

            // 如果没有默认凭证，尝试获取任意一个可用的
            if (!credential && !input.name) {
                credential = await ctx.db.systemCredential.findFirst({
                    where: {
                        provider: input.provider,
                        isDisabled: false,
                    },
                    orderBy: { createdAt: "asc" },
                })
            }

            if (!credential || !credential.encryptedCredentials) {
                return null
            }

            try {
                const decrypted = decryptCredentials({
                    encryptedData: credential.encryptedCredentials,
                    iv: credential.credentialsIv!,
                    authTag: credential.credentialsAuthTag!,
                    keyVersion: credential.credentialsVersion,
                })

                const parsed = JSON.parse(decrypted)

                return {
                    provider: credential.provider,
                    name: credential.name,
                    apiKey: parsed.apiKey,
                    baseUrl: credential.baseUrl,
                    region: credential.region,
                    resourceName: credential.resourceName,
                }
            } catch (error) {
                console.error(
                    "[systemCredential] Failed to decrypt credential:",
                    error,
                )
                return null
            }
        }),
})
