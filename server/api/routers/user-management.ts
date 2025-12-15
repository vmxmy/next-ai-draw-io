import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { withAudit } from "@/server/api/middleware/audit"
import {
    createPermissionProcedure,
    getUserPermissions,
    getUserRoles,
} from "@/server/api/middleware/rbac"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"

export const userManagementRouter = createTRPCRouter({
    // === 获取当前用户的角色和权限（用于前端权限判断）===

    getMyRoles: protectedProcedure.query(async ({ ctx }) => {
        const roles = await getUserRoles(ctx.db, ctx.session.user.id)
        return roles
    }),

    getMyPermissions: protectedProcedure.query(async ({ ctx }) => {
        const permissions = await getUserPermissions(
            ctx.db,
            ctx.session.user.id,
        )
        return permissions
    }),

    // === 用户列表查询 ===

    list: createPermissionProcedure("users:read")
        .input(
            z.object({
                page: z.number().min(1).default(1),
                pageSize: z.number().min(1).max(100).default(20),
                search: z.string().optional(),
                tier: z.string().optional(),
                status: z.enum(["active", "suspended"]).optional(),
                sortBy: z
                    .enum(["createdAt", "email", "tier"])
                    .default("createdAt"),
                sortOrder: z.enum(["asc", "desc"]).default("desc"),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { page, pageSize, search, tier, status, sortBy, sortOrder } =
                input

            // 构建查询条件
            const where: any = {}

            if (search) {
                where.OR = [
                    { email: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                    { phone: { contains: search } },
                ]
            }

            if (tier) {
                where.tier = tier
            }

            if (status) {
                where.status = status
            }

            // 查询总数
            const total = await ctx.db.user.count({ where })

            // 查询数据
            const users = await ctx.db.user.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { [sortBy]: sortOrder },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    phone: true,
                    tier: true,
                    tierExpiresAt: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    roles: {
                        include: {
                            role: true,
                        },
                    },
                },
            })

            return {
                users,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        }),

    // === 获取用户详情 ===

    getDetail: createPermissionProcedure("users:read")
        .input(z.object({ userId: z.string() }))
        .query(async ({ ctx, input }) => {
            const user = await ctx.db.user.findUnique({
                where: { id: input.userId },
                include: {
                    roles: {
                        include: {
                            role: {
                                include: {
                                    permissions: true,
                                },
                            },
                        },
                    },
                    quotaUsage: {
                        orderBy: { updatedAt: "desc" },
                        take: 10,
                    },
                    sessions: {
                        where: { expires: { gt: new Date() } },
                        orderBy: { expires: "desc" },
                    },
                },
            })

            if (!user) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "User not found",
                })
            }

            return user
        }),

    // === 更新用户信息 ===

    update: createPermissionProcedure("users:write")
        .use(withAudit("user:update", "user"))
        .input(
            z.object({
                userId: z.string(),
                tier: z.string().optional(),
                tierExpiresAt: z.date().optional().nullable(),
                status: z.enum(["active", "suspended"]).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { userId, ...data } = input

            const user = await ctx.db.user.update({
                where: { id: userId },
                data,
            })

            return user
        }),

    // === 禁用用户 ===

    suspend: createPermissionProcedure("users:write")
        .use(withAudit("user:suspend", "user"))
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const user = await ctx.db.user.update({
                where: { id: input.userId },
                data: { status: "suspended" },
            })

            return user
        }),

    // === 启用用户 ===

    activate: createPermissionProcedure("users:write")
        .use(withAudit("user:activate", "user"))
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const user = await ctx.db.user.update({
                where: { id: input.userId },
                data: { status: "active" },
            })

            return user
        }),

    // === 分配角色 ===

    assignRole: createPermissionProcedure("users:write")
        .use(withAudit("user:assign_role", "user"))
        .input(
            z.object({
                userId: z.string(),
                roleId: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // 检查是否已有该角色
            const existing = await ctx.db.userRole.findUnique({
                where: {
                    userId_roleId: {
                        userId: input.userId,
                        roleId: input.roleId,
                    },
                },
            })

            if (existing) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "User already has this role",
                })
            }

            const userRole = await ctx.db.userRole.create({
                data: {
                    userId: input.userId,
                    roleId: input.roleId,
                },
                include: {
                    role: true,
                },
            })

            return userRole
        }),

    // === 移除角色 ===

    removeRole: createPermissionProcedure("users:write")
        .use(withAudit("user:remove_role", "user"))
        .input(
            z.object({
                userId: z.string(),
                roleId: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            await ctx.db.userRole.delete({
                where: {
                    userId_roleId: {
                        userId: input.userId,
                        roleId: input.roleId,
                    },
                },
            })

            return { success: true }
        }),

    // === 获取所有角色（用于下拉选择）===

    listRoles: createPermissionProcedure("users:read").query(
        async ({ ctx }) => {
            const roles = await ctx.db.role.findMany({
                include: {
                    permissions: true,
                },
            })

            return roles
        },
    ),

    // === 获取用户统计（仪表板用）===

    getStats: createPermissionProcedure("users:read").query(async ({ ctx }) => {
        const [totalUsers, activeUsers, suspendedUsers, tierStats] =
            await Promise.all([
                ctx.db.user.count(),
                ctx.db.user.count({ where: { status: "active" } }),
                ctx.db.user.count({ where: { status: "suspended" } }),
                ctx.db.user.groupBy({
                    by: ["tier"],
                    _count: { tier: true },
                }),
            ])

        return {
            totalUsers,
            activeUsers,
            suspendedUsers,
            tierStats: tierStats.map((s) => ({
                tier: s.tier,
                count: s._count.tier,
            })),
        }
    }),
})
