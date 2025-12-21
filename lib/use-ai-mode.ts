"use client"

import { useSession } from "next-auth/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { STORAGE_KEYS } from "@/lib/storage"
import { api } from "@/lib/trpc/client"

export type AIMode = "system_default" | "byok"

export interface AIModeStat {
    mode: AIMode
    isLoading: boolean
    hasByokConfig: boolean
    // Fast 模式配置
    byokProvider: string | null
    byokCredentialName: string | null
    byokModel: string | null
    // Max 模式配置
    maxProvider: string | null
    maxCredentialName: string | null
    maxModel: string | null
    setMode: (mode: AIMode) => Promise<void>
    refresh: () => void
}

/**
 * Hook for managing AI mode selection
 *
 * - 登录用户: 从 tRPC 获取 aiMode 状态和选中的配置
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

    const isAuthenticatedRef = useRef(isAuthenticated)
    const setModeMutationRef = useRef(setModeMutation)
    const refetchRef = useRef(refetch)

    useEffect(() => {
        isAuthenticatedRef.current = isAuthenticated
    }, [isAuthenticated])

    useEffect(() => {
        setModeMutationRef.current = setModeMutation
        refetchRef.current = refetch
    }, [setModeMutation, refetch])

    const setMode = useCallback(async (mode: AIMode) => {
        if (!isAuthenticatedRef.current) return
        await setModeMutationRef.current.mutateAsync({ mode })
        await refetchRef.current()
    }, [])

    const mode = useMemo((): AIMode => {
        if (isAuthenticated) {
            return data?.aiMode || "system_default"
        }
        return anonymousHasByok ? "byok" : "system_default"
    }, [isAuthenticated, data?.aiMode, anonymousHasByok])

    const hasByokConfig = isAuthenticated
        ? data?.hasByokConfig || false
        : anonymousHasByok

    return {
        mode,
        isLoading: isAuthenticated ? isLoading : false,
        hasByokConfig,
        // Fast 模式配置
        byokProvider: data?.byokProvider || null,
        byokCredentialName: data?.byokCredentialName || null,
        byokModel: data?.byokModel || null,
        // Max 模式配置
        maxProvider: data?.maxProvider || null,
        maxCredentialName: data?.maxCredentialName || null,
        maxModel: data?.maxModel || null,
        setMode,
        refresh: refetch,
    }
}
