"use client"

import {
    readConversationMetasFromStorage,
    readConversationPayloadFromStorage,
    readCurrentConversationIdFromStorage,
    writeConversationMetasToStorage,
    writeConversationPayloadToStorage,
    writeCurrentConversationIdToStorage,
} from "@/features/chat/sessions/local-storage"
import type {
    ConversationMeta,
    ConversationPayload,
} from "@/features/chat/sessions/storage"
import { deriveConversationTitle } from "../hooks"
import type { ConversationStorageAdapter } from "./types"

/**
 * 云端存储适配器配置
 */
export interface CloudStorageAdapterConfig {
    userId: string
    /**
     * 推送会话变更到云端
     */
    pushMutate: (data: {
        conversations: Array<{
            id: string
            payload?: ConversationPayload
            deleted?: boolean
            sessionId?: string
            title?: string
            createdAt?: number
            updatedAt?: number
        }>
    }) => void
    /**
     * 获取会话列表（从 React Query 缓存）
     */
    getConversations: () => ConversationMeta[]
    /**
     * 设置会话列表缓存（乐观更新）
     */
    setConversationsCache: (
        updater: (prev: ConversationMeta[] | undefined) => ConversationMeta[],
    ) => void
    /**
     * 使会话详情缓存失效
     */
    invalidateConversation: (id: string) => void
}

/**
 * 创建云端存储适配器
 *
 * 结合 localStorage（本地缓存）和 TRPC（云端同步）
 * - 读取：优先本地缓存，异步从云端更新
 * - 写入：同时更新本地和云端
 */
export function createCloudStorageAdapter(
    config: CloudStorageAdapterConfig,
): ConversationStorageAdapter {
    const {
        userId,
        pushMutate: originalPushMutate,
        getConversations,
        setConversationsCache,
        invalidateConversation,
    } = config

    // 包装 pushMutate 添加调试日志
    const pushMutate: typeof originalPushMutate = (data) => {
        console.log("[cloud-adapter] pushMutate called:", {
            count: data.conversations.length,
            conversations: data.conversations.map((c) => ({
                id: c.id,
                title: c.title,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                deleted: c.deleted,
                hasPayload: !!c.payload,
            })),
        })
        return originalPushMutate(data)
    }

    // 内存缓存
    let cachedConversations: ConversationMeta[] = []

    return {
        // =====================
        // 读取操作
        // =====================

        listConversations(): ConversationMeta[] {
            // 从 React Query 缓存获取
            const conversations = getConversations()
            cachedConversations = conversations
            return conversations
        },

        loadConversation(id: string): ConversationPayload | null {
            // 优先从本地缓存读取（云端数据会通过 React Query 异步加载）
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
                // 1. 写入本地缓存
                writeConversationPayloadToStorage(userId, id, payload)
                writeCurrentConversationIdToStorage(userId, id)

                const newMeta: ConversationMeta = {
                    id,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    title: deriveConversationTitle(payload.messages),
                }

                // 2. 乐观更新 React Query 缓存
                setConversationsCache((prev) => [newMeta, ...(prev || [])])

                // 3. 同步到云端
                pushMutate({
                    conversations: [
                        {
                            id,
                            payload,
                            createdAt: timestamp,
                            updatedAt: timestamp,
                        },
                    ],
                })

                cachedConversations = [newMeta, ...cachedConversations]
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
                // 1. 合并本地数据
                const existing = readConversationPayloadFromStorage(userId, id)
                if (!existing) return

                const merged: ConversationPayload = {
                    ...existing,
                    ...payload,
                    messages: payload.messages ?? existing.messages,
                    xml: payload.xml ?? existing.xml,
                    sessionId: payload.sessionId ?? existing.sessionId,
                }

                // 2. 写入本地缓存
                writeConversationPayloadToStorage(userId, id, merged)

                // 3. 乐观更新元数据
                const now = Date.now()
                setConversationsCache((prev) =>
                    (prev || []).map((m) =>
                        m.id === id
                            ? {
                                  ...m,
                                  updatedAt: now,
                                  title:
                                      m.title ||
                                      deriveConversationTitle(merged.messages),
                              }
                            : m,
                    ),
                )

                // 4. 同步到云端（由调用方处理防抖）
                // 注意：这里不直接调用 pushMutate，因为防抖在 hook 层处理
            } catch (error) {
                console.error("Failed to save conversation:", error)
            }
        },

        saveImmediately(id: string, payload: ConversationPayload): void {
            // 同步保存，用于 beforeunload/visibilitychange
            try {
                // 1. 写入本地缓存
                writeConversationPayloadToStorage(userId, id, payload)

                // 2. 更新本地元数据
                const metas = readConversationMetasFromStorage(userId)
                const now = Date.now()
                const existing = metas.find((m) => m.id === id)
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

                // 3. 使用 sendBeacon 同步到云端（即使页面即将关闭也能发送）
                // tRPC batch 格式: {"0":{"json":{input}}}
                if (navigator.sendBeacon) {
                    const beaconPayload = JSON.stringify({
                        "0": {
                            json: {
                                conversations: [
                                    {
                                        id,
                                        payload,
                                        createdAt: existing?.createdAt ?? now,
                                        updatedAt: now,
                                    },
                                ],
                            },
                        },
                    })
                    navigator.sendBeacon(
                        "/api/trpc/conversation.push?batch=1",
                        new Blob([beaconPayload], {
                            type: "application/json",
                        }),
                    )
                }
            } catch (error) {
                console.error("Failed to persist state:", error)
            }
        },

        deleteConversation(id: string): void {
            try {
                // 获取原始时间戳
                const metas = readConversationMetasFromStorage(userId)
                const existing = metas.find((m) => m.id === id)
                const now = Date.now()

                // 1. 乐观更新 React Query 缓存
                setConversationsCache((prev) =>
                    (prev || []).filter((m) => m.id !== id),
                )

                // 2. 同步删除到云端
                pushMutate({
                    conversations: [
                        {
                            id,
                            deleted: true,
                            createdAt: existing?.createdAt ?? now,
                            updatedAt: now,
                        },
                    ],
                })

                // 3. 删除本地缓存
                const nextMetas = metas.filter((m) => m.id !== id)
                writeConversationMetasToStorage(userId, nextMetas)
                cachedConversations = nextMetas

                // 4. 使缓存失效
                invalidateConversation(id)
            } catch (error) {
                console.error("Failed to delete conversation:", error)
            }
        },

        updateTitle(id: string, title: string): void {
            try {
                const now = Date.now()
                const metas = readConversationMetasFromStorage(userId)
                const existing = metas.find((m) => m.id === id)

                // 1. 乐观更新 React Query 缓存
                setConversationsCache((prev) =>
                    (prev || []).map((m) =>
                        m.id === id ? { ...m, title, updatedAt: now } : m,
                    ),
                )

                // 2. 更新本地缓存
                const nextMetas = metas.map((m) =>
                    m.id === id ? { ...m, title, updatedAt: now } : m,
                )
                writeConversationMetasToStorage(userId, nextMetas)
                cachedConversations = nextMetas

                // 3. 同步到云端
                pushMutate({
                    conversations: [
                        {
                            id,
                            title,
                            createdAt: existing?.createdAt ?? now,
                            updatedAt: now,
                        },
                    ],
                })

                // 4. 使详情缓存失效以便下次获取最新数据
                invalidateConversation(id)
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
                // 1. 乐观更新 React Query 缓存
                setConversationsCache((prev) =>
                    (prev || []).map((m) =>
                        m.id === id ? { ...m, ...updates } : m,
                    ),
                )

                // 2. 更新本地缓存
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
