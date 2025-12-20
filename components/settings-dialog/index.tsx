"use client"

import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/contexts/i18n-context"
import { STORAGE_KEYS } from "@/lib/storage"
import {
    type CloudConfig,
    useCloudSync,
    useModelSelector,
    useProviderCatalog,
} from "./hooks"
import { AboutTab, InterfaceTab, ModelConfigTab } from "./tabs"

// Re-export storage keys for backward compatibility
export const STORAGE_ACCESS_CODE_KEY = STORAGE_KEYS.accessCode
export const STORAGE_CLOSE_PROTECTION_KEY = STORAGE_KEYS.closeProtection
export const STORAGE_AI_PROVIDER_KEY = STORAGE_KEYS.aiProvider
export const STORAGE_AI_PROVIDER_CONNECTION_KEY =
    STORAGE_KEYS.aiProviderConnection
export const STORAGE_AI_BASE_URL_KEY = STORAGE_KEYS.aiBaseUrl
export const STORAGE_AI_API_KEY_KEY = STORAGE_KEYS.aiApiKey
export const STORAGE_AI_MODEL_KEY = STORAGE_KEYS.aiModel

interface SettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCloseProtectionChange?: (enabled: boolean) => void
    drawioUi: "kennedy" | "atlas"
    onToggleDrawioUi: () => void
    darkMode: boolean
    onToggleDarkMode: () => void
}

function getStoredAccessCodeRequired(): boolean | null {
    if (typeof window === "undefined") return null
    const stored = localStorage.getItem(STORAGE_KEYS.accessCodeRequired)
    if (stored === null) return null
    return stored === "true"
}

