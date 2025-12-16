"use client"

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
import { useCloudSync, useModelSelector } from "./hooks"
import { AboutTab, InterfaceTab, ModelConfigTab } from "./tabs"

// Re-export storage keys for backward compatibility
export const STORAGE_ACCESS_CODE_KEY = STORAGE_KEYS.accessCode
export const STORAGE_CLOSE_PROTECTION_KEY = STORAGE_KEYS.closeProtection
export const STORAGE_AI_PROVIDER_KEY = STORAGE_KEYS.aiProvider
export const STORAGE_AI_BASE_URL_KEY = STORAGE_KEYS.aiBaseUrl
export const STORAGE_AI_API_KEY_KEY = STORAGE_KEYS.aiApiKey
export const STORAGE_AI_MODEL_KEY = STORAGE_KEYS.aiModel

interface SettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCloseProtectionChange?: (enabled: boolean) => void
    drawioUi: "min" | "sketch"
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

    // Access code state
    const [accessCode, setAccessCode] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)
    const [accessCodeError, setAccessCodeError] = useState("")
    const [accessCodeRequired, setAccessCodeRequired] = useState(
        () => getStoredAccessCodeRequired() ?? false,
    )

    // Local provider config state
    const [provider, setProvider] = useState("")
    const [baseUrl, setBaseUrl] = useState("")
    const [apiKey, setApiKey] = useState("")
    const [modelId, setModelId] = useState("")

    // Interface state
    const [closeProtection, setCloseProtection] = useState(true)

    // Cloud sync hook
    const cloudSync = useCloudSync({
        provider,
        apiKey,
        baseUrl,
        modelId,
        onConfigRestored: (config) => {
            if (config.baseUrl) {
                setBaseUrl(config.baseUrl)
                localStorage.setItem(STORAGE_KEYS.aiBaseUrl, config.baseUrl)
            }
            if (config.modelId) {
                setModelId(config.modelId)
                localStorage.setItem(STORAGE_KEYS.aiModel, config.modelId)
            }
        },
    })

    // Model selector hook
    const modelSelector = useModelSelector({
        provider,
        apiKey,
        baseUrl,
        isDialogOpen: open,
    })

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

        // Load from localStorage
        setAccessCode(localStorage.getItem(STORAGE_KEYS.accessCode) || "")
        setCloseProtection(
            localStorage.getItem(STORAGE_KEYS.closeProtection) !== "false",
        )

        const localProvider =
            localStorage.getItem(STORAGE_KEYS.aiProvider) || ""
        const localBaseUrl = localStorage.getItem(STORAGE_KEYS.aiBaseUrl) || ""
        const localApiKey = localStorage.getItem(STORAGE_KEYS.aiApiKey) || ""
        const localModelId = localStorage.getItem(STORAGE_KEYS.aiModel) || ""

        setProvider(localProvider)
        setBaseUrl(localBaseUrl)
        setApiKey(localApiKey)
        setModelId(localModelId)
        setAccessCodeError("")

        // Load cloud config
        cloudSync.clearCloudConfigState()
        if (localProvider && localProvider !== "default") {
            cloudSync.loadCloudConfig(localProvider).then((config) => {
                if (config) {
                    // Auto-fill from cloud if local is empty
                    if (!localBaseUrl && config.baseUrl) {
                        setBaseUrl(config.baseUrl)
                        localStorage.setItem(
                            STORAGE_KEYS.aiBaseUrl,
                            config.baseUrl,
                        )
                    }
                    if (!localModelId && config.modelId) {
                        setModelId(config.modelId)
                        localStorage.setItem(
                            STORAGE_KEYS.aiModel,
                            config.modelId,
                        )
                    }
                }
            })
        }
    }, [open])

    // Handle provider change
    const handleProviderChange = useCallback(
        async (value: string) => {
            setProvider(value)
            localStorage.setItem(STORAGE_KEYS.aiProvider, value)

            cloudSync.clearCloudConfigState()
            if (value && cloudSync.isLoggedIn) {
                const config = await cloudSync.loadCloudConfig(value)
                if (config) {
                    if (!baseUrl && config.baseUrl) {
                        setBaseUrl(config.baseUrl)
                        localStorage.setItem(
                            STORAGE_KEYS.aiBaseUrl,
                            config.baseUrl,
                        )
                    }
                    if (!modelId && config.modelId) {
                        setModelId(config.modelId)
                        localStorage.setItem(
                            STORAGE_KEYS.aiModel,
                            config.modelId,
                        )
                    }
                }
            }
        },
        [baseUrl, modelId, cloudSync],
    )

    // Handle field changes with auto-sync
    const handleApiKeyChange = useCallback(
        (value: string) => {
            setApiKey(value)
            localStorage.setItem(STORAGE_KEYS.aiApiKey, value)
            if (value && baseUrl && provider && cloudSync.isLoggedIn) {
                cloudSync.syncOnChange()
            }
        },
        [baseUrl, provider, cloudSync],
    )

    const handleBaseUrlChange = useCallback(
        (value: string) => {
            setBaseUrl(value)
            localStorage.setItem(STORAGE_KEYS.aiBaseUrl, value)
            if (apiKey && value && provider && cloudSync.isLoggedIn) {
                cloudSync.syncOnChange()
            }
        },
        [apiKey, provider, cloudSync],
    )

    const handleModelIdChange = useCallback((value: string) => {
        setModelId(value)
        localStorage.setItem(STORAGE_KEYS.aiModel, value)
    }, [])

    const handleSelectModel = useCallback(
        (id: string) => {
            setModelId(id)
            localStorage.setItem(STORAGE_KEYS.aiModel, id)
            modelSelector.closeModelMenu()
        },
        [modelSelector],
    )

    // Clear all config
    const handleClearConfig = useCallback(() => {
        localStorage.removeItem(STORAGE_KEYS.aiProvider)
        localStorage.removeItem(STORAGE_KEYS.aiBaseUrl)
        localStorage.removeItem(STORAGE_KEYS.aiApiKey)
        localStorage.removeItem(STORAGE_KEYS.aiModel)

        const currentProvider = provider
        setProvider("")
        setBaseUrl("")
        setApiKey("")
        setModelId("")

        if (cloudSync.isLoggedIn && currentProvider) {
            cloudSync.deleteCloudConfig()
        }
    }, [provider, cloudSync])

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
                            baseUrl={baseUrl}
                            onBaseUrlChange={handleBaseUrlChange}
                            apiKey={apiKey}
                            onApiKeyChange={handleApiKeyChange}
                            modelId={modelId}
                            onModelIdChange={handleModelIdChange}
                            onClearConfig={handleClearConfig}
                            cloudConfig={cloudSync.cloudConfig}
                            isLoggedIn={cloudSync.isLoggedIn}
                            syncSuccess={cloudSync.syncSuccess}
                            restoreSuccess={cloudSync.restoreSuccess}
                            isRestoring={cloudSync.isRestoring}
                            isSyncing={cloudSync.isSyncing}
                            isDeleting={cloudSync.isDeleting}
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
