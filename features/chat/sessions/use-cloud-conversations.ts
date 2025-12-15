"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import type { ChatMessage } from "@/features/chat/ai/types"
import type {
    ConversationMeta,
    ConversationPayload,
    DiagramVersion,
} from "@/features/chat/sessions/storage"
import {
    createConversationId,
    createSessionId,
} from "@/features/chat/sessions/storage"
import { api } from "@/lib/trpc/client"

// 防抖函数
function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), wait)
    }
}

export function useCloudConversations({
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
    stopCurrentRequest,
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
    stopCurrentRequest?: () => void
}) {
    const queryClient = useQueryClient()

    const [currentConversationId, setCurrentConversationId] =
        useState<string>("")
    const [sessionId, setSessionId] = useState(() => createSessionId())
    const [canSaveDiagram, setCanSaveDiagram] = useState(false)

    const pendingDiagramXmlRef = useRef<string | null>(null)

    // 图表版本管理
    const diagramVersionsRef = useRef<DiagramVersion[]>([])
    const diagramVersionCursorRef = useRef<number>(-1)
    const diagramVersionMarksRef = useRef<Record<number, number>>({})

    const [diagramVersions, setDiagramVersions] = useState<DiagramVersion[]>([])
    const [diagramVersionCursor, setDiagramVersionCursor] = useState<number>(-1)

    // 查询会话列表
    const { data: conversationsData, isLoading: isLoadingList } =
        api.conversation.listMetas.useQuery(
            { limit: 50, offset: 0 },
            {
                enabled: userId !== "anonymous",
                staleTime: 60_000, // 1分钟缓存
                refetchOnWindowFocus: false, // 禁止窗口聚焦时重新获取
                refetchOnReconnect: false, // 禁止网络重连时重新获取
                refetchOnMount: false, // 禁止重新挂载时重新获取
            },
        )

    const conversations: ConversationMeta[] = useMemo(
        () => conversationsData?.conversations || [],
        [conversationsData],
    )

    // 查询当前会话详情
    const { data: currentPayloadData } = api.conversation.getById.useQuery(
        { id: currentConversationId || "skip" }, // 避免传入空字符串
        {
            enabled:
                !!currentConversationId &&
                currentConversationId.length > 0 &&
                userId !== "anonymous",
            staleTime: 30_000, // 30秒缓存
            refetchOnWindowFocus: false, // 禁止窗口聚焦时重新获取
            refetchOnReconnect: false, // 禁止网络重连时重新获取
        },
    )

    // 创建会话 mutation
    // 注意：不在 onSuccess 中刷新查询，避免与自动保存形成循环
    // 所有更新都通过乐观更新处理（setQueryData）
    const pushMutation = api.conversation.push.useMutation()

    // 使用 ref 存储 mutate 函数以避免依赖问题
    const pushMutateRef = useRef(pushMutation.mutate)
    useEffect(() => {
        pushMutateRef.current = pushMutation.mutate
    }, [pushMutation.mutate])

    // 应用会话数据到 UI
    useEffect(() => {
        if (!currentPayloadData?.payload) return

        const payload =
            currentPayloadData.payload as unknown as ConversationPayload

        // 标记正在恢复数据，避免触发自动保存
        isRestoringRef.current = true

        setMessages((payload.messages || []) as any)
        setSessionId(payload.sessionId || createSessionId())

        processedToolCallsRef.current = new Set()
        autoRetryCountRef.current = 0
        editFailureCountRef.current = 0
        forceDisplayNextRef.current = false

        // 恢复图表版本
        const versions = Array.isArray(payload.diagramVersions)
            ? (payload.diagramVersions as DiagramVersion[])
            : []
        const cursor =
            typeof payload.diagramVersionCursor === "number"
                ? payload.diagramVersionCursor
                : -1
        const marks =
            payload.diagramVersionMarks &&
            typeof payload.diagramVersionMarks === "object"
                ? (payload.diagramVersionMarks as Record<number, number>)
                : {}

        diagramVersionsRef.current = versions
        diagramVersionCursorRef.current = Math.min(
            Math.max(cursor, -1),
            versions.length - 1,
        )
        diagramVersionMarksRef.current = marks
        setDiagramVersions(versions)
        setDiagramVersionCursor(diagramVersionCursorRef.current)

        // 恢复图表 XML
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

        // 更新数据指纹，防止恢复后立即触发保存
        const dataFingerprint = JSON.stringify({
            messagesLength: (payload.messages || []).length,
            xmlLength: (payload.xml || "").length,
            sessionId: payload.sessionId || createSessionId(),
            versionsCount: versions.length,
            cursor: diagramVersionCursorRef.current,
        })
        lastSavedDataRef.current = dataFingerprint

        // 延迟重置恢复标记，确保自动保存 useEffect 不会立即触发
        setTimeout(() => {
            isRestoringRef.current = false
        }, 100)
    }, [
        currentPayloadData,
        setMessages,
        isDrawioReady,
        onDisplayChart,
        chartXMLRef,
        clearDiagram,
        processedToolCallsRef,
        autoRetryCountRef,
        editFailureCountRef,
        forceDisplayNextRef,
    ])

    // 防抖保存到云端（使用 ref 避免依赖不稳定导致的无限循环）
    const debouncedSave = useMemo(
        () =>
            debounce(
                (conversation: {
                    id: string
                    title?: string
                    createdAt: number
                    updatedAt: number
                    payload: ConversationPayload
                }) => {
                    pushMutateRef.current({
                        conversations: [conversation],
                    })
                },
                1000,
            ),
        [],
    )

    // 自动保存会话（防抖）
    // 使用 ref 记录上次保存的数据，避免重复保存相同内容
    const lastSavedDataRef = useRef<string>("")
    const isRestoringRef = useRef(false) // 标记是否正在恢复数据

    useEffect(() => {
        // 匿名用户不保存到云端
        if (userId === "anonymous") return
        if (!currentConversationId) return
        // 正在恢复数据时不触发保存
        if (isRestoringRef.current) return

        // 创建数据指纹，用于检测实际变化
        const dataFingerprint = JSON.stringify({
            messagesLength: (messagesRef.current as any[])?.length || 0,
            xmlLength: (chartXMLRef.current || "").length,
            sessionId,
            versionsCount: diagramVersionsRef.current.length,
            cursor: diagramVersionCursorRef.current,
        })

        // 如果数据没有实际变化，跳过保存
        if (dataFingerprint === lastSavedDataRef.current) {
            return
        }
        lastSavedDataRef.current = dataFingerprint

        const conversation = {
            id: currentConversationId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            payload: {
                messages: messagesRef.current as any,
                xml: chartXMLRef.current || "",
                sessionId,
                diagramVersions: diagramVersionsRef.current,
                diagramVersionCursor: diagramVersionCursorRef.current,
                diagramVersionMarks: diagramVersionMarksRef.current,
            } as ConversationPayload,
        }

        debouncedSave(conversation)
    }, [
        messages,
        chartXML,
        currentConversationId,
        sessionId,
        debouncedSave,
        userId,
    ])

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

    const handleNewChat = useCallback(
        (options?: { keepDiagram?: boolean }): boolean => {
            const keepDiagram = options?.keepDiagram === true
            const id = createConversationId()
            const now = Date.now()
            const currentXml = chartXMLRef.current || ""

            const newConv = {
                id,
                title: undefined,
                createdAt: now,
                updatedAt: now,
                payload: {
                    messages: [],
                    xml: keepDiagram ? currentXml : "",
                    sessionId: createSessionId(),
                    diagramVersions: [],
                    diagramVersionCursor: -1,
                    diagramVersionMarks: {},
                } as ConversationPayload,
            }

            try {
                stopCurrentRequest?.()

                // 乐观更新：立即更新 UI
                queryClient.setQueryData(
                    [["conversation", "listMetas"]],
                    (old: any) => {
                        if (!old) return { conversations: [newConv] }
                        return {
                            ...old,
                            conversations: [
                                newConv,
                                ...(old.conversations || []),
                            ],
                        }
                    },
                )

                setCurrentConversationId(id)
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
                setSessionId(newConv.payload.sessionId)

                // 后台保存到云端
                pushMutateRef.current({ conversations: [newConv] })

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
            chartXMLRef,
            resetFiles,
            setMessages,
            stopCurrentRequest,
            t,
            queryClient,
        ],
    )

    const handleSelectConversation = useCallback(
        (id: string) => {
            if (!id || id === currentConversationId) return
            try {
                stopCurrentRequest?.()
                setCurrentConversationId(id)
            } catch (error) {
                console.error("Failed to select conversation:", error)
                toast.warning(t("toast.storageUpdateFailed"))
            }
        },
        [currentConversationId, stopCurrentRequest, t],
    )

    const handleDeleteConversation = useCallback(
        (id: string) => {
            try {
                stopCurrentRequest?.()

                // 乐观更新：立即从列表移除
                queryClient.setQueryData(
                    [["conversation", "listMetas"]],
                    (old: any) => {
                        if (!old) return old
                        return {
                            ...old,
                            conversations: (old.conversations || []).filter(
                                (c: any) => c.id !== id,
                            ),
                        }
                    },
                )

                // 如果删除的是当前会话，切换到第一个
                if (id === currentConversationId) {
                    const remaining = conversations.filter((c) => c.id !== id)
                    if (remaining.length > 0) {
                        setCurrentConversationId(remaining[0].id)
                    } else {
                        handleNewChat()
                    }
                }

                // 后台标记删除
                pushMutateRef.current({
                    conversations: [
                        {
                            id,
                            deleted: true,
                            updatedAt: Date.now(),
                            createdAt: Date.now(),
                        } as any,
                    ],
                })
            } catch (error) {
                console.error("Failed to delete conversation:", error)
                toast.warning(t("toast.storageUpdateFailed"))
            }
        },
        [
            conversations,
            currentConversationId,
            stopCurrentRequest,
            t,
            queryClient,
            handleNewChat,
        ],
    )

    // 图表版本管理（简化版，核心逻辑保留）
    const MAX_DIAGRAM_VERSIONS = 50
    const MAX_XML_SIZE = 5_000_000

    const normalizeCursor = (cursor: number, len: number) =>
        Math.min(Math.max(cursor, -1), len - 1)

    const ensureDiagramVersionForMessage = useCallback(
        (messageIndex: number, xml: string, note?: string) => {
            const nextXml = String(xml ?? "")

            if (nextXml.length > MAX_XML_SIZE) {
                console.error(
                    `[diagram] XML too large: ${nextXml.length} bytes`,
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
                nextIndex = truncated.length - 1
                diagramVersionCursorRef.current = nextIndex
                setDiagramVersions(truncated)
                setDiagramVersionCursor(nextIndex)
            }

            diagramVersionMarksRef.current = {
                ...diagramVersionMarksRef.current,
                [messageIndex]: nextIndex,
            }
            return nextXml
        },
        [],
    )

    const appendDiagramVersion = useCallback((xml: string, note?: string) => {
        const nextXml = String(xml ?? "")
        if (!nextXml) return

        if (nextXml.length > MAX_XML_SIZE) {
            console.error(`[diagram] XML too large: ${nextXml.length} bytes`)
            toast.error("图表过大，无法保存历史版本")
            return
        }

        const versions = diagramVersionsRef.current
        const cursor = diagramVersionCursorRef.current
        const currentXml =
            cursor >= 0 && cursor < versions.length ? versions[cursor]?.xml : ""
        if (nextXml === currentXml) return

        let truncated =
            cursor >= 0 && cursor < versions.length - 1
                ? versions.slice(0, cursor + 1)
                : versions.slice()

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
    }, [])

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
        },
        [chartXMLRef, onDisplayChart],
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
        },
        [],
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

    // 初始化：如果没有会话，创建一个
    useEffect(() => {
        if (isLoadingList) return
        if (userId === "anonymous") return // 匿名用户由 useLocalConversations 处理

        if (conversations.length === 0 && !currentConversationId) {
            handleNewChat()
        } else if (!currentConversationId && conversations.length > 0) {
            setCurrentConversationId(conversations[0].id)
        }
    }, [
        conversations.length,
        currentConversationId,
        handleNewChat,
        isLoadingList,
        userId,
    ])

    // Draw.io 就绪后加载待处理的 XML
    useEffect(() => {
        if (!isDrawioReady) {
            setCanSaveDiagram(false)
            return
        }
        const pending = pendingDiagramXmlRef.current
        pendingDiagramXmlRef.current = null

        if (pending) {
            onDisplayChart(pending, true)
            chartXMLRef.current = pending
        }
        setTimeout(() => setCanSaveDiagram(true), 300)
    }, [isDrawioReady, onDisplayChart, chartXMLRef])

    // 云端模式的空操作函数（使用 useCallback 确保引用稳定）
    const noop = useCallback(() => {}, [])

    return {
        conversations,
        setConversations: noop, // 云端模式不支持直接设置
        currentConversationId,
        setCurrentConversationId,
        sessionId,
        setSessionId,
        hasRestored: true, // 云端模式始终视为已恢复
        canSaveDiagram,
        getConversationDisplayTitle,
        deriveConversationTitle,
        loadConversation: noop, // 云端模式通过 React Query 自动加载
        persistCurrentConversation: noop, // 云端模式通过防抖自动保存
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