export function SettingsDialog({
    open,
    onOpenChange,
    onCloseProtectionChange,
    drawioUi,
    onToggleDrawioUi,
    darkMode,
    onToggleDarkMode,
}: SettingsDialogProps) {
    const { t } = useI18n()
    const { data: session } = useSession()
    const isLoggedIn = Boolean(session?.user)

    // Access code state
    const [accessCode, setAccessCode] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)
    const [accessCodeError, setAccessCodeError] = useState("")
    const [accessCodeRequired, setAccessCodeRequired] = useState(
        () => getStoredAccessCodeRequired() ?? false,
    )

    // Provider config state
    const [provider, setProvider] = useState("")
    const [connectionName, setConnectionName] = useState("default")
    const [connectionIsDefault, setConnectionIsDefault] = useState(true)
    const [baseUrl, setBaseUrl] = useState("")
    const [apiKey, setApiKey] = useState("")
    const [modelId, setModelId] = useState("")
    const [isLoadingConfig, setIsLoadingConfig] = useState(false)
    const [allCloudConnections, setAllCloudConnections] = useState<
        CloudConfig[]
    >([])

    // Interface state
    const [closeProtection, setCloseProtection] = useState(true)

    // Check if current provider has cloud config (for sync logic)
    const providerHasCloudConfigRef = allCloudConnections.some(
        (conn) => conn.provider === provider,
    )

    // Cloud sync hook
    const cloudSync = useCloudSync({
        provider,
        connectionName,
        isDefault: connectionIsDefault,
        apiKey,
        baseUrl,
        modelId,
        hasCloudConfig: providerHasCloudConfigRef,
        onConfigRestored: (config) => {
            if (config.baseUrl) {
                setBaseUrl(config.baseUrl)
                // Only save to localStorage for non-logged-in users
                if (!isLoggedIn) {
                    localStorage.setItem(STORAGE_KEYS.aiBaseUrl, config.baseUrl)
                }
            }
            if (config.modelId) {
                setModelId(config.modelId)
                if (!isLoggedIn) {
                    localStorage.setItem(STORAGE_KEYS.aiModel, config.modelId)
                }
            }
        },
    })

    // Model selector hook
    const modelSelector = useModelSelector({
        provider,
        apiKey,
        baseUrl,
        isDialogOpen: open,
        isLoggedIn,
        hasCloudConfig: providerHasCloudConfigRef,
    })

    // Provider catalog hook (数据库驱动)
    const providerCatalog = useProviderCatalog()

    // Fetch access code requirement on mount
    useEffect(() => {
        if (getStoredAccessCodeRequired() !== null) return

        fetch("/api/config")
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.json()
            })
            .then((data) => {
                const required = data?.accessCodeRequired === true
                localStorage.setItem(
                    STORAGE_KEYS.accessCodeRequired,
                    String(required),
                )
                setAccessCodeRequired(required)
            })
            .catch(() => {
                setAccessCodeRequired(false)
            })
    }, [])

    // Load settings when dialog opens
    useEffect(() => {
        if (!open) return

        // Access code and interface settings always use localStorage
        setAccessCode(localStorage.getItem(STORAGE_KEYS.accessCode) || "")
        setCloseProtection(
            localStorage.getItem(STORAGE_KEYS.closeProtection) !== "false",
        )
        setAccessCodeError("")

        if (isLoggedIn) {
            // Logged-in users: Load from cloud only
            setIsLoadingConfig(true)
            cloudSync.clearCloudConfigState()

            // Load all connections first
            cloudSync
                .loadConnections()
                .then(async (connections) => {
                    // Save all connections for provider switching
                    setAllCloudConnections(connections)

                    // Find default connection or first connection
                    const defaultConn = connections.find((c) => c.isDefault)
                    const firstConn = connections[0]
                    const targetConn = defaultConn || firstConn

                    if (targetConn) {
                        setProvider(targetConn.provider || "")
                        setConnectionName(targetConn.name || "default")
                        setConnectionIsDefault(!!targetConn.isDefault)
                        setBaseUrl(targetConn.baseUrl || "")
                        setModelId(targetConn.modelId || "")
                        // API key is not returned from cloud for security
                        setApiKey("")

                        // Load full config and filtered connections for this provider
                        if (targetConn.provider) {
                            await cloudSync.loadConnections(targetConn.provider)
                            await cloudSync.loadCloudConfig(
                                targetConn.provider,
                                targetConn.name,
                            )
                        }
                    } else {
                        // No cloud config, reset to defaults
                        setProvider("")
                        setConnectionName("default")
                        setConnectionIsDefault(true)
                        setBaseUrl("")
                        setApiKey("")
                        setModelId("")
                    }
                })
                .finally(() => {
                    setIsLoadingConfig(false)
                })
        } else {
            // Non-logged-in users: Load from localStorage
            const localProvider =
                localStorage.getItem(STORAGE_KEYS.aiProvider) || ""
            const localConnection =
                localStorage.getItem(STORAGE_KEYS.aiProviderConnection) ||
                "default"
            const localBaseUrl =
                localStorage.getItem(STORAGE_KEYS.aiBaseUrl) || ""
            const localApiKey =
                localStorage.getItem(STORAGE_KEYS.aiApiKey) || ""
            const localModelId =
                localStorage.getItem(STORAGE_KEYS.aiModel) || ""

            setProvider(localProvider)
            setConnectionName(localConnection)
            setConnectionIsDefault(localConnection === "default")
            setBaseUrl(localBaseUrl)
            setApiKey(localApiKey)
            setModelId(localModelId)
        }
    }, [open, isLoggedIn])

    // Handle provider change
    const handleProviderChange = useCallback(
        async (value: string) => {
            setProvider(value)
            setConnectionName("default")
            setConnectionIsDefault(true)

            // Clear form fields first
            setApiKey("")
            setBaseUrl("")
            setModelId("")

            // Always update localStorage for provider selection (both logged-in and non-logged-in)
            // This ensures getAIConfig() returns correct value for building request headers
            if (value) {
                localStorage.setItem(STORAGE_KEYS.aiProvider, value)
            } else {
                localStorage.removeItem(STORAGE_KEYS.aiProvider)
            }
            localStorage.setItem(STORAGE_KEYS.aiProviderConnection, "default")

            if (isLoggedIn) {
                // Logged-in: Load cloud config for new provider
                cloudSync.clearCloudConfigState()
                if (value) {
                    // Find config from all saved connections
                    const providerConnections = allCloudConnections.filter(
                        (conn) => conn.provider === value,
                    )
                    const defaultConfig =
                        providerConnections.find((c) => c.isDefault) ||
                        providerConnections.find((c) => c.name === "default") ||
                        providerConnections[0]

                    if (defaultConfig) {
                        // Fill form from existing connection
                        setConnectionName(defaultConfig.name || "default")
                        setConnectionIsDefault(!!defaultConfig.isDefault)
                        setBaseUrl(defaultConfig.baseUrl || "")
                        setModelId(defaultConfig.modelId || "")
                    }

                    // Load connections for this provider (for advanced options)
                    await cloudSync.loadConnections(value)
                    await cloudSync.loadCloudConfig(
                        value,
                        defaultConfig?.name || "default",
                    )
                }
            } else {
                // Non-logged-in: Also clear API key/baseUrl/model from localStorage
                localStorage.removeItem(STORAGE_KEYS.aiApiKey)
                localStorage.removeItem(STORAGE_KEYS.aiBaseUrl)
                localStorage.removeItem(STORAGE_KEYS.aiModel)
            }
        },
        [isLoggedIn, cloudSync, allCloudConnections],
    )

    const handleConnectionNameChange = useCallback(
        (value: string) => {
            setConnectionName(value)
            if (value === "default") {
                setConnectionIsDefault(true)
            }

            if (!isLoggedIn) {
                localStorage.setItem(STORAGE_KEYS.aiProviderConnection, value)
            }
            cloudSync.clearCloudConfigState()
        },
        [isLoggedIn, cloudSync],
    )

    const handleSelectCloudConnection = useCallback(
        async (value: string) => {
            if (!value) return
            setConnectionName(value)

            const selected = cloudSync.connections.find(
                (config) => config.name === value,
            )
            if (selected) {
                setConnectionIsDefault(!!selected.isDefault)
                if (selected.baseUrl) {
                    setBaseUrl(selected.baseUrl)
                }
                if (selected.modelId) {
                    setModelId(selected.modelId)
                }
            }

            if (!isLoggedIn) {
                localStorage.setItem(STORAGE_KEYS.aiProviderConnection, value)
                if (selected?.baseUrl) {
                    localStorage.setItem(
                        STORAGE_KEYS.aiBaseUrl,
                        selected.baseUrl,
                    )
                }
                if (selected?.modelId) {
                    localStorage.setItem(STORAGE_KEYS.aiModel, selected.modelId)
                }
            }

            if (provider) {
                cloudSync.loadCloudConfig(provider, value)
            }
        },
        [cloudSync, provider, isLoggedIn],
    )

    const handleConnectionDefaultChange = useCallback((value: boolean) => {
        setConnectionIsDefault(value)
    }, [])

    // Handle field changes - auto-sync for logged-in users
    const handleApiKeyChange = useCallback(
        (value: string) => {
            setApiKey(value)

            if (isLoggedIn) {
                // Logged-in: Auto-sync to cloud when we have required fields
                if (value && provider) {
                    cloudSync.syncOnChange()
                }
            } else {
                // Non-logged-in: Save to localStorage
                localStorage.setItem(STORAGE_KEYS.aiApiKey, value)
            }
        },
        [isLoggedIn, provider, cloudSync],
    )

    const handleBaseUrlChange = useCallback(
        (value: string) => {
            setBaseUrl(value)

            if (isLoggedIn) {
                // Logged-in: Auto-sync to cloud
                if (apiKey && provider) {
                    cloudSync.syncOnChange()
                }
            } else {
                // Non-logged-in: Save to localStorage
                localStorage.setItem(STORAGE_KEYS.aiBaseUrl, value)
            }
        },
        [isLoggedIn, apiKey, provider, cloudSync],
    )

    const handleModelIdChange = useCallback(
        (value: string) => {
            setModelId(value)

            if (isLoggedIn) {
                // Logged-in: Auto-sync to cloud
                if (apiKey && provider) {
                    cloudSync.syncOnChange()
                }
            } else {
                // Non-logged-in: Save to localStorage
                localStorage.setItem(STORAGE_KEYS.aiModel, value)
            }
        },
        [isLoggedIn, apiKey, provider, cloudSync],
    )

    const handleSelectModel = useCallback(
        (id: string) => {
            setModelId(id)

            if (isLoggedIn) {
                if (apiKey && provider) {
                    cloudSync.syncOnChange()
                }
            } else {
                localStorage.setItem(STORAGE_KEYS.aiModel, id)
            }

            modelSelector.closeModelMenu()
        },
        [isLoggedIn, apiKey, provider, cloudSync, modelSelector],
    )

    // Clear all config
    const handleClearConfig = useCallback(() => {
        const currentProvider = provider

        // Reset state
        setProvider("")
        setConnectionName("default")
        setConnectionIsDefault(true)
        setBaseUrl("")
        setApiKey("")
        setModelId("")

        if (isLoggedIn) {
            // Logged-in: Delete from cloud only
            if (currentProvider) {
                cloudSync.deleteCloudConfig()
            }
        } else {
            // Non-logged-in: Clear localStorage
            localStorage.removeItem(STORAGE_KEYS.aiProvider)
            localStorage.removeItem(STORAGE_KEYS.aiProviderConnection)
            localStorage.removeItem(STORAGE_KEYS.aiBaseUrl)
            localStorage.removeItem(STORAGE_KEYS.aiApiKey)
            localStorage.removeItem(STORAGE_KEYS.aiModel)
        }
    }, [provider, isLoggedIn, cloudSync])

    // Access code save
    const handleAccessCodeSave = async () => {
        if (!accessCodeRequired) return

        setAccessCodeError("")
        setIsVerifying(true)

        try {
            const response = await fetch("/api/verify-access-code", {
                method: "POST",
                headers: { "x-access-code": accessCode.trim() },
            })

            const data = await response.json()

            if (!data.valid) {
                setAccessCodeError(
                    data.message || t("settings.accessCode.invalid"),
                )
                return
            }

            localStorage.setItem(STORAGE_KEYS.accessCode, accessCode.trim())
            onOpenChange(false)
        } catch {
            setAccessCodeError(t("settings.accessCode.verifyFailed"))
        } finally {
            setIsVerifying(false)
        }
    }

    // Close protection change
    const handleCloseProtectionChange = useCallback(
        (checked: boolean) => {
            setCloseProtection(checked)
            localStorage.setItem(
                STORAGE_KEYS.closeProtection,
                checked.toString(),
            )
            onCloseProtectionChange?.(checked)
        },
        [onCloseProtectionChange],
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[640px] h-[750px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t("dialog.settings.title")}</DialogTitle>
                    <DialogDescription>
                        {t("dialog.settings.description")}
                    </DialogDescription>
                </DialogHeader>
                <Tabs
                    defaultValue="model"
                    className="w-full flex-1 flex flex-col overflow-hidden"
                >
                    <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
                        <TabsTrigger value="model">
                            {t("settings.tabs.model")}
                        </TabsTrigger>
                        <TabsTrigger value="interface">
                            {t("settings.tabs.interface")}
                        </TabsTrigger>
                        <TabsTrigger value="about">
                            {t("settings.tabs.about")}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent
                        value="model"
                        className="space-y-4 py-2 overflow-y-auto flex-1"
                    >
                        <ModelConfigTab
                            accessCodeRequired={accessCodeRequired}
                            accessCode={accessCode}
                            onAccessCodeChange={setAccessCode}
                            onAccessCodeSave={handleAccessCodeSave}
                            isVerifyingAccessCode={isVerifying}
                            accessCodeError={accessCodeError}
                            provider={provider}
                            onProviderChange={handleProviderChange}
                            providerOptions={providerCatalog.providerOptions}
                            isLoadingProviders={
                                providerCatalog.isLoading || isLoadingConfig
                            }
                            getModelPlaceholder={
                                providerCatalog.getModelPlaceholder
                            }
                            getBaseUrlPlaceholder={
                                providerCatalog.getBaseUrlPlaceholder
                            }
                            connectionName={connectionName}
                            onConnectionNameChange={handleConnectionNameChange}
                            onSelectCloudConnection={
                                handleSelectCloudConnection
                            }
                            connectionIsDefault={connectionIsDefault}
                            onConnectionDefaultChange={
                                handleConnectionDefaultChange
                            }
                            baseUrl={baseUrl}
                            onBaseUrlChange={handleBaseUrlChange}
                            apiKey={apiKey}
                            onApiKeyChange={handleApiKeyChange}
                            modelId={modelId}
                            onModelIdChange={handleModelIdChange}
                            onClearConfig={handleClearConfig}
                            cloudConfig={cloudSync.cloudConfig}
                            isLoggedIn={isLoggedIn}
                            syncSuccess={cloudSync.syncSuccess}
                            restoreSuccess={cloudSync.restoreSuccess}
                            isRestoring={cloudSync.isRestoring}
                            isSyncing={cloudSync.isSyncing}
                            isDeleting={cloudSync.isDeleting}
                            isLoadingConnections={
                                cloudSync.isLoadingConnections
                            }
                            cloudConnections={cloudSync.connections}
                            allCloudConnections={allCloudConnections}
                            hasCloudConfig={cloudSync.hasCloudConfig}
                            onSyncToCloud={cloudSync.syncToCloud}
                            onRestoreFromCloud={cloudSync.restoreFromCloud}
                            modelOptions={modelSelector.modelOptions}
                            isLoadingModels={modelSelector.isLoadingModels}
                            isModelMenuOpen={modelSelector.isModelMenuOpen}
                            onOpenModelMenu={modelSelector.openModelMenu}
                            onCloseModelMenuDelayed={
                                modelSelector.closeModelMenuDelayed
                            }
                            onToggleModelMenu={modelSelector.toggleModelMenu}
                            onSelectModel={handleSelectModel}
                            filterModels={modelSelector.filterModels}
                        />
                    </TabsContent>

                    <TabsContent
                        value="interface"
                        className="space-y-4 py-2 overflow-y-auto flex-1"
                    >
                        <InterfaceTab
                            darkMode={darkMode}
                            onToggleDarkMode={onToggleDarkMode}
                            drawioUi={drawioUi}
                            onToggleDrawioUi={onToggleDrawioUi}
                            closeProtection={closeProtection}
                            onCloseProtectionChange={
                                handleCloseProtectionChange
                            }
                        />
                    </TabsContent>

                    <TabsContent
                        value="about"
                        className="space-y-6 py-2 overflow-y-auto flex-1"
                    >
                        <AboutTab />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
