"use client"

import { useMemo } from "react"
import type { ChatMessage } from "@/features/chat/ai/types"
import { useCloudConversations } from "./use-cloud-conversations"
import { useLocalConversations } from "./use-local-conversations"

/**
 * 统一会话管理配置
 */
export interface UseConversationsConfig {
    /** 用户 ID（匿名用户为 "anonymous"） */
    userId: string
    /** 语言 */
    locale: string
    /** 翻译函数 */
    t: (key: string) => string
    /** DrawIO 是否就绪 */
    isDrawioReady: boolean
    /** 显示图表的回调 */
    onDisplayChart: (xml: string, skipValidation?: boolean) => string | null
    /** 清空图表的回调 */
    clearDiagram: () => void
    /** 当前图表 XML */
    chartXML: string
    /** 图表 XML ref */
    chartXMLRef: React.MutableRefObject<string>
    /** 消息列表 */
    messages: ChatMessage[]
    /** 已处理的工具调用 ID 集合 */
    processedToolCallsRef: React.MutableRefObject<Set<string>>
    /** 自动重试计数器 */
    autoRetryCountRef: React.MutableRefObject<number>
    /** 编辑失败计数器 */
    editFailureCountRef: React.MutableRefObject<number>
    /** 强制显示下一个图表 */
    forceDisplayNextRef: React.MutableRefObject<boolean>
    /** 设置消息列表 */
    setMessages: (messages: ChatMessage[]) => void
    /** 消息列表 ref */
    messagesRef: React.MutableRefObject<ChatMessage[]>
    /** 重置文件上传状态 */
    resetFiles: () => void
    /** 停止当前请求 */
    stopCurrentRequest?: () => void
    /** 存储模式：cloud 或 local */
    mode: "cloud" | "local"
    /** 云端同步队列（local 模式需要） */
    queuePushConversation?: (
        id: string,
        opts?: { immediate?: boolean; deleted?: boolean },
    ) => void
    /** 是否持久化上传的文件（local 模式需要） */
    persistUploadedFiles?: boolean
}

/**
 * 统一会话管理 Hook
 *
 * 根据 mode 参数自动选择使用云端或本地存储
 * 提供一致的 API，简化使用方式
 *
 * @example
 * ```tsx
 * const isAuthenticated = authStatus === "authenticated"
 *
 * const conversations = useConversations({
 *     mode: isAuthenticated ? "cloud" : "local",
 *     userId,
 *     locale,
 *     // ... 其他配置
 * })
 *
 * // 使用统一的 API
 * conversations.handleNewChat()
 * conversations.handleSelectConversation(id)
 * ```
 */
export function useConversations(config: UseConversationsConfig) {
    const {
        mode,
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
        queuePushConversation,
        persistUploadedFiles = false,
    } = config

    const isCloudMode = mode === "cloud"

    // 云端模式 Hook
    const cloudHook = useCloudConversations({
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
        enabled: isCloudMode,
    })

    // 本地模式 Hook（需要额外参数）
    const localHook = useLocalConversations({
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
        queuePushConversation: queuePushConversation || (() => {}),
        persistUploadedFiles,
        enabled: !isCloudMode,
    })

    // 根据模式选择使用哪个 hook 的返回值
    const activeHook = isCloudMode ? cloudHook : localHook

    // 返回统一的接口
    return useMemo(
        () => ({
            // 会话状态
            conversations: activeHook.conversations,
            setConversations: activeHook.setConversations,
            currentConversationId: activeHook.currentConversationId,
            setCurrentConversationId: activeHook.setCurrentConversationId,
            sessionId: activeHook.sessionId,
            setSessionId: activeHook.setSessionId,
            hasRestored: activeHook.hasRestored,
            canSaveDiagram: activeHook.canSaveDiagram,
            isLoadingSwitch: activeHook.isLoadingSwitch,
            switchingToId: activeHook.switchingToId,

            // 会话标题
            getConversationDisplayTitle: activeHook.getConversationDisplayTitle,
            deriveConversationTitle: activeHook.deriveConversationTitle,

            // 图表版本管理
            diagramVersions: activeHook.diagramVersions,
            diagramVersionCursor: activeHook.diagramVersionCursor,
            canUndo: activeHook.canUndo,
            canRedo: activeHook.canRedo,
            undoDiagram: activeHook.undoDiagram,
            redoDiagram: activeHook.redoDiagram,
            restoreDiagramVersionIndex: activeHook.restoreDiagramVersionIndex,
            ensureDiagramVersionForMessage:
                activeHook.ensureDiagramVersionForMessage,
            appendDiagramVersion: activeHook.appendDiagramVersion,
            getDiagramXmlForMessage: activeHook.getDiagramXmlForMessage,
            getDiagramVersionIndexForMessage:
                activeHook.getDiagramVersionIndexForMessage,
            getPreviousDiagramXmlBeforeMessage:
                activeHook.getPreviousDiagramXmlBeforeMessage,
            truncateDiagramVersionsAfterMessage:
                activeHook.truncateDiagramVersionsAfterMessage,

            // 会话操作
            loadConversation: activeHook.loadConversation,
            persistCurrentConversation: activeHook.persistCurrentConversation,
            handleNewChat: activeHook.handleNewChat,
            handleSelectConversation: activeHook.handleSelectConversation,
            handleDeleteConversation: activeHook.handleDeleteConversation,

            // 元数据
            mode,
            isCloudMode,
        }),
        [activeHook, mode, isCloudMode],
    )
}

/**
 * 会话 Hook 返回类型
 */
export type UseConversationsReturn = ReturnType<typeof useConversations>
