import { useCallback, useEffect, useState } from "react"

export interface ModelOption {
    id: string
    label?: string
}

export interface UseModelSelectorOptions {
    provider: string
    apiKey: string
    baseUrl: string
    isDialogOpen: boolean
    isLoggedIn?: boolean
    hasCloudConfig?: boolean
}

export function useModelSelector(options: UseModelSelectorOptions) {
    const {
        provider,
        apiKey,
        baseUrl,
        isDialogOpen,
        isLoggedIn,
        hasCloudConfig,
    } = options

    const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)

    // Fetch models when dialog opens and credentials are available
    // For logged-in users with cloud config, server will use cloud credentials
    useEffect(() => {
        if (!isDialogOpen) return
        if (!provider) {
            setModelOptions([])
            return
        }

        // 有本地 apiKey 或 (已登录且有云端配置) 时获取模型列表
        const hasLocalKey = apiKey.trim().length > 0
        const canUseCloudKey = isLoggedIn && hasCloudConfig

        if (!hasLocalKey && !canUseCloudKey) {
            setModelOptions([])
            return
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => {
            setIsLoadingModels(true)
            fetch("/api/models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider,
                    // 如果有本地 key 就传，没有则让服务端从云端读取
                    ...(hasLocalKey ? { apiKey } : {}),
                    ...(baseUrl ? { baseUrl } : {}),
                }),
                signal: controller.signal,
            })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    return res.json()
                })
                .then((data) => {
                    const models = Array.isArray(data?.models)
                        ? data.models
                        : []
                    setModelOptions(models)
                })
                .catch(() => {
                    setModelOptions([])
                })
                .finally(() => {
                    setIsLoadingModels(false)
                })
        }, 250)

        return () => {
            clearTimeout(timeout)
            controller.abort()
        }
    }, [apiKey, baseUrl, isDialogOpen, provider, isLoggedIn, hasCloudConfig])

    // Filter models based on search query
    const filterModels = useCallback(
        (query: string) => {
            const q = query.trim().toLowerCase()
            if (!q) return modelOptions.slice(0, 100)

            return modelOptions
                .filter((m) => {
                    return (
                        String(m.id).toLowerCase().includes(q) ||
                        String(m.label || "")
                            .toLowerCase()
                            .includes(q)
                    )
                })
                .slice(0, 100)
        },
        [modelOptions],
    )

    const openModelMenu = useCallback(() => {
        setIsModelMenuOpen(true)
    }, [])

    const closeModelMenu = useCallback(() => {
        setIsModelMenuOpen(false)
    }, [])

    const toggleModelMenu = useCallback(() => {
        setIsModelMenuOpen((v) => !v)
    }, [])

    // Delayed close for blur handling
    const closeModelMenuDelayed = useCallback(() => {
        setTimeout(() => setIsModelMenuOpen(false), 150)
    }, [])

    return {
        // State
        modelOptions,
        isLoadingModels,
        isModelMenuOpen,

        // Actions
        openModelMenu,
        closeModelMenu,
        toggleModelMenu,
        closeModelMenuDelayed,
        filterModels,

        // Computed
        hasModels: modelOptions.length > 0,
        modelsCount: modelOptions.length,
    }
}

// Helper function to get model placeholder based on provider
export function getModelPlaceholder(
    provider: string,
    fallbackLabel: string,
): string {
    switch (provider) {
        case "openai":
            return "e.g., gpt-4o"
        case "anthropic":
            return "e.g., claude-3-5-sonnet-latest"
        case "google":
            return "e.g., gemini-2.5-pro"
        case "deepseek":
            return "e.g., deepseek-chat"
        case "openai_compatible":
            return "e.g., your-model-id"
        default:
            return fallbackLabel
    }
}

// Helper function to get base URL placeholder based on provider
export function getBaseUrlPlaceholder(
    provider: string,
    fallbackLabel: string,
): string {
    switch (provider) {
        case "anthropic":
            return "https://api.anthropic.com/v1"
        case "siliconflow":
            return "https://api.siliconflow.com/v1"
        case "openai_compatible":
            return "https://your-gateway.example.com/v1"
        default:
            return fallbackLabel
    }
}
