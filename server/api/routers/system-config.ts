import { z } from "zod"
import {
    createTRPCRouter,
    protectedProcedure,
    publicProcedure,
} from "@/server/api/trpc"
import { clearConfigCache } from "@/server/system-config"

/**
 * SystemConfig Router
 * 用于管理系统级配置（AI 模型、通知设置等）
 */
export const systemConfigRouter = createTRPCRouter({
    /**
     * 获取 AI 默认配置（公开，用于服务端获取）
     */
    getAIConfig: publicProcedure.query(async ({ ctx }) => {
        const [provider, model, fallbackModels] = await Promise.all([
            ctx.db.systemConfig.findUnique({
                where: { key: "ai.default.provider" },
            }),
            ctx.db.systemConfig.findUnique({
                where: { key: "ai.default.model" },
            }),
            ctx.db.systemConfig.findUnique({
                where: { key: "ai.fallback.models" },
            }),
        ])

        return {
            provider: (provider?.value as string) || "openrouter",
            model:
                (model?.value as string) || "qwen/qwen-2.5-coder-32b-instruct",
            fallbackModels: (fallbackModels?.value as string[]) || [],
        }
    }),

    /**
     * 管理员：获取所有配置
     */
    adminList: protectedProcedure
        .input(
            z
                .object({
                    category: z.string().optional(),
                })
                .optional(),
        )
        .query(async ({ ctx, input }) => {
            // TODO: 添加管理员权限检查
            const where = input?.category ? { category: input.category } : {}

            return ctx.db.systemConfig.findMany({
                where,
                orderBy: [{ category: "asc" }, { key: "asc" }],
            })
        }),

    /**
     * 管理员：更新配置
     */
    adminUpdate: protectedProcedure
        .input(
            z.object({
                key: z.string(),
                value: z.any(),
                category: z.string().optional(),
                description: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // TODO: 添加管理员权限检查

            // 使用 upsert 来支持创建或更新
            const result = await ctx.db.systemConfig.upsert({
                where: { key: input.key },
                update: {
                    value: input.value,
                    description: input.description,
                },
                create: {
                    key: input.key,
                    value: input.value,
                    category: input.category || "ai", // 默认分类
                    description: input.description,
                },
            })

            // 清除缓存，确保立即生效
            clearConfigCache(input.key)

            return result
        }),

    /**
     * 管理员：创建配置
     */
    adminCreate: protectedProcedure
        .input(
            z.object({
                key: z.string(),
                value: z.any(),
                category: z.string(),
                description: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // TODO: 添加管理员权限检查

            return ctx.db.systemConfig.create({
                data: input,
            })
        }),
})
