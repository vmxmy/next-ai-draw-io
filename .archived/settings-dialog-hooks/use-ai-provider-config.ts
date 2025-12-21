import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"
import { STORAGE_KEYS } from "@/lib/storage"
import { api } from "@/lib/trpc/client"

export interface AIProviderConfig {
    provider: string
    baseUrl: string
    apiKey: string
    modelId: string
}

export interface CloudConfig {
    id?: string
    provider?: string
    name?: string
    isDefault?: boolean
    apiKeyPreview?: string
    baseUrl?: string
    modelId?: string
}

export type ProviderType =
    | "openai"
    | "anthropic"
    | "google"
    | "azure"
    | "openrouter"
    | "deepseek"
    | "siliconflow"
    | "openai_compatible"

export function useAIProviderConfig() {
    const { data: session } = useSession()
    const utils = api.useUtils()

    const [localConfig, setLocalConfig] = useState<AIProviderConfig>({
        provider: "",
        baseUrl: "",
        apiKey: "",
        modelId: "",
    })

    const [cloudConfig, setCloudConfig] = useState<CloudConfig>({})
    const [isLoadingCloud, setIsLoadingCloud] = useState(false)

    // 从 localStorage 加载配置
    useEffect(() => {
        if (typeof window === "undefined") return
        setLocalConfig({
            provider: localStorage.getItem(STORAGE_KEYS.aiProvider) || "",
            baseUrl: localStorage.getItem(STORAGE_KEYS.aiBaseUrl) || "",
            apiKey: localStorage.getItem(STORAGE_KEYS.aiApiKey) || "",
            modelId: localStorage.getItem(STORAGE_KEYS.aiModel) || "",
        })
    }, [])

    // Provider 变更时加载云端配置
    const loadCloudConfig = useCallback(
        async (provider: string) => {
            if (!session?.user || !provider) {
                setCloudConfig({})
                return
            }

            setIsLoadingCloud(true)
            try {
                const config = await utils.providerConfig.get.fetch({
                    provider: provider as ProviderType,
                })

                if (config) {
                    setCloudConfig({
                        apiKeyPreview: config.hasApiKey
                            ? config.apiKeyPreview
                            : undefined,
                        baseUrl: config.baseUrl,
                        modelId: config.modelId,
                    })

                    // 本地为空时自动填充云端值
                    if (!localConfig.baseUrl && config.baseUrl) {
                        const cloudBaseUrl = config.baseUrl
                        setLocalConfig((prev) => ({
                            ...prev,
                            baseUrl: cloudBaseUrl,
                        }))
                        localStorage.setItem(
                            STORAGE_KEYS.aiBaseUrl,
                            cloudBaseUrl,
                        )
                    }
                    if (!localConfig.modelId && config.modelId) {
                        const cloudModelId = config.modelId
                        setLocalConfig((prev) => ({
                            ...prev,
                            modelId: cloudModelId,
                        }))
                        localStorage.setItem(STORAGE_KEYS.aiModel, cloudModelId)
                    }
                } else {
                    setCloudConfig({})
                }
            } catch (error) {
                console.error("Failed to load cloud config:", error)
                setCloudConfig({})
            } finally {
                setIsLoadingCloud(false)
            }
        },
        [session, utils, localConfig.baseUrl, localConfig.modelId],
    )

    // Provider 变更时触发云端加载
    useEffect(() => {
        if (localConfig.provider) {
            loadCloudConfig(localConfig.provider)
        }
    }, [localConfig.provider, loadCloudConfig])

    const updateProvider = useCallback((value: string) => {
        setLocalConfig((prev) => ({ ...prev, provider: value }))
        localStorage.setItem(STORAGE_KEYS.aiProvider, value)
        // 清空云端配置，等待重新加载
        setCloudConfig({})
    }, [])

    const updateBaseUrl = useCallback((value: string) => {
        setLocalConfig((prev) => ({ ...prev, baseUrl: value }))
        localStorage.setItem(STORAGE_KEYS.aiBaseUrl, value)
    }, [])

    const updateApiKey = useCallback((value: string) => {
        setLocalConfig((prev) => ({ ...prev, apiKey: value }))
        localStorage.setItem(STORAGE_KEYS.aiApiKey, value)
    }, [])

    const updateModelId = useCallback((value: string) => {
        setLocalConfig((prev) => ({ ...prev, modelId: value }))
        localStorage.setItem(STORAGE_KEYS.aiModel, value)
    }, [])

    const clearConfig = useCallback(() => {
        const emptyConfig: AIProviderConfig = {
            provider: "",
            baseUrl: "",
            apiKey: "",
            modelId: "",
        }
        setLocalConfig(emptyConfig)
        setCloudConfig({})
        localStorage.removeItem(STORAGE_KEYS.aiProvider)
        localStorage.removeItem(STORAGE_KEYS.aiBaseUrl)
        localStorage.removeItem(STORAGE_KEYS.aiApiKey)
        localStorage.removeItem(STORAGE_KEYS.aiModel)
    }, [])

    return {
        localConfig,
        cloudConfig,
        isLoadingCloud,
        updateProvider,
        updateBaseUrl,
        updateApiKey,
        updateModelId,
        clearConfig,
        reloadCloudConfig: () => loadCloudConfig(localConfig.provider),
        hasLocalConfig: Boolean(localConfig.provider && localConfig.apiKey),
        hasCloudConfig: Boolean(
            cloudConfig.baseUrl ||
                cloudConfig.modelId ||
                cloudConfig.apiKeyPreview,
        ),
        isLoggedIn: Boolean(session?.user),
    }
}
