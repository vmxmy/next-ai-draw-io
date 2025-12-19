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
    connectionName: string
    isDefault: boolean
    apiKey: string
    baseUrl: string
    modelId: string
    onConfigRestored?: (config: { baseUrl?: string; modelId?: string }) => void
    onCloudConfigLoaded?: (config: CloudConfig) => void
    onConnectionsLoaded?: (configs: CloudConfig[]) => void
}

export function useCloudSync(options: UseCloudSyncOptions) {
    const {
        provider,
        connectionName,
        isDefault,
        apiKey,
        baseUrl,
        modelId,
        onConfigRestored,
        onCloudConfigLoaded,
        onConnectionsLoaded,
    } = options

    const { data: session } = useSession()
    const utils = api.useUtils()

    const [cloudConfig, setCloudConfig] = useState<CloudConfig>({})
    const [connections, setConnections] = useState<CloudConfig[]>([])
    const [syncSuccess, setSyncSuccess] = useState(false)
    const [restoreSuccess, setRestoreSuccess] = useState(false)
    const [isRestoring, setIsRestoring] = useState(false)
    const [isLoadingConnections, setIsLoadingConnections] = useState(false)

    const upsertConfigMutation = api.providerConfig.upsert.useMutation()
    const deleteConfigMutation = api.providerConfig.delete.useMutation()

    // Load cloud config for a provider
    const loadCloudConfig = useCallback(
        async (targetProvider: string, targetName?: string) => {
            if (!session?.user || !targetProvider) {
                setCloudConfig({})
                return null
            }

            try {
                const config = await utils.providerConfig.get.fetch({
                    provider: targetProvider as ProviderType,
                    ...(targetName ? { name: targetName } : {}),
                })

                if (config) {
                    const newCloudConfig: CloudConfig = {
                        provider: config.provider,
                        name: config.name,
                        isDefault: config.isDefault,
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

    const loadConnections = useCallback(
        async (targetProvider?: string) => {
            if (!session?.user) {
                setConnections([])
                return []
            }
            setIsLoadingConnections(true)
            try {
                const configs = await utils.providerConfig.getAll.fetch()
                const filtered = targetProvider
                    ? configs.filter(
                          (config) => config.provider === targetProvider,
                      )
                    : configs
                setConnections(filtered)
                onConnectionsLoaded?.(filtered)
                return filtered
            } catch (error) {
                console.error("Failed to load cloud connections:", error)
                setConnections([])
                return []
            } finally {
                setIsLoadingConnections(false)
            }
        },
        [session, utils, onConnectionsLoaded],
    )

    // Sync current config to cloud
    const syncToCloud = useCallback(() => {
        if (!session?.user || !provider || !apiKey) {
            return
        }

        upsertConfigMutation.mutate(
            {
                provider: provider as ProviderType,
                name: connectionName || "default",
                isDefault,
                apiKey,
                baseUrl: baseUrl || undefined,
                modelId: modelId || undefined,
            },
            {
                onSuccess: () => {
                    console.log("[settings] Synced to cloud:", provider)
                    loadConnections(provider)
                    setSyncSuccess(true)
                    setTimeout(() => setSyncSuccess(false), 2000)
                },
            },
        )
    }, [
        session,
        provider,
        connectionName,
        isDefault,
        apiKey,
        baseUrl,
        modelId,
        upsertConfigMutation,
        loadConnections,
    ])

    // Sync on field change (auto-sync when apiKey is present)
    const syncOnChange = useCallback(() => {
        if (session?.user && provider && apiKey) {
            upsertConfigMutation.mutate(
                {
                    provider: provider as ProviderType,
                    name: connectionName || "default",
                    isDefault,
                    apiKey,
                    baseUrl: baseUrl || undefined,
                    modelId: modelId || undefined,
                },
                {
                    onSuccess: () => {
                        console.log(
                            "[settings] Config synced to cloud (apiKey + baseUrl)",
                        )
                        loadConnections(provider)
                    },
                },
            )
        }
    }, [
        session,
        provider,
        connectionName,
        isDefault,
        apiKey,
        baseUrl,
        modelId,
        upsertConfigMutation,
        loadConnections,
    ])

    // Restore config from cloud
    const restoreFromCloud = useCallback(async () => {
        if (!session?.user || !provider) {
            return
        }

        setIsRestoring(true)
        try {
            const config = await utils.providerConfig.get.fetch({
                provider: provider as ProviderType,
                ...(connectionName ? { name: connectionName } : {}),
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
    }, [session, provider, connectionName, utils, onConfigRestored])

    // Delete cloud config
    const deleteCloudConfig = useCallback(() => {
        if (!session?.user || !provider) {
            return
        }

        setCloudConfig({})

        deleteConfigMutation.mutate(
            {
                provider: provider as ProviderType,
                ...(connectionName ? { name: connectionName } : {}),
            },
            {
                onSuccess: () => {
                    console.log(
                        "[settings] Cloud config cleared for provider:",
                        provider,
                    )
                    loadConnections(provider)
                },
                onError: (error) => {
                    console.error(
                        "[settings] Failed to clear cloud config:",
                        error,
                    )
                },
            },
        )
    }, [
        session,
        provider,
        connectionName,
        deleteConfigMutation,
        loadConnections,
    ])

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
        isLoadingConnections,
        connections,

        // Actions
        loadCloudConfig,
        loadConnections,
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
