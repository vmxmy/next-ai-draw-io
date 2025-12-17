import type {
    ConversationMeta,
    ConversationPayload,
} from "@/features/chat/sessions/storage"

/**
 * 会话存储适配器接口
 *
 * 抽象本地存储和云端存储的差异，提供统一的 API
 * 使 hook 逻辑可以复用，只需切换底层存储实现
 */
export interface ConversationStorageAdapter {
    // =====================
    // 读取操作
    // =====================

    /**
     * 获取所有会话元数据列表
     */
    listConversations(): ConversationMeta[] | Promise<ConversationMeta[]>

    /**
     * 加载指定会话的完整数据
     */
    loadConversation(
        id: string,
    ): ConversationPayload | null | Promise<ConversationPayload | null>

    /**
     * 获取当前活动会话 ID
     */
    getCurrentConversationId(): string

    // =====================
    // 写入操作
    // =====================

    /**
     * 创建新会话
     * @returns 是否创建成功
     */
    createConversation(
        id: string,
        payload: ConversationPayload,
        timestamp: number,
    ): boolean | Promise<boolean>

    /**
     * 保存会话数据（防抖处理，适合频繁调用）
     */
    saveConversation(
        id: string,
        payload: Partial<ConversationPayload>,
    ): void | Promise<void>

    /**
     * 立即保存会话数据（用于 beforeunload/visibilitychange）
     * 必须是同步的，因为 beforeunload 不等待 Promise
     */
    saveImmediately(id: string, payload: ConversationPayload): void

    /**
     * 删除会话
     */
    deleteConversation(id: string): void | Promise<void>

    /**
     * 更新会话标题
     */
    updateTitle(id: string, title: string): void | Promise<void>

    /**
     * 设置当前活动会话 ID
     */
    setCurrentConversationId(id: string): void

    // =====================
    // 元数据操作
    // =====================

    /**
     * 更新会话元数据（updatedAt、title 等）
     */
    updateMeta(
        id: string,
        updates: Partial<Omit<ConversationMeta, "id">>,
    ): void | Promise<void>

    /**
     * 获取会话列表的同步版本（用于需要立即获取的场景）
     * 返回缓存的列表，不触发网络请求
     */
    getCachedConversations(): ConversationMeta[]
}

/**
 * 云端适配器特有的配置
 */
export interface CloudAdapterConfig {
    userId: string
    /**
     * 推送变更到云端的回调
     */
    pushMutate: (data: {
        conversations: Array<{
            id: string
            payload?: ConversationPayload
            deleted?: boolean
            sessionId?: string
            title?: string
        }>
    }) => void
    /**
     * 获取 TRPC utils 用于查询
     */
    getConversationById: (id: string) => Promise<{
        payload?: ConversationPayload
    } | null>
}

/**
 * 本地适配器特有的配置
 */
export interface LocalAdapterConfig {
    userId: string
    /**
     * 推送变更到云端的回调（用于登录用户的本地-云端同步）
     */
    queuePushConversation?: (
        id: string,
        opts?: { immediate?: boolean; deleted?: boolean },
    ) => void
}

/**
 * 存储适配器工厂函数类型
 */
export type CreateStorageAdapter<
    TConfig extends LocalAdapterConfig | CloudAdapterConfig,
> = (config: TConfig) => ConversationStorageAdapter
