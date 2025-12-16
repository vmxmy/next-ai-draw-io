import { useCallback } from "react"
import type { ChatMessage } from "@/features/chat/ai/types"
import type { ConversationMeta } from "@/features/chat/sessions/storage"

/**
 * 从消息列表中提取会话标题
 * 使用第一条用户消息的前 24 个字符作为标题
 */
export function deriveConversationTitle(
    messages: ChatMessage[],
): string | undefined {
    const firstUser = messages.find((m) => m.role === "user") as any
    const textPart =
        firstUser?.parts?.find((p: any) => p.type === "text")?.text || ""
    const trimmed = String(textPart).trim()
    if (!trimmed) return undefined
    return trimmed.slice(0, 24)
}

export interface UseConversationTitlesOptions {
    conversations: ConversationMeta[]
    locale: string
}

/**
 * 会话标题管理 Hook
 * 提供标题派生和显示功能
 */
export function useConversationTitles({
    conversations,
    locale,
}: UseConversationTitlesOptions) {
    /**
     * 获取会话的显示标题
     * 优先使用保存的标题，否则使用 "会话 N" 格式
     */
    const getConversationDisplayTitle = useCallback(
        (id: string): string => {
            const idx = conversations.findIndex((c) => c.id === id)
            const meta = idx >= 0 ? conversations[idx] : undefined
            if (meta?.title) return meta.title
            if (idx >= 0) {
                return locale === "zh-CN"
                    ? `会话 ${idx + 1}`
                    : `Session ${idx + 1}`
            }
            return id
        },
        [conversations, locale],
    )

    return {
        deriveConversationTitle,
        getConversationDisplayTitle,
    }
}
