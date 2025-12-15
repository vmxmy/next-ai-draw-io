import { initTRPC } from "@trpc/server"
import type { createTRPCContext } from "@/server/api/trpc"

// 创建 tRPC 实例（用于中间件）
const t = initTRPC
    .context<Awaited<ReturnType<typeof createTRPCContext>>>()
    .create()

/**
 * 从 rawInput 中提取 resourceId
 */
function extractResourceId(rawInput: unknown): string {
    if (!rawInput || typeof rawInput !== "object") return "unknown"

    const input = rawInput as Record<string, unknown>

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
        if (input[field]) return String(input[field])
    }

    // 如果有多个 ID（批量操作）
    if (Array.isArray(input.userIds)) {
        return `bulk:${input.userIds.length} users`
    }

    return "unknown"
}

/**
 * 创建审计日志中间件
 * @param action 操作类型，例如 "user:update"
 * @param resourceType 资源类型，例如 "user"
 */
export function withAudit(action: string, resourceType: string) {
    return t.middleware(async ({ ctx, next, rawInput }) => {
        const startTime = Date.now()
        let status = "success"
        let errorMessage: string | null = null
        let result: unknown

        try {
            result = await next()
            return result
        } catch (error) {
            status = "failed"
            errorMessage =
                error instanceof Error ? error.message : "Unknown error"
            throw error
        } finally {
            // 仅为认证用户记录审计日志
            if (ctx.session?.user?.id) {
                const resourceId = extractResourceId(rawInput)

                // 异步记录审计日志，不阻塞响应
                void ctx.db.auditLog
                    .create({
                        data: {
                            userId: ctx.session.user.id,
                            action,
                            resourceType,
                            resourceId,
                            beforeValue: null, // 后续优化：获取变更前的值
                            afterValue: null, // 后续优化：记录结果
                            changesSummary: `${action} on ${resourceType}:${resourceId}`,
                            ipAddress: null, // 后续优化：从 headers 获取
                            userAgent: null, // 后续优化：从 headers 获取
                            status,
                            errorMessage,
                        },
                    })
                    .catch((err) => {
                        // 审计日志失败不应影响业务逻辑
                        console.error(
                            "[audit] Failed to create audit log:",
                            err,
                        )
                    })
            }
        }
    })
}
