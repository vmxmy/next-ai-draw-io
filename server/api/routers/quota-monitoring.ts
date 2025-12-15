import { z } from "zod"
import { withAudit } from "@/server/api/middleware/audit"
import { createPermissionProcedure } from "@/server/api/middleware/rbac"
import { createTRPCRouter } from "@/server/api/trpc"

export const quotaMonitoringRouter = createTRPCRouter({
    // === 获取实时仪表板数据 ===
    getDashboard: createPermissionProcedure("quotas:read").query(
        async ({ ctx }) => {
            // 获取所有配额使用记录
            const allQuotaUsage = await ctx.db.userQuotaUsage.findMany({
                include: {
                    user: {
                        select: {
                            tier: true,
                        },
                    },
                },
            })

            // 计算总体统计
            const totalUsage = allQuotaUsage.reduce(
                (sum, q) => sum + Number(q.count),
                0,
            )

            // 按等级统计
            const tierStats = allQuotaUsage.reduce(
                (acc, q) => {
                    const tier = q.user.tier
                    if (!acc[tier]) {
                        acc[tier] = {
                            tier,
                            totalUsed: 0,
                            userCount: new Set(),
                        }
                    }
                    acc[tier].totalUsed += Number(q.count)
                    acc[tier].userCount.add(q.userId)
                    return acc
                },
                {} as Record<
                    string,
                    {
                        tier: string
                        totalUsed: number
                        userCount: Set<string>
                    }
                >,
            )

            return {
                totalUsage,
                totalUsers: new Set(allQuotaUsage.map((q) => q.userId)).size,
                tierStats: Object.values(tierStats).map((stat) => ({
                    tier: stat.tier,
                    totalUsed: stat.totalUsed,
                    userCount: stat.userCount.size,
                })),
            }
        },
    ),

    // === 获取用户配额使用明细 ===
    getUserQuotaDetail: createPermissionProcedure("quotas:read")
        .input(z.object({ userId: z.string() }))
        .query(async ({ ctx, input }) => {
            const userQuotaUsage = await ctx.db.userQuotaUsage.findMany({
                where: { userId: input.userId },
                orderBy: { updatedAt: "desc" },
                take: 30, // 最近30条记录
            })

            const user = await ctx.db.user.findUnique({
                where: { id: input.userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    tier: true,
                },
            })

            return {
                user,
                userQuotaUsage: userQuotaUsage,
                quotaUsage: userQuotaUsage, // Alias for backward compatibility
            }
        }),

    // === 获取配额使用趋势 ===
    getUsageTrend: createPermissionProcedure("quotas:read")
        .input(
            z.object({
                period: z.enum(["day", "week", "month"]).default("week"),
                tier: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const now = new Date()
            let startDate: Date

            // 计算时间范围
            switch (input.period) {
                case "day":
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                    break
                case "week":
                    startDate = new Date(
                        now.getTime() - 7 * 24 * 60 * 60 * 1000,
                    )
                    break
                case "month":
                    startDate = new Date(
                        now.getTime() - 30 * 24 * 60 * 60 * 1000,
                    )
                    break
            }

            // 构建查询条件
            const where: any = {
                updatedAt: {
                    gte: startDate,
                },
            }

            if (input.tier) {
                where.user = {
                    tier: input.tier,
                }
            }

            const userQuotaUsage = await ctx.db.userQuotaUsage.findMany({
                where,
                include: {
                    user: {
                        select: {
                            tier: true,
                        },
                    },
                },
                orderBy: { updatedAt: "asc" },
            })

            // 按日期分组统计
            const trendData = userQuotaUsage.reduce(
                (acc, q) => {
                    const date = q.updatedAt.toISOString().split("T")[0]
                    if (!acc[date]) {
                        acc[date] = {
                            date,
                            totalUsed: 0,
                            count: 0,
                        }
                    }
                    acc[date].totalUsed += Number(q.count)
                    acc[date].count += 1
                    return acc
                },
                {} as Record<
                    string,
                    {
                        date: string
                        totalUsed: number
                        count: number
                    }
                >,
            )

            return Object.values(trendData)
        }),

    // === 获取异常用户（暂时返回空，因为没有配额限制信息）===
    getAnomalousUsers: createPermissionProcedure("quotas:read")
        .input(
            z.object({
                threshold: z.number().min(0).max(1).default(0.9),
                page: z.number().min(1).default(1),
                pageSize: z.number().min(1).max(100).default(20),
            }),
        )
        .query(async ({ input }) => {
            // 由于 UserQuotaUsage 不包含配额限制信息，暂时返回空列表
            return {
                users: [],
                total: 0,
                page: input.page,
                pageSize: input.pageSize,
                totalPages: 0,
            }
        }),

    // === 重置用户配额 ===
    resetUserQuota: createPermissionProcedure("quotas:reset")
        .use(withAudit("quota:reset", "quota"))
        .input(
            z.object({
                userId: z.string(),
                bucketType: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { userId, bucketType } = input

            const where: any = { userId }

            if (bucketType) {
                where.bucketType = bucketType
            }

            // 删除配额记录
            await ctx.db.userQuotaUsage.deleteMany({
                where,
            })

            return { success: true }
        }),

    // === 批量重置配额 ===
    batchResetQuota: createPermissionProcedure("quotas:reset")
        .use(withAudit("quota:batch_reset", "quota"))
        .input(
            z.object({
                userIds: z.array(z.string()),
                bucketType: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { userIds, bucketType } = input

            const where: any = {
                userId: { in: userIds },
            }

            if (bucketType) {
                where.bucketType = bucketType
            }

            await ctx.db.userQuotaUsage.deleteMany({
                where,
            })

            return { success: true, count: userIds.length }
        }),
})
