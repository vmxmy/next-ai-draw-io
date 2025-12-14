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
const STORAGE_CRITICAL_THRESHOLD = 0.95 // 95%

async function checkStorageQuota(): Promise<{
    usage: number
    isWarning: boolean
    isCritical: boolean
}> {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
        return { usage: 0, isWarning: false, isCritical: false }
    }

    try {
        const estimate = await navigator.storage.estimate()
        const usage = (estimate.usage || 0) / (estimate.quota || 1)
        return {
            usage,
            isWarning: usage > STORAGE_WARNING_THRESHOLD,
            isCritical: usage > STORAGE_CRITICAL_THRESHOLD,
        }
    } catch {
        return { usage: 0, isWarning: false, isCritical: false }
    }
}

export function cleanOldestConversations(count: number): number {
    try {
        const metas = readConversationMetasFromStorage()
        if (metas.length <= 1) return 0

        const sorted = [...metas].sort((a, b) => a.updatedAt - b.updatedAt)
        const toRemove = sorted.slice(0, Math.min(count, metas.length - 1))

        toRemove.forEach((meta) => {
            removeConversationPayloadFromStorage(meta.id)
        })

        const remaining = metas.filter((m) => !toRemove.includes(m))
        localStorage.setItem(
            STORAGE_CONVERSATIONS_KEY,
            JSON.stringify(remaining),
        )

        return toRemove.length
    } catch {
        return 0
    }
}

export function readConversationMetasFromStorage(): ConversationMeta[] {
    try {
        const raw = localStorage.getItem(STORAGE_CONVERSATIONS_KEY)
        const metas = raw ? (JSON.parse(raw) as unknown) : []
        return Array.isArray(metas) ? (metas as ConversationMeta[]) : []
    } catch {
        return []
    }
}

export function writeConversationMetasToStorage(metas: ConversationMeta[]) {
    try {
        localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(metas))
    } catch (error: any) {
        if (error?.name === "QuotaExceededError") {
            const removed = cleanOldestConversations(3)
            if (removed > 0) {
                toast.warning(`存储空间不足，已自动清理 ${removed} 个旧会话`)
                try {
                    localStorage.setItem(
                        STORAGE_CONVERSATIONS_KEY,
                        JSON.stringify(metas),
                    )
                } catch {
                    toast.error("存储空间已满，无法保存会话元数据")
                }
            } else {
                toast.error("存储空间已满，无法保存会话")
            }
        }
        throw error
    }
}

export function readCurrentConversationIdFromStorage(): string {
    try {
        return localStorage.getItem(STORAGE_CURRENT_CONVERSATION_ID_KEY) || ""
    } catch {
        return ""
    }
}

export function writeCurrentConversationIdToStorage(id: string) {
    try {
        localStorage.setItem(STORAGE_CURRENT_CONVERSATION_ID_KEY, id)
    } catch {
        // ignore
    }
}

export function readConversationPayloadFromStorage(
    id: string,
): ConversationPayload | null {
    try {
        const raw = localStorage.getItem(conversationStorageKey(id))
        if (!raw) return null
        return JSON.parse(raw) as ConversationPayload
    } catch {
        return null
    }
}

export function writeConversationPayloadToStorage(
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

        localStorage.setItem(conversationStorageKey(id), serialized)
    } catch (error: any) {
        if (error?.name === "QuotaExceededError") {
            const removed = cleanOldestConversations(5)
            if (removed > 0) {
                toast.warning(`存储空间不足，已自动清理 ${removed} 个旧会话`)
                try {
                    localStorage.setItem(
                        conversationStorageKey(id),
                        JSON.stringify(payload),
                    )
                    return
                } catch {
                    // 清理后仍然失败
                }
            }
            toast.error("存储空间已满，无法保存会话数据")
        }
        throw error
    }
}

export function removeConversationPayloadFromStorage(id: string) {
    try {
        localStorage.removeItem(conversationStorageKey(id))
    } catch {
        // ignore
    }
}
