import { initTRPC, TRPCError } from "@trpc/server"
import { z } from "zod"
import type { createTRPCContext } from "@/server/api/trpc"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"

// 定义 Tier 枚举
const tierEnum = z.enum(["anonymous", "free", "pro", "enterprise"])

// 创建 tRPC 实例（用于自定义中间件）
const t = initTRPC
    .context<Awaited<ReturnType<typeof createTRPCContext>>>()
    .create()

// 管理员中间件（基于邮箱白名单）
const requireAdmin = t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)

    const userEmail = ctx.session.user.email || ""

    if (!adminEmails.includes(userEmail)) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "Admin access required",
        })
    }

    return next({ ctx: { session: ctx.session } })
})

const adminProcedure = protectedProcedure.use(requireAdmin)

export const tierConfigRouter = createTRPCRouter({
    // 获取所有启用的等级配置（普通用户可见）
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.db.tierConfig.findMany({
            where: { enabled: true },
            orderBy: { sortOrder: "asc" },
        })
    }),

    // 获取当前用户的等级和配额信息
    getUserTier: protectedProcedure.query(async ({ ctx }) => {
        const user = await ctx.db.user.findUnique({
            where: { id: ctx.session.user.id },
            select: { tier: true, tierExpiresAt: true },
        })

        if (!user) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "User not found",
            })
        }

        const tierConfig = await ctx.db.tierConfig.findUnique({
            where: { tier: user.tier },
        })

        return {
            tier: user.tier,
            tierExpiresAt: user.tierExpiresAt,
            config: tierConfig,
        }
    }),

    // 获取当前用户的配额使用情况
    getUserQuotaUsage: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.user.id
        const dayKey = new Date().toISOString().slice(0, 10)
        const minuteKey = Math.floor(Date.now() / 60_000).toString()

        const [dayRequests, dayTokens, minuteTokens] = await Promise.all([
            ctx.db.userQuotaUsage.findUnique({
                where: {
                    userId_bucketType_bucketKey: {
                        userId,
                        bucketType: "day-requests",
                        bucketKey: dayKey,
                    },
                },
            }),
            ctx.db.userQuotaUsage.findUnique({
                where: {
                    userId_bucketType_bucketKey: {
                        userId,
                        bucketType: "day-tokens",
                        bucketKey: dayKey,
                    },
                },
            }),
            ctx.db.userQuotaUsage.findUnique({
                where: {
                    userId_bucketType_bucketKey: {
                        userId,
                        bucketType: "minute-tokens",
                        bucketKey: minuteKey,
                    },
                },
            }),
        ])

        return {
            dailyRequests: Number(dayRequests?.count ?? 0),
            dailyTokens: Number(dayTokens?.count ?? 0),
            minuteTokens: Number(minuteTokens?.count ?? 0),
        }
    }),

    // === 管理员 API ===

    // 获取所有等级配置（包括已禁用）
    adminList: adminProcedure.query(async ({ ctx }) => {
        return ctx.db.tierConfig.findMany({
            orderBy: { sortOrder: "asc" },
        })
    }),

    // 更新等级配置
    adminUpdate: adminProcedure
        .input(
            z.object({
                tier: tierEnum,
                displayName: z.string().optional(),
                dailyRequestLimit: z.number().int().min(0).optional(),
                dailyTokenLimit: z.number().int().min(0).optional(),
                tpmLimit: z.number().int().min(0).optional(),
                enabled: z.boolean().optional(),
                description: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { tier, ...updateData } = input

            // BigInt 转换
            const data: any = { ...updateData }
            if (updateData.dailyTokenLimit !== undefined) {
                data.dailyTokenLimit = BigInt(updateData.dailyTokenLimit)
            }

            return ctx.db.tierConfig.update({
                where: { tier },
                data,
            })
        }),

    // 更新用户等级（用于后台手动调整用户等级）
    adminSetUserTier: adminProcedure
        .input(
            z.object({
                userId: z.string(),
                tier: tierEnum,
                tierExpiresAt: z.date().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.db.user.update({
                where: { id: input.userId },
                data: {
                    tier: input.tier,
                    tierExpiresAt: input.tierExpiresAt,
                },
            })
        }),

    // 获取所有用户的等级统计
    adminGetStats: adminProcedure.query(async ({ ctx }) => {
        const stats = await ctx.db.user.groupBy({
            by: ["tier"],
            _count: { tier: true },
        })
        return stats.map((s) => ({ tier: s.tier, count: s._count.tier }))
    }),
})
