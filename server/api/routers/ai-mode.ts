import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"

const aiModeEnum = z.enum(["system_default", "byok"])

export const aiModeRouter = createTRPCRouter({
    // 获取当前用户的 AI 模式和配置状态
    getStatus: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.user.id

        const user = await ctx.db.user.findUnique({
            where: { id: userId },
            select: {
                aiMode: true,
                tier: true,
                selectedProviderConfigId: true,
                selectedProviderConfig: {
                    select: {
                        id: true,
                        provider: true,
                        name: true,
                        modelId: true,
                        isDisabled: true,
                        encryptedCredentials: true,
                    },
                },
            },
        })

        const selectedConfig = user?.selectedProviderConfig
        const hasValidConfig =
            !!selectedConfig &&
            !selectedConfig.isDisabled &&
            !!selectedConfig.encryptedCredentials

        const result = {
            aiMode:
                (user?.aiMode as "system_default" | "byok") || "system_default",
            tier: user?.tier || "free",
            hasByokConfig: hasValidConfig,
            selectedConfigId: user?.selectedProviderConfigId || null,
            byokProvider: selectedConfig?.provider || null,
            byokConnectionName: selectedConfig?.name || null,
            byokModel: selectedConfig?.modelId || null,
        }

        // Debug logging
        console.log("[aiMode.getStatus] Debug:", {
            userId,
            userAiMode: user?.aiMode,
            selectedConfig: selectedConfig
                ? {
                      id: selectedConfig.id,
                      provider: selectedConfig.provider,
                      name: selectedConfig.name,
                      hasEncryptedCredentials:
                          !!selectedConfig.encryptedCredentials,
                  }
                : null,
            result,
        })

        return result
    }),

    // 切换 AI 模式
    setMode: protectedProcedure
        .input(z.object({ mode: aiModeEnum }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            // 切换到 BYOK 模式时，验证用户是否有选中的有效配置
            if (input.mode === "byok") {
                const user = await ctx.db.user.findUnique({
                    where: { id: userId },
                    select: {
                        selectedProviderConfig: {
                            select: {
                                isDisabled: true,
                                encryptedCredentials: true,
                            },
                        },
                    },
                })

                const config = user?.selectedProviderConfig
                if (
                    !config ||
                    config.isDisabled ||
                    !config.encryptedCredentials
                ) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message:
                            "Cannot enable BYOK mode: No valid configuration selected. Please select a provider with API key first.",
                    })
                }
            }

            await ctx.db.user.update({
                where: { id: userId },
                data: { aiMode: input.mode },
            })

            return { success: true, mode: input.mode }
        }),

    // 设置选中的配置
    setSelectedConfig: protectedProcedure
        .input(
            z.object({
                configId: z.string().nullable(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            // 如果设置了 configId，验证它属于当前用户
            if (input.configId) {
                const config = await ctx.db.providerConfig.findFirst({
                    where: {
                        id: input.configId,
                        userId,
                    },
                })
                if (!config) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "Configuration not found",
                    })
                }
            }

            await ctx.db.user.update({
                where: { id: userId },
                data: { selectedProviderConfigId: input.configId },
            })

            return { success: true, configId: input.configId }
        }),
})
