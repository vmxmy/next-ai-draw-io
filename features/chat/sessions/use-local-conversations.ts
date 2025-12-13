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
    DiagramVersion,
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

    // 统一的“对话驱动”图表线性历史：entries + cursor + messageIndex 书签
    const diagramVersionsRef = useRef<DiagramVersion[]>([])
    const diagramVersionCursorRef = useRef<number>(-1)
    const diagramVersionMarksRef = useRef<Record<number, number>>({})

    const [diagramVersions, setDiagramVersions] = useState<DiagramVersion[]>([])
    const [diagramVersionCursor, setDiagramVersionCursor] = useState<number>(-1)

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
                          diagramVersions: [],
                          diagramVersionCursor: -1,
                          diagramVersionMarks: {},
                          sessionId: createSessionId(),
                      }

                setMessages((payload.messages || []) as any)
                setSessionId(payload.sessionId || createSessionId())

                processedToolCallsRef.current = new Set()
                autoRetryCountRef.current = 0
                editFailureCountRef.current = 0
                forceDisplayNextRef.current = false

                // 恢复统一线性历史（如果没有则从旧 snapshots 迁移）
                let versions = Array.isArray(payload.diagramVersions)
                    ? (payload.diagramVersions as DiagramVersion[])
                    : []
                let cursor =
                    typeof payload.diagramVersionCursor === "number"
                        ? payload.diagramVersionCursor
                        : -1
                let marks: Record<number, number> =
                    payload.diagramVersionMarks &&
                    typeof payload.diagramVersionMarks === "object"
                        ? (payload.diagramVersionMarks as Record<
                              number,
                              number
                          >)
                        : {}

                if (versions.length === 0 && Array.isArray(payload.snapshots)) {
                    const migrated: DiagramVersion[] = payload.snapshots
                        .filter((s) => Array.isArray(s) && s.length === 2)
                        .map(([messageIndex, snapshotXml], idx) => {
                            const mi = Number(messageIndex)
                            if (!Number.isFinite(mi)) return null
                            return {
                                id: `migrated-${mi}-${idx}`,
                                createdAt:
                                    Date.now() -
                                    ((payload.snapshots?.length ?? 0) - idx) *
                                        1000,
                                xml: String(snapshotXml ?? ""),
                                note: "migrated",
                            } satisfies DiagramVersion
                        })
                        .filter(Boolean) as DiagramVersion[]

                    versions = migrated
                    cursor = versions.length > 0 ? versions.length - 1 : -1
                    marks = {}
                    for (const [
                        messageIndex,
                        snapshotXml,
                    ] of payload.snapshots) {
                        const mi = Number(messageIndex)
                        if (!Number.isFinite(mi)) continue
                        const xml = String(snapshotXml ?? "")
                        const found = versions.findIndex((v) => v.xml === xml)
                        if (found >= 0) marks[mi] = found
                    }
                }

                diagramVersionsRef.current = versions
                diagramVersionCursorRef.current = Math.min(
                    Math.max(cursor, -1),
                    versions.length - 1,
                )
                diagramVersionMarksRef.current = marks
                setDiagramVersions(versions)
                setDiagramVersionCursor(diagramVersionCursorRef.current)

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
                setSessionId(createSessionId())
                clearDiagram()
                diagramVersionsRef.current = []
                diagramVersionCursorRef.current = -1
                diagramVersionMarksRef.current = {}
                setDiagramVersions([])
                setDiagramVersionCursor(-1)
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
                        diagramVersions: [],
                        diagramVersionCursor: -1,
                        diagramVersionMarks: {},
                        sessionId,
                    } satisfies ConversationPayload)

                const merged: ConversationPayload = {
                    messages:
                        overrides.messages ?? existing.messages ?? ([] as any),
                    xml: overrides.xml ?? existing.xml ?? "",
                    snapshots: overrides.snapshots ?? existing.snapshots ?? [],
                    diagramVersions:
                        overrides.diagramVersions ??
                        existing.diagramVersions ??
                        [],
                    diagramVersionCursor:
                        overrides.diagramVersionCursor ??
                        existing.diagramVersionCursor ??
                        -1,
                    diagramVersionMarks:
                        overrides.diagramVersionMarks ??
                        existing.diagramVersionMarks ??
                        {},
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
            sessionId,
            diagramVersions: diagramVersionsRef.current,
            diagramVersionCursor: diagramVersionCursorRef.current,
            diagramVersionMarks: diagramVersionMarksRef.current,
        })
    }, [
        chartXMLRef,
        currentConversationId,
        messagesRef,
        persistCurrentConversation,
        sessionId,
    ])

    const persistDiagramVersions = useCallback(() => {
        persistCurrentConversation({
            diagramVersions: diagramVersionsRef.current,
            diagramVersionCursor: diagramVersionCursorRef.current,
            diagramVersionMarks: diagramVersionMarksRef.current,
        })
    }, [persistCurrentConversation])

    const normalizeCursor = (cursor: number, len: number) =>
        Math.min(Math.max(cursor, -1), len - 1)

    const ensureDiagramVersionForMessage = useCallback(
        (messageIndex: number, xml: string, note?: string) => {
            const nextXml = String(xml ?? "")
            const versions = diagramVersionsRef.current
            const cursor = diagramVersionCursorRef.current

            const currentXml =
                cursor >= 0 && cursor < versions.length
                    ? versions[cursor]?.xml
                    : ""

            let nextIndex = cursor
            if (nextXml && nextXml !== currentXml) {
                const truncated =
                    cursor >= 0 && cursor < versions.length - 1
                        ? versions.slice(0, cursor + 1)
                        : versions.slice()

                const entry: DiagramVersion = {
                    id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    createdAt: Date.now(),
                    xml: nextXml,
                    note,
                }
                truncated.push(entry)
                diagramVersionsRef.current = truncated
                nextIndex = truncated.length - 1
                diagramVersionCursorRef.current = nextIndex
                setDiagramVersions(truncated)
                setDiagramVersionCursor(nextIndex)
            }

            diagramVersionMarksRef.current = {
                ...diagramVersionMarksRef.current,
                [messageIndex]: nextIndex,
            }
            persistDiagramVersions()
            return nextXml
        },
        [persistDiagramVersions],
    )

    const appendDiagramVersion = useCallback(
        (xml: string, note?: string) => {
            const nextXml = String(xml ?? "")
            if (!nextXml) return

            const versions = diagramVersionsRef.current
            const cursor = diagramVersionCursorRef.current
            const currentXml =
                cursor >= 0 && cursor < versions.length
                    ? versions[cursor]?.xml
                    : ""
            if (nextXml === currentXml) return

            const truncated =
                cursor >= 0 && cursor < versions.length - 1
                    ? versions.slice(0, cursor + 1)
                    : versions.slice()

            const entry: DiagramVersion = {
                id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: Date.now(),
                xml: nextXml,
                note,
            }
            truncated.push(entry)

            diagramVersionsRef.current = truncated
            diagramVersionCursorRef.current = truncated.length - 1
            setDiagramVersions(truncated)
            setDiagramVersionCursor(diagramVersionCursorRef.current)
            persistDiagramVersions()
        },
        [persistDiagramVersions],
    )

    const getDiagramXmlForMessage = useCallback((messageIndex: number) => {
        const idx = diagramVersionMarksRef.current[messageIndex]
        const versions = diagramVersionsRef.current
        if (typeof idx !== "number") return ""
        return idx >= 0 && idx < versions.length ? versions[idx]?.xml || "" : ""
    }, [])

    const getDiagramVersionIndexForMessage = useCallback(
        (messageIndex: number) => {
            const idx = diagramVersionMarksRef.current[messageIndex]
            return typeof idx === "number" ? idx : -1
        },
        [],
    )

    const getPreviousDiagramXmlBeforeMessage = useCallback(
        (beforeIndex: number) => {
            const marks = diagramVersionMarksRef.current
            const keys = Object.keys(marks)
                .map((k) => Number(k))
                .filter((k) => Number.isFinite(k) && k < beforeIndex)
                .sort((a, b) => b - a)
            if (keys.length === 0) return ""
            const idx = marks[keys[0]]
            const versions = diagramVersionsRef.current
            return idx >= 0 && idx < versions.length
                ? versions[idx]?.xml || ""
                : ""
        },
        [],
    )

    const restoreDiagramVersionIndex = useCallback(
        (index: number) => {
            const versions = diagramVersionsRef.current
            const nextIndex = normalizeCursor(index, versions.length)
            const entry = versions[nextIndex]
            if (!entry) return
            onDisplayChart(entry.xml, true)
            chartXMLRef.current = entry.xml
            diagramVersionCursorRef.current = nextIndex
            setDiagramVersionCursor(nextIndex)
            persistDiagramVersions()
        },
        [chartXMLRef, onDisplayChart, persistDiagramVersions],
    )

    const truncateDiagramVersionsAfterMessage = useCallback(
        (messageIndex: number) => {
            const markIdx = diagramVersionMarksRef.current[messageIndex]
            if (typeof markIdx !== "number") return
            const versions = diagramVersionsRef.current
            const nextVersions =
                markIdx >= 0 && markIdx < versions.length
                    ? versions.slice(0, markIdx + 1)
                    : versions.slice()

            const nextMarks: Record<number, number> = {}
            for (const [k, v] of Object.entries(
                diagramVersionMarksRef.current,
            )) {
                const mi = Number(k)
                if (!Number.isFinite(mi)) continue
                if (
                    mi <= messageIndex &&
                    typeof v === "number" &&
                    v <= markIdx
                ) {
                    nextMarks[mi] = v
                }
            }

            diagramVersionsRef.current = nextVersions
            diagramVersionMarksRef.current = nextMarks
            diagramVersionCursorRef.current = normalizeCursor(
                Math.min(diagramVersionCursorRef.current, markIdx),
                nextVersions.length,
            )
            setDiagramVersions(nextVersions)
            setDiagramVersionCursor(diagramVersionCursorRef.current)
            persistDiagramVersions()
        },
        [persistDiagramVersions],
    )

    const canUndo = diagramVersionCursor > 0
    const canRedo =
        diagramVersionCursor >= 0 &&
        diagramVersionCursor < diagramVersions.length - 1

    const undoDiagram = useCallback(() => {
        if (!canUndo) return
        restoreDiagramVersionIndex(diagramVersionCursor - 1)
    }, [canUndo, diagramVersionCursor, restoreDiagramVersionIndex])

    const redoDiagram = useCallback(() => {
        if (!canRedo) return
        restoreDiagramVersionIndex(diagramVersionCursor + 1)
    }, [canRedo, diagramVersionCursor, restoreDiagramVersionIndex])

    const handleNewChat = useCallback(
        (options?: { keepDiagram?: boolean }) => {
            const keepDiagram = options?.keepDiagram === true
            const id = createConversationId()
            const now = Date.now()
            const currentXml = chartXMLRef.current || ""
            const payload: ConversationPayload = {
                messages: [],
                xml: keepDiagram ? currentXml : "",
                snapshots: [],
                diagramVersions: [],
                diagramVersionCursor: -1,
                diagramVersionMarks: {},
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
                if (!keepDiagram) {
                    clearDiagram()
                }
                resetFiles()
                diagramVersionsRef.current = []
                diagramVersionCursorRef.current = -1
                diagramVersionMarksRef.current = {}
                setDiagramVersions([])
                setDiagramVersionCursor(-1)
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
        },
        [
            clearDiagram,
            conversations,
            chartXMLRef,
            persistCurrentConversation,
            flushPersistCurrentConversation,
            queuePushConversation,
            resetFiles,
            setMessages,
            stopCurrentRequest,
            t,
        ],
    )

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
                            diagramVersions: [],
                            diagramVersionCursor: -1,
                            diagramVersionMarks: {},
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
                    sessionId,
                    diagramVersions: diagramVersionsRef.current,
                    diagramVersionCursor: diagramVersionCursorRef.current,
                    diagramVersionMarks: diagramVersionMarksRef.current,
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
                    diagramVersions: [],
                    diagramVersionCursor: -1,
                    diagramVersionMarks: {},
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
                    diagramVersions: [],
                    diagramVersionCursor: -1,
                    diagramVersionMarks: {},
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
        diagramVersions,
        diagramVersionCursor,
        canUndo,
        canRedo,
        undoDiagram,
        redoDiagram,
        restoreDiagramVersionIndex,
        ensureDiagramVersionForMessage,
        appendDiagramVersion,
        getDiagramXmlForMessage,
        getDiagramVersionIndexForMessage,
        getPreviousDiagramXmlBeforeMessage,
        truncateDiagramVersionsAfterMessage,
        handleNewChat,
        handleSelectConversation,
        handleDeleteConversation,
    }
}
