"use client"

import type {
    ConversationMeta,
    ConversationPayload,
} from "@/features/chat/sessions/storage"
import {
    conversationStorageKey,
    STORAGE_CONVERSATIONS_KEY,
    STORAGE_CURRENT_CONVERSATION_ID_KEY,
} from "@/features/chat/sessions/storage"

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
    } catch {
        // ignore
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
        localStorage.setItem(
            conversationStorageKey(id),
            JSON.stringify(payload),
        )
    } catch {
        // ignore
    }
}

export function removeConversationPayloadFromStorage(id: string) {
    try {
        localStorage.removeItem(conversationStorageKey(id))
    } catch {
        // ignore
    }
}
