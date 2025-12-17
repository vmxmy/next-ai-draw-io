import type { ChatMessage } from "@/features/chat/ai/types"
import type {
    ConversationMeta,
    ConversationPayload,
    DiagramVersion,
} from "@/features/chat/sessions/storage"

/**
 * 会话 Hook 配置
 *
 * 所有会话管理 hook 的公共配置接口
 */
export interface ConversationHookConfig {
    /** 用户 ID（匿名用户为 "anonymous"） */
    userId: string
    /** 当前语言 */
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
    /** 图表 XML ref（用于事件处理器） */
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
    /** 消息列表 ref（用于事件处理器） */
    messagesRef: React.MutableRefObject<ChatMessage[]>
    /** 重置文件上传状态 */
    resetFiles: () => void
    /** 停止当前请求 */
    stopCurrentRequest?: () => void
    /** 是否启用 hook */
    enabled?: boolean
}

/**
 * 图表版本历史状态
 *
 * 由 useDiagramVersionHistory hook 返回
 */
export interface DiagramVersionState {
    versions: DiagramVersion[]
    cursor: number
    canUndo: boolean
    canRedo: boolean
}

/**
 * 会话 Hook 返回值
 *
 * 所有会话管理 hook 的公共返回接口
 */
export interface ConversationHookReturn {
    // =====================
    // 会话状态
    // =====================

    /** 会话元数据列表（已排序） */
    conversations: ConversationMeta[]
    /** 设置会话列表（内部使用） */
    setConversations: React.Dispatch<React.SetStateAction<ConversationMeta[]>>
    /** 当前会话 ID */
    currentConversationId: string
    /** 设置当前会话 ID（内部使用） */
    setCurrentConversationId: React.Dispatch<React.SetStateAction<string>>
    /** 当前会话唯一 session ID */
    sessionId: string
    /** 设置 session ID（内部使用） */
    setSessionId: React.Dispatch<React.SetStateAction<string>>
    /** 是否已完成数据恢复 */
    hasRestored: boolean
    /** 是否可以保存图表（DrawIO 就绪后） */
    canSaveDiagram: boolean
    /** 是否正在切换会话 */
    isLoadingSwitch: boolean
    /** 正在切换到的会话 ID */
    switchingToId: string | null

    // =====================
    // 会话标题
    // =====================

    /** 获取会话显示标题 */
    getConversationDisplayTitle: (id: string) => string
    /** 从消息推导标题 */
    deriveConversationTitle: (messages: ChatMessage[]) => string

    // =====================
    // 图表版本管理（来自 useDiagramVersionHistory）
    // =====================

    /** 图表版本列表 */
    diagramVersions: DiagramVersion[]
    /** 当前版本游标 */
    diagramVersionCursor: number
    /** 是否可以撤销 */
    canUndo: boolean
    /** 是否可以重做 */
    canRedo: boolean
    /** 撤销图表操作 */
    undoDiagram: () => void
    /** 重做图表操作 */
    redoDiagram: () => void
    /** 恢复到指定版本 */
    restoreDiagramVersionIndex: (index: number) => void
    /** 为消息确保图表版本存在 */
    ensureDiagramVersionForMessage: (
        messageIndex: number,
        xml: string,
        note?: string,
    ) => { versionIndex: number; created: boolean }
    /** 追加新图表版本 */
    appendDiagramVersion: (xml: string, note?: string) => void
    /** 获取消息对应的图表 XML */
    getDiagramXmlForMessage: (messageIndex: number) => string | undefined
    /** 获取消息对应的版本索引 */
    getDiagramVersionIndexForMessage: (
        messageIndex: number,
    ) => number | undefined
    /** 获取消息之前的图表 XML */
    getPreviousDiagramXmlBeforeMessage: (
        messageIndex: number,
    ) => string | undefined
    /** 截断消息之后的版本 */
    truncateDiagramVersionsAfterMessage: (messageIndex: number) => void

    // =====================
    // 会话操作
    // =====================

    /** 加载会话数据 */
    loadConversation: (id: string) => void
    /** 持久化当前会话 */
    persistCurrentConversation: (
        overrides: Partial<ConversationPayload>,
    ) => void
    /** 创建新会话 */
    handleNewChat: (options?: { keepDiagram?: boolean }) => boolean
    /** 切换会话 */
    handleSelectConversation: (id: string) => void | Promise<void>
    /** 删除会话 */
    handleDeleteConversation: (id: string) => void
}

/**
 * 本地 Hook 专有配置
 */
export interface LocalConversationHookConfig extends ConversationHookConfig {
    /** 云端同步队列（用于登录用户） */
    queuePushConversation: (
        id: string,
        opts?: { immediate?: boolean; deleted?: boolean },
    ) => void
    /** 是否持久化上传的文件 */
    persistUploadedFiles: boolean
}

/**
 * 云端 Hook 专有配置
 */
export interface CloudConversationHookConfig extends ConversationHookConfig {
    // 云端 hook 通过 TRPC 自动获取数据，无需额外配置
}
