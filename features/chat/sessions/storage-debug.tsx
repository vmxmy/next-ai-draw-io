"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
export function StorageDebugPanel({ userId }: { userId: string }) {
    const [stats, setStats] = useState<StorageStats | null>(null)
    const [loading, setLoading] = useState(false)

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

                <Button
                    onClick={analyzeStorage}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                >
                    {loading ? "分析中..." : "刷新数据"}
                </Button>
            </CardContent>
        </Card>
    )
}
