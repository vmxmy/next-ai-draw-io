import type { ChatMessage, MessagePart } from "@/features/chat/ai/types"

export const TOOL_ERROR_STATE = "output-error" as const

// 是否需要自动重试：只看最后一条 assistant 的 tool parts
export function hasToolErrors(messages: ChatMessage[]): boolean {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== "assistant") {
        return false
    }

    const toolParts =
        (lastMessage.parts as MessagePart[] | undefined)?.filter((part) =>
            part.type?.startsWith("tool-"),
        ) || []

    if (toolParts.length === 0) return false
    return toolParts.some((part) => part.state === TOOL_ERROR_STATE)
}

export function getLastToolErrorName(messages: ChatMessage[]): string | null {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== "assistant") {
        return null
    }

    const toolParts =
        (lastMessage.parts as MessagePart[] | undefined)?.filter((part) =>
            part.type?.startsWith("tool-"),
        ) || []

    const lastError = toolParts.find((part) => part.state === TOOL_ERROR_STATE)
    return lastError?.toolName ? String(lastError.toolName) : null
}
