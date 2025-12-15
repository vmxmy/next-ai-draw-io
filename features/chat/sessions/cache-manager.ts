"use client"

import {
    cleanOldestConversations,
    readConversationMetasFromStorage,
    removeConversationPayloadFromStorage,
} from "@/features/chat/sessions/local-storage"

// 缓存配额限制
const MAX_CACHED_CONVERSATIONS_LOGGED_IN = 30 // 登录用户最多缓存 30 个会话
const MAX_CACHED_CONVERSATIONS_ANONYMOUS = 100 // 匿名用户最多缓存 100 个
const STALE_DAYS = 30 // 超过 30 天未更新的会话视为过期

/**
 * 获取用户的缓存配额限制
 */
export function getCacheQuota(isAuthenticated: boolean): number {
    return isAuthenticated
        ? MAX_CACHED_CONVERSATIONS_LOGGED_IN
        : MAX_CACHED_CONVERSATIONS_ANONYMOUS
}

/**
 * 清理过期的本地缓存
 * 删除超过指定天数未更新的会话（仅本地缓存，云端数据保持不变）
 */
export function cleanStaleCache(userId: string): number {
    try {
        const metas = readConversationMetasFromStorage(userId)
        if (metas.length === 0) return 0

        const now = Date.now()
        const staleThreshold = STALE_DAYS * 24 * 60 * 60 * 1000

        const staleConversations = metas.filter(
            (m) => now - m.updatedAt > staleThreshold,
        )

        if (staleConversations.length === 0) return 0

        // 只删除 payload，保留 meta（用户仍能看到会话列表）
        staleConversations.forEach((meta) => {
            removeConversationPayloadFromStorage(userId, meta.id)
        })

        return staleConversations.length
    } catch {
        return 0
    }
}

/**
 * 强制缓存数量限制
 * 如果缓存会话超过配额，删除最旧的会话（按 updatedAt 排序）
 */
export function enforceCacheQuota(
    userId: string,
    isAuthenticated: boolean,
): number {
    try {
        const metas = readConversationMetasFromStorage(userId)
        const quota = getCacheQuota(isAuthenticated)

        if (metas.length <= quota) return 0

        const excessCount = metas.length - quota

        // cleanOldestConversations 会删除最旧的会话
        return cleanOldestConversations(userId, excessCount)
    } catch {
        return 0
    }
}

/**
 * 智能缓存清理
 * 结合过期清理和配额限制，返回清理的会话数量
 */
export function smartCacheCleanup(
    userId: string,
    isAuthenticated: boolean,
): {
    staleRemoved: number
    quotaRemoved: number
    totalRemoved: number
} {
    // 1. 先清理过期缓存
    const staleRemoved = cleanStaleCache(userId)

    // 2. 再强制配额限制
    const quotaRemoved = enforceCacheQuota(userId, isAuthenticated)

    return {
        staleRemoved,
        quotaRemoved,
        totalRemoved: staleRemoved + quotaRemoved,
    }
}

/**
 * 检查是否需要清理缓存（非侵入式检查，不实际清理）
 */
export function shouldCleanupCache(
    userId: string,
    isAuthenticated: boolean,
): boolean {
    try {
        const metas = readConversationMetasFromStorage(userId)
        const quota = getCacheQuota(isAuthenticated)

        // 如果超过配额 80%，建议清理
        return metas.length > quota * 0.8
    } catch {
        return false
    }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(
    userId: string,
    isAuthenticated: boolean,
): {
    cached: number
    quota: number
    usagePercentage: number
    staleCount: number
} {
    try {
        const metas = readConversationMetasFromStorage(userId)
        const quota = getCacheQuota(isAuthenticated)
        const now = Date.now()
        const staleThreshold = STALE_DAYS * 24 * 60 * 60 * 1000

        const staleCount = metas.filter(
            (m) => now - m.updatedAt > staleThreshold,
        ).length

        return {
            cached: metas.length,
            quota,
            usagePercentage: (metas.length / quota) * 100,
            staleCount,
        }
    } catch {
        return {
            cached: 0,
            quota: getCacheQuota(isAuthenticated),
            usagePercentage: 0,
            staleCount: 0,
        }
    }
}
