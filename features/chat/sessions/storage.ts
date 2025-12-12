import type { ChatMessage } from "@/features/chat/ai/types"

// localStorage keys for persistence
// Legacy single-session keys (used only for migration)
export const STORAGE_MESSAGES_KEY = "next-ai-draw-io-messages"
export const STORAGE_XML_SNAPSHOTS_KEY = "next-ai-draw-io-xml-snapshots"
export const STORAGE_SESSION_ID_KEY = "next-ai-draw-io-session-id"

// Multi-session keys
export const STORAGE_CONVERSATIONS_KEY = "next-ai-draw-io-conversations"
export const STORAGE_CURRENT_CONVERSATION_ID_KEY =
    "next-ai-draw-io-current-conversation-id"

export const conversationStorageKey = (id: string) =>
    `next-ai-draw-io-conversation:${id}`

// 云端同步（登录态）游标
const STORAGE_SYNC_CURSOR_PREFIX = "next-ai-draw-io-sync-cursor:"
export const syncCursorStorageKey = (userId: string) =>
    `${STORAGE_SYNC_CURSOR_PREFIX}${userId}`

export interface ConversationMeta {
    id: string
    createdAt: number
    updatedAt: number
    title?: string
}

export interface ConversationPayload {
    messages: ChatMessage[]
    xml: string
    snapshots: [number, string][]
    sessionId: string
}

export const createConversationId = () =>
    `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const createSessionId = () =>
    `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
