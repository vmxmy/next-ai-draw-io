"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { sanitizeMessagesForToolCalling } from "@/features/chat/ai/sanitize-messages"
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
import {
    deriveConversationTitle,
    useConversationTitles,
    useDebouncedCallback,
    useDiagramVersionHistory,
} from "./hooks"

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
    stopCurrentRequest?: () => void
    enabled?: boolean
}) {
    const utils = api.useUtils()

    const [currentConversationId, setCurrentConversationId] =
        useState<string>("")
    const [sessionId, setSessionId] = useState(() => createSessionId())
    const [canSaveDiagram, setCanSaveDiagram] = useState(false)

    const pendingDiagramXmlRef = useRef<string | null>(null)

    // Refs 用于事件处理器中获取最新值，避免闭包过期
    const currentConversationIdRef = useRef(currentConversationId)
    const sessionIdRef = useRef(sessionId)

    // 同步 refs 保持最新
    useEffect(() => {
        currentConversationIdRef.current = currentConversationId
    }, [currentConversationId])

    useEffect(() => {
        sessionIdRef.current = sessionId
    }, [sessionId])

    // 使用共享的图表版本管理 hook
    const diagramHistory = useDiagramVersionHistory({
        onDisplayChart,
        chartXMLRef,
    })

    // 查询会话列表
    const { data: conversationsData, isLoading: isLoadingList } =
        api.conversation.listMetas.useQuery(
            { limit: 50, offset: 0 },
            {
                enabled: enabled && userId !== "anonymous",
                staleTime: 60_000, // 1分钟缓存
                refetchOnWindowFocus: false, // 禁止窗口聚焦时重新获取
                refetchOnReconnect: false, // 禁止网络重连时重新获取
                refetchOnMount: false, // 禁止重新挂载时重新获取
            },
        )

    // 按 updatedAt 降序排序，确保最近更新的会话显示在前面
    // 虽然服务端已排序，但前端也排序作为防御性措施
    const conversations: ConversationMeta[] = useMemo(
        () =>
            (conversationsData?.conversations || []).sort(
                (a, b) => b.updatedAt - a.updatedAt,
            ),
        [conversationsData],
    )

    // 使用共享的会话标题 hook
    const { getConversationDisplayTitle } = useConversationTitles({
        conversations,
        locale,
    })

    // 切换会话时的 loading 状态
    const [isLoadingSwitch, setIsLoadingSwitch] = useState(false)
    const [switchingToId, setSwitchingToId] = useState<string | null>(null)

    // 查询当前会话详情
    const { data: currentPayloadData, isFetching: isFetchingPayload } =
        api.conversation.getById.useQuery(
            { id: currentConversationId || "skip" }, // 避免传入空字符串
            {
                enabled:
                    enabled &&
                    !!currentConversationId &&
                    currentConversationId.length > 0 &&
                    userId !== "anonymous",
                staleTime: 30_000, // 30秒缓存
                refetchOnWindowFocus: false, // 禁止窗口聚焦时重新获取
                refetchOnReconnect: false, // 禁止网络重连时重新获取
                refetchOnMount: true, // 页面加载时重新获取最新数据
            },
        )

    // 创建会话 mutation
    // 注意：不在 onSuccess 中刷新查询，避免与自动保存形成循环
    // 所有更新都通过乐观更新处理（setQueryData）
    const pushMutation = api.conversation.push.useMutation({
        onError: (error, variables) => {
            console.error("[conversation.push] Client error:", error)
            console.log("[conversation.push] Failed variables:", {
                count: variables.conversations.length,
                conversations: variables.conversations.map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                    deleted: c.deleted,
                    hasPayload: !!c.payload,
                    payloadKeys: c.payload ? Object.keys(c.payload) : [],
                })),
            })
        },
    })

    // 使用 ref 存储 mutate 函数以避免依赖问题
    const pushMutateRef = useRef(pushMutation.mutate)
    useEffect(() => {
        pushMutateRef.current = pushMutation.mutate
    }, [pushMutation.mutate])

    // 监听数据加载状态，关闭 loading
    // 使用 ref 跟踪 isFetchingPayload 的前一个值，只在从 true 变为 false 时清除 loading
    const prevIsFetchingRef = useRef(isFetchingPayload)
    useEffect(() => {
        const wasLoading = prevIsFetchingRef.current
        prevIsFetchingRef.current = isFetchingPayload

        // 只在 isFetchingPayload 从 true 变为 false 时清除 loading
        if (wasLoading && !isFetchingPayload && isLoadingSwitch) {
            setIsLoadingSwitch(false)
            setSwitchingToId(null)
        }
    }, [isFetchingPayload, isLoadingSwitch])

    // 跟踪上次恢复的会话 ID，防止 isDrawioReady 变化时重复恢复
    const lastRestoredConversationIdRef = useRef<string>("")

    // 应用会话数据到 UI
    useEffect(() => {
        if (!currentPayloadData?.payload) return

        const payload =
            currentPayloadData.payload as unknown as ConversationPayload

        // 如果是同一个会话且只是 isDrawioReady 变化，跳过重复恢复
        // 待处理的 XML 会由 pendingDiagramXmlRef 机制处理
        if (lastRestoredConversationIdRef.current === currentConversationId) {
            return
        }
        lastRestoredConversationIdRef.current = currentConversationId

        // 标记正在恢复数据，避免触发自动保存
        isRestoringRef.current = true

        // 清理消息历史，确保 tool-call/tool-result 配对完整
        const sanitizedMessages = sanitizeMessagesForToolCalling(
            (payload.messages || []) as any,
        )
        setMessages(sanitizedMessages as any)
        setSessionId(payload.sessionId || createSessionId())

        // 预先填充已处理的工具调用 ID，防止历史消息中的 display_diagram 被重新执行
        const existingToolCallIds = new Set<string>()
        for (const message of payload.messages || []) {
            if (!message.parts) continue
            for (const part of message.parts as any[]) {
                const toolCallId = part?.toolCallId
                if (
                    part?.type?.startsWith("tool-") &&
                    typeof toolCallId === "string"
                ) {
                    existingToolCallIds.add(toolCallId)
                }
            }
        }
        processedToolCallsRef.current = existingToolCallIds

        autoRetryCountRef.current = 0
        editFailureCountRef.current = 0
        forceDisplayNextRef.current = false

        // 恢复图表版本（使用共享 hook）
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

        diagramHistory.restoreState({ versions, cursor, marks })

        // 恢复图表 XML
        // payload.xml 包含用户手动编辑和 AI 生成的最新状态
        // versions[cursor].xml 只包含 AI 生成的版本历史
        // 优先使用 payload.xml（包含用户手动编辑），仅当 payload.xml 为空时才使用版本历史
        const latestVersionXml =
            cursor >= 0 && versions[cursor]?.xml ? versions[cursor].xml : null
        const xmlToLoad = payload.xml || latestVersionXml

        if (xmlToLoad) {
            if (isDrawioReady) {
                onDisplayChart(xmlToLoad, true)
                chartXMLRef.current = xmlToLoad
            } else {
                pendingDiagramXmlRef.current = xmlToLoad
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
            cursor: diagramHistory.cursorRef.current,
        })
        lastSavedDataRef.current = dataFingerprint

        // 延迟重置恢复标记，确保自动保存 useEffect 不会立即触发
        setTimeout(() => {
            isRestoringRef.current = false
        }, 100)
    }, [
        currentPayloadData,
        currentConversationId,
        setMessages,
        isDrawioReady,
        onDisplayChart,
        chartXMLRef,
        clearDiagram,
        processedToolCallsRef,
        autoRetryCountRef,
        editFailureCountRef,
        forceDisplayNextRef,
        diagramHistory.restoreState,
    ])

    // 防抖保存到云端（300ms 防抖，企业级标准：快速响应 + 避免频繁请求）
    // 使用 useDebouncedCallback 确保组件卸载时自动清理 timeout
    const [debouncedSave] = useDebouncedCallback(
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
        300,
    )

    // 自动保存会话（防抖）
    // 使用 ref 记录上次保存的数据，避免重复保存相同内容
    const lastSavedDataRef = useRef<string>("")
    const isRestoringRef = useRef(false) // 标记是否正在恢复数据

    // 同步更新 chartXMLRef（确保 ref 在 effect 触发前已更新）
    useEffect(() => {
        chartXMLRef.current = chartXML
    }, [chartXML])

    useEffect(() => {
        // 匿名用户不保存到云端
        if (userId === "anonymous") return
        if (!currentConversationId) return
        // 正在恢复数据时不触发保存
        if (isRestoringRef.current) return

        // 保护机制：空消息时不触发保存，避免异常情况覆盖原有数据
        const messageArray = messagesRef.current as any[]
        if (!messageArray || messageArray.length === 0) {
            console.log(
                "[session-debug] Skipping cloud auto-save: empty messages",
            )
            return
        }

        // 创建数据指纹，用于检测实际变化
        // 使用 chartXML 而非 chartXMLRef.current 确保时序正确
        const currentXml = chartXML || ""
        const dataFingerprint = JSON.stringify({
            messagesLength: (messagesRef.current as any[])?.length || 0,
            xmlHash:
                currentXml.length > 0
                    ? currentXml.slice(0, 100) +
                      currentXml.slice(-100) +
                      currentXml.length
                    : "",
            sessionId,
            versionsCount: diagramHistory.versionsRef.current.length,
            cursor: diagramHistory.cursorRef.current,
        })

        // 如果数据没有实际变化，跳过保存
        if (dataFingerprint === lastSavedDataRef.current) return

        lastSavedDataRef.current = dataFingerprint

        const conversation = {
            id: currentConversationId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            payload: {
                messages: messagesRef.current as any,
                xml: currentXml,
                sessionId,
                diagramVersions: diagramHistory.versionsRef.current,
                diagramVersionCursor: diagramHistory.cursorRef.current,
                diagramVersionMarks: diagramHistory.marksRef.current,
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
        diagramHistory.versions,
        diagramHistory.cursor,
    ])

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

                // 乐观更新：使用 TRPC utils 正确更新 React Query 缓存
                utils.conversation.listMetas.setData(
                    { limit: 50, offset: 0 },
                    (old) => {
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
                diagramHistory.clearHistory()
                setSessionId(newConv.payload.sessionId)

                // 后台保存到云端（乐观更新已完成 UI 更新，仅失败时回滚）
                pushMutateRef.current(
                    { conversations: [newConv] },
                    {
                        onError: (error) => {
                            console.error(
                                "Failed to save new conversation:",
                                error,
                            )
                            // 保存失败时回滚乐观更新
                            utils.conversation.listMetas.invalidate()
                        },
                    },
                )

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
            utils,
            diagramHistory.clearHistory,
        ],
    )

    // 立即保存当前会话到云端（不防抖，返回 Promise）
    const flushSaveToCloud = useCallback((): Promise<void> => {
        if (userId === "anonymous") return Promise.resolve()
        if (!currentConversationId) return Promise.resolve()
        if (isRestoringRef.current) return Promise.resolve()

        const conversation = {
            id: currentConversationId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            payload: {
                messages: messagesRef.current as any,
                xml: chartXMLRef.current || "",
                sessionId,
                diagramVersions: diagramHistory.versionsRef.current,
                diagramVersionCursor: diagramHistory.cursorRef.current,
                diagramVersionMarks: diagramHistory.marksRef.current,
            } as ConversationPayload,
        }

        // 更新数据指纹，避免重复保存
        const dataFingerprint = JSON.stringify({
            messagesLength: (messagesRef.current as any[])?.length || 0,
            xmlLength: (chartXMLRef.current || "").length,
            sessionId,
            versionsCount: diagramHistory.versionsRef.current.length,
            cursor: diagramHistory.cursorRef.current,
        })
        lastSavedDataRef.current = dataFingerprint

        // 立即保存，返回 Promise 以便等待完成
        return new Promise((resolve) => {
            pushMutateRef.current(
                { conversations: [conversation] },
                {
                    onSuccess: () => resolve(),
                    onError: () => resolve(), // 即使失败也 resolve，避免阻塞切换
                },
            )
        })
    }, [
        userId,
        currentConversationId,
        sessionId,
        chartXMLRef,
        messagesRef,
        diagramHistory.versionsRef,
        diagramHistory.cursorRef,
        diagramHistory.marksRef,
    ])

    const handleSelectConversation = useCallback(
        async (id: string) => {
            if (!id || id === currentConversationId) return
            console.log("[session] Switching to conversation:", id)
            try {
                stopCurrentRequest?.()
                setIsLoadingSwitch(true)
                setSwitchingToId(id)

                // 等待当前会话保存完成
                await flushSaveToCloud()

                // 强制重新获取目标会话的最新数据（绕过缓存）
                await utils.conversation.getById.invalidate({ id })
                const freshData = await utils.conversation.getById.fetch(
                    { id },
                    { staleTime: 0 }, // 强制获取最新数据
                )

                // 手动更新缓存，确保 useQuery 使用最新数据
                utils.conversation.getById.setData({ id }, freshData)

                setCurrentConversationId(id)
                console.log(
                    "[session] Switch successful, clearing loading state",
                )
                // 明确清除 loading 状态（不再仅依赖 isFetchingPayload 变化）
                setIsLoadingSwitch(false)
                setSwitchingToId(null)
            } catch (error) {
                console.error("[session] Failed to select conversation:", error)
                toast.warning(t("toast.storageUpdateFailed"))
                setIsLoadingSwitch(false)
                setSwitchingToId(null)
            }
        },
        [currentConversationId, stopCurrentRequest, t, flushSaveToCloud, utils],
    )

    const handleDeleteConversation = useCallback(
        (id: string) => {
            try {
                stopCurrentRequest?.()

                // 乐观更新：使用 TRPC utils 正确更新 React Query 缓存
                utils.conversation.listMetas.setData(
                    { limit: 50, offset: 0 },
                    (old) => {
                        if (!old) return old
                        return {
                            ...old,
                            conversations: (old.conversations || []).filter(
                                (c) => c.id !== id,
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

                // 后台标记删除（乐观更新已完成 UI 更新，仅失败时回滚）
                pushMutateRef.current(
                    {
                        conversations: [
                            {
                                id,
                                deleted: true,
                                updatedAt: Date.now(),
                                createdAt: Date.now(),
                            } as any,
                        ],
                    },
                    {
                        onError: (error) => {
                            console.error(
                                "Failed to delete conversation:",
                                error,
                            )
                            // 删除失败时回滚乐观更新
                            utils.conversation.listMetas.invalidate()
                        },
                    },
                )
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
            utils,
            handleNewChat,
        ],
    )

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

    // 页面隐藏/关闭时立即保存（企业级可靠性保障）
    // 使用 refs 避免闭包过期问题
    useEffect(() => {
        if (userId === "anonymous") return

        const saveImmediately = () => {
            // 使用 refs 获取最新值，避免闭包过期
            const convId = currentConversationIdRef.current
            const sessId = sessionIdRef.current

            if (!convId) return
            if (isRestoringRef.current) return

            const conversation = {
                id: convId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                payload: {
                    messages: messagesRef.current as any,
                    xml: chartXMLRef.current || "",
                    sessionId: sessId,
                    diagramVersions: diagramHistory.versionsRef.current,
                    diagramVersionCursor: diagramHistory.cursorRef.current,
                    diagramVersionMarks: diagramHistory.marksRef.current,
                } as ConversationPayload,
            }

            // 使用 sendBeacon 确保页面关闭时也能发送请求
            // tRPC batch 格式: {"0":{"json":{input}}}
            const payload = JSON.stringify({
                "0": {
                    json: {
                        conversations: [conversation],
                    },
                },
            })

            // 优先使用 sendBeacon（页面关闭时更可靠）
            if (navigator.sendBeacon) {
                navigator.sendBeacon(
                    "/api/trpc/conversation.push?batch=1",
                    new Blob([payload], { type: "application/json" }),
                )
            } else {
                // 降级到同步请求
                pushMutateRef.current({ conversations: [conversation] })
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
        userId,
        // 使用 refs，不再需要这些状态作为依赖
        // currentConversationId, sessionId 已通过 refs 访问
        chartXMLRef,
        messagesRef,
        diagramHistory.versionsRef,
        diagramHistory.cursorRef,
        diagramHistory.marksRef,
    ])

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
        isLoadingSwitch, // 会话切换 loading 状态
        switchingToId, // 正在切换到的会话 ID
        getConversationDisplayTitle,
        deriveConversationTitle,
        loadConversation: noop, // 云端模式通过 React Query 自动加载
        persistCurrentConversation: noop, // 云端模式通过防抖自动保存
        // 图表版本管理（使用共享 hook）
        diagramVersions: diagramHistory.versions,
        diagramVersionCursor: diagramHistory.cursor,
        canUndo: diagramHistory.canUndo,
        canRedo: diagramHistory.canRedo,
        undoDiagram: diagramHistory.undoDiagram,
        redoDiagram: diagramHistory.redoDiagram,
        restoreDiagramVersionIndex: diagramHistory.restoreDiagramVersionIndex,
        ensureDiagramVersionForMessage:
            diagramHistory.ensureDiagramVersionForMessage,
        appendDiagramVersion: diagramHistory.appendDiagramVersion,
        getDiagramXmlForMessage: diagramHistory.getDiagramXmlForMessage,
        getDiagramVersionIndexForMessage:
            diagramHistory.getDiagramVersionIndexForMessage,
        getPreviousDiagramXmlBeforeMessage:
            diagramHistory.getPreviousDiagramXmlBeforeMessage,
        truncateDiagramVersionsAfterMessage:
            diagramHistory.truncateDiagramVersionsAfterMessage,
        handleNewChat,
        handleSelectConversation,
        handleDeleteConversation,
    }
}
