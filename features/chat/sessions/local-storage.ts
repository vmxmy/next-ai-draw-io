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
    try {
        const raw = localStorage.getItem(STORAGE_CONVERSATIONS_KEY(userId))
        const metas = raw ? (JSON.parse(raw) as unknown) : []
        return Array.isArray(metas) ? (metas as ConversationMeta[]) : []
    } catch {
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
    try {
        const raw = localStorage.getItem(conversationStorageKey(userId, id))
        if (!raw) return null
        return JSON.parse(raw) as ConversationPayload
    } catch {
        return null
    }
}

export function writeConversationPayloadToStorage(
    userId: string,
    id: string,
    payload: ConversationPayload,
) {
    try {
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
