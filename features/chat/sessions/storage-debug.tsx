"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    getCacheStats,
    smartCacheCleanup,
} from "@/features/chat/sessions/cache-manager"
import { readConversationMetasFromStorage } from "@/features/chat/sessions/local-storage"
import { formatStorageSize } from "@/features/chat/sessions/storage-optimizer"

interface StorageStats {
    totalSize: number
    conversationCount: number
    quota: number
    usage: number
    usagePercentage: number
    conversations: Array<{
        id: string
        title?: string
        size: number
    }>
}

/**
 * localStorage 存储空间调试工具
 * 用于开发和调试时查看存储使用情况
 */
export function StorageDebugPanel({
    userId,
    isAuthenticated = false,
}: {
    userId: string
    isAuthenticated?: boolean
}) {
    const [stats, setStats] = useState<StorageStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [cleaning, setCleaning] = useState(false)

    const analyzeStorage = async () => {
        setLoading(true)
        try {
            // 获取浏览器存储配额信息
            let quota = 0
            let usage = 0
            if (
                typeof navigator !== "undefined" &&
                navigator.storage?.estimate
            ) {
                const estimate = await navigator.storage.estimate()
                quota = estimate.quota || 0
                usage = estimate.usage || 0
            }

            // 分析 localStorage 中的会话数据
            const metas = readConversationMetasFromStorage(userId)
            const conversations = metas.map((meta) => {
                const key = `conversation:${userId}:${meta.id}`
                const value = localStorage.getItem(key) || ""
                const size = (key.length + value.length) * 2 // UTF-16 每字符 2 字节
                return {
                    id: meta.id,
                    title: meta.title,
                    size,
                }
            })

            // 计算 localStorage 总大小
            let totalSize = 0
            for (const key in localStorage) {
                if (Object.hasOwn(localStorage, key)) {
                    const value = localStorage[key]
                    totalSize += (key.length + value.length) * 2
                }
            }

            setStats({
                totalSize,
                conversationCount: conversations.length,
                quota,
                usage,
                usagePercentage: quota > 0 ? (usage / quota) * 100 : 0,
                conversations: conversations.sort((a, b) => b.size - a.size), // 按大小降序
            })
        } catch (error) {
            console.error("分析存储失败:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleCleanupCache = async () => {
        setCleaning(true)
        try {
            const result = smartCacheCleanup(userId, isAuthenticated)
            if (result.totalRemoved > 0) {
                const messages = []
                if (result.staleRemoved > 0) {
                    messages.push(`${result.staleRemoved} 个过期会话`)
                }
                if (result.quotaRemoved > 0) {
                    messages.push(`${result.quotaRemoved} 个旧会话（超出配额）`)
                }
                toast.success(`已清理：${messages.join("、")}`)
            } else {
                toast.info("无需清理，缓存状态良好")
            }
            // 重新分析存储
            await analyzeStorage()
        } catch (error) {
            console.error("清理失败:", error)
            toast.error("清理缓存失败")
        } finally {
            setCleaning(false)
        }
    }

    useEffect(() => {
        void analyzeStorage()
    }, [userId])

    if (!stats) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>存储空间分析</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button onClick={analyzeStorage} disabled={loading}>
                        {loading ? "分析中..." : "刷新数据"}
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>存储空间分析</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                            localStorage 使用
                        </span>
                        <span className="text-sm font-mono">
                            {formatStorageSize(stats.totalSize)}
                        </span>
                    </div>

                    {stats.quota > 0 && (
                        <>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">
                                    总存储配额
                                </span>
                                <span className="text-sm font-mono">
                                    {formatStorageSize(stats.quota)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">
                                    已使用
                                </span>
                                <span className="text-sm font-mono">
                                    {formatStorageSize(stats.usage)} (
                                    {stats.usagePercentage.toFixed(1)}%)
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all"
                                    style={{
                                        width: `${Math.min(stats.usagePercentage, 100)}%`,
                                    }}
                                />
                            </div>
                        </>
                    )}

                    <div className="flex justify-between pt-2">
                        <span className="text-sm text-muted-foreground">
                            会话数量
                        </span>
                        <span className="text-sm font-mono">
                            {stats.conversationCount}
                        </span>
                    </div>

                    {/* 缓存配额信息 */}
                    {(() => {
                        const cacheStats = getCacheStats(
                            userId,
                            isAuthenticated,
                        )
                        return (
                            <>
                                <div className="border-t pt-2 mt-2">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">
                                            缓存配额
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {isAuthenticated
                                                ? "登录用户"
                                                : "匿名用户"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            已缓存 / 配额
                                        </span>
                                        <span className="text-sm font-mono">
                                            {cacheStats.cached} /{" "}
                                            {cacheStats.quota}
                                        </span>
                                    </div>
                                    {cacheStats.staleCount > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">
                                                过期会话
                                            </span>
                                            <span className="text-sm font-mono text-yellow-600">
                                                {cacheStats.staleCount}
                                            </span>
                                        </div>
                                    )}
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                        <div
                                            className={`h-2 rounded-full transition-all ${
                                                cacheStats.usagePercentage > 90
                                                    ? "bg-red-600"
                                                    : cacheStats.usagePercentage >
                                                        70
                                                      ? "bg-yellow-600"
                                                      : "bg-green-600"
                                            }`}
                                            style={{
                                                width: `${Math.min(cacheStats.usagePercentage, 100)}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        )
                    })()}
                </div>

                {stats.conversations.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                            会话存储占用（前 10）
                        </h3>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                            {stats.conversations.slice(0, 10).map((conv) => (
                                <div
                                    key={conv.id}
                                    className="flex justify-between items-center text-xs p-2 bg-muted rounded"
                                >
                                    <span className="truncate flex-1 mr-2">
                                        {conv.title || conv.id}
                                    </span>
                                    <span className="font-mono text-muted-foreground">
                                        {formatStorageSize(conv.size)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    <Button
                        onClick={handleCleanupCache}
                        disabled={cleaning || loading}
                        variant="default"
                        className="flex-1"
                    >
                        {cleaning ? "清理中..." : "清理缓存"}
                    </Button>
                    <Button
                        onClick={analyzeStorage}
                        disabled={loading || cleaning}
                        variant="outline"
                        className="flex-1"
                    >
                        {loading ? "分析中..." : "刷新"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
