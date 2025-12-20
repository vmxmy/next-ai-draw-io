import type { ChatMessage, MessagePart } from "./types"

/**
 * 清理消息历史，确保 tool-call/tool-result 配对完整
 *
 * AI SDK 要求：
 * - 含 function call 的 assistant 消息必须紧跟在 user 消息或 tool 响应之后
 * - tool-call 后必须立刻跟 tool 响应
 *
 * 从存储恢复消息时，可能因为截断或错误导致配对不完整，需要清理。
 */
export function sanitizeMessagesForToolCalling(
    messages: ChatMessage[],
): ChatMessage[] {
    if (!messages || messages.length === 0) return []

    const hasToolCall = (msg: ChatMessage): boolean => {
        if (msg.role !== "assistant") return false
        const parts = msg.parts as MessagePart[] | undefined
        if (!Array.isArray(parts)) return false
        return parts.some(
            (p) => p.type === "tool-call" || p.type === "tool-invocation",
        )
    }

    const hasToolResult = (msg: ChatMessage): boolean => {
        if (msg.role !== "assistant") return false
        const parts = msg.parts as MessagePart[] | undefined
        if (!Array.isArray(parts)) return false
        return parts.some((p) => p.type === "tool-result")
    }

    const isToolMessage = (msg: ChatMessage): boolean => {
        return msg.role === "tool"
    }

    // 第一遍：合并连续的 assistant 消息
    const merged: ChatMessage[] = []
    for (const msg of messages) {
        const prev = merged[merged.length - 1]
        if (
            prev &&
            prev.role === "assistant" &&
            msg.role === "assistant" &&
            !hasToolCall(prev) &&
            !hasToolCall(msg)
        ) {
            // 合并 parts
            const prevParts = (prev.parts as MessagePart[]) || []
            const currParts = (msg.parts as MessagePart[]) || []
            prev.parts = [...prevParts, ...currParts]
        } else {
            merged.push({ ...msg })
        }
    }

    // 第二遍：移除孤儿 tool-call 和孤儿 tool 响应
    const cleaned: ChatMessage[] = []
    for (let i = 0; i < merged.length; i++) {
        const msg = merged[i]
        if (!msg) continue

        // 检查 tool 消息是否有前置 tool-call
        if (isToolMessage(msg)) {
            const prev = cleaned[cleaned.length - 1]
            if (!prev || !hasToolCall(prev)) {
                console.warn(
                    "[sanitize] Skipping orphan tool response (no preceding tool-call)",
                )
                continue
            }
            cleaned.push(msg)
            continue
        }

        // 检查带 tool-call 的 assistant 消息是否有后续 tool 响应
        if (hasToolCall(msg)) {
            const next = merged[i + 1]
            if (!next || !isToolMessage(next)) {
                console.warn(
                    "[sanitize] Stripping tool-call from assistant (no following tool response)",
                )
                // 移除 tool-call parts，保留其他 parts
                const parts = (msg.parts as MessagePart[]) || []
                const keptParts = parts.filter(
                    (p) =>
                        p.type !== "tool-call" && p.type !== "tool-invocation",
                )
                if (keptParts.length > 0) {
                    cleaned.push({ ...msg, parts: keptParts })
                }
                continue
            }
        }

        // 检查带 tool-result 的 assistant 消息（来自 addToolOutput）
        if (hasToolResult(msg)) {
            // 这种情况一般是正常的，tool-result 是对 tool-call 的响应
            cleaned.push(msg)
            continue
        }

        cleaned.push(msg)
    }

    return cleaned
}
