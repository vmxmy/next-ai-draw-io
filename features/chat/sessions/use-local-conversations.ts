"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { sanitizeMessagesForToolCalling } from "@/features/chat/ai/sanitize-messages"
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
    enabled = true,
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
    enabled?: boolean
}) {
    const [conversations, setConversations] = useState<ConversationMeta[]>([])
    const [currentConversationId, setCurrentConversationId] = useState(() => {
        if (typeof window === "undefined") return ""
        return readCurrentConversationIdFromStorage(userId)
    })
    const [sessionId, setSessionId] = useState(() => createSessionId())
    const [hasRestored, setHasRestored] = useState(false)
    const [isLoadingSwitch, setIsLoadingSwitch] = useState(false)
    const [switchingToId, setSwitchingToId] = useState<string | null>(null)

    // Refs 用于事件处理器中获取最新值，避免闭包过期
    const currentConversationIdRef = useRef(currentConversationId)
    const sessionIdRef = useRef(sessionId)
    const [canSaveDiagram, setCanSaveDiagram] = useState(false)

    const pendingDiagramXmlRef = useRef<string | null>(null)
    const persistDebounceTimerRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null)
    const loadingConversationRef = useRef<string | null>(null)

    // 同步 refs 保持最新
    useEffect(() => {
        currentConversationIdRef.current = currentConversationId
    }, [currentConversationId])

    useEffect(() => {
        sessionIdRef.current = sessionId
    }, [sessionId])

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
            console.log("[session-debug] loadConversation called", {
                id,
                userId,
                isDrawioReady,
            })
            try {
                const storageKey = conversationStorageKey(userId, id)
                const raw = localStorage.getItem(storageKey)
                console.log("[session-debug] loadConversation raw data", {
                    storageKey,
                    hasData: !!raw,
                    dataLength: raw?.length ?? 0,
                })
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
                console.log("[session-debug] loadConversation parsed payload", {
                    messageCount: payload.messages?.length ?? 0,
                    xmlLength: payload.xml?.length ?? 0,
                    hasXml: !!payload.xml,
                    xmlPreview: payload.xml?.substring(0, 100),
                    sessionId: payload.sessionId,
                    diagramVersionCount: payload.diagramVersions?.length ?? 0,
                })

                // 清理消息历史，确保 tool-call/tool-result 配对完整
                const sanitizedMessages = sanitizeMessagesForToolCalling(
                    (payload.messages || []) as any,
                )
                setMessages(sanitizedMessages as any)
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
                console.log("[session-debug] restored diagram history", {
                    versionCount: versions.length,
                    cursor,
                    marksCount: Object.keys(marks).length,
                })

                if (payload.xml) {
                    console.log("[session-debug] loading diagram XML", {
                        isDrawioReady,
                        xmlLength: payload.xml.length,
                    })
                    if (isDrawioReady) {
                        const result = onDisplayChart(payload.xml, true)
                        console.log("[session-debug] onDisplayChart result", {
                            result,
                        })
                        chartXMLRef.current = payload.xml
                    } else {
                        console.log(
                            "[session-debug] drawio not ready, storing pending XML",
                        )
                        pendingDiagramXmlRef.current = payload.xml
                    }
                } else {
                    console.log(
                        "[session-debug] no XML in payload, clearing diagram",
                    )
                    clearDiagram()
                    chartXMLRef.current = ""
                }
                console.log(
                    "[session-debug] loadConversation completed successfully",
                )
            } catch (error) {
                console.error("[session-debug] loadConversation FAILED", error)
                // 注意：不设置空消息，避免触发自动保存覆盖云端数据
                // 保持 UI 状态不变，让用户知道加载失败
                toast.error("会话加载失败，请刷新页面重试")
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
            console.log(
                "[session-debug] loadConversationFromCloudIfNeeded called",
                {
                    id,
                    userId,
                },
            )
            if (userId === "anonymous") {
                console.log(
                    "[session-debug] Cloud load skipped: anonymous user",
                )
                return false
            }

            try {
                const storageKey = conversationStorageKey(userId, id)
                const raw = localStorage.getItem(storageKey)
                console.log(
                    "[session-debug] Checking local storage for cloud load",
                    {
                        storageKey,
                        hasLocal: !!raw,
                    },
                )
                if (raw) {
                    console.log(
                        "[session-debug] Local data exists, skipping cloud load",
                    )
                    return false
                }
            } catch (error) {
                console.log(
                    "[session-debug] Error checking local storage",
                    error,
                )
            }

            if (loadingConversationRef.current === id) {
                console.log("[session-debug] Already loading this conversation")
                return false
            }
            loadingConversationRef.current = id

            try {
                const url = `/api/trpc/conversation.getById?input=${encodeURIComponent(JSON.stringify({ id }))}`
                console.log("[session-debug] Fetching from cloud", { url })
                const response = await fetch(url, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                })

                console.log("[session-debug] Cloud response", {
                    ok: response.ok,
                    status: response.status,
                })
                if (!response.ok) {
                    toast.error("会话加载失败")
                    return false
                }

                const data = await response.json()
                const result = data.result?.data
                console.log("[session-debug] Cloud data parsed", {
                    hasResult: !!result,
                    hasPayload: !!result?.payload,
                    messageCount: result?.payload?.messages?.length ?? 0,
                    xmlLength: result?.payload?.xml?.length ?? 0,
                })

                if (!result || !result.payload) {
                    console.log("[session-debug] Cloud data incomplete")
                    toast.error("会话数据不完整")
                    return false
                }

                const payload = result.payload as any

                try {
                    writeConversationPayloadToStorage(userId, id, payload)
                    console.log(
                        "[session-debug] Cached cloud data to localStorage",
                    )
                } catch (error) {
                    console.warn("[session-debug] 缓存会话失败:", error)
                }

                console.log(
                    "[session-debug] Loading conversation from cloud data",
                )
                loadConversation(id)
                return true
            } catch (error) {
                console.error("[session-debug] 从云端加载会话失败:", error)
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
                setIsLoadingSwitch(true)
                setSwitchingToId(id)
                flushPersistCurrentConversation()
                writeCurrentConversationIdToStorage(userId, id)
                setCurrentConversationId(id)
            } catch (error) {
                console.error("Failed to select conversation:", error)
                toast.warning(t("toast.storageUpdateFailed"))
                setIsLoadingSwitch(false)
                setSwitchingToId(null)
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
        if (!enabled) return
        console.log("[session-debug] Effect: load conversation triggered", {
            currentConversationId,
            hasId: !!currentConversationId,
        })
        if (!currentConversationId) {
            console.log(
                "[session-debug] Effect: no currentConversationId, skipping",
            )
            return
        }
        loadConversation(currentConversationId)

        // 加载完成后清除 loading 状态（短暂延迟确保 UI 更新完成）
        const timer = setTimeout(() => {
            setIsLoadingSwitch(false)
            setSwitchingToId(null)
        }, 100)

        return () => clearTimeout(timer)
    }, [enabled, currentConversationId, loadConversation])

    // Effect: 消息变更时自动保存
    useEffect(() => {
        if (!enabled) return
        if (!hasRestored) return
        if (!currentConversationId) return

        // 保护机制：空消息时不触发保存，避免异常情况覆盖原有数据
        const messageArray = messages as any[]
        if (!messageArray || messageArray.length === 0) {
            // 检查存储中是否已有消息，如果有则不用空消息覆盖
            const existing = readConversationPayloadFromStorage(
                userId,
                currentConversationId,
            )
            if (existing?.messages && existing.messages.length > 0) {
                console.log(
                    "[session-debug] Skipping auto-save: empty messages would overwrite existing data",
                )
                return
            }
        }

        if (persistDebounceTimerRef.current) {
            clearTimeout(persistDebounceTimerRef.current)
        }
        // 300ms 防抖，企业级标准：快速响应 + 避免频繁写入
        persistDebounceTimerRef.current = setTimeout(() => {
            persistDebounceTimerRef.current = null
            persistCurrentConversation({ messages: messages as any })
        }, 300)

        return () => {
            if (persistDebounceTimerRef.current) {
                clearTimeout(persistDebounceTimerRef.current)
                persistDebounceTimerRef.current = null
            }
        }
    }, [
        enabled,
        currentConversationId,
        hasRestored,
        messages,
        persistCurrentConversation,
    ])

    // Effect: DrawIO 就绪后加载待处理的 XML
    useEffect(() => {
        if (!enabled) return
        console.log("[session-debug] Effect: DrawIO ready check", {
            isDrawioReady,
            currentConversationId,
            hasPendingXml: !!pendingDiagramXmlRef.current,
        })
        if (!isDrawioReady) {
            console.log(
                "[session-debug] DrawIO not ready, disabling diagram save",
            )
            setCanSaveDiagram(false)
            return
        }
        const pending = pendingDiagramXmlRef.current
        pendingDiagramXmlRef.current = null
        console.log("[session-debug] DrawIO ready, processing pending XML", {
            hasPending: !!pending,
            pendingLength: pending?.length ?? 0,
        })

        let xmlToLoad = pending
        if (!xmlToLoad && currentConversationId) {
            console.log("[session-debug] No pending XML, loading from storage")
            const storedPayload = readConversationPayloadFromStorage(
                userId,
                currentConversationId,
            )
            xmlToLoad = storedPayload?.xml || ""
            console.log("[session-debug] Loaded XML from storage", {
                hasPayload: !!storedPayload,
                xmlLength: xmlToLoad?.length ?? 0,
            })
        }
        if (xmlToLoad) {
            console.log("[session-debug] Displaying XML in DrawIO", {
                xmlLength: xmlToLoad.length,
                xmlPreview: xmlToLoad.substring(0, 100),
            })
            const result = onDisplayChart(xmlToLoad, true)
            console.log("[session-debug] onDisplayChart result", { result })
            chartXMLRef.current = xmlToLoad
        } else {
            console.log("[session-debug] No XML to load")
        }
        setTimeout(() => setCanSaveDiagram(true), 300)
    }, [
        enabled,
        chartXMLRef,
        currentConversationId,
        isDrawioReady,
        onDisplayChart,
        userId,
    ])

    // Effect: 图表 XML 变更时保存
    useEffect(() => {
        if (!enabled) return
        if (!canSaveDiagram) return
        if (chartXML && chartXML.length > 300) {
            persistCurrentConversation({ xml: chartXML })
        } else if (chartXML === "") {
            persistCurrentConversation({ xml: "" })
        }
    }, [enabled, canSaveDiagram, chartXML, persistCurrentConversation])

    // Effect: sessionId 变更时保存
    useEffect(() => {
        if (!enabled) return
        persistCurrentConversation({ sessionId })
    }, [enabled, persistCurrentConversation, sessionId])

    // Effect: 页面隐藏/卸载前保存（企业级可靠性保障）
    // 使用 refs 避免闭包捕获过期值
    useEffect(() => {
        if (!enabled) return

        const saveImmediately = () => {
            // 使用 refs 获取最新值，避免闭包过期
            const convId = currentConversationIdRef.current
            const sessId = sessionIdRef.current
            if (!convId) return
            try {
                const versionState = diagramHistory.getStateSnapshot()
                const payload: ConversationPayload = {
                    messages: messagesRef.current as any,
                    xml: chartXMLRef.current || "",
                    sessionId: sessId,
                    diagramVersions: versionState.versions,
                    diagramVersionCursor: versionState.cursor,
                    diagramVersionMarks: versionState.marks,
                }
                writeConversationPayloadToStorage(userId, convId, payload)

                const metas = readConversationMetasFromStorage(userId)
                const now = Date.now()
                const next = Array.isArray(metas)
                    ? metas.map((m) =>
                          m.id === convId
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
                console.error("Failed to persist state:", error)
            }
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                saveImmediately()
            }
        }

        const handleBeforeUnload = () => {
            saveImmediately()
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        window.addEventListener("beforeunload", handleBeforeUnload)

        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            )
            window.removeEventListener("beforeunload", handleBeforeUnload)
        }
    }, [
        enabled,
        chartXMLRef,
        diagramHistory.getStateSnapshot,
        messagesRef,
        userId,
    ])

    // Effect: 初始化会话列表
    useEffect(() => {
        if (!enabled) {
            console.log(
                "[session-debug] Effect: Initialize skipped (not enabled)",
            )
            return
        }
        console.log("[session-debug] Effect: Initialize conversation list", {
            userId,
            currentConversationId,
        })
        try {
            let metas = readConversationMetasFromStorage(userId)
            console.log("[session-debug] Initial metas loaded", {
                count: metas.length,
                ids: metas.map((m) => m.id),
            })

            // 迁移旧格式数据
            const legacyMessages = localStorage.getItem(STORAGE_MESSAGES_KEY)
            const legacySnapshots = localStorage.getItem(
                STORAGE_XML_SNAPSHOTS_KEY,
            )
            const legacyXml = localStorage.getItem(STORAGE_DIAGRAM_XML_KEY)
            const legacySession = localStorage.getItem(STORAGE_SESSION_ID_KEY)
            console.log("[session-debug] Legacy data check", {
                hasLegacyMessages: !!legacyMessages,
                hasLegacySnapshots: !!legacySnapshots,
                hasLegacyXml: !!legacyXml,
                hasLegacySession: !!legacySession,
            })

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
                console.log(
                    "[session-debug] No metas found, creating new conversation",
                )
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
                console.log("[session-debug] Created new conversation", { id })
                setCurrentConversationId(id)
            } else if (!currentConversationId) {
                const id = metas[0].id
                console.log(
                    "[session-debug] No currentConversationId, using first meta",
                    { id },
                )
                writeCurrentConversationIdToStorage(userId, id)
                setCurrentConversationId(id)
            } else {
                console.log(
                    "[session-debug] Using existing currentConversationId",
                    {
                        currentConversationId,
                    },
                )
            }

            console.log("[session-debug] Setting conversations", {
                count: metas.length,
            })
            setConversations(metas)
        } catch (error) {
            console.error(
                "[session-debug] Failed to restore conversations:",
                error,
            )
        } finally {
            console.log(
                "[session-debug] Initialization complete, setting hasRestored=true",
            )
            setHasRestored(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, userId])

    // Effect: 按需从云端加载
    useEffect(() => {
        if (!enabled) return
        console.log("[session-debug] Effect: Cloud load check", {
            currentConversationId,
            hasRestored,
            userId,
            isAnonymous: userId === "anonymous",
        })
        if (!currentConversationId || !hasRestored) {
            console.log(
                "[session-debug] Cloud load skipped: no id or not restored",
            )
            return
        }
        if (userId === "anonymous") {
            console.log("[session-debug] Cloud load skipped: anonymous user")
            return
        }

        console.log(
            "[session-debug] Triggering cloud load for",
            currentConversationId,
        )
        void loadConversationFromCloudIfNeeded(currentConversationId)
    }, [
        enabled,
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
        isLoadingSwitch,
        switchingToId,
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
