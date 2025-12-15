import type { ConversationPayload } from "@/features/chat/sessions/storage"

// 配置参数
const MAX_MESSAGES = 100 // 最多保留 100 条消息
const MAX_SNAPSHOTS = 20 // 最多保留 20 个快照
const MAX_DIAGRAM_VERSIONS = 50 // 最多保留 50 个图表版本
const MAX_TOOL_RESULT_LENGTH = 5000 // 工具调用结果最大长度
const MAX_ERROR_MESSAGE_LENGTH = 200 // 错误消息最大长度

interface ErrorSummary {
    type: string
    location: string
    message: string
}

/**
 * Extract concise error summary from error text
 */
function extractErrorSummary(errorText: string): ErrorSummary {
    if (!errorText) {
        return {
            type: "unknown",
            location: "unknown",
            message: "Error occurred",
        }
    }

    // Parse XML errors
    const uncloseMatch = errorText.match(/unclosed tag:\s*(\w+)/i)
    if (uncloseMatch) {
        return {
            type: "unclosed-tag",
            location: uncloseMatch[1],
            message: `Unclosed tag: ${uncloseMatch[1]}`,
        }
    }

    const entityMatch = errorText.match(/undefined entity:\s*&(\w+)/i)
    if (entityMatch) {
        return {
            type: "invalid-entity",
            location: entityMatch[1],
            message: `Invalid entity: &${entityMatch[1]}`,
        }
    }

    const invalidCharMatch = errorText.match(
        /invalid character|not well-formed/i,
    )
    if (invalidCharMatch) {
        return {
            type: "malformed-xml",
            location: "unknown",
            message: "XML is not well-formed",
        }
    }

    // Generic error
    return {
        type: "generic",
        location: "unknown",
        message: errorText.slice(0, MAX_ERROR_MESSAGE_LENGTH),
    }
}

/**
 * Compress failed tool calls to save tokens
 */
function compressFailedToolCall(inv: any): any {
    // Only compress failed tool calls
    if (
        inv.state !== "result" ||
        !inv.result ||
        typeof inv.result !== "string"
    ) {
        return inv
    }

    // Check if this is an error result (contains error indicators)
    const isError =
        inv.result.includes("Error") || inv.result.includes("Failed")
    if (!isError) {
        return inv
    }

    // Extract error summary
    const errorSummary = extractErrorSummary(inv.result)

    // Compress the tool call
    return {
        ...inv,
        // Replace full input with summary if it's too large
        args:
            inv.args &&
            typeof inv.args === "object" &&
            JSON.stringify(inv.args).length > 1000
                ? {
                      summary:
                          "[Failed XML - compressed for context management]",
                      errorType: errorSummary.type,
                      errorLocation: errorSummary.location,
                  }
                : inv.args,
        // Compress error message
        result: `${errorSummary.message}\n[Full error compressed - original length: ${inv.result.length} chars]`,
    }
}

/**
 * 截断大型工具调用结果
 */
function truncateToolResults(messages: any[]): any[] {
    return messages.map((msg) => {
        if (msg.role === "assistant" && Array.isArray(msg.toolInvocations)) {
            return {
                ...msg,
                toolInvocations: msg.toolInvocations.map((inv: any) => {
                    // First, try to compress failed tool calls
                    const compressed = compressFailedToolCall(inv)

                    // Then, truncate large successful results
                    if (
                        compressed.state === "result" &&
                        typeof compressed.result === "string" &&
                        compressed.result.length > MAX_TOOL_RESULT_LENGTH
                    ) {
                        return {
                            ...compressed,
                            result: `${compressed.result.slice(0, MAX_TOOL_RESULT_LENGTH)}...\n[输出过大已截断，原长度: ${compressed.result.length} 字符]`,
                        }
                    }
                    return compressed
                }),
            }
        }
        return msg
    })
}

/**
 * 优化会话数据以减少存储空间（仅保留大小限制，不压缩）
 */
export function optimizePayload(
    payload: ConversationPayload,
): ConversationPayload {
    const optimized = { ...payload }

    // 1. 限制消息数量（保留最近的）
    if (
        Array.isArray(optimized.messages) &&
        optimized.messages.length > MAX_MESSAGES
    ) {
        optimized.messages = optimized.messages.slice(-MAX_MESSAGES)
    }

    // 2. 截断大型工具调用结果
    if (Array.isArray(optimized.messages)) {
        optimized.messages = truncateToolResults(optimized.messages)
    }

    // 3. 限制快照数量
    if (
        Array.isArray(optimized.snapshots) &&
        optimized.snapshots.length > MAX_SNAPSHOTS
    ) {
        optimized.snapshots = optimized.snapshots.slice(-MAX_SNAPSHOTS)
    }

    // 4. 限制图表版本数量
    if (
        Array.isArray(optimized.diagramVersions) &&
        optimized.diagramVersions.length > MAX_DIAGRAM_VERSIONS
    ) {
        optimized.diagramVersions = optimized.diagramVersions.slice(
            -MAX_DIAGRAM_VERSIONS,
        )
    }

    return optimized
}

/**
 * 估算对象的存储大小（字节）
 */
export function estimateStorageSize(obj: any): number {
    try {
        const json = JSON.stringify(obj)
        // UTF-16 编码，每个字符 2 字节
        return json.length * 2
    } catch {
        return 0
    }
}

/**
 * 格式化存储大小为人类可读格式
 */
export function formatStorageSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
