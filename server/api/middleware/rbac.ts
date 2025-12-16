import type { PrismaClient } from "@prisma/client"
import { initTRPC, TRPCError } from "@trpc/server"
import type { createTRPCContext } from "@/server/api/trpc"
import { protectedProcedure } from "@/server/api/trpc"

// 创建 tRPC 实例（用于中间件）
const t = initTRPC
    .context<Awaited<ReturnType<typeof createTRPCContext>>>()
    .create()

// 权限缓存配置
const PERMISSION_CACHE_TTL_MS = 60_000 // 1 分钟缓存
const PERMISSION_CACHE_MAX_SIZE = 1000 // 最多缓存 1000 个用户

// 简单的 LRU 缓存实现
interface CacheEntry {
    permissions: string[]
    expiresAt: number
}

const permissionCache = new Map<string, CacheEntry>()

function getCachedPermissions(userId: string): string[] | null {
    const entry = permissionCache.get(userId)
    if (!entry) return null
    if (Date.now() >= entry.expiresAt) {
        permissionCache.delete(userId)
        return null
    }
    return entry.permissions
}

function setCachedPermissions(userId: string, permissions: string[]): void {
    // 简单的大小限制：超过最大值时清空缓存
    if (permissionCache.size >= PERMISSION_CACHE_MAX_SIZE) {
        permissionCache.clear()
    }
    permissionCache.set(userId, {
        permissions,
        expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS,
    })
}

/**
 * 清除指定用户的权限缓存
 * 在用户角色变更时调用
 */
export function invalidatePermissionCache(userId: string): void {
    permissionCache.delete(userId)
}

/**
 * 检查用户是否拥有指定权限
 * 使用缓存优化性能
 */
async function checkUserPermission(
    db: PrismaClient,
    userId: string,
    permission: string,
): Promise<boolean> {
    // 先检查缓存
    let allPermissions = getCachedPermissions(userId)

    if (!allPermissions) {
        // 缓存未命中，从数据库获取
        const userRoles = await db.userRole.findMany({
            where: { userId },
            include: {
                role: {
                    include: { permissions: true },
                },
            },
        })

        // 收集所有权限
        allPermissions = []
        for (const ur of userRoles) {
            for (const p of ur.role.permissions) {
                allPermissions.push(p.name)
            }
        }

        // 存入缓存
        setCachedPermissions(userId, allPermissions)
    }

    // 检查是否有超级管理员权限（通配符 "*"）
    if (allPermissions.includes("*")) return true

    // 检查具体权限
    if (allPermissions.includes(permission)) return true

    // 检查资源级通配符，例如 "users:*" 匹配 "users:read"
    const [resource] = permission.split(":")
    if (allPermissions.includes(`${resource}:*`)) return true

    return false
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
 * 使用缓存优化性能
 */
export async function getUserPermissions(
    db: PrismaClient,
    userId: string,
): Promise<string[]> {
    // 先检查缓存
    const cached = getCachedPermissions(userId)
    if (cached) return cached

    // 缓存未命中，从数据库获取
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

    const result = Array.from(permissions)

    // 存入缓存
    setCachedPermissions(userId, result)

    return result
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
