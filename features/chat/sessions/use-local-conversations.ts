"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import {
    deriveConversationTitle,
    useConversationTitles,
    useDiagramVersionHistory,
} from "./hooks"

type QueuePushConversation = (
    id: string,
    opts?: { immediate?: boolean; deleted?: boolean },
) => void

/**
 * 移除消息中的文件 parts（type: "file"），保留文本和其他 parts
 */
function stripFilePartsFromMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((msg) => {
        const parts = (msg as any)?.parts
        if (!Array.isArray(parts)) return msg

        const keptParts = parts.filter((p: any) => p?.type !== "file")

        if (keptParts.length === parts.length) return msg

        return { ...msg, parts: keptParts }
    })
}

export function useLocalConversations({
    userId,
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
    persistUploadedFiles,
}: {
    userId: string
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
    persistUploadedFiles: boolean
}) {
    const [conversations, setConversations] = useState<ConversationMeta[]>([])
    const [currentConversationId, setCurrentConversationId] = useState(() => {
        if (typeof window === "undefined") return ""
        return readCurrentConversationIdFromStorage(userId)
    })
    const [sessionId, setSessionId] = useState(() => createSessionId())
    const [hasRestored, setHasRestored] = useState(false)
    const [canSaveDiagram, setCanSaveDiagram] = useState(false)

    const pendingDiagramXmlRef = useRef<string | null>(null)
    const persistDebounceTimerRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null)
    const loadingConversationRef = useRef<string | null>(null)

    // 使用共享的标题 hook
    const { getConversationDisplayTitle } = useConversationTitles({
        conversations,
        locale,
    })

    // 持久化版本变更的回调
    const handleVersionsChange = useCallback(() => {
        // 版本变更时触发持久化（通过 debounce 实现）
    }, [])

    // 使用共享的图表版本历史 hook
    const diagramHistory = useDiagramVersionHistory({
        onDisplayChart,
        chartXMLRef,
        onVersionsChange: handleVersionsChange,
    })
    const getDiagramStateSnapshot = diagramHistory.getStateSnapshot

    // 迁移旧的 snapshots 数据到新的版本格式
    const migrateSnapshotsToVersions = useCallback(
        (
            snapshots: Array<[number, string]>,
        ): {
            versions: DiagramVersion[]
            cursor: number
            marks: Record<number, number>
        } => {
            const versions: DiagramVersion[] = snapshots
                .filter((s) => Array.isArray(s) && s.length === 2)
                .map(([messageIndex, snapshotXml], idx) => {
                    const mi = Number(messageIndex)
                    if (!Number.isFinite(mi)) return null
                    return {
                        id: `migrated-${mi}-${idx}`,
                        createdAt: Date.now() - (snapshots.length - idx) * 1000,
                        xml: String(snapshotXml ?? ""),
                        note: "migrated",
                    } satisfies DiagramVersion
                })
                .filter(Boolean) as DiagramVersion[]

            const cursor = versions.length > 0 ? versions.length - 1 : -1
            const marks: Record<number, number> = {}

            for (const [messageIndex, snapshotXml] of snapshots) {
                const mi = Number(messageIndex)
                if (!Number.isFinite(mi)) continue
                const xml = String(snapshotXml ?? "")
                const found = versions.findIndex((v) => v.xml === xml)
                if (found >= 0) marks[mi] = found
            }

            return { versions, cursor, marks }
        },
        [],
    )

    const loadConversation = useCallback(
        (id: string) => {
            try {
                const raw = localStorage.getItem(
                    conversationStorageKey(userId, id),
                )
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

                // 恢复图表版本历史
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

                // 迁移旧格式数据
                if (versions.length === 0 && Array.isArray(payload.snapshots)) {
                    const migrated = migrateSnapshotsToVersions(
                        payload.snapshots as Array<[number, string]>,
                    )
                    versions = migrated.versions
                    cursor = migrated.cursor
                    marks = migrated.marks
                }

                diagramHistory.restoreState({ versions, cursor, marks })

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
                diagramHistory.clearHistory()
            }
        },
        [
            autoRetryCountRef,
            chartXMLRef,
            clearDiagram,
            diagramHistory.restoreState,
            diagramHistory.clearHistory,
            editFailureCountRef,
            forceDisplayNextRef,
            isDrawioReady,
            migrateSnapshotsToVersions,
            onDisplayChart,
            processedToolCallsRef,
            setMessages,
            userId,
        ],
    )

    // 从云端按需加载会话
    const loadConversationFromCloudIfNeeded = useCallback(
        async (id: string) => {
            if (userId === "anonymous") return false

            try {
                const raw = localStorage.getItem(
                    conversationStorageKey(userId, id),
                )
                if (raw) return false
            } catch {
                // ignore
            }

            if (loadingConversationRef.current === id) return false
            loadingConversationRef.current = id

            try {
                const response = await fetch(
                    `/api/trpc/conversation.getById?input=${encodeURIComponent(JSON.stringify({ id }))}`,
                    {
                        method: "GET",
                        headers: { "Content-Type": "application/json" },
                    },
                )

                if (!response.ok) {
                    toast.error("会话加载失败")
                    return false
                }

                const data = await response.json()
                const result = data.result?.data

                if (!result || !result.payload) {
                    toast.error("会话数据不完整")
                    return false
                }

                const payload = result.payload as any

                try {
                    writeConversationPayloadToStorage(userId, id, payload)
                } catch (error) {
                    console.warn("缓存会话失败:", error)
                }

                loadConversation(id)
                return true
            } catch (error) {
                console.error("从云端加载会话失败:", error)
                toast.error("加载会话失败，请重试")
                return false
            } finally {
                loadingConversationRef.current = null
            }
        },
        [userId, loadConversation],
    )

    const persistCurrentConversation = useCallback(
        (overrides: Partial<ConversationPayload>) => {
            if (!currentConversationId) return
            try {
                const existing =
                    readConversationPayloadFromStorage(
                        userId,
                        currentConversationId,
                    ) ||
                    ({
                        messages: [],
                        xml: "",
                        snapshots: [],
                        diagramVersions: [],
                        diagramVersionCursor: -1,
                        diagramVersionMarks: {},
                        sessionId,
                    } satisfies ConversationPayload)

                let messagesToSave =
                    overrides.messages ?? existing.messages ?? ([] as any)

                if (!persistUploadedFiles) {
                    messagesToSave = stripFilePartsFromMessages(messagesToSave)
                }

                const versionState = getDiagramStateSnapshot()

                const merged: ConversationPayload = {
                    messages: messagesToSave,
                    xml: overrides.xml ?? existing.xml ?? "",
                    snapshots: overrides.snapshots ?? existing.snapshots ?? [],
                    diagramVersions:
                        overrides.diagramVersions ?? versionState.versions,
                    diagramVersionCursor:
                        overrides.diagramVersionCursor ?? versionState.cursor,
                    diagramVersionMarks:
                        overrides.diagramVersionMarks ?? versionState.marks,
                    sessionId:
                        overrides.sessionId ?? existing.sessionId ?? sessionId,
                }

                writeConversationPayloadToStorage(
                    userId,
                    currentConversationId,
                    merged,
                )

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
                    writeConversationMetasToStorage(userId, next)
                    return next
                })

                queuePushConversation(currentConversationId)
            } catch (error) {
                console.error("Failed to persist current conversation:", error)
            }
        },
        [
            currentConversationId,
            getDiagramStateSnapshot,
            queuePushConversation,
            sessionId,
            userId,
            persistUploadedFiles,
        ],
    )

    const flushPersistCurrentConversation = useCallback(() => {
        if (!currentConversationId) return
        if (persistDebounceTimerRef.current) {
            clearTimeout(persistDebounceTimerRef.current)
            persistDebounceTimerRef.current = null
        }
        const versionState = getDiagramStateSnapshot()
        persistCurrentConversation({
            messages: messagesRef.current as any,
            xml: chartXMLRef.current || "",
            sessionId,
            diagramVersions: versionState.versions,
            diagramVersionCursor: versionState.cursor,
            diagramVersionMarks: versionState.marks,
        })
    }, [
        chartXMLRef,
        currentConversationId,
        getDiagramStateSnapshot,
        messagesRef,
        persistCurrentConversation,
        sessionId,
    ])

    const persistDiagramVersions = useCallback(() => {
        const versionState = getDiagramStateSnapshot()
        persistCurrentConversation({
            diagramVersions: versionState.versions,
            diagramVersionCursor: versionState.cursor,
            diagramVersionMarks: versionState.marks,
        })
    }, [getDiagramStateSnapshot, persistCurrentConversation])

    // 包装图表版本方法以添加持久化
    const ensureDiagramVersionForMessage = useCallback(
        (messageIndex: number, xml: string, note?: string) => {
            const result = diagramHistory.ensureDiagramVersionForMessage(
                messageIndex,
                xml,
                note,
            )
            persistDiagramVersions()
            return result
        },
        [diagramHistory.ensureDiagramVersionForMessage, persistDiagramVersions],
    )

    const appendDiagramVersion = useCallback(
        (xml: string, note?: string) => {
            diagramHistory.appendDiagramVersion(xml, note)
            persistDiagramVersions()
        },
        [diagramHistory.appendDiagramVersion, persistDiagramVersions],
    )

    const restoreDiagramVersionIndex = useCallback(
        (index: number) => {
            diagramHistory.restoreDiagramVersionIndex(index)
            persistDiagramVersions()
        },
        [diagramHistory.restoreDiagramVersionIndex, persistDiagramVersions],
    )

    const truncateDiagramVersionsAfterMessage = useCallback(
        (messageIndex: number) => {
            diagramHistory.truncateDiagramVersionsAfterMessage(messageIndex)
            persistDiagramVersions()
        },
        [
            diagramHistory.truncateDiagramVersionsAfterMessage,
            persistDiagramVersions,
        ],
    )

    const handleNewChat = useCallback(
        (options?: { keepDiagram?: boolean }): boolean => {
            const isAnonymous = userId === "anonymous"
            if (isAnonymous) {
                const ANONYMOUS_QUOTA = 3
                if (conversations.length >= ANONYMOUS_QUOTA) {
                    return false
                }
            }

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

                writeConversationPayloadToStorage(userId, id, payload)
                const nextMetas = [
                    {
                        id,
                        createdAt: now,
                        updatedAt: now,
                    } satisfies ConversationMeta,
                    ...conversations,
                ]
                writeConversationMetasToStorage(userId, nextMetas)
                writeCurrentConversationIdToStorage(userId, id)

                setMessages([])
                if (!keepDiagram) {
                    clearDiagram()
                }
                resetFiles()
                diagramHistory.clearHistory()
                setSessionId(payload.sessionId)
                setConversations(nextMetas)
                setCurrentConversationId(id)

                queuePushConversation(id, { immediate: true })
                toast.success(t("toast.startedFreshChat"), {
                    id: "startedFreshChat",
                    duration: 2000,
                })
                return true
            } catch (error) {
                console.error("Failed to create new conversation:", error)
                toast.warning(t("toast.storageUpdateFailed"))
                return false
            }
        },
        [
            clearDiagram,
            conversations,
            chartXMLRef,
            diagramHistory.clearHistory,
            flushPersistCurrentConversation,
            queuePushConversation,
            resetFiles,
            setMessages,
            stopCurrentRequest,
            t,
            userId,
        ],
    )

    const handleSelectConversation = useCallback(
        (id: string) => {
            if (!id || id === currentConversationId) return
            try {
                stopCurrentRequest?.()
                flushPersistCurrentConversation()
                writeCurrentConversationIdToStorage(userId, id)
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
            userId,
        ],
    )

    const handleDeleteConversation = useCallback(
        (id: string) => {
            try {
                stopCurrentRequest?.()
                flushPersistCurrentConversation()
                queuePushConversation(id, { immediate: true, deleted: true })
                removeConversationPayloadFromStorage(userId, id)

                const nextMetas = conversations.filter((c) => c.id !== id)
                writeConversationMetasToStorage(userId, nextMetas)
                setConversations(nextMetas)

                if (id === currentConversationId) {
                    const nextId = nextMetas[0]?.id
                    if (nextId) {
                        writeCurrentConversationIdToStorage(userId, nextId)
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
                        writeConversationPayloadToStorage(
                            userId,
                            newId,
                            payload,
                        )
                        const metas = [
                            {
                                id: newId,
                                createdAt: now,
                                updatedAt: now,
                            } satisfies ConversationMeta,
                        ]
                        writeConversationMetasToStorage(userId, metas)
                        writeCurrentConversationIdToStorage(userId, newId)
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
            userId,
        ],
    )

    // Effect: 加载会话
    useEffect(() => {
        if (!currentConversationId) return
        loadConversation(currentConversationId)
    }, [currentConversationId, loadConversation])

    // Effect: 消息变更时自动保存
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

    // Effect: DrawIO 就绪后加载待处理的 XML
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
                readConversationPayloadFromStorage(
                    userId,
                    currentConversationId,
                )?.xml || ""
        }
        if (xmlToLoad) {
            onDisplayChart(xmlToLoad, true)
            chartXMLRef.current = xmlToLoad
        }
        setTimeout(() => setCanSaveDiagram(true), 300)
    }, [
        chartXMLRef,
        currentConversationId,
        isDrawioReady,
        onDisplayChart,
        userId,
    ])

    // Effect: 图表 XML 变更时保存
    useEffect(() => {
        if (!canSaveDiagram) return
        if (chartXML && chartXML.length > 300) {
            persistCurrentConversation({ xml: chartXML })
        } else if (chartXML === "") {
            persistCurrentConversation({ xml: "" })
        }
    }, [canSaveDiagram, chartXML, persistCurrentConversation])

    // Effect: sessionId 变更时保存
    useEffect(() => {
        persistCurrentConversation({ sessionId })
    }, [persistCurrentConversation, sessionId])

    // Effect: 页面卸载前保存
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (!currentConversationId) return
            try {
                const versionState = diagramHistory.getStateSnapshot()
                const payload: ConversationPayload = {
                    messages: messagesRef.current as any,
                    xml: chartXMLRef.current || "",
                    sessionId,
                    diagramVersions: versionState.versions,
                    diagramVersionCursor: versionState.cursor,
                    diagramVersionMarks: versionState.marks,
                }
                writeConversationPayloadToStorage(
                    userId,
                    currentConversationId,
                    payload,
                )

                const metas = readConversationMetasFromStorage(userId)
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
                writeConversationMetasToStorage(userId, next)
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
        diagramHistory.getStateSnapshot,
        messagesRef,
        sessionId,
        userId,
    ])

    // Effect: 初始化会话列表
    useEffect(() => {
        try {
            let metas = readConversationMetasFromStorage(userId)

            // 迁移旧格式数据
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
                writeConversationPayloadToStorage(userId, id, payload)
                metas = [
                    {
                        id,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        title: deriveConversationTitle(payload.messages),
                    },
                ]
                writeConversationMetasToStorage(userId, metas)
                writeCurrentConversationIdToStorage(userId, id)
                setCurrentConversationId(id)

                localStorage.removeItem(STORAGE_MESSAGES_KEY)
                localStorage.removeItem(STORAGE_XML_SNAPSHOTS_KEY)
                localStorage.removeItem(STORAGE_DIAGRAM_XML_KEY)
                localStorage.removeItem(STORAGE_SESSION_ID_KEY)
            }

            if (metas.length === 0) {
                const id = createConversationId()
                metas = [{ id, createdAt: Date.now(), updatedAt: Date.now() }]
                writeConversationMetasToStorage(userId, metas)
                writeCurrentConversationIdToStorage(userId, id)
                writeConversationPayloadToStorage(userId, id, {
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
                writeCurrentConversationIdToStorage(userId, id)
                setCurrentConversationId(id)
            }

            setConversations(metas)
        } catch (error) {
            console.error("Failed to restore conversations:", error)
        } finally {
            setHasRestored(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    // Effect: 按需从云端加载
    useEffect(() => {
        if (!currentConversationId || !hasRestored) return
        if (userId === "anonymous") return

        void loadConversationFromCloudIfNeeded(currentConversationId)
    }, [
        currentConversationId,
        hasRestored,
        userId,
        loadConversationFromCloudIfNeeded,
    ])

    // 按 updatedAt 降序排序
    const sortedConversations = useMemo(
        () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
        [conversations],
    )

    return {
        conversations: sortedConversations,
        setConversations,
        currentConversationId,
        setCurrentConversationId,
        sessionId,
        setSessionId,
        hasRestored,
        canSaveDiagram,
        isLoadingSwitch: false, // 本地模式同步加载，无需 loading 状态
        getConversationDisplayTitle,
        deriveConversationTitle,
        loadConversation,
        persistCurrentConversation,
        diagramVersions: diagramHistory.versions,
        diagramVersionCursor: diagramHistory.cursor,
        canUndo: diagramHistory.canUndo,
        canRedo: diagramHistory.canRedo,
        undoDiagram: diagramHistory.undoDiagram,
        redoDiagram: diagramHistory.redoDiagram,
        restoreDiagramVersionIndex,
        ensureDiagramVersionForMessage,
        appendDiagramVersion,
        getDiagramXmlForMessage: diagramHistory.getDiagramXmlForMessage,
        getDiagramVersionIndexForMessage:
            diagramHistory.getDiagramVersionIndexForMessage,
        getPreviousDiagramXmlBeforeMessage:
            diagramHistory.getPreviousDiagramXmlBeforeMessage,
        truncateDiagramVersionsAfterMessage,
        handleNewChat,
        handleSelectConversation,
        handleDeleteConversation,
    }
}
