"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
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
            const metas = readConversationMetasFromStorage()
            const meta = metas.find((m) => m.id === id)
            const now = Date.now()
            const createdAt = meta?.createdAt ?? now
            const updatedAt = meta?.updatedAt ?? now

            const payload = opts?.deleted
                ? undefined
                : readConversationPayloadFromStorage(id)

            return {
                id,
                title: meta?.title,
                createdAt,
                updatedAt,
                deleted: opts?.deleted,
                payload: payload ?? undefined,
            }
        },
        [],
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

            let shouldReloadCurrent = false
            let currentRemoved = false

            const localMetas = readConversationMetasFromStorage()
            const metaById = new Map(localMetas.map((m) => [m.id, m]))

            for (const rc of remote) {
                const id = String(rc?.id || "")
                if (!id) continue

                if (rc?.deleted) {
                    metaById.delete(id)
                    removeConversationPayloadFromStorage(id)
                    if (id === currentConversationId) currentRemoved = true
                    continue
                }

                const localMeta = metaById.get(id)
                const remoteUpdatedAt = Number(rc?.updatedAt ?? 0)
                if (localMeta && localMeta.updatedAt >= remoteUpdatedAt) {
                    continue
                }

                try {
                    localStorage.setItem(
                        conversationStorageKey(id),
                        JSON.stringify(rc?.payload ?? {}),
                    )
                } catch {
                    // ignore
                }

                metaById.set(id, {
                    id,
                    createdAt: Number(rc?.createdAt ?? Date.now()),
                    updatedAt: remoteUpdatedAt || Date.now(),
                    title: rc?.title,
                })

                if (id === currentConversationId) shouldReloadCurrent = true
            }

            const nextMetas = Array.from(metaById.values()).sort(
                (a, b) => b.updatedAt - a.updatedAt,
            )
            writeConversationMetasToStorage(nextMetas)
            setConversations(nextMetas)

            if (currentRemoved) {
                const nextId = nextMetas[0]?.id || ""
                if (nextId) {
                    writeCurrentConversationIdToStorage(nextId)
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
                writeConversationPayloadToStorage(newId, payload)
                const metas: ConversationMeta[] = [
                    { id: newId, createdAt: now, updatedAt: now },
                ]
                writeConversationMetasToStorage(metas)
                writeCurrentConversationIdToStorage(newId)
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
                limit: 200,
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
        if (conversations.length === 0) return

        let cancelled = false

        const bootstrap = async () => {
            if (syncBootstrappedUserIdRef.current === userId) return
            syncBootstrappedUserIdRef.current = userId

            const metas = readConversationMetasFromStorage()
            const toPush = metas
                .map((m) => {
                    const payload = readConversationPayloadFromStorage(m.id)
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
