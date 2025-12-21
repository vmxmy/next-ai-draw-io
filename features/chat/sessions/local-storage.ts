"use client"

import { toast } from "sonner"
import type {
    ConversationMeta,
    ConversationPayload,
} from "@/features/chat/sessions/storage"
import {
    conversationStorageKey,
    STORAGE_CONVERSATIONS_KEY,
    STORAGE_CURRENT_CONVERSATION_ID_KEY,
} from "@/features/chat/sessions/storage"

const STORAGE_WARNING_THRESHOLD = 0.8 // 80%

/**
 * Sanitize messages to fix tool call/response pairing issues.
 * This handles cases where:
 * 1. Tool messages have empty content (common with client-side tools like display_diagram)
 * 2. Tool-call parts exist without corresponding tool responses
 *
 * These issues can cause AI SDK validation errors when switching providers.
 */
function sanitizeMessages(messages: any[]): any[] {
    if (!Array.isArray(messages)) return []

    // First pass: find tool call IDs that have invalid (empty) responses
    const invalidToolCallIds = new Set<string>()
    messages.forEach((msg) => {
        if (msg.role === "tool") {
            const hasValidContent =
                Array.isArray(msg.parts) && msg.parts.length > 0
            if (!hasValidContent) {
                // Find the tool call ID from parts or content
                const toolCallId =
                    msg.parts?.[0]?.toolCallId ||
                    msg.toolInvocations?.[0]?.toolCallId
                if (toolCallId) {
                    invalidToolCallIds.add(toolCallId)
                    console.log(
                        `[sanitizeMessages] Found empty tool message for callId: ${toolCallId}`,
                    )
                }
            }
        }
    })

    if (invalidToolCallIds.size === 0) {
        return messages // No sanitization needed
    }

    // Second pass: remove invalid tool messages and their corresponding tool-calls
    const sanitized = messages
        .filter((msg) => {
            // Remove empty tool messages
            if (msg.role === "tool") {
                const hasValidContent =
                    Array.isArray(msg.parts) && msg.parts.length > 0
                if (!hasValidContent) {
                    console.log(
                        `[sanitizeMessages] Removing empty tool message`,
                    )
                    return false
                }
            }
            return true
        })
        .map((msg) => {
            // Remove orphan tool-call parts from assistant messages
            if (msg.role === "assistant" && Array.isArray(msg.parts)) {
                const filteredParts = msg.parts.filter((part: any) => {
                    if (
                        part.type === "tool-invocation" &&
                        invalidToolCallIds.has(part.toolInvocationId)
                    ) {
                        console.log(
                            `[sanitizeMessages] Removing orphan tool-invocation: ${part.toolInvocationId}`,
                        )
                        return false
                    }
                    return true
                })
                if (filteredParts.length !== msg.parts.length) {
                    return { ...msg, parts: filteredParts }
                }
            }
            return msg
        })
        .filter((msg) => {
            // Remove assistant messages that have no remaining content
            if (msg.role === "assistant") {
                const hasContent =
                    Array.isArray(msg.parts) && msg.parts.length > 0
                if (!hasContent) {
                    console.log(
                        `[sanitizeMessages] Removing empty assistant message`,
                    )
                    return false
                }
            }
            return true
        })

    console.log(
        `[sanitizeMessages] Removed ${messages.length - sanitized.length} problematic messages`,
    )
    return sanitized
}

export function cleanOldestConversations(
    userId: string,
    count: number,
): number {
    try {
        const metas = readConversationMetasFromStorage(userId)
        if (metas.length <= 1) return 0

        const sorted = [...metas].sort((a, b) => a.updatedAt - b.updatedAt)
        const toRemove = sorted.slice(0, Math.min(count, metas.length - 1))

        toRemove.forEach((meta) => {
            removeConversationPayloadFromStorage(userId, meta.id)
        })

        const remaining = metas.filter((m) => !toRemove.includes(m))
        localStorage.setItem(
            STORAGE_CONVERSATIONS_KEY(userId),
            JSON.stringify(remaining),
        )

        return toRemove.length
    } catch {
        return 0
    }
}

export function readConversationMetasFromStorage(
    userId: string,
): ConversationMeta[] {
    const storageKey = STORAGE_CONVERSATIONS_KEY(userId)
    console.log("[session-debug] readConversationMetasFromStorage", {
        userId,
        storageKey,
    })
    try {
        const raw = localStorage.getItem(storageKey)
        console.log("[session-debug] raw metas from localStorage", {
            hasData: !!raw,
            length: raw?.length ?? 0,
        })
        const metas = raw ? (JSON.parse(raw) as unknown) : []
        const result = Array.isArray(metas) ? (metas as ConversationMeta[]) : []
        console.log("[session-debug] parsed metas", {
            count: result.length,
            ids: result.map((m) => m.id),
        })
        return result
    } catch (error) {
        console.error(
            "[session-debug] readConversationMetasFromStorage error",
            error,
        )
        return []
    }
}

export function writeConversationMetasToStorage(
    userId: string,
    metas: ConversationMeta[],
) {
    try {
        localStorage.setItem(
            STORAGE_CONVERSATIONS_KEY(userId),
            JSON.stringify(metas),
        )
    } catch (error: any) {
        if (error?.name === "QuotaExceededError") {
            const removed = cleanOldestConversations(userId, 3)
            if (removed > 0) {
                toast.warning(`存储空间不足，已自动清理 ${removed} 个旧会话`, {
                    id: "storage-quota-metas",
                    duration: 3000,
                })
                try {
                    localStorage.setItem(
                        STORAGE_CONVERSATIONS_KEY(userId),
                        JSON.stringify(metas),
                    )
                } catch {
                    toast.error("存储空间已满，无法保存会话元数据", {
                        id: "storage-full-metas",
                        duration: 5000,
                    })
                }
            } else {
                toast.error("存储空间已满，无法保存会话", {
                    id: "storage-full-metas",
                    duration: 5000,
                })
            }
        }
        throw error
    }
}

