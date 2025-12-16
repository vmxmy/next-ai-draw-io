import { useSession } from "next-auth/react"
import { useCallback, useState } from "react"
import { api } from "@/lib/trpc/client"
import type { CloudConfig, ProviderType } from "./use-ai-provider-config"

export interface CloudSyncState {
    syncSuccess: boolean
    restoreSuccess: boolean
    isRestoring: boolean
    isSyncing: boolean
    isDeleting: boolean
}

export interface UseCloudSyncOptions {
    provider: string
    apiKey: string
    baseUrl: string
    modelId: string
    onConfigRestored?: (config: { baseUrl?: string; modelId?: string }) => void
    onCloudConfigLoaded?: (config: CloudConfig) => void
}

export function useCloudSync(options: UseCloudSyncOptions) {
    const {
        provider,
        apiKey,
        baseUrl,
        modelId,
        onConfigRestored,
        onCloudConfigLoaded,
    } = options

    const { data: session } = useSession()
    const utils = api.useUtils()

    const [cloudConfig, setCloudConfig] = useState<CloudConfig>({})
    const [syncSuccess, setSyncSuccess] = useState(false)
    const [restoreSuccess, setRestoreSuccess] = useState(false)
    const [isRestoring, setIsRestoring] = useState(false)

    const upsertConfigMutation = api.providerConfig.upsert.useMutation()
    const deleteConfigMutation = api.providerConfig.delete.useMutation()

    // Load cloud config for a provider
    const loadCloudConfig = useCallback(
        async (targetProvider: string) => {
            if (!session?.user || !targetProvider) {
                setCloudConfig({})
                return null
            }

            try {
                const config = await utils.providerConfig.get.fetch({
                    provider: targetProvider as ProviderType,
                })

                if (config) {
                    const newCloudConfig: CloudConfig = {
                        apiKeyPreview: config.hasApiKey
                            ? config.apiKeyPreview
                            : undefined,
                        baseUrl: config.baseUrl,
                        modelId: config.modelId,
                    }
                    setCloudConfig(newCloudConfig)
                    onCloudConfigLoaded?.(newCloudConfig)
                    return config
                } else {
                    setCloudConfig({})
                    return null
                }
            } catch (error) {
                console.error("Failed to load cloud config:", error)
                setCloudConfig({})
                return null
            }
        },
        [session, utils, onCloudConfigLoaded],
    )

    // Sync current config to cloud
    const syncToCloud = useCallback(() => {
        if (!session?.user || !provider || !apiKey || !baseUrl) {
            return
        }

        upsertConfigMutation.mutate(
            {
                provider: provider as ProviderType,
                apiKey,
                baseUrl,
                modelId: modelId || undefined,
            },
            {
                onSuccess: () => {
                    console.log("[settings] Synced to cloud:", provider)
                    setSyncSuccess(true)
                    setTimeout(() => setSyncSuccess(false), 2000)
                },
            },
        )
    }, [session, provider, apiKey, baseUrl, modelId, upsertConfigMutation])

    // Sync on field change (auto-sync when both apiKey and baseUrl present)
    const syncOnChange = useCallback(() => {
        if (session?.user && provider && apiKey && baseUrl) {
            upsertConfigMutation.mutate(
                {
                    provider: provider as ProviderType,
                    apiKey,
                    baseUrl,
                    modelId: modelId || undefined,
                },
                {
                    onSuccess: () => {
                        console.log(
                            "[settings] Config synced to cloud (apiKey + baseUrl)",
                        )
                    },
                },
            )
        }
    }, [session, provider, apiKey, baseUrl, modelId, upsertConfigMutation])

    // Restore config from cloud
    const restoreFromCloud = useCallback(async () => {
        if (!session?.user || !provider) {
            return
        }

        setIsRestoring(true)
        try {
            const config = await utils.providerConfig.get.fetch({
                provider: provider as ProviderType,
            })

            if (config) {
                const restored: { baseUrl?: string; modelId?: string } = {}
                if (config.baseUrl) {
                    restored.baseUrl = config.baseUrl
                }
                if (config.modelId) {
                    restored.modelId = config.modelId
                }

                onConfigRestored?.(restored)

                console.log("[settings] Restored from cloud:", provider)
                setRestoreSuccess(true)
                setTimeout(() => setRestoreSuccess(false), 2000)
            } else {
                console.warn("[settings] No cloud config found")
            }
        } catch (error) {
            console.error("Failed to restore from cloud:", error)
        } finally {
            setIsRestoring(false)
        }
    }, [session, provider, utils, onConfigRestored])

    // Delete cloud config
    const deleteCloudConfig = useCallback(() => {
        if (!session?.user || !provider) {
            return
        }

        setCloudConfig({})

        deleteConfigMutation.mutate(
            { provider: provider as ProviderType },
            {
                onSuccess: () => {
                    console.log(
                        "[settings] Cloud config cleared for provider:",
                        provider,
                    )
                },
                onError: (error) => {
                    console.error(
                        "[settings] Failed to clear cloud config:",
                        error,
                    )
                },
            },
        )
    }, [session, provider, deleteConfigMutation])

    // Clear cloud config state (without deleting from server)
    const clearCloudConfigState = useCallback(() => {
        setCloudConfig({})
    }, [])

    return {
        // State
        cloudConfig,
        syncSuccess,
        restoreSuccess,
        isRestoring,
        isSyncing: upsertConfigMutation.isPending,
        isDeleting: deleteConfigMutation.isPending,

        // Actions
        loadCloudConfig,
        syncToCloud,
        syncOnChange,
        restoreFromCloud,
        deleteCloudConfig,
        clearCloudConfigState,

        // Computed
        hasCloudConfig: Boolean(
            cloudConfig.baseUrl ||
                cloudConfig.modelId ||
                cloudConfig.apiKeyPreview,
        ),
        isLoggedIn: Boolean(session?.user),
    }
}
