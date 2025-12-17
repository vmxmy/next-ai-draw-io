"use client"

import { createContext, type ReactNode, useContext, useMemo } from "react"
import type { ConversationMeta } from "@/features/chat/sessions/storage"

/**
 * Session Context 值类型
 *
 * 包含会话相关的状态和操作，减少 prop drilling
 */
export interface SessionContextValue {
    // =====================
    // 会话状态
    // =====================

    /** 会话元数据列表（已排序） */
    conversations: ConversationMeta[]
    /** 当前会话 ID */
    currentConversationId: string
    /** 是否正在切换会话 */
    isLoadingSwitch: boolean
    /** 正在切换到的会话 ID */
    switchingToId: string | null

    // =====================
    // 会话标题
    // =====================

    /** 获取会话显示标题 */
    getConversationDisplayTitle: (id: string) => string

    // =====================
    // 会话操作
    // =====================

    /** 创建新会话 */
    handleNewChat: (options?: { keepDiagram?: boolean }) => boolean
    /** 切换会话 */
    handleSelectConversation: (id: string) => void | Promise<void>
    /** 删除会话 */
    handleDeleteConversation: (id: string) => void
    /** 更新会话标题 */
    handleUpdateConversationTitle?: (id: string, title: string) => void

    // =====================
    // 元数据
    // =====================

    /** 语言 */
    locale: string
}

/**
 * Session Context
 */
const SessionContext = createContext<SessionContextValue | undefined>(undefined)

/**
 * Session Context Provider Props
 */
export interface SessionProviderProps {
    children: ReactNode
    value: SessionContextValue
}

/**
 * Session Context Provider
 *
 * 包装组件以提供会话状态
 *
 * @example
 * ```tsx
 * <SessionProvider value={sessionContextValue}>
 *     <ChatHeader />
 *     <ChatMessages />
 * </SessionProvider>
 * ```
 */
export function SessionProvider({ children, value }: SessionProviderProps) {
    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    )
}

/**
 * 使用 Session Context
 *
 * 必须在 SessionProvider 内部使用
 *
 * @throws 如果在 SessionProvider 外部使用
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *     const { conversations, handleNewChat } = useSessionContext()
 *     // ...
 * }
 * ```
 */
export function useSessionContext(): SessionContextValue {
    const context = useContext(SessionContext)
    if (!context) {
        throw new Error(
            "useSessionContext must be used within a SessionProvider",
        )
    }
    return context
}

/**
 * 安全使用 Session Context（不抛出错误）
 *
 * 当组件可能在 SessionProvider 内外使用时使用此 hook
 *
 * @returns context 值或 undefined
 */
export function useSessionContextSafe(): SessionContextValue | undefined {
    return useContext(SessionContext)
}

// =====================
// 选择器 Hooks（细粒度订阅）
// =====================

/**
 * 获取会话列表相关状态
 */
export function useConversationList() {
    const {
        conversations,
        currentConversationId,
        getConversationDisplayTitle,
        isLoadingSwitch,
        switchingToId,
    } = useSessionContext()

    return useMemo(
        () => ({
            conversations,
            currentConversationId,
            getConversationDisplayTitle,
            isLoadingSwitch,
            switchingToId,
        }),
        [
            conversations,
            currentConversationId,
            getConversationDisplayTitle,
            isLoadingSwitch,
            switchingToId,
        ],
    )
}

/**
 * 获取会话操作
 */
export function useSessionActions() {
    const {
        handleNewChat,
        handleSelectConversation,
        handleDeleteConversation,
        handleUpdateConversationTitle,
    } = useSessionContext()

    return useMemo(
        () => ({
            handleNewChat,
            handleSelectConversation,
            handleDeleteConversation,
            handleUpdateConversationTitle,
        }),
        [
            handleNewChat,
            handleSelectConversation,
            handleDeleteConversation,
            handleUpdateConversationTitle,
        ],
    )
}

/**
 * 获取当前会话信息
 */
export function useCurrentConversation() {
    const {
        conversations,
        currentConversationId,
        getConversationDisplayTitle,
    } = useSessionContext()

    return useMemo(() => {
        const current = conversations.find(
            (c) => c.id === currentConversationId,
        )
        return {
            id: currentConversationId,
            meta: current,
            title: current
                ? getConversationDisplayTitle(currentConversationId)
                : "",
        }
    }, [conversations, currentConversationId, getConversationDisplayTitle])
}

/**
 * 创建 Session Context 值
 *
 * 辅助函数，从 useConversations hook 返回值创建 context 值
 *
 * @example
 * ```tsx
 * const conversationHook = useConversations({ ... })
 * const sessionContextValue = createSessionContextValue(conversationHook, {
 *     locale,
 *     handleUpdateConversationTitle,
 * })
 * ```
 */
export function createSessionContextValue(
    hook: {
        conversations: ConversationMeta[]
        currentConversationId: string
        isLoadingSwitch: boolean
        switchingToId: string | null
        getConversationDisplayTitle: (id: string) => string
        handleNewChat: (options?: { keepDiagram?: boolean }) => boolean
        handleSelectConversation: (id: string) => void | Promise<void>
        handleDeleteConversation: (id: string) => void
    },
    extra: {
        locale: string
        handleUpdateConversationTitle?: (id: string, title: string) => void
    },
): SessionContextValue {
    return {
        conversations: hook.conversations,
        currentConversationId: hook.currentConversationId,
        isLoadingSwitch: hook.isLoadingSwitch,
        switchingToId: hook.switchingToId,
        getConversationDisplayTitle: hook.getConversationDisplayTitle,
        handleNewChat: hook.handleNewChat,
        handleSelectConversation: hook.handleSelectConversation,
        handleDeleteConversation: hook.handleDeleteConversation,
        handleUpdateConversationTitle: extra.handleUpdateConversationTitle,
        locale: extra.locale,
    }
}
