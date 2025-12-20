import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"

const aiModeEnum = z.enum(["system_default", "byok"])

export const aiModeRouter = createTRPCRouter({
    // 获取当前用户的 AI 模式和配置状态
    getStatus: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.user.id

        const [user, defaultConfig] = await Promise.all([
            ctx.db.user.findUnique({
                where: { id: userId },
                select: { aiMode: true, tier: true },
            }),
            ctx.db.providerConfig.findFirst({
                where: { userId, isDefault: true, isDisabled: false },
                select: {
                    provider: true,
                    modelId: true,
                    encryptedCredentials: true,
                },
            }),
        ])

        return {
            aiMode:
                (user?.aiMode as "system_default" | "byok") || "system_default",
            tier: user?.tier || "free",
            hasByokConfig: !!defaultConfig?.encryptedCredentials,
            byokProvider: defaultConfig?.provider || null,
            byokModel: defaultConfig?.modelId || null,
        }
    }),

    // 切换 AI 模式
    setMode: protectedProcedure
        .input(z.object({ mode: aiModeEnum }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            // 切换到 BYOK 模式时，验证用户是否有有效配置
            if (input.mode === "byok") {
                const config = await ctx.db.providerConfig.findFirst({
                    where: {
                        userId,
                        isDefault: true,
                        isDisabled: false,
                        encryptedCredentials: { not: null },
                    },
                })
                if (!config) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message:
                            "Cannot enable BYOK mode: No API key configured. Please add your API key first.",
                    })
                }
            }

            await ctx.db.user.update({
                where: { id: userId },
                data: { aiMode: input.mode },
            })

            return { success: true, mode: input.mode }
        }),
})
