"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { smartCacheCleanup } from "@/features/chat/sessions/cache-manager"
import {
    cleanOldestConversations,
    readConversationMetasFromStorage,
    readConversationPayloadFromStorage,
    removeConversationPayloadFromStorage,
    writeConversationMetasToStorage,
    writeConversationPayloadToStorage,
    writeCurrentConversationIdToStorage,
} from "@/features/chat/sessions/local-storage"
import type {
    ConversationMeta,
    ConversationPayload,
} from "@/features/chat/sessions/storage"
import {
    conversationStorageKey,
    createConversationId,
    createSessionId,
    syncCursorStorageKey,
} from "@/features/chat/sessions/storage"
import { api } from "@/lib/trpc/client"

export function useConversationSync({
    authStatus,
    userId,
    hasRestored,
    conversations,
    currentConversationId,
    setConversations,
    setCurrentConversationId,
    loadConversation,
}: {
    authStatus: "authenticated" | "loading" | "unauthenticated"
    userId?: string | null
    hasRestored: boolean
    conversations: ConversationMeta[]
    currentConversationId: string
    setConversations: React.Dispatch<React.SetStateAction<ConversationMeta[]>>
    setCurrentConversationId: React.Dispatch<React.SetStateAction<string>>
    loadConversation: (id: string) => void
}) {
    const pushConversationsMutation = api.conversation.push.useMutation()
    const pullConversationsMutation = api.conversation.pull.useMutation()

    const pushConversationsMutateAsyncRef = useRef(
        pushConversationsMutation.mutateAsync,
    )
    const pullConversationsMutateAsyncRef = useRef(
        pullConversationsMutation.mutateAsync,
    )
    useEffect(() => {
        pushConversationsMutateAsyncRef.current =
            pushConversationsMutation.mutateAsync
        pullConversationsMutateAsyncRef.current =
            pullConversationsMutation.mutateAsync
    }, [
        pushConversationsMutation.mutateAsync,
        pullConversationsMutation.mutateAsync,
    ])

    const syncBootstrappedUserIdRef = useRef<string | null>(null)
    const syncPullIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
        null,
    )
    const syncDebounceTimersRef = useRef<
        Map<string, ReturnType<typeof setTimeout>>
    >(new Map())
    const syncPullInFlightRef = useRef(false)
    const pullOnceRef = useRef<(() => Promise<void>) | null>(null)

    const [isOnline, setIsOnline] = useState(() => {
        if (typeof navigator === "undefined") return true
        return navigator.onLine
    })
    const [syncInFlightCount, setSyncInFlightCount] = useState(0)
    const [lastSyncOkAt, setLastSyncOkAt] = useState<number | null>(null)
    const [lastSyncErrorAt, setLastSyncErrorAt] = useState<number | null>(null)

    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)
        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
        }
    }, [])

    const markSyncStart = useCallback(() => {
        setSyncInFlightCount((c) => c + 1)
    }, [])

    const markSyncEnd = useCallback(() => {
        setSyncInFlightCount((c) => Math.max(0, c - 1))
    }, [])

    const getSyncCursor = useCallback((): string => {
        if (!userId) return "0"
        try {
            return localStorage.getItem(syncCursorStorageKey(userId)) || "0"
        } catch {
            return "0"
        }
    }, [userId])

    const setSyncCursor = useCallback(
        (cursor: string) => {
            if (!userId) return
            try {
                localStorage.setItem(syncCursorStorageKey(userId), cursor)
            } catch {
                // ignore
            }
        },
        [userId],
    )

    const buildPushConversationInput = useCallback(
        (id: string, opts?: { deleted?: boolean }) => {
            const metas = readConversationMetasFromStorage(
                userId || "anonymous",
            )
            const meta = metas.find((m) => m.id === id)
            const now = Date.now()
            const createdAt = meta?.createdAt ?? now
            const updatedAt = meta?.updatedAt ?? now

            const payload = opts?.deleted
                ? undefined
                : readConversationPayloadFromStorage(userId || "anonymous", id)

            return {
                id,
                title: meta?.title,
                createdAt,
                updatedAt,
                deleted: opts?.deleted,
                payload: payload ?? undefined,
            }
        },
        [userId],
    )

    const pushConversationNow = useCallback(
        async (id: string, opts?: { deleted?: boolean }) => {
            if (authStatus !== "authenticated") return
            if (!userId) return
            if (!isOnline) return

            const input = buildPushConversationInput(id, opts)
            if (!input.deleted && !input.payload) return

            markSyncStart()
            try {
                const res = await pushConversationsMutateAsyncRef.current({
                    conversations: [input],
                })
                if (res?.cursor) setSyncCursor(res.cursor)
                setLastSyncOkAt(Date.now())
                setLastSyncErrorAt(null)
            } catch {
                setLastSyncErrorAt(Date.now())
            } finally {
                markSyncEnd()
            }

            setTimeout(() => {
                void pullOnceRef.current?.()
            }, 1500)
        },
        [
            authStatus,
            buildPushConversationInput,
            isOnline,
            markSyncEnd,
            markSyncStart,
            setSyncCursor,
            userId,
        ],
    )

    const queuePushConversation = useCallback(
        (id: string, opts?: { immediate?: boolean; deleted?: boolean }) => {
            if (authStatus !== "authenticated") return
            if (!userId) return

            const delay = opts?.immediate ? 0 : 1000
            const existing = syncDebounceTimersRef.current.get(id)
            if (existing) clearTimeout(existing)
            const timer = setTimeout(() => {
                syncDebounceTimersRef.current.delete(id)
                void pushConversationNow(id, { deleted: opts?.deleted })
            }, delay)
            syncDebounceTimersRef.current.set(id, timer)
        },
        [authStatus, pushConversationNow, userId],
    )

    const applyRemoteConversations = useCallback(
        (remote: Array<any>) => {
            if (!Array.isArray(remote) || remote.length === 0) return

            const userIdOrAnonymous = userId || "anonymous"
            let shouldReloadCurrent = false
            let currentRemoved = false

            const localMetas =
                readConversationMetasFromStorage(userIdOrAnonymous)
            const metaById = new Map(localMetas.map((m) => [m.id, m]))

            for (const rc of remote) {
                const id = String(rc?.id || "")
                if (!id) continue

                if (rc?.deleted) {
                    metaById.delete(id)
                    removeConversationPayloadFromStorage(userIdOrAnonymous, id)
                    if (id === currentConversationId) currentRemoved = true
                    continue
                }

                const localMeta = metaById.get(id)
                const remoteUpdatedAt = Number(rc?.updatedAt ?? 0)
                if (localMeta && localMeta.updatedAt >= remoteUpdatedAt) {
                    continue
                }

                // 使用 writeConversationPayloadToStorage 以支持压缩和自动清理
                let payloadWriteSuccess = false
                try {
                    const payload = rc?.payload ?? {}
                    writeConversationPayloadToStorage(
                        userIdOrAnonymous,
                        id,
                        payload as ConversationPayload,
                    )
                    payloadWriteSuccess = true
                } catch (error: any) {
                    // 如果是 QuotaExceededError，writeConversationPayloadToStorage 已经尝试清理
                    // 如果清理后还失败，这里跳过该会话
                    if (error?.name === "QuotaExceededError") {
                        console.warn(
                            `无法恢复会话 ${id}：localStorage 空间不足`,
                        )
                        // 不添加 meta，避免出现"空会话"
                        continue
                    }
                    // 其他错误也跳过
                    console.error(`写入会话 ${id} 失败:`, error)
                    continue
                }

                // 只有 payload 成功写入后才添加 meta
                if (payloadWriteSuccess) {
                    metaById.set(id, {
                        id,
                        createdAt: Number(rc?.createdAt ?? Date.now()),
                        updatedAt: remoteUpdatedAt || Date.now(),
                        title: rc?.title,
                    })

                    if (id === currentConversationId) shouldReloadCurrent = true
                }
            }

            const nextMetas = Array.from(metaById.values()).sort(
                (a, b) => b.updatedAt - a.updatedAt,
            )
            writeConversationMetasToStorage(userIdOrAnonymous, nextMetas)
            setConversations(nextMetas)

            if (currentRemoved) {
                const nextId = nextMetas[0]?.id || ""
                if (nextId) {
                    writeCurrentConversationIdToStorage(
                        userIdOrAnonymous,
                        nextId,
                    )
                    setCurrentConversationId(nextId)
                    return
                }

                const newId = createConversationId()
                const now = Date.now()
                const payload: ConversationPayload = {
                    messages: [],
                    xml: "",
                    snapshots: [],
                    sessionId: createSessionId(),
                }
                writeConversationPayloadToStorage(
                    userIdOrAnonymous,
                    newId,
                    payload,
                )
                const metas: ConversationMeta[] = [
                    { id: newId, createdAt: now, updatedAt: now },
                ]
                writeConversationMetasToStorage(userIdOrAnonymous, metas)
                writeCurrentConversationIdToStorage(userIdOrAnonymous, newId)
                setConversations(metas)
                setCurrentConversationId(newId)
                queuePushConversation(newId, { immediate: true })
                return
            }

            if (shouldReloadCurrent && currentConversationId) {
                loadConversation(currentConversationId)
            }
        },
        [
            currentConversationId,
            loadConversation,
            queuePushConversation,
            setConversations,
            setCurrentConversationId,
        ],
    )

    const pullOnce = useCallback(async () => {
        if (authStatus !== "authenticated") return
        if (!userId) return
        if (!isOnline) return
        if (syncPullInFlightRef.current) return

        syncPullInFlightRef.current = true
        markSyncStart()
        try {
            const cursor = getSyncCursor()
            const res = await pullConversationsMutateAsyncRef.current({
                cursor,
                limit: 100,
            })
            if (res?.cursor) setSyncCursor(res.cursor)
            if (Array.isArray(res?.conversations) && res.conversations.length) {
                applyRemoteConversations(res.conversations as any[])
            }
            setLastSyncOkAt(Date.now())
            setLastSyncErrorAt(null)
        } catch {
            setLastSyncErrorAt(Date.now())
        } finally {
            syncPullInFlightRef.current = false
            markSyncEnd()
        }
    }, [
        applyRemoteConversations,
        authStatus,
        getSyncCursor,
        isOnline,
        markSyncEnd,
        markSyncStart,
        setSyncCursor,
        userId,
    ])

    useEffect(() => {
        pullOnceRef.current = pullOnce
        return () => {
            pullOnceRef.current = null
        }
    }, [pullOnce])

    useEffect(() => {
        if (authStatus !== "authenticated" || !userId) {
            syncBootstrappedUserIdRef.current = null
            if (syncPullIntervalRef.current) {
                clearInterval(syncPullIntervalRef.current)
                syncPullIntervalRef.current = null
            }
            return
        }

        if (!hasRestored) return

        let cancelled = false

        const bootstrap = async () => {
            if (syncBootstrappedUserIdRef.current === userId) return
            syncBootstrappedUserIdRef.current = userId

            // 先拉取远端，再推送本地：
            // - pull 使用的是「事件游标」增量同步；
            // - 如果先 push，会把游标推进到"最新事件"，导致新设备从 0 开始的首次同步反而拉不到历史远端会话。
            // KISS：首次启动时多做一次 pull，换取"必能看到云端历史"的确定性。
            await pullOnceRef.current?.()

            const userIdOrAnonymous = userId || "anonymous"
            const metas = readConversationMetasFromStorage(userIdOrAnonymous)
            const toPush = metas
                .map((m) => {
                    const payload = readConversationPayloadFromStorage(
                        userIdOrAnonymous,
                        m.id,
                    )
                    if (!payload) return null
                    return {
                        id: m.id,
                        title: m.title,
                        createdAt: m.createdAt,
                        updatedAt: m.updatedAt,
                        payload,
                    }
                })
                .filter(Boolean) as Array<{
                id: string
                title?: string
                createdAt: number
                updatedAt: number
                payload: ConversationPayload
            }>

            if (toPush.length > 0) {
                try {
                    const res = await pushConversationsMutateAsyncRef.current({
                        conversations: toPush as any,
                    })
                    if (!cancelled && res?.cursor) setSyncCursor(res.cursor)
                } catch {
                    // ignore
                }
            }

            if (!cancelled) {
                await pullOnceRef.current?.()
            }

            // 登录后执行智能缓存清理
            if (!cancelled && userId) {
                try {
                    const cleanupResult = smartCacheCleanup(userId, true)
                    if (cleanupResult.totalRemoved > 0) {
                        const messages = []
                        if (cleanupResult.staleRemoved > 0) {
                            messages.push(
                                `${cleanupResult.staleRemoved} 个过期会话`,
                            )
                        }
                        if (cleanupResult.quotaRemoved > 0) {
                            messages.push(
                                `${cleanupResult.quotaRemoved} 个旧会话（超出缓存配额）`,
                            )
                        }
                        toast.info(`已清理本地缓存：${messages.join("、")}`, {
                            id: "cache-cleanup",
                            duration: 3000,
                        })
                    }
                } catch (error) {
                    console.error("缓存清理失败:", error)
                }
            }
        }

        void bootstrap()

        if (!syncPullIntervalRef.current) {
            syncPullIntervalRef.current = setInterval(() => {
                void pullOnceRef.current?.()
            }, 20_000)
        }

        const handleWake = () => void pullOnceRef.current?.()
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                void pullOnceRef.current?.()
            }
        }

        window.addEventListener("focus", handleWake)
        window.addEventListener("online", handleWake)
        document.addEventListener("visibilitychange", handleVisibility)

        return () => {
            cancelled = true
            window.removeEventListener("focus", handleWake)
            window.removeEventListener("online", handleWake)
            document.removeEventListener("visibilitychange", handleVisibility)
        }
    }, [authStatus, conversations.length, hasRestored, setSyncCursor, userId])

    return {
        isOnline,
        syncInFlightCount,
        lastSyncOkAt,
        lastSyncErrorAt,
        pullOnce,
        queuePushConversation,
    }
}
