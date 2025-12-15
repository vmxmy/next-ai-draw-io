"use client"

import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { QuotaLimitToast } from "@/components/quota-limit-toast"
import { STORAGE_KEYS } from "@/lib/storage"
import { api } from "@/lib/trpc/client"

export interface QuotaConfig {
    dailyRequestLimit: number
    dailyTokenLimit: number
    tpmLimit: number
}

export interface QuotaCheckResult {
    allowed: boolean
    remaining: number
    used: number
}

export interface QuotaUsage {
    dailyRequests: number
    dailyTokens: number
    minuteTokens: number
}

/**
 * Hook for managing request/token quotas and rate limiting.
 *
 * 新版本（基于服务端数据驱动）：
 * - 登录用户：从 tRPC 获取实时配额和使用情况
 * - 匿名用户：从 /api/config 获取配额配置
 * - 所有用户：BYOK（自带 API Key）绕过所有限额
 *
 * 注意：服务端已经强制执行限额，前端检查主要用于快速反馈
 */
export function useQuotaManager(fallbackConfig?: QuotaConfig): {
    hasOwnApiKey: () => boolean
    checkDailyLimit: () => QuotaCheckResult
    checkTokenLimit: () => QuotaCheckResult
    checkTPMLimit: () => QuotaCheckResult
    incrementRequestCount: () => void
    incrementTokenCount: (tokens: number) => void
    incrementTPMCount: (tokens: number) => void
    showQuotaLimitToast: () => void
    showTokenLimitToast: (used: number) => void
    showTPMLimitToast: () => void
    tier?: string
    config: QuotaConfig | null
    usage: QuotaUsage
} {
    const { status } = useSession()
    const [config, setConfig] = useState<QuotaConfig | null>(
        fallbackConfig || null,
    )
    const [usage, setUsage] = useState<QuotaUsage>({
        dailyRequests: 0,
        dailyTokens: 0,
        minuteTokens: 0,
    })

    // 登录用户：从 tRPC 获取等级配置
    const { data: tierData } = api.tierConfig.getUserTier.useQuery(undefined, {
        enabled: status === "authenticated",
        refetchInterval: 60_000, // 每分钟刷新
    })

    // 登录用户：从 tRPC 获取配额使用情况
    const { data: usageData, refetch: refetchUsage } =
        api.tierConfig.getUserQuotaUsage.useQuery(undefined, {
            enabled: status === "authenticated",
            refetchInterval: 10_000, // 每 10 秒刷新
        })

    // 匿名用户：从 /api/quota/anonymous 获取配额配置和使用情况
    useEffect(() => {
        if (status !== "unauthenticated") return // 只在确认未登录时执行

        const fetchAnonymousQuota = () => {
            fetch("/api/quota/anonymous")
                .then((res) => res.json())
                .then((data) => {
                    if (data.config) {
                        setConfig({
                            dailyRequestLimit:
                                data.config.dailyRequestLimit || 0,
                            dailyTokenLimit: data.config.dailyTokenLimit || 0,
                            tpmLimit: data.config.tpmLimit || 0,
                        })
                    }
                    if (data.usage) {
                        setUsage({
                            dailyRequests: data.usage.dailyRequests || 0,
                            dailyTokens: data.usage.dailyTokens || 0,
                            minuteTokens: data.usage.minuteTokens || 0,
                        })
                    }
                })
                .catch(() => {
                    if (fallbackConfig) {
                        setConfig(fallbackConfig)
                    }
                })
        }

        // 立即执行一次
        fetchAnonymousQuota()

        // 每 10 秒刷新一次
        const interval = setInterval(fetchAnonymousQuota, 10_000)

        return () => clearInterval(interval)
    }, [status])

    // 登录用户：从 tRPC 数据更新 config 和 usage
    useEffect(() => {
        if (tierData?.config) {
            setConfig({
                dailyRequestLimit: tierData.config.dailyRequestLimit,
                dailyTokenLimit: Number(tierData.config.dailyTokenLimit),
                tpmLimit: tierData.config.tpmLimit,
            })
        }
    }, [tierData])

    useEffect(() => {
        if (usageData) {
            setUsage(usageData)
        }
    }, [usageData])

    // Check if user has their own API key configured (bypass limits)
    const hasOwnApiKey = useCallback((): boolean => {
        // SSR safe: only access localStorage in browser
        if (typeof window === "undefined") return false
        const provider = localStorage.getItem(STORAGE_KEYS.aiProvider)
        const apiKey = localStorage.getItem(STORAGE_KEYS.aiApiKey)
        return !!(provider && apiKey)
    }, [])

    // Check daily request limit
    const checkDailyLimit = useCallback((): QuotaCheckResult => {
        if (hasOwnApiKey()) return { allowed: true, remaining: -1, used: 0 }
        if (!config || config.dailyRequestLimit <= 0)
            return { allowed: true, remaining: -1, used: 0 }

        return {
            allowed: usage.dailyRequests < config.dailyRequestLimit,
            remaining: config.dailyRequestLimit - usage.dailyRequests,
            used: usage.dailyRequests,
        }
    }, [config, usage.dailyRequests, hasOwnApiKey])

    // Increment request count (乐观更新)
    const incrementRequestCount = useCallback(() => {
        setUsage((prev) => ({
            ...prev,
            dailyRequests: prev.dailyRequests + 1,
        }))
        // 只有登录用户才触发 tRPC 刷新（匿名用户依赖轮询）
        if (status === "authenticated") {
            setTimeout(() => {
                void refetchUsage()
            }, 1000)
        }
    }, [refetchUsage, status])

    // Show quota limit toast (request-based)
    const showQuotaLimitToast = useCallback(() => {
        toast.custom(
            (t) => (
                <QuotaLimitToast
                    used={usage.dailyRequests}
                    limit={config?.dailyRequestLimit || 0}
                    onDismiss={() => toast.dismiss(t)}
                />
            ),
            { duration: 15000 },
        )
    }, [usage.dailyRequests, config])

    // Check daily token limit
    const checkTokenLimit = useCallback((): QuotaCheckResult => {
        if (hasOwnApiKey()) return { allowed: true, remaining: -1, used: 0 }
        if (!config || config.dailyTokenLimit <= 0)
            return { allowed: true, remaining: -1, used: 0 }

        return {
            allowed: usage.dailyTokens < config.dailyTokenLimit,
            remaining: config.dailyTokenLimit - usage.dailyTokens,
            used: usage.dailyTokens,
        }
    }, [config, usage.dailyTokens, hasOwnApiKey])

    // Increment token count (乐观更新)
    const incrementTokenCount = useCallback(
        (tokens: number) => {
            if (!Number.isFinite(tokens) || tokens <= 0) return

            setUsage((prev) => ({
                ...prev,
                dailyTokens: prev.dailyTokens + tokens,
            }))
            // 只有登录用户才触发 tRPC 刷新（匿名用户依赖轮询）
            if (status === "authenticated") {
                setTimeout(() => {
                    void refetchUsage()
                }, 1000)
            }
        },
        [refetchUsage, status],
    )

    // Show token limit toast
    const showTokenLimitToast = useCallback(
        (used: number) => {
            toast.custom(
                (t) => (
                    <QuotaLimitToast
                        type="token"
                        used={used}
                        limit={config?.dailyTokenLimit || 0}
                        onDismiss={() => toast.dismiss(t)}
                    />
                ),
                { duration: 15000 },
            )
        },
        [config],
    )

    // Check TPM (tokens per minute) limit
    const checkTPMLimit = useCallback((): QuotaCheckResult => {
        if (hasOwnApiKey()) return { allowed: true, remaining: -1, used: 0 }
        if (!config || config.tpmLimit <= 0)
            return { allowed: true, remaining: -1, used: 0 }

        return {
            allowed: usage.minuteTokens < config.tpmLimit,
            remaining: config.tpmLimit - usage.minuteTokens,
            used: usage.minuteTokens,
        }
    }, [config, usage.minuteTokens, hasOwnApiKey])

    // Increment TPM count (乐观更新)
    const incrementTPMCount = useCallback(
        (tokens: number) => {
            if (!Number.isFinite(tokens) || tokens <= 0) return

            setUsage((prev) => ({
                ...prev,
                minuteTokens: prev.minuteTokens + tokens,
            }))
            // 只有登录用户才触发 tRPC 刷新（匿名用户依赖轮询）
            if (status === "authenticated") {
                setTimeout(() => {
                    void refetchUsage()
                }, 1000)
            }
        },
        [refetchUsage, status],
    )

    // Show TPM limit toast
    const showTPMLimitToast = useCallback(() => {
        const limit = config?.tpmLimit || 0
        const limitDisplay = limit >= 1000 ? `${limit / 1000}k` : String(limit)
        toast.error(
            `Rate limit reached (${limitDisplay} tokens/min). Please wait 60 seconds before sending another request.`,
            { duration: 8000 },
        )
    }, [config])

    return {
        // Check functions
        hasOwnApiKey,
        checkDailyLimit,
        checkTokenLimit,
        checkTPMLimit,

        // Increment functions
        incrementRequestCount,
        incrementTokenCount,
        incrementTPMCount,

        // Toast functions
        showQuotaLimitToast,
        showTokenLimitToast,
        showTPMLimitToast,

        // 暴露额外信息
        tier: tierData?.tier,
        config,
        usage,
    }
}
