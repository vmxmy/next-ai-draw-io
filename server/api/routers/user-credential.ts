import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { decryptCredentials, encryptCredentials } from "@/server/encryption"

/**
 * 用户凭证 TRPC Router
 * 管理用户级 Provider 凭证（支持每个 Provider 多套凭证）
 */
export const userCredentialRouter = createTRPCRouter({
    /**
     * 获取当前用户的所有凭证列表
     */
    list: protectedProcedure
        .input(
            z
                .object({
                    provider: z.string().optional(),
                })
                .optional()
                .nullable(),
        )
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            const where: { userId: string; provider?: string } = { userId }
            if (input?.provider) {
                where.provider = input.provider
            }

            const credentials = await ctx.db.userCredential.findMany({
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
                    encryptedCredentials: true,
                },
            })

            return credentials.map((cred) => ({
                ...cred,
                hasCredentials: Boolean(cred.encryptedCredentials),
                encryptedCredentials: undefined,
            }))
        }),

    /**
     * 获取单个凭证详情
     */
    get: protectedProcedure
        .input(
            z.object({
                provider: z.string(),
                name: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            const credential = await ctx.db.userCredential.findUnique({
                where: {
                    userId_provider_name: {
                        userId,
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
                apiKeyPreview: credential.encryptedCredentials
                    ? "********"
                    : undefined,
                encryptedCredentials: undefined,
            }
        }),

    /**
     * 创建或更新凭证
     */
    upsert: protectedProcedure
        .input(
            z.object({
                provider: z.string(),
                name: z.string().default("default"),
                apiKey: z.string().optional(),
                baseUrl: z.string().optional(),
                credentialType: z.string().default("apiKey"),
                region: z.string().optional(),
                resourceName: z.string().optional(),
                isDefault: z.boolean().default(false),
                isDisabled: z.boolean().default(false),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id
            const { provider, name, apiKey, ...rest } = input

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
                await ctx.db.userCredential.updateMany({
                    where: {
                        userId,
                        provider,
                        name: { not: name },
                        isDefault: true,
                    },
                    data: { isDefault: false },
                })
            }

            const result = await ctx.db.userCredential.upsert({
                where: {
                    userId_provider_name: { userId, provider, name },
                },
                update: updateData,
                create: {
                    userId,
                    provider,
                    name,
                    ...updateData,
                } as any,
            })

            return {
                id: result.id,
                provider: result.provider,
                name: result.name,
                isDefault: result.isDefault,
            }
        }),

    /**
     * 删除凭证
     */
    delete: protectedProcedure
        .input(
            z.object({
                provider: z.string(),
                name: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            const credential = await ctx.db.userCredential.findUnique({
                where: {
                    userId_provider_name: {
                        userId,
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

            await ctx.db.userCredential.delete({
                where: {
                    userId_provider_name: {
                        userId,
                        provider: input.provider,
                        name: input.name,
                    },
                },
            })

            return { success: true }
        }),

    /**
     * 设置默认凭证
     */
    setDefault: protectedProcedure
        .input(
            z.object({
                provider: z.string(),
                name: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            // 取消该 provider 其他凭证的默认状态
            await ctx.db.userCredential.updateMany({
                where: {
                    userId,
                    provider: input.provider,
                    isDefault: true,
                },
                data: { isDefault: false },
            })

            // 设置新的默认凭证
            const result = await ctx.db.userCredential.update({
                where: {
                    userId_provider_name: {
                        userId,
                        provider: input.provider,
                        name: input.name,
                    },
                },
                data: { isDefault: true },
            })

            return {
                id: result.id,
                provider: result.provider,
                name: result.name,
            }
        }),

    /**
     * 内部：获取解密后的凭证（仅供服务端使用）
     */
    getDecrypted: protectedProcedure
        .input(
            z.object({
                provider: z.string(),
                name: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            // 查找指定凭证，或该 provider 的默认凭证
            let credential = input.name
                ? await ctx.db.userCredential.findUnique({
                      where: {
                          userId_provider_name: {
                              userId,
                              provider: input.provider,
                              name: input.name,
                          },
                      },
                  })
                : await ctx.db.userCredential.findFirst({
                      where: {
                          userId,
                          provider: input.provider,
                          isDefault: true,
                          isDisabled: false,
                      },
                  })

            // 如果没有默认凭证，尝试获取任意一个可用的
            if (!credential && !input.name) {
                credential = await ctx.db.userCredential.findFirst({
                    where: {
                        userId,
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
                    "[userCredential] Failed to decrypt credential:",
                    error,
                )
                return null
            }
        }),
})
