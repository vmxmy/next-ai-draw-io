import { Prisma } from "@prisma/client"
import { initTRPC } from "@trpc/server"
import type { createTRPCContext } from "@/server/api/trpc"

// 创建 tRPC 实例（用于中间件）
const t = initTRPC
    .context<Awaited<ReturnType<typeof createTRPCContext>>>()
    .create()

/**
 * 从 input 中提取 resourceId
 */
function extractResourceId(input: unknown): string {
    if (!input || typeof input !== "object") return "unknown"

    const obj = input as Record<string, unknown>

    // 尝试常见的 ID 字段
    const idFields = [
        "id",
        "userId",
        "roleId",
        "tier",
        "key",
        "sessionId",
        "logId",
    ]

    for (const field of idFields) {
        if (obj[field]) return String(obj[field])
    }

    // 如果有多个 ID（批量操作）
    if (Array.isArray(obj.userIds)) {
        return `bulk:${obj.userIds.length} users`
    }

    return "unknown"
}

/**
 * 创建审计日志中间件
 * @param action 操作类型，例如 "user:update"
 * @param resourceType 资源类型，例如 "user"
 */
export function withAudit(action: string, resourceType: string) {
    return t.middleware(async ({ ctx, next, input }) => {
        const _startTime = Date.now()
        const _status = "success"
        const _errorMessage: string | null = null

        try {
            const result = await next()

            // 记录成功的审计日志
            if (ctx.session?.user?.id) {
                const resourceId = extractResourceId(input)
                void ctx.db.auditLog
                    .create({
                        data: {
                            userId: ctx.session.user.id,
                            action,
                            resourceType,
                            resourceId,
                            beforeValue: Prisma.JsonNull,
                            afterValue: Prisma.JsonNull,
                            changesSummary: `${action} on ${resourceType}:${resourceId}`,
                            ipAddress: null,
                            userAgent: null,
                            status: "success",
                            errorMessage: null,
                        },
                    })
                    .catch((err) => {
                        console.error(
                            "[audit] Failed to create audit log:",
                            err,
                        )
                    })
            }

            return result
        } catch (error) {
            // 记录失败的审计日志
            if (ctx.session?.user?.id) {
                const resourceId = extractResourceId(input)
                const errorMsg =
                    error instanceof Error ? error.message : "Unknown error"

                void ctx.db.auditLog
                    .create({
                        data: {
                            userId: ctx.session.user.id,
                            action,
                            resourceType,
                            resourceId,
                            beforeValue: Prisma.JsonNull,
                            afterValue: Prisma.JsonNull,
                            changesSummary: `${action} on ${resourceType}:${resourceId}`,
                            ipAddress: null,
                            userAgent: null,
                            status: "failed",
                            errorMessage: errorMsg,
                        },
                    })
                    .catch((err) => {
                        console.error(
                            "[audit] Failed to create audit log:",
                            err,
                        )
                    })
            }

            throw error
        }
    })
}
