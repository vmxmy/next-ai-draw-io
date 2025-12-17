"use client"

import {
    readConversationMetasFromStorage,
    readConversationPayloadFromStorage,
    readCurrentConversationIdFromStorage,
    removeConversationPayloadFromStorage,
    writeConversationMetasToStorage,
    writeConversationPayloadToStorage,
    writeCurrentConversationIdToStorage,
} from "@/features/chat/sessions/local-storage"
import type {
    ConversationMeta,
    ConversationPayload,
} from "@/features/chat/sessions/storage"
import { deriveConversationTitle } from "../hooks"
import type {
    ConversationStorageAdapter,
    CreateStorageAdapter,
    LocalAdapterConfig,
} from "./types"

/**
 * 创建本地存储适配器
 *
 * 封装 localStorage 操作，提供统一的 ConversationStorageAdapter 接口
 */
export const createLocalStorageAdapter: CreateStorageAdapter<
    LocalAdapterConfig
> = ({ userId, queuePushConversation }): ConversationStorageAdapter => {
    // 内存缓存，避免频繁读取 localStorage
    let cachedConversations: ConversationMeta[] = []

    return {
        // =====================
        // 读取操作
        // =====================

        listConversations(): ConversationMeta[] {
            const metas = readConversationMetasFromStorage(userId)
            cachedConversations = metas
            return metas
        },

        loadConversation(id: string): ConversationPayload | null {
            return readConversationPayloadFromStorage(userId, id)
        },

        getCurrentConversationId(): string {
            return readCurrentConversationIdFromStorage(userId)
        },

        // =====================
        // 写入操作
        // =====================

        createConversation(
            id: string,
            payload: ConversationPayload,
            timestamp: number,
        ): boolean {
            try {
                writeConversationPayloadToStorage(userId, id, payload)

                const newMeta: ConversationMeta = {
                    id,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    title: deriveConversationTitle(payload.messages),
                }

                const metas = readConversationMetasFromStorage(userId)
                const nextMetas = [newMeta, ...metas]
                writeConversationMetasToStorage(userId, nextMetas)
                writeCurrentConversationIdToStorage(userId, id)

                cachedConversations = nextMetas

                // 通知云端（如果配置了）
                queuePushConversation?.(id, { immediate: true })

                return true
            } catch (error) {
                console.error("Failed to create conversation:", error)
                return false
            }
        },

        saveConversation(
            id: string,
            payload: Partial<ConversationPayload>,
        ): void {
            try {
                const existing = readConversationPayloadFromStorage(userId, id)
                if (!existing) return

                const merged: ConversationPayload = {
                    ...existing,
                    ...payload,
                    messages: payload.messages ?? existing.messages,
                    xml: payload.xml ?? existing.xml,
                    sessionId: payload.sessionId ?? existing.sessionId,
                }

                writeConversationPayloadToStorage(userId, id, merged)

                // 更新元数据
                const metas = readConversationMetasFromStorage(userId)
                const now = Date.now()
                const nextMetas = metas.map((m) =>
                    m.id === id
                        ? {
                              ...m,
                              updatedAt: now,
                              title:
                                  m.title ||
                                  deriveConversationTitle(merged.messages),
                          }
                        : m,
                )
                writeConversationMetasToStorage(userId, nextMetas)
                cachedConversations = nextMetas

                // 通知云端（如果配置了）
                queuePushConversation?.(id)
            } catch (error) {
                console.error("Failed to save conversation:", error)
            }
        },

        saveImmediately(id: string, payload: ConversationPayload): void {
            // 同步保存，用于 beforeunload/visibilitychange
            try {
                writeConversationPayloadToStorage(userId, id, payload)

                // 更新元数据
                const metas = readConversationMetasFromStorage(userId)
                const now = Date.now()
                const nextMetas = metas.map((m) =>
                    m.id === id
                        ? {
                              ...m,
                              updatedAt: now,
                              title:
                                  m.title ||
                                  deriveConversationTitle(payload.messages),
                          }
                        : m,
                )
                writeConversationMetasToStorage(userId, nextMetas)
                cachedConversations = nextMetas
            } catch (error) {
                console.error("Failed to persist state:", error)
            }
        },

        deleteConversation(id: string): void {
            try {
                // 通知云端删除（如果配置了）
                queuePushConversation?.(id, { immediate: true, deleted: true })

                removeConversationPayloadFromStorage(userId, id)

                const metas = readConversationMetasFromStorage(userId)
                const nextMetas = metas.filter((m) => m.id !== id)
                writeConversationMetasToStorage(userId, nextMetas)
                cachedConversations = nextMetas
            } catch (error) {
                console.error("Failed to delete conversation:", error)
            }
        },

        updateTitle(id: string, title: string): void {
            try {
                const metas = readConversationMetasFromStorage(userId)
                const now = Date.now()
                const nextMetas = metas.map((m) =>
                    m.id === id ? { ...m, title, updatedAt: now } : m,
                )
                writeConversationMetasToStorage(userId, nextMetas)
                cachedConversations = nextMetas

                // 通知云端更新标题
                queuePushConversation?.(id)
            } catch (error) {
                console.error("Failed to update title:", error)
            }
        },

        setCurrentConversationId(id: string): void {
            writeCurrentConversationIdToStorage(userId, id)
        },

        // =====================
        // 元数据操作
        // =====================

        updateMeta(
            id: string,
            updates: Partial<Omit<ConversationMeta, "id">>,
        ): void {
            try {
                const metas = readConversationMetasFromStorage(userId)
                const nextMetas = metas.map((m) =>
                    m.id === id ? { ...m, ...updates } : m,
                )
                writeConversationMetasToStorage(userId, nextMetas)
                cachedConversations = nextMetas
            } catch (error) {
                console.error("Failed to update meta:", error)
            }
        },

        getCachedConversations(): ConversationMeta[] {
            return cachedConversations
        },
    }
}
