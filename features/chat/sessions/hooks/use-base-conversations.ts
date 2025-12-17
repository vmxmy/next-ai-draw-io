"use client"

import { useCallback, useEffect, useRef } from "react"
import type { ChatMessage } from "@/features/chat/ai/types"
import type {
    ConversationMeta,
    ConversationPayload,
    DiagramVersion,
} from "@/features/chat/sessions/storage"
import { createSessionId } from "@/features/chat/sessions/storage"
import { useConversationTitles } from "./use-conversation-titles"
import type { DiagramVersionState } from "./use-diagram-version-history"
import {
    type UseDiagramVersionHistoryOptions,
    useDiagramVersionHistory,
} from "./use-diagram-version-history"

/**
 * 基础配置 - 所有会话 hook 共用
 */
export interface BaseConversationConfig {
    /** 用户 ID */
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
    /** 图表 XML ref */
    chartXMLRef: React.MutableRefObject<string>
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
    /** 是否启用 */
    enabled?: boolean
}

/**
 * 基础 Hook 选项
 */
export interface UseBaseConversationsOptions
    extends Omit<UseDiagramVersionHistoryOptions, "onVersionsChange"> {
    /** 会话列表 */
    conversations: ConversationMeta[]
    /** 语言 */
    locale: string
    /** 版本变更回调（用于持久化） */
    onVersionsChange?: (state: DiagramVersionState) => void
}

/**
 * 基础会话 Hook
 *
 * 提供共享的图表版本管理和标题管理功能
 * 不包含数据获取逻辑，由专门的 cloud/local hook 处理
 */
export function useBaseConversations({
    conversations,
    locale,
    onDisplayChart,
    chartXMLRef,
    onVersionsChange,
}: UseBaseConversationsOptions) {
    // 图表版本管理
    const diagramHistory = useDiagramVersionHistory({
        onDisplayChart,
        chartXMLRef,
        onVersionsChange,
    })

    // 会话标题
    const { getConversationDisplayTitle } = useConversationTitles({
        conversations,
        locale,
    })

    return {
        // 图表版本管理
        diagramHistory,
        getConversationDisplayTitle,
    }
}

/**
 * 恢复 payload 到 UI 的工具函数
 *
 * 从云端或本地加载会话数据后，应用到 UI 状态
 */
export function applyPayloadToUI(
    payload: ConversationPayload,
    config: {
        isDrawioReady: boolean
        onDisplayChart: (xml: string, skipValidation?: boolean) => string | null
        clearDiagram: () => void
        chartXMLRef: React.MutableRefObject<string>
        processedToolCallsRef: React.MutableRefObject<Set<string>>
        autoRetryCountRef: React.MutableRefObject<number>
        editFailureCountRef: React.MutableRefObject<number>
        forceDisplayNextRef: React.MutableRefObject<boolean>
        setMessages: (messages: ChatMessage[]) => void
        setSessionId: (id: string) => void
        diagramHistoryRestoreState: (state: DiagramVersionState) => void
        pendingDiagramXmlRef: React.MutableRefObject<string | null>
    },
): void {
    const {
        isDrawioReady,
        onDisplayChart,
        clearDiagram,
        chartXMLRef,
        processedToolCallsRef,
        autoRetryCountRef,
        editFailureCountRef,
        forceDisplayNextRef,
        setMessages,
        setSessionId,
        diagramHistoryRestoreState,
        pendingDiagramXmlRef,
    } = config

    // 恢复消息
    setMessages((payload.messages || []) as ChatMessage[])
    setSessionId(payload.sessionId || createSessionId())

    // 预填充已处理的工具调用 ID
    const existingToolCallIds = new Set<string>()
    for (const message of payload.messages || []) {
        const parts = (message as any)?.parts
        if (!Array.isArray(parts)) continue
        for (const part of parts) {
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

    // 重置计数器
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

    diagramHistoryRestoreState({ versions, cursor, marks })

    // 恢复图表 XML
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
}

/**
 * 创建 payload 数据快照
 *
 * 用于保存前获取当前状态
 */
export function createPayloadSnapshot(config: {
    messagesRef: React.MutableRefObject<ChatMessage[]>
    chartXMLRef: React.MutableRefObject<string>
    sessionId: string
    getDiagramStateSnapshot: () => DiagramVersionState
}): ConversationPayload {
    const { messagesRef, chartXMLRef, sessionId, getDiagramStateSnapshot } =
        config
    const versionState = getDiagramStateSnapshot()

    return {
        messages: messagesRef.current,
        xml: chartXMLRef.current || "",
        sessionId,
        diagramVersions: versionState.versions,
        diagramVersionCursor: versionState.cursor,
        diagramVersionMarks: versionState.marks,
    }
}

/**
 * 使用 refs 避免闭包过期的 Hook
 *
 * 在事件处理器中（如 visibilitychange、beforeunload）
 * 需要访问最新值而不是闭包捕获的旧值
 */
export function useStaleClosurePrevention<T>(
    value: T,
): React.MutableRefObject<T> {
    const ref = useRef(value)

    useEffect(() => {
        ref.current = value
    }, [value])

    return ref
}

/**
 * 页面可见性变化处理 Hook
 *
 * 在页面隐藏或卸载时保存数据
 */
export function useVisibilityPersistence(config: {
    enabled: boolean
    onSave: () => void
}) {
    const { enabled, onSave } = config
    const onSaveRef = useRef(onSave)

    useEffect(() => {
        onSaveRef.current = onSave
    }, [onSave])

    useEffect(() => {
        if (!enabled) return

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                onSaveRef.current()
            }
        }

        const handleBeforeUnload = () => {
            onSaveRef.current()
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
    }, [enabled])
}