export function readCurrentConversationIdFromStorage(userId: string): string {
    try {
        return (
            localStorage.getItem(STORAGE_CURRENT_CONVERSATION_ID_KEY(userId)) ||
            ""
        )
    } catch {
        return ""
    }
}

export function writeCurrentConversationIdToStorage(
    userId: string,
    id: string,
) {
    try {
        localStorage.setItem(STORAGE_CURRENT_CONVERSATION_ID_KEY(userId), id)
    } catch {
        // ignore
    }
}

export function readConversationPayloadFromStorage(
    userId: string,
    id: string,
): ConversationPayload | null {
    const storageKey = conversationStorageKey(userId, id)
    console.log("[session-debug] readConversationPayloadFromStorage", {
        userId,
        id,
        storageKey,
    })
    try {
        const raw = localStorage.getItem(storageKey)
        console.log("[session-debug] raw payload from localStorage", {
            hasData: !!raw,
            length: raw?.length ?? 0,
        })
        if (!raw) {
            console.log("[session-debug] no payload found in localStorage")
            return null
        }
        const payload = JSON.parse(raw) as ConversationPayload
        console.log("[session-debug] parsed payload", {
            hasMessages: !!payload.messages,
            messageCount: payload.messages?.length ?? 0,
            hasXml: !!payload.xml,
            xmlLength: payload.xml?.length ?? 0,
            hasSessionId: !!payload.sessionId,
            hasDiagramVersions: !!payload.diagramVersions,
            diagramVersionCount: payload.diagramVersions?.length ?? 0,
        })

        // 检测并清理旧的压缩数据
        // 如果 XML 字段不是以 '<' 开头，说明可能是压缩数据，删除并返回 null
        if (payload.xml && !payload.xml.trimStart().startsWith("<")) {
            console.warn(
                `[session-debug] 检测到旧的压缩数据，正在清理会话 ${id}，将从云端重新加载`,
            )
            removeConversationPayloadFromStorage(userId, id)
            return null
        }

        // 检查快照中的 XML
        if (Array.isArray(payload.snapshots)) {
            const hasCompressedSnapshot = payload.snapshots.some(
                ([, xml]) => xml && !xml.trimStart().startsWith("<"),
            )
            if (hasCompressedSnapshot) {
                console.warn(
                    `[session-debug] 检测到旧的压缩快照数据，正在清理会话 ${id}，将从云端重新加载`,
                )
                removeConversationPayloadFromStorage(userId, id)
                return null
            }
        }

        // 检查图表版本中的 XML
        if (Array.isArray(payload.diagramVersions)) {
            const hasCompressedVersion = payload.diagramVersions.some(
                (ver) => ver.xml && !ver.xml.trimStart().startsWith("<"),
            )
            if (hasCompressedVersion) {
                console.warn(
                    `[session-debug] 检测到旧的压缩版本数据，正在清理会话 ${id}，将从云端重新加载`,
                )
                removeConversationPayloadFromStorage(userId, id)
                return null
            }
        }

        // Sanitize messages to fix tool call/response pairing issues
        if (payload.messages) {
            const originalCount = payload.messages.length
            payload.messages = sanitizeMessages(payload.messages)
            if (payload.messages.length !== originalCount) {
                console.log(
                    `[session-debug] sanitized messages: ${originalCount} -> ${payload.messages.length}`,
                )
            }
        }

        console.log(
            "[session-debug] payload validation passed, returning payload",
        )
        return payload
    } catch (error) {
        console.error(
            "[session-debug] readConversationPayloadFromStorage error",
            error,
        )
        return null
    }
}

export function writeConversationPayloadToStorage(
    userId: string,
    id: string,
    payload: ConversationPayload,
) {
    try {
        // 匿名用户简化模式：不进行优化，直接保存
        const serialized = JSON.stringify(payload)

        // 检查 quota（异步，不阻塞）
        if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
            navigator.storage
                .estimate()
                .then((estimate) => {
                    const usage = (estimate.usage || 0) / (estimate.quota || 1)
                    if (usage > STORAGE_WARNING_THRESHOLD) {
                        toast.warning(
                            `存储空间使用 ${Math.round(usage * 100)}%，请考虑清理旧会话`,
                            { id: "storage-warning", duration: 5000 },
                        )
                    }
                })
                .catch(() => {
                    // ignore
                })
        }

        localStorage.setItem(conversationStorageKey(userId, id), serialized)
    } catch (error: any) {
        if (error?.name === "QuotaExceededError") {
            const removed = cleanOldestConversations(userId, 5)
            if (removed > 0) {
                toast.warning(`存储空间不足，已自动清理 ${removed} 个旧会话`, {
                    id: "storage-quota-payload",
                    duration: 3000,
                })
                try {
                    // 重试保存
                    localStorage.setItem(
                        conversationStorageKey(userId, id),
                        JSON.stringify(payload),
                    )
                    return
                } catch {
                    // 清理后仍然失败
                }
            }
            toast.error("存储空间已满，无法保存会话数据", {
                id: "storage-full-payload",
                duration: 5000,
            })
        }
        throw error
    }
}

export function removeConversationPayloadFromStorage(
    userId: string,
    id: string,
) {
    try {
        localStorage.removeItem(conversationStorageKey(userId, id))
    } catch {
        // ignore
    }
}
