import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"

const aiModeEnum = z.enum(["system_default", "byok"])

export const aiModeRouter = createTRPCRouter({
    // 获取当前用户的 AI 模式和配置状态
    getStatus: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.user.id

        // 获取用户基本信息和 mode configs
        const [user, credentials, modeConfigs] = await Promise.all([
            ctx.db.user.findUnique({
                where: { id: userId },
                select: {
                    aiMode: true,
                    tier: true,
                },
            }),
            ctx.db.userCredential.findMany({
                where: {
                    userId,
                    isDisabled: false,
                    encryptedCredentials: { not: null },
                },
                select: {
                    provider: true,
                    name: true,
                },
            }),
            ctx.db.userModeConfig.findMany({
                where: { userId },
                select: {
                    mode: true,
                    provider: true,
                    credentialName: true,
                    modelId: true,
                },
            }),
        ])

        // 检查用户是否有有效的 BYOK 配置
        // 需要至少有一个凭证 + 至少一个模式配置了 provider
        const hasValidCredential = credentials.length > 0
        const fastConfig = modeConfigs.find((c) => c.mode === "fast")
        const maxConfig = modeConfigs.find((c) => c.mode === "max")
        const hasModeConfig = !!(fastConfig?.provider || maxConfig?.provider)
        const hasByokConfig = hasValidCredential && hasModeConfig

        const result = {
            aiMode:
                (user?.aiMode as "system_default" | "byok") || "system_default",
            tier: user?.tier || "free",
            hasByokConfig,
            // 返回 fast 模式的配置信息（主要配置）
            byokProvider: fastConfig?.provider || null,
            byokCredentialName: fastConfig?.credentialName || null,
            byokModel: fastConfig?.modelId || null,
            // 返回 max 模式配置信息
            maxProvider: maxConfig?.provider || null,
            maxCredentialName: maxConfig?.credentialName || null,
            maxModel: maxConfig?.modelId || null,
        }

        console.log("[aiMode.getStatus] Debug:", {
            userId,
            userAiMode: user?.aiMode,
            credentialCount: credentials.length,
            hasByokConfig,
            result,
        })

        return result
    }),

    // 切换 AI 模式
    setMode: protectedProcedure
        .input(z.object({ mode: aiModeEnum }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            // 切换到 BYOK 模式时，验证用户是否有有效配置
            if (input.mode === "byok") {
                // 检查用户是否有凭证
                const credentialCount = await ctx.db.userCredential.count({
                    where: {
                        userId,
                        isDisabled: false,
                        encryptedCredentials: { not: null },
                    },
                })

                // 检查用户是否有模式配置
                const modeConfigCount = await ctx.db.userModeConfig.count({
                    where: {
                        userId,
                        provider: { not: null },
                    },
                })

                if (credentialCount === 0 || modeConfigCount === 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message:
                            "Cannot enable BYOK mode: Please configure at least one credential and mode setting first.",
                    })
                }
            }

            await ctx.db.user.update({
                where: { id: userId },
                data: { aiMode: input.mode },
            })

            return { success: true, mode: input.mode }
        }),

    // 设置选中的配置（已废弃，保留兼容性）
    setSelectedConfig: protectedProcedure
        .input(
            z.object({
                configId: z.string().nullable(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // 不再使用 selectedProviderConfigId
            // 保留此 endpoint 以兼容旧客户端
            console.warn(
                "[aiMode.setSelectedConfig] Deprecated: Use userModeConfig instead",
            )
            return { success: true, configId: input.configId }
        }),
})
