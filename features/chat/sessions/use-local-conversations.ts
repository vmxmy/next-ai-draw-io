"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { ChatMessage } from "@/features/chat/ai/types"
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
import {
    conversationStorageKey,
    createConversationId,
    createSessionId,
    STORAGE_MESSAGES_KEY,
    STORAGE_SESSION_ID_KEY,
    STORAGE_XML_SNAPSHOTS_KEY,
} from "@/features/chat/sessions/storage"
import { STORAGE_DIAGRAM_XML_KEY } from "@/lib/storage-keys"

type QueuePushConversation = (
    id: string,
    opts?: { immediate?: boolean; deleted?: boolean },
) => void

export function useLocalConversations({
    locale,
    t,
    isDrawioReady,
    onDisplayChart,
    clearDiagram,
    chartXML,
    chartXMLRef,
    messages,
    processedToolCallsRef,
    autoRetryCountRef,
    editFailureCountRef,
    forceDisplayNextRef,
    xmlSnapshotsRef,
    setMessages,
    messagesRef,
    resetFiles,
    queuePushConversation,
    stopCurrentRequest,
}: {
    locale: string
    t: (key: any) => string
    isDrawioReady: boolean
    onDisplayChart: (xml: string, skipValidation?: boolean) => string | null
    clearDiagram: () => void
    chartXML: string
    chartXMLRef: React.MutableRefObject<string>
    messages: any
    processedToolCallsRef: React.MutableRefObject<Set<string>>
    autoRetryCountRef: React.MutableRefObject<number>
    editFailureCountRef: React.MutableRefObject<number>
    forceDisplayNextRef: React.MutableRefObject<boolean>
    xmlSnapshotsRef: React.MutableRefObject<Map<number, string>>
    setMessages: (messages: any) => void
    messagesRef: React.MutableRefObject<any>
    resetFiles: () => void
    queuePushConversation: QueuePushConversation
    stopCurrentRequest?: () => void
}) {
    const [conversations, setConversations] = useState<ConversationMeta[]>([])
    const [currentConversationId, setCurrentConversationId] = useState(() => {
        if (typeof window === "undefined") return ""
        return readCurrentConversationIdFromStorage()
    })
    const [sessionId, setSessionId] = useState(() => createSessionId())
    const [hasRestored, setHasRestored] = useState(false)
    const [canSaveDiagram, setCanSaveDiagram] = useState(false)

    const pendingDiagramXmlRef = useRef<string | null>(null)
    const persistDebounceTimerRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null)

    const deriveConversationTitle = useCallback((msgs: ChatMessage[]) => {
        const firstUser = msgs.find((m) => m.role === "user") as any
        const textPart =
            firstUser?.parts?.find((p: any) => p.type === "text")?.text || ""
        const trimmed = String(textPart).trim()
        if (!trimmed) return undefined
        return trimmed.slice(0, 24)
    }, [])

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

    const loadConversation = useCallback(
        (id: string) => {
            try {
                const raw = localStorage.getItem(conversationStorageKey(id))
                const payload: ConversationPayload = raw
                    ? JSON.parse(raw)
                    : {
                          messages: [],
                          xml: "",
                          snapshots: [],
                          sessionId: createSessionId(),
                      }

                setMessages((payload.messages || []) as any)
                xmlSnapshotsRef.current = new Map(payload.snapshots || [])
                setSessionId(payload.sessionId || createSessionId())

                processedToolCallsRef.current = new Set()
                autoRetryCountRef.current = 0
                editFailureCountRef.current = 0
                forceDisplayNextRef.current = false

                if (payload.xml) {
                    if (isDrawioReady) {
                        onDisplayChart(payload.xml, true)
                        chartXMLRef.current = payload.xml
                    } else {
                        pendingDiagramXmlRef.current = payload.xml
                    }
                } else {
                    clearDiagram()
                    chartXMLRef.current = ""
                }
            } catch (error) {
                console.error("Failed to load conversation:", error)
                setMessages([])
                xmlSnapshotsRef.current = new Map()
                setSessionId(createSessionId())
                clearDiagram()
            }
        },
        [
            autoRetryCountRef,
            chartXMLRef,
            clearDiagram,
            editFailureCountRef,
            forceDisplayNextRef,
            isDrawioReady,
            onDisplayChart,
            processedToolCallsRef,
            setMessages,
            xmlSnapshotsRef,
        ],
    )

    const persistCurrentConversation = useCallback(
        (overrides: Partial<ConversationPayload>) => {
            if (!currentConversationId) return
            try {
                const existing =
                    readConversationPayloadFromStorage(currentConversationId) ||
                    ({
                        messages: [],
                        xml: "",
                        snapshots: [],
                        sessionId,
                    } satisfies ConversationPayload)

                const merged: ConversationPayload = {
                    messages:
                        overrides.messages ?? existing.messages ?? ([] as any),
                    xml: overrides.xml ?? existing.xml ?? "",
                    snapshots: overrides.snapshots ?? existing.snapshots ?? [],
                    sessionId:
                        overrides.sessionId ?? existing.sessionId ?? sessionId,
                }

                writeConversationPayloadToStorage(currentConversationId, merged)

                setConversations((prev) => {
                    const now = Date.now()
                    let found = false
                    const next = prev.map((m) => {
                        if (m.id !== currentConversationId) return m
                        found = true
                        return {
                            ...m,
                            updatedAt: now,
                            title:
                                m.title ||
                                deriveConversationTitle(merged.messages),
                        }
                    })
                    if (!found) {
                        next.unshift({
                            id: currentConversationId,
                            createdAt: now,
                            updatedAt: now,
                            title: deriveConversationTitle(merged.messages),
                        })
                    }
                    writeConversationMetasToStorage(next)
                    return next
                })

                queuePushConversation(currentConversationId)
            } catch (error) {
                console.error("Failed to persist current conversation:", error)
            }
        },
        [
            currentConversationId,
            deriveConversationTitle,
            queuePushConversation,
            sessionId,
        ],
    )

    const flushPersistCurrentConversation = useCallback(() => {
        if (!currentConversationId) return
        if (persistDebounceTimerRef.current) {
            clearTimeout(persistDebounceTimerRef.current)
            persistDebounceTimerRef.current = null
        }
        persistCurrentConversation({
            messages: messagesRef.current as any,
            xml: chartXMLRef.current || "",
            snapshots: Array.from(xmlSnapshotsRef.current.entries()),
            sessionId,
        })
    }, [
        chartXMLRef,
        currentConversationId,
        messagesRef,
        persistCurrentConversation,
        sessionId,
        xmlSnapshotsRef,
    ])

    const saveXmlSnapshots = useCallback(() => {
        const snapshotsArray = Array.from(xmlSnapshotsRef.current.entries())
        persistCurrentConversation({ snapshots: snapshotsArray })
    }, [persistCurrentConversation, xmlSnapshotsRef])

    const handleNewChat = useCallback(() => {
        const id = createConversationId()
        const now = Date.now()
        const payload: ConversationPayload = {
            messages: [],
            xml: "",
            snapshots: [],
            sessionId: createSessionId(),
        }

        try {
            stopCurrentRequest?.()
            flushPersistCurrentConversation()

            writeConversationPayloadToStorage(id, payload)
            const nextMetas = [
                {
                    id,
                    createdAt: now,
                    updatedAt: now,
                } satisfies ConversationMeta,
                ...conversations,
            ]
            writeConversationMetasToStorage(nextMetas)
            writeCurrentConversationIdToStorage(id)

            setMessages([])
            clearDiagram()
            resetFiles()
            xmlSnapshotsRef.current.clear()
            setSessionId(payload.sessionId)
            setConversations(nextMetas)
            setCurrentConversationId(id)

            queuePushConversation(id, { immediate: true })
            toast.success(t("toast.startedFreshChat"), {
                id: "startedFreshChat",
                duration: 2000,
            })
        } catch (error) {
            console.error("Failed to create new conversation:", error)
            toast.warning(t("toast.storageUpdateFailed"))
        }
    }, [
        clearDiagram,
        conversations,
        persistCurrentConversation,
        flushPersistCurrentConversation,
        queuePushConversation,
        resetFiles,
        setMessages,
        stopCurrentRequest,
        t,
        xmlSnapshotsRef,
    ])

    const handleSelectConversation = useCallback(
        (id: string) => {
            if (!id || id === currentConversationId) return
            try {
                stopCurrentRequest?.()
                flushPersistCurrentConversation()
                writeCurrentConversationIdToStorage(id)
                setCurrentConversationId(id)
            } catch (error) {
                console.error("Failed to select conversation:", error)
                toast.warning(t("toast.storageUpdateFailed"))
            }
        },
        [
            currentConversationId,
            flushPersistCurrentConversation,
            stopCurrentRequest,
            t,
        ],
    )

    const handleDeleteConversation = useCallback(
        (id: string) => {
            try {
                stopCurrentRequest?.()
                flushPersistCurrentConversation()
                queuePushConversation(id, { immediate: true, deleted: true })
                removeConversationPayloadFromStorage(id)

                const nextMetas = conversations.filter((c) => c.id !== id)
                writeConversationMetasToStorage(nextMetas)
                setConversations(nextMetas)

                if (id === currentConversationId) {
                    const nextId = nextMetas[0]?.id
                    if (nextId) {
                        writeCurrentConversationIdToStorage(nextId)
                        setCurrentConversationId(nextId)
                    } else {
                        const newId = createConversationId()
                        const now = Date.now()
                        const payload: ConversationPayload = {
                            messages: [],
                            xml: "",
                            snapshots: [],
                            sessionId: createSessionId(),
                        }
                        writeConversationPayloadToStorage(newId, payload)
                        const metas = [
                            {
                                id: newId,
                                createdAt: now,
                                updatedAt: now,
                            } satisfies ConversationMeta,
                        ]
                        writeConversationMetasToStorage(metas)
                        writeCurrentConversationIdToStorage(newId)
                        setConversations(metas)
                        setCurrentConversationId(newId)
                    }
                }
            } catch (error) {
                console.error("Failed to delete conversation:", error)
                toast.warning(t("toast.storageUpdateFailed"))
            }
        },
        [
            conversations,
            currentConversationId,
            flushPersistCurrentConversation,
            queuePushConversation,
            stopCurrentRequest,
            t,
        ],
    )

    useEffect(() => {
        if (!currentConversationId) return
        loadConversation(currentConversationId)
    }, [currentConversationId, loadConversation])

    useEffect(() => {
        if (!hasRestored) return
        if (!currentConversationId) return

        if (persistDebounceTimerRef.current) {
            clearTimeout(persistDebounceTimerRef.current)
        }
        persistDebounceTimerRef.current = setTimeout(() => {
            persistDebounceTimerRef.current = null
            persistCurrentConversation({ messages: messages as any })
        }, 800)

        return () => {
            if (persistDebounceTimerRef.current) {
                clearTimeout(persistDebounceTimerRef.current)
                persistDebounceTimerRef.current = null
            }
        }
    }, [
        currentConversationId,
        hasRestored,
        messages,
        persistCurrentConversation,
    ])

    useEffect(() => {
        if (!isDrawioReady) {
            setCanSaveDiagram(false)
            return
        }
        const pending = pendingDiagramXmlRef.current
        pendingDiagramXmlRef.current = null

        let xmlToLoad = pending
        if (!xmlToLoad && currentConversationId) {
            xmlToLoad =
                readConversationPayloadFromStorage(currentConversationId)
                    ?.xml || ""
        }
        if (xmlToLoad) {
            onDisplayChart(xmlToLoad, true)
            chartXMLRef.current = xmlToLoad
        }
        setTimeout(() => setCanSaveDiagram(true), 300)
    }, [chartXMLRef, currentConversationId, isDrawioReady, onDisplayChart])

    useEffect(() => {
        if (!canSaveDiagram) return
        if (chartXML && chartXML.length > 300) {
            persistCurrentConversation({ xml: chartXML })
        } else if (chartXML === "") {
            persistCurrentConversation({ xml: "" })
        }
    }, [canSaveDiagram, chartXML, persistCurrentConversation])

    useEffect(() => {
        persistCurrentConversation({ sessionId })
    }, [persistCurrentConversation, sessionId])

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (!currentConversationId) return
            try {
                const payload: ConversationPayload = {
                    messages: messagesRef.current as any,
                    xml: chartXMLRef.current || "",
                    snapshots: Array.from(xmlSnapshotsRef.current.entries()),
                    sessionId,
                }
                writeConversationPayloadToStorage(
                    currentConversationId,
                    payload,
                )

                const metas = readConversationMetasFromStorage()
                const now = Date.now()
                const next = Array.isArray(metas)
                    ? metas.map((m) =>
                          m.id === currentConversationId
                              ? {
                                    ...m,
                                    updatedAt: now,
                                    title:
                                        m.title ||
                                        deriveConversationTitle(
                                            payload.messages,
                                        ),
                                }
                              : m,
                      )
                    : []
                writeConversationMetasToStorage(next)
            } catch (error) {
                console.error("Failed to persist state before unload:", error)
            }
        }

        window.addEventListener("beforeunload", handleBeforeUnload)
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload)
    }, [
        chartXMLRef,
        currentConversationId,
        deriveConversationTitle,
        messagesRef,
        sessionId,
        xmlSnapshotsRef,
    ])

    useEffect(() => {
        try {
            let metas = readConversationMetasFromStorage()

            const legacyMessages = localStorage.getItem(STORAGE_MESSAGES_KEY)
            const legacySnapshots = localStorage.getItem(
                STORAGE_XML_SNAPSHOTS_KEY,
            )
            const legacyXml = localStorage.getItem(STORAGE_DIAGRAM_XML_KEY)
            const legacySession = localStorage.getItem(STORAGE_SESSION_ID_KEY)

            if (
                metas.length === 0 &&
                (legacyMessages || legacySnapshots || legacyXml)
            ) {
                const id = createConversationId()
                const payload: ConversationPayload = {
                    messages: legacyMessages ? JSON.parse(legacyMessages) : [],
                    xml: legacyXml || "",
                    snapshots: legacySnapshots
                        ? JSON.parse(legacySnapshots)
                        : [],
                    sessionId: legacySession || createSessionId(),
                }
                writeConversationPayloadToStorage(id, payload)
                metas = [
                    {
                        id,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        title: deriveConversationTitle(payload.messages),
                    },
                ]
                writeConversationMetasToStorage(metas)
                writeCurrentConversationIdToStorage(id)
                setCurrentConversationId(id)

                localStorage.removeItem(STORAGE_MESSAGES_KEY)
                localStorage.removeItem(STORAGE_XML_SNAPSHOTS_KEY)
                localStorage.removeItem(STORAGE_DIAGRAM_XML_KEY)
                localStorage.removeItem(STORAGE_SESSION_ID_KEY)
            }

            if (metas.length === 0) {
                const id = createConversationId()
                metas = [{ id, createdAt: Date.now(), updatedAt: Date.now() }]
                writeConversationMetasToStorage(metas)
                writeCurrentConversationIdToStorage(id)
                writeConversationPayloadToStorage(id, {
                    messages: [],
                    xml: "",
                    snapshots: [],
                    sessionId: createSessionId(),
                })
                setCurrentConversationId(id)
            } else if (!currentConversationId) {
                const id = metas[0].id
                writeCurrentConversationIdToStorage(id)
                setCurrentConversationId(id)
            }

            setConversations(metas)
        } catch (error) {
            console.error("Failed to restore conversations:", error)
        } finally {
            setHasRestored(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        conversations,
        setConversations,
        currentConversationId,
        setCurrentConversationId,
        sessionId,
        setSessionId,
        hasRestored,
        canSaveDiagram,
        getConversationDisplayTitle,
        deriveConversationTitle,
        loadConversation,
        persistCurrentConversation,
        saveXmlSnapshots,
        handleNewChat,
        handleSelectConversation,
        handleDeleteConversation,
    }
}
