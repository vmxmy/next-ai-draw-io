"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { ChatMessage } from "@/features/chat/ai/types"
import { getCacheQuota } from "@/features/chat/sessions/cache-manager"
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

/**
 * 移除消息中的文件 parts（type: "file"），保留文本和其他 parts
 * @param messages 原始消息数组
 * @returns 移除文件后的新消息数组
 */
function stripFilePartsFromMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((msg) => {
        const parts = (msg as any)?.parts
        if (!Array.isArray(parts)) return msg

        const keptParts = parts.filter((p: any) => p?.type !== "file")

        // 如果没有移除任何 parts，返回原消息（避免不必要的对象创建）
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
    const loadingConversationRef = useRef<string | null>(null) // 正在加载的会话 ID

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
            userId,
        ],
    )

    // 从云端按需加载会话（仅登录用户）
    const loadConversationFromCloudIfNeeded = useCallback(
        async (id: string) => {
            // 匿名用户不支持云端加载
            if (userId === "anonymous") return false

            // 检查 localStorage 是否已有数据
            try {
                const raw = localStorage.getItem(
                    conversationStorageKey(userId, id),
                )
                if (raw) {
                    // 已有缓存，无需从云端加载
                    return false
                }
            } catch {
                // ignore
            }

            // 防止重复加载
            if (loadingConversationRef.current === id) return false
            loadingConversationRef.current = id

            try {
                // 从云端加载（使用 fetch 直接调用 tRPC）
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

                // 缓存到 localStorage
                try {
                    writeConversationPayloadToStorage(userId, id, payload)
                } catch (error) {
                    // 缓存失败不影响使用
                    console.warn("缓存会话失败:", error)
                }

                // 加载会话内容
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

                // 获取要保存的消息（可能来自 overrides 或 existing）
                let messagesToSave =
                    overrides.messages ?? existing.messages ?? ([] as any)

                // 如果不保存文件，移除 file parts
                if (!persistUploadedFiles) {
                    messagesToSave = stripFilePartsFromMessages(messagesToSave)
                }

                const merged: ConversationPayload = {
                    messages: messagesToSave,
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
            deriveConversationTitle,
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

    const MAX_DIAGRAM_VERSIONS = 50
    const MAX_XML_SIZE = 5_000_000 // 5MB

    const normalizeCursor = (cursor: number, len: number) =>
        Math.min(Math.max(cursor, -1), len - 1)

    const ensureDiagramVersionForMessage = useCallback(
        (messageIndex: number, xml: string, note?: string) => {
            const nextXml = String(xml ?? "")

            // 检查 XML 大小
            if (nextXml.length > MAX_XML_SIZE) {
                console.error(
                    `[diagram] XML too large: ${nextXml.length} bytes (max ${MAX_XML_SIZE})`,
                )
                toast.error("图表过大，无法保存历史版本")
                return nextXml
            }

            const versions = diagramVersionsRef.current
            const cursor = diagramVersionCursorRef.current

            const currentXml =
                cursor >= 0 && cursor < versions.length
                    ? versions[cursor]?.xml
                    : ""

            let nextIndex = cursor
            if (nextXml && nextXml !== currentXml) {
                let truncated =
                    cursor >= 0 && cursor < versions.length - 1
                        ? versions.slice(0, cursor + 1)
                        : versions.slice()

                // 限制版本数量（FIFO）
                if (truncated.length >= MAX_DIAGRAM_VERSIONS) {
                    truncated = truncated.slice(
                        truncated.length - MAX_DIAGRAM_VERSIONS + 1,
                    )
                    // 调整 marks
                    const minIndex = versions.length - truncated.length
                    const newMarks: Record<number, number> = {}
                    for (const [k, v] of Object.entries(
                        diagramVersionMarksRef.current,
                    )) {
                        const mi = Number(k)
                        if (typeof v === "number" && v >= minIndex) {
                            newMarks[mi] = v - minIndex
                        }
                    }
                    diagramVersionMarksRef.current = newMarks
                }

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

            // 检查 XML 大小
            if (nextXml.length > MAX_XML_SIZE) {
                console.error(
                    `[diagram] XML too large: ${nextXml.length} bytes (max ${MAX_XML_SIZE})`,
                )
                toast.error("图表过大，无法保存历史版本")
                return
            }

            const versions = diagramVersionsRef.current
            const cursor = diagramVersionCursorRef.current
            const currentXml =
                cursor >= 0 && cursor < versions.length
                    ? versions[cursor]?.xml
                    : ""
            if (nextXml === currentXml) return

            let truncated =
                cursor >= 0 && cursor < versions.length - 1
                    ? versions.slice(0, cursor + 1)
                    : versions.slice()

            // 限制版本数量（FIFO）
            if (truncated.length >= MAX_DIAGRAM_VERSIONS) {
                truncated = truncated.slice(
                    truncated.length - MAX_DIAGRAM_VERSIONS + 1,
                )
            }

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
        (options?: { keepDiagram?: boolean }): boolean => {
            // 检查匿名用户配额限制
            const isAnonymous = userId === "anonymous"
            if (isAnonymous) {
                const quota = getCacheQuota(false)
                if (conversations.length >= quota) {
                    // 超过限制，返回 false
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
        deriveConversationTitle,
        messagesRef,
        sessionId,
        userId,
    ])

    useEffect(() => {
        try {
            let metas = readConversationMetasFromStorage(userId)

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

    // 监听会话切换，按需从云端加载
    useEffect(() => {
        if (!currentConversationId || !hasRestored) return
        if (userId === "anonymous") return

        // 异步检查并加载
        void loadConversationFromCloudIfNeeded(currentConversationId)
    }, [
        currentConversationId,
        hasRestored,
        userId,
        loadConversationFromCloudIfNeeded,
    ])

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
