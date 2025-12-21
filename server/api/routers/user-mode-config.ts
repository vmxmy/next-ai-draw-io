import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"

const modeEnum = z.enum(["fast", "max"])

/**
 * 用户模式配置 TRPC Router
 * 管理用户的 Fast/Max 模式配置（选择哪个 Provider + 凭证 + 模型）
 */
export const userModeConfigRouter = createTRPCRouter({
    /**
     * 获取当前用户的所有模式配置
     */
    list: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.user.id

        const configs = await ctx.db.userModeConfig.findMany({
            where: { userId },
            orderBy: { mode: "asc" },
        })

        return configs
    }),

    /**
     * 获取指定模式的配置
     */
    get: protectedProcedure
        .input(z.object({ mode: modeEnum }))
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            const config = await ctx.db.userModeConfig.findUnique({
                where: {
                    userId_mode: { userId, mode: input.mode },
                },
            })

            return config
        }),

    /**
     * 更新或创建模式配置
     */
    upsert: protectedProcedure
        .input(
            z.object({
                mode: modeEnum,
                provider: z.string().optional().nullable(),
                credentialName: z.string().optional().nullable(),
                modelId: z.string().optional().nullable(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id
            const { mode, ...data } = input

            const result = await ctx.db.userModeConfig.upsert({
                where: {
                    userId_mode: { userId, mode },
                },
                update: {
                    provider: data.provider || null,
                    credentialName: data.credentialName || null,
                    modelId: data.modelId || null,
                },
                create: {
                    userId,
                    mode,
                    provider: data.provider || null,
                    credentialName: data.credentialName || null,
                    modelId: data.modelId || null,
                },
            })

            return result
        }),

    /**
     * 删除模式配置（重置为系统默认）
     */
    delete: protectedProcedure
        .input(z.object({ mode: modeEnum }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            await ctx.db.userModeConfig.deleteMany({
                where: {
                    userId,
                    mode: input.mode,
                },
            })

            return { success: true }
        }),

    /**
     * 批量更新所有模式配置
     */
    updateAll: protectedProcedure
        .input(
            z.object({
                fast: z
                    .object({
                        provider: z.string().optional().nullable(),
                        credentialName: z.string().optional().nullable(),
                        modelId: z.string().optional().nullable(),
                    })
                    .optional(),
                max: z
                    .object({
                        provider: z.string().optional().nullable(),
                        credentialName: z.string().optional().nullable(),
                        modelId: z.string().optional().nullable(),
                    })
                    .optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            const results = await ctx.db.$transaction(async (tx) => {
                const updated: Record<string, unknown> = {}

                if (input.fast) {
                    updated.fast = await tx.userModeConfig.upsert({
                        where: { userId_mode: { userId, mode: "fast" } },
                        update: {
                            provider: input.fast.provider || null,
                            credentialName: input.fast.credentialName || null,
                            modelId: input.fast.modelId || null,
                        },
                        create: {
                            userId,
                            mode: "fast",
                            provider: input.fast.provider || null,
                            credentialName: input.fast.credentialName || null,
                            modelId: input.fast.modelId || null,
                        },
                    })
                }

                if (input.max) {
                    updated.max = await tx.userModeConfig.upsert({
                        where: { userId_mode: { userId, mode: "max" } },
                        update: {
                            provider: input.max.provider || null,
                            credentialName: input.max.credentialName || null,
                            modelId: input.max.modelId || null,
                        },
                        create: {
                            userId,
                            mode: "max",
                            provider: input.max.provider || null,
                            credentialName: input.max.credentialName || null,
                            modelId: input.max.modelId || null,
                        },
                    })
                }

                return updated
            })

            return results
        }),
})
