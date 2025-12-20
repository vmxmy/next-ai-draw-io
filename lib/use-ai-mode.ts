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
    selectedConfigId: string | null
    byokProvider: string | null
    byokConnectionName: string | null
    byokModel: string | null
    setMode: (mode: AIMode) => Promise<void>
    setSelectedConfig: (configId: string | null) => Promise<void>
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
    const setSelectedConfigMutation = api.aiMode.setSelectedConfig.useMutation()

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
    const setSelectedConfigMutationRef = useRef(setSelectedConfigMutation)
    const refetchRef = useRef(refetch)

    useEffect(() => {
        isAuthenticatedRef.current = isAuthenticated
    }, [isAuthenticated])

    useEffect(() => {
        setModeMutationRef.current = setModeMutation
        setSelectedConfigMutationRef.current = setSelectedConfigMutation
        refetchRef.current = refetch
    }, [setModeMutation, setSelectedConfigMutation, refetch])

    const setMode = useCallback(async (mode: AIMode) => {
        if (!isAuthenticatedRef.current) return
        await setModeMutationRef.current.mutateAsync({ mode })
        await refetchRef.current()
    }, [])

    const setSelectedConfig = useCallback(async (configId: string | null) => {
        if (!isAuthenticatedRef.current) return
        await setSelectedConfigMutationRef.current.mutateAsync({ configId })
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

    // Debug logging
    console.log("[useAIMode] Debug:", {
        isAuthenticated,
        isLoading,
        mode,
        hasByokConfig,
        selectedConfigId: data?.selectedConfigId,
        rawData: data,
        anonymousHasByok,
    })

    return {
        mode,
        isLoading: isAuthenticated ? isLoading : false,
        hasByokConfig,
        selectedConfigId: data?.selectedConfigId || null,
        byokProvider: data?.byokProvider || null,
        byokConnectionName: data?.byokConnectionName || null,
        byokModel: data?.byokModel || null,
        setMode,
        setSelectedConfig,
        refresh: refetch,
    }
}
