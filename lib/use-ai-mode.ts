"use client"

import { useSession } from "next-auth/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { STORAGE_KEYS } from "@/lib/storage"
import { api } from "@/lib/trpc/client"

export type AIMode = "system_default" | "byok"

export interface AIModeStat {
    mode: AIMode
    isLoading: boolean
    hasByokConfig: boolean
    byokProvider: string | null
    byokModel: string | null
    setMode: (mode: AIMode) => Promise<void>
    refresh: () => void
}

/**
 * Hook for managing AI mode selection
 *
 * - 登录用户: 从 tRPC 获取 aiMode 状态
 * - 匿名用户: 从 localStorage 检测 BYOK 配置
 */
export function useAIMode(): AIModeStat {
    const { status } = useSession()
    const isAuthenticated = status === "authenticated"

    // 登录用户: tRPC 查询
    const { data, isLoading, refetch } = api.aiMode.getStatus.useQuery(
        undefined,
        {
            enabled: isAuthenticated,
            staleTime: 30_000,
        },
    )

    const setModeMutation = api.aiMode.setMode.useMutation()

    // 匿名用户: localStorage 检测
    const [anonymousHasByok, setAnonymousHasByok] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined" || isAuthenticated) return

        const checkLocalByok = () => {
            const provider = localStorage.getItem(STORAGE_KEYS.aiProvider)
            const apiKey = localStorage.getItem(STORAGE_KEYS.aiApiKey)
            setAnonymousHasByok(!!(provider && apiKey))
        }

        checkLocalByok()

        // 监听 storage 变化
        const handleStorage = () => checkLocalByok()
        window.addEventListener("storage", handleStorage)
        return () => window.removeEventListener("storage", handleStorage)
    }, [isAuthenticated])

    const setMode = useCallback(
        async (mode: AIMode) => {
            if (!isAuthenticated) return
            await setModeMutation.mutateAsync({ mode })
            await refetch()
        },
        [isAuthenticated, setModeMutation, refetch],
    )

    const mode = useMemo((): AIMode => {
        if (isAuthenticated) {
            return data?.aiMode || "system_default"
        }
        return anonymousHasByok ? "byok" : "system_default"
    }, [isAuthenticated, data?.aiMode, anonymousHasByok])

    return {
        mode,
        isLoading: isAuthenticated ? isLoading : false,
        hasByokConfig: isAuthenticated
            ? data?.hasByokConfig || false
            : anonymousHasByok,
        byokProvider: data?.byokProvider || null,
        byokModel: data?.byokModel || null,
        setMode,
        refresh: refetch,
    }
}
