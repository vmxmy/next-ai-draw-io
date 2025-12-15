import type { PrismaClient } from "@prisma/client"
import { initTRPC, TRPCError } from "@trpc/server"
import type { createTRPCContext } from "@/server/api/trpc"
import { protectedProcedure } from "@/server/api/trpc"

// 创建 tRPC 实例（用于中间件）
const t = initTRPC
    .context<Awaited<ReturnType<typeof createTRPCContext>>>()
    .create()

/**
 * 检查用户是否拥有指定权限
 */
async function checkUserPermission(
    db: PrismaClient,
    userId: string,
    permission: string,
): Promise<boolean> {
    // 获取用户的所有角色和权限
    const userRoles = await db.userRole.findMany({
        where: { userId },
        include: {
            role: {
                include: { permissions: true },
            },
        },
    })

    // 检查是否有超级管理员权限（通配符 "*"）
    const hasSuperAdmin = userRoles.some((ur) =>
        ur.role.permissions.some((p) => p.name === "*"),
    )
    if (hasSuperAdmin) return true

    // 检查具体权限
    const hasPermission = userRoles.some((ur) =>
        ur.role.permissions.some((p) => {
            // 精确匹配
            if (p.name === permission) return true
            // 资源级通配符，例如 "users:*" 匹配 "users:read"
            const [resource] = permission.split(":")
            if (p.name === `${resource}:*`) return true
            return false
        }),
    )

    return hasPermission
}

/**
 * 检查用户是否拥有指定角色
 */
async function checkUserRole(
    db: PrismaClient,
    userId: string,
    roleName: string,
): Promise<boolean> {
    const userRole = await db.userRole.findFirst({
        where: {
            userId,
            role: { name: roleName },
        },
    })

    return !!userRole
}

/**
 * 获取用户的所有权限
 */
export async function getUserPermissions(
    db: PrismaClient,
    userId: string,
): Promise<string[]> {
    const userRoles = await db.userRole.findMany({
        where: { userId },
        include: {
            role: {
                include: { permissions: true },
            },
        },
    })

    const permissions = new Set<string>()
    for (const ur of userRoles) {
        for (const perm of ur.role.permissions) {
            permissions.add(perm.name)
        }
    }

    return Array.from(permissions)
}

/**
 * 获取用户的所有角色
 */
export async function getUserRoles(db: PrismaClient, userId: string) {
    const userRoles = await db.userRole.findMany({
        where: { userId },
        include: { role: true },
    })

    return userRoles.map((ur) => ur.role)
}

/**
 * 创建权限检查中间件
 * @param permission 需要的权限，例如 "users:read"
 */
export function requirePermission(permission: string) {
    return t.middleware(async ({ ctx, next }) => {
        if (!ctx.session?.user?.id) {
            throw new TRPCError({ code: "UNAUTHORIZED" })
        }

        const hasPermission = await checkUserPermission(
            ctx.db,
            ctx.session.user.id,
            permission,
        )

        if (!hasPermission) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: `Missing permission: ${permission}`,
            })
        }

        return next({ ctx })
    })
}

/**
 * 创建角色检查中间件
 * @param roleName 需要的角色名称，例如 "superAdmin"
 */
export function requireRole(roleName: string) {
    return t.middleware(async ({ ctx, next }) => {
        if (!ctx.session?.user?.id) {
            throw new TRPCError({ code: "UNAUTHORIZED" })
        }

        const hasRole = await checkUserRole(
            ctx.db,
            ctx.session.user.id,
            roleName,
        )

        if (!hasRole) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: `Missing role: ${roleName}`,
            })
        }

        return next({ ctx })
    })
}

/**
 * 创建带权限检查的 procedure 工厂函数
 * @param permission 需要的权限
 */
export const createPermissionProcedure = (permission: string) =>
    protectedProcedure.use(requirePermission(permission))

/**
 * 创建带角色检查的 procedure 工厂函数
 * @param roleName 需要的角色
 */
export const createRoleProcedure = (roleName: string) =>
    protectedProcedure.use(requireRole(roleName))
