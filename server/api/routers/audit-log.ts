import { z } from "zod"
import { createPermissionProcedure } from "@/server/api/middleware/rbac"
import { createTRPCRouter } from "@/server/api/trpc"

export const auditLogRouter = createTRPCRouter({
    // === 获取审计日志列表 ===
    list: createPermissionProcedure("logs:read")
        .input(
            z.object({
                page: z.number().min(1).default(1),
                pageSize: z.number().min(1).max(100).default(20),
                userId: z.string().optional(),
                action: z.string().optional(),
                resourceType: z.string().optional(),
                status: z.enum(["success", "failed"]).optional(),
                dateFrom: z.date().optional(),
                dateTo: z.date().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const {
                page,
                pageSize,
                userId,
                action,
                resourceType,
                status,
                dateFrom,
                dateTo,
            } = input

            // 构建查询条件
            const where: any = {}

            if (userId) {
                where.userId = userId
            }

            if (action) {
                where.action = { contains: action }
            }

            if (resourceType) {
                where.resourceType = resourceType
            }

            if (status) {
                where.status = status
            }

            if (dateFrom || dateTo) {
                where.createdAt = {}
                if (dateFrom) {
                    where.createdAt.gte = dateFrom
                }
                if (dateTo) {
                    where.createdAt.lte = dateTo
                }
            }

            // 查询总数
            const total = await ctx.db.auditLog.count({ where })

            // 查询数据
            const logs = await ctx.db.auditLog.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                        },
                    },
                },
            })

            return {
                logs,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        }),

    // === 获取审计日志详情 ===
    getDetail: createPermissionProcedure("logs:read")
        .input(z.object({ logId: z.string() }))
        .query(async ({ ctx, input }) => {
            const log = await ctx.db.auditLog.findUnique({
                where: { id: input.logId },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            tier: true,
                        },
                    },
                },
            })

            return log
        }),

    // === 获取操作统计 ===
    getStats: createPermissionProcedure("logs:read").query(async ({ ctx }) => {
        const now = new Date()
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const [
            totalLogs,
            last24hLogs,
            last7dLogs,
            successLogs,
            failedLogs,
            actionStats,
        ] = await Promise.all([
            ctx.db.auditLog.count(),
            ctx.db.auditLog.count({
                where: {
                    createdAt: { gte: last24h },
                },
            }),
            ctx.db.auditLog.count({
                where: {
                    createdAt: { gte: last7d },
                },
            }),
            ctx.db.auditLog.count({
                where: { status: "success" },
            }),
            ctx.db.auditLog.count({
                where: { status: "failed" },
            }),
            ctx.db.auditLog.groupBy({
                by: ["action"],
                _count: { action: true },
                orderBy: {
                    _count: {
                        action: "desc",
                    },
                },
                take: 10,
            }),
        ])

        return {
            totalLogs,
            last24hLogs,
            last7dLogs,
            successLogs,
            failedLogs,
            successRate:
                totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 0,
            topActions: actionStats.map((stat) => ({
                action: stat.action,
                count: stat._count.action,
            })),
        }
    }),

    // === 获取用户操作历史 ===
    getUserHistory: createPermissionProcedure("logs:read")
        .input(
            z.object({
                userId: z.string(),
                limit: z.number().min(1).max(100).default(20),
            }),
        )
        .query(async ({ ctx, input }) => {
            const logs = await ctx.db.auditLog.findMany({
                where: { userId: input.userId },
                take: input.limit,
                orderBy: { createdAt: "desc" },
            })

            return logs
        }),

    // === 导出审计日志 ===
    export: createPermissionProcedure("logs:read")
        .input(
            z.object({
                userId: z.string().optional(),
                action: z.string().optional(),
                resourceType: z.string().optional(),
                status: z.enum(["success", "failed"]).optional(),
                dateFrom: z.date().optional(),
                dateTo: z.date().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { userId, action, resourceType, status, dateFrom, dateTo } =
                input

            // 构建查询条件（与 list 相同）
            const where: any = {}

            if (userId) {
                where.userId = userId
            }

            if (action) {
                where.action = { contains: action }
            }

            if (resourceType) {
                where.resourceType = resourceType
            }

            if (status) {
                where.status = status
            }

            if (dateFrom || dateTo) {
                where.createdAt = {}
                if (dateFrom) {
                    where.createdAt.gte = dateFrom
                }
                if (dateTo) {
                    where.createdAt.lte = dateTo
                }
            }

            // 获取所有符合条件的日志（限制最多10000条）
            const logs = await ctx.db.auditLog.findMany({
                where,
                take: 10000,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: {
                            email: true,
                            name: true,
                        },
                    },
                },
            })

            return logs
        }),
})
