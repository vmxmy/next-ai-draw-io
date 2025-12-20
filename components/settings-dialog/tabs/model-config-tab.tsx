"use client"

import {
    Check,
    ChevronDown,
    ChevronRight,
    Cloud,
    HardDrive,
    Search,
    Settings2,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/contexts/i18n-context"
import { type AIMode, useAIMode } from "@/lib/use-ai-mode"
import type { CloudConfig, ModelOption } from "../hooks"

interface ProviderOption {
    value: string
    label: string
}

interface ModelConfigTabProps {
    // Access code
    accessCodeRequired: boolean
    accessCode: string
    onAccessCodeChange: (value: string) => void
    onAccessCodeSave: () => void
    isVerifyingAccessCode: boolean
    accessCodeError: string

    // Provider config
    provider: string
    onProviderChange: (value: string) => void
    providerOptions: ProviderOption[]
    isLoadingProviders: boolean
    getModelPlaceholder: (providerKey: string) => string
    getBaseUrlPlaceholder: (providerKey: string) => string
    connectionName: string
    onConnectionNameChange: (value: string) => void
    onSelectCloudConnection: (value: string) => void
    connectionIsDefault: boolean
    onConnectionDefaultChange: (value: boolean) => void
    baseUrl: string
    onBaseUrlChange: (value: string) => void
    apiKey: string
    onApiKeyChange: (value: string) => void
    modelId: string
    onModelIdChange: (value: string) => void
    onClearConfig: () => void

    // Cloud sync
    cloudConfig: CloudConfig
    isLoggedIn: boolean
    syncSuccess: boolean
    restoreSuccess: boolean
    isRestoring: boolean
    isSyncing: boolean
    isDeleting: boolean
    isLoadingConnections: boolean
    cloudConnections: CloudConfig[]
    allCloudConnections: CloudConfig[]
    hasCloudConfig: boolean
    onSyncToCloud: () => void
    onRestoreFromCloud: () => void

    // Model selector
    modelOptions: ModelOption[]
    isLoadingModels: boolean
    isModelMenuOpen: boolean
    onOpenModelMenu: () => void
    onCloseModelMenuDelayed: () => void
    onToggleModelMenu: () => void
    onSelectModel: (modelId: string) => void
    filterModels: (query: string) => ModelOption[]
}

export function ModelConfigTab({
    accessCodeRequired,
    accessCode,
    onAccessCodeChange,
    onAccessCodeSave,
    isVerifyingAccessCode,
    accessCodeError,
    provider,
    onProviderChange,
    providerOptions,
    isLoadingProviders,
    getModelPlaceholder,
    getBaseUrlPlaceholder,
    connectionName,
    onConnectionNameChange,
    onSelectCloudConnection,
    connectionIsDefault,
    onConnectionDefaultChange,
    baseUrl,
    onBaseUrlChange,
    apiKey,
    onApiKeyChange,
    modelId,
    onModelIdChange,
    onClearConfig,
    cloudConfig,
    isLoggedIn,
    syncSuccess,
    restoreSuccess,
    isRestoring,
    isSyncing,
    isDeleting,
    isLoadingConnections,
    cloudConnections,
    allCloudConnections,
    hasCloudConfig,
    onSyncToCloud,
    onRestoreFromCloud,
    modelOptions,
    isLoadingModels,
    isModelMenuOpen,
    onOpenModelMenu,
    onCloseModelMenuDelayed,
    onToggleModelMenu,
    onSelectModel,
    filterModels,
}: ModelConfigTabProps) {
    const { t } = useI18n()
    const [advancedOpen, setAdvancedOpen] = useState(false)

    // AI Mode toggle (for logged-in users)
    const {
        mode: aiMode,
        hasByokConfig,
        isLoading: isModeLoading,
        setMode,
    } = useAIMode()
    const [isSwitchingMode, setIsSwitchingMode] = useState(false)

    // Debug logging for BYOK switch state
    const switchDisabled =
        (aiMode !== "byok" && !hasByokConfig) ||
        isModeLoading ||
        isSwitchingMode
    console.log("[ModelConfigTab] BYOK Switch Debug:", {
        isLoggedIn,
        aiMode,
        hasByokConfig,
        isModeLoading,
        isSwitchingMode,
        switchDisabled,
    })

    const handleModeToggle = async (checked: boolean) => {
        if (!isLoggedIn) return
        setIsSwitchingMode(true)
        try {
            await setMode(checked ? "byok" : "system_default")
        } finally {
            setIsSwitchingMode(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            onAccessCodeSave()
        }
    }

    const filteredModels = filterModels(modelId)
    const baseUrlPlaceholder = getBaseUrlPlaceholder(provider)

    // Get providers that have cloud config (from all connections)
    const providersWithCloudConfig = new Set(
        allCloudConnections.map((conn) => conn.provider).filter(Boolean),
    )

    // Check if advanced options have values (to show indicator)
    const hasAdvancedValues =
        baseUrl || (isLoggedIn && connectionName !== "default")

    return (
        <div className="space-y-4 py-2 overflow-y-auto flex-1">
            {/* AI Mode Toggle (for logged-in users) */}
            {isLoggedIn && (
                <div className="space-y-2 pb-3 border-b">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="ai-mode">
                                {t("settings.aiMode.label")}
                            </Label>
                            <p className="text-[0.8rem] text-muted-foreground">
                                {aiMode === "byok"
                                    ? t("settings.aiMode.byokDescription")
                                    : t("settings.aiMode.systemDescription")}
                            </p>
                        </div>
                        <Switch
                            id="ai-mode"
                            checked={aiMode === "byok"}
                            disabled={
                                // 如果已经是 byok 模式，允许关闭
                                // 只有在非 byok 模式且没有配置时才禁用
                                (aiMode !== "byok" && !hasByokConfig) ||
                                isModeLoading ||
                                isSwitchingMode
                            }
                            onCheckedChange={handleModeToggle}
                        />
                    </div>
                    {aiMode === "byok" && (
                        <p className="text-sm text-emerald-600">
                            {t("settings.aiMode.byokActive")}
                        </p>
                    )}
                    {!hasByokConfig && aiMode !== "byok" && (
                        <p className="text-sm text-muted-foreground">
                            {t("settings.aiMode.noConfig")}
                        </p>
                    )}
                </div>
            )}

            {/* Access Code Section */}
            {accessCodeRequired && (
                <div className="space-y-2 pb-3 border-b">
                    <Label htmlFor="access-code">
                        {t("settings.accessCode.label")}
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="access-code"
                            type="password"
                            value={accessCode}
                            onChange={(e) => onAccessCodeChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t("settings.accessCode.placeholder")}
                            autoComplete="off"
                        />
                        <Button
                            onClick={onAccessCodeSave}
                            disabled={
                                isVerifyingAccessCode || !accessCode.trim()
                            }
                        >
                            {isVerifyingAccessCode
                                ? "..."
                                : t("settings.accessCode.save")}
                        </Button>
                    </div>
                    <p className="text-[0.8rem] text-muted-foreground">
                        {t("settings.accessCode.requiredNote")}
                    </p>
                    {accessCodeError && (
                        <p className="text-[0.8rem] text-destructive">
                            {accessCodeError}
                        </p>
                    )}
                </div>
            )}

            {/* AI Provider Section */}
            <div className="space-y-2">
                <Label>{t("settings.aiProvider.title")}</Label>
                <p className="text-[0.8rem] text-muted-foreground">
                    {t("settings.aiProvider.note")}
                </p>

                {/* Basic Configuration */}
                <div className="space-y-3 pt-2">
                    {/* Provider Select */}
                    <div className="space-y-2">
                        <Label htmlFor="ai-provider">
                            {t("settings.aiProvider.providerLabel")}
                        </Label>
                        <Select
                            value={provider || "default"}
                            onValueChange={(value) => {
                                onProviderChange(
                                    value === "default" ? "" : value,
                                )
                            }}
                        >
                            <SelectTrigger id="ai-provider">
                                <SelectValue
                                    placeholder={t(
                                        "settings.aiProvider.useServerDefault",
                                    )}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">
                                    {t("settings.aiProvider.useServerDefault")}
                                </SelectItem>
                                {isLoadingProviders ? (
                                    <SelectItem value="_loading" disabled>
                                        Loading...
                                    </SelectItem>
                                ) : (
                                    providerOptions.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                {option.label}
                                                {isLoggedIn &&
                                                    providersWithCloudConfig.has(
                                                        option.value,
                                                    ) && (
                                                        <Cloud className="h-3 w-3 text-muted-foreground" />
                                                    )}
                                            </span>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Provider-specific fields */}
                    {provider && provider !== "default" && (
                        <>
                            {/* API Key - Most important, first */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="ai-api-key"
                                    className="flex items-center gap-1.5"
                                >
                                    {t("settings.aiProvider.apiKeyLabel")}
                                    <span className="text-destructive">*</span>
                                    {isLoggedIn &&
                                        (apiKey ? (
                                            <HardDrive className="h-3 w-3 text-muted-foreground" />
                                        ) : cloudConfig.apiKeyPreview ? (
                                            <Cloud className="h-3 w-3 text-muted-foreground" />
                                        ) : null)}
                                </Label>
                                <Input
                                    id="ai-api-key"
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) =>
                                        onApiKeyChange(e.target.value)
                                    }
                                    placeholder={t(
                                        "settings.aiProvider.apiKeyPlaceholder",
                                    )}
                                    autoComplete="off"
                                />
                            </div>

                            {/* Model ID - Second most important */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="ai-model"
                                    className="flex items-center gap-1.5"
                                >
                                    {t("settings.aiProvider.modelIdLabel")}
                                    {isLoggedIn &&
                                        (modelId ? (
                                            <HardDrive className="h-3 w-3 text-muted-foreground" />
                                        ) : cloudConfig.modelId ? (
                                            <Cloud className="h-3 w-3 text-muted-foreground" />
                                        ) : null)}
                                </Label>
                                <div className="relative">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="ai-model"
                                            value={modelId}
                                            onChange={(e) => {
                                                onModelIdChange(e.target.value)
                                                onOpenModelMenu()
                                            }}
                                            onFocus={onOpenModelMenu}
                                            onBlur={onCloseModelMenuDelayed}
                                            placeholder={
                                                getModelPlaceholder(provider) ||
                                                t(
                                                    "settings.aiProvider.modelIdLabel",
                                                )
                                            }
                                            className="pl-8 pr-9"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                            onMouseDown={(e) =>
                                                e.preventDefault()
                                            }
                                            onClick={onToggleModelMenu}
                                        >
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                    {isModelMenuOpen &&
                                        modelOptions.length > 0 && (
                                            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                                                <div className="max-h-56 overflow-auto">
                                                    {filteredModels.map((m) => (
                                                        <button
                                                            key={m.id}
                                                            type="button"
                                                            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                                                            onMouseDown={(e) =>
                                                                e.preventDefault()
                                                            }
                                                            onClick={() =>
                                                                onSelectModel(
                                                                    m.id,
                                                                )
                                                            }
                                                        >
                                                            <span className="truncate">
                                                                {m.id}
                                                            </span>
                                                            {m.label && (
                                                                <span className="ml-2 max-w-[45%] truncate text-xs text-muted-foreground">
                                                                    {m.label}
                                                                </span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                </div>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    {isLoadingModels
                                        ? t("settings.aiProvider.modelsLoading")
                                        : modelOptions.length > 0
                                          ? t(
                                                "settings.aiProvider.modelsCount",
                                                {
                                                    count: modelOptions.length,
                                                },
                                            )
                                          : apiKey
                                            ? ""
                                            : t(
                                                  "settings.aiProvider.modelsHint",
                                              )}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2">
                                {/* Sync to Cloud Button - 允许：1) 有新 apiKey  2) 云端已有配置  3) 创建新连接 */}
                                {isLoggedIn &&
                                    provider &&
                                    (apiKey ||
                                        hasCloudConfig ||
                                        (connectionName &&
                                            connectionName !== "default")) && (
                                        <Button
                                            variant={
                                                syncSuccess
                                                    ? "outline"
                                                    : "default"
                                            }
                                            size="sm"
                                            className="flex-1"
                                            disabled={isSyncing || syncSuccess}
                                            onClick={onSyncToCloud}
                                        >
                                            {syncSuccess ? (
                                                <>
                                                    <Check className="h-4 w-4 mr-2 text-green-600" />
                                                    {t(
                                                        "settings.aiProvider.synced",
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <Cloud className="h-4 w-4 mr-2" />
                                                    {isSyncing
                                                        ? t(
                                                              "settings.aiProvider.syncing",
                                                          )
                                                        : t(
                                                              "settings.aiProvider.syncToCloud",
                                                          )}
                                                </>
                                            )}
                                        </Button>
                                    )}

                                {/* Restore from Cloud Button */}
                                {isLoggedIn && provider && hasCloudConfig && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        disabled={isRestoring || restoreSuccess}
                                        onClick={onRestoreFromCloud}
                                    >
                                        {restoreSuccess ? (
                                            <>
                                                <Check className="h-4 w-4 mr-2 text-green-600" />
                                                {t(
                                                    "settings.aiProvider.restored",
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <HardDrive className="h-4 w-4 mr-2" />
                                                {isRestoring
                                                    ? t(
                                                          "settings.aiProvider.restoring",
                                                      )
                                                    : t(
                                                          "settings.aiProvider.restoreFromCloud",
                                                      )}
                                            </>
                                        )}
                                    </Button>
                                )}

                                {/* Clear Config Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={
                                        isLoggedIn &&
                                        provider &&
                                        (apiKey || hasCloudConfig)
                                            ? ""
                                            : "flex-1"
                                    }
                                    onClick={onClearConfig}
                                >
                                    {t("settings.aiProvider.clear")}
                                    {isLoggedIn && isDeleting && (
                                        <Cloud className="ml-2 h-3 w-3 animate-pulse" />
                                    )}
                                </Button>
                            </div>

                            {/* Advanced Options - Collapsible */}
                            <Collapsible
                                open={advancedOpen}
                                onOpenChange={setAdvancedOpen}
                                className="pt-2"
                            >
                                <CollapsibleTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                                    >
                                        {advancedOpen ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                        <Settings2 className="h-4 w-4" />
                                        {t(
                                            "settings.aiProvider.advancedOptions",
                                        )}
                                        {hasAdvancedValues && !advancedOpen && (
                                            <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
                                        )}
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-3 pt-3">
                                    {/* Base URL */}
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="ai-base-url"
                                            className="flex items-center gap-1.5"
                                        >
                                            {t(
                                                "settings.aiProvider.baseUrlLabel",
                                            )}
                                            {isLoggedIn &&
                                                (baseUrl ? (
                                                    <HardDrive className="h-3 w-3 text-muted-foreground" />
                                                ) : cloudConfig.baseUrl ? (
                                                    <Cloud className="h-3 w-3 text-muted-foreground" />
                                                ) : null)}
                                        </Label>
                                        <Input
                                            id="ai-base-url"
                                            value={baseUrl}
                                            onChange={(e) =>
                                                onBaseUrlChange(e.target.value)
                                            }
                                            placeholder={
                                                baseUrlPlaceholder ||
                                                t(
                                                    "settings.aiProvider.baseUrlPlaceholder",
                                                )
                                            }
                                        />
                                        {baseUrlPlaceholder && !baseUrl && (
                                            <p className="text-[0.8rem] text-muted-foreground">
                                                {t(
                                                    "settings.aiProvider.baseUrlDefault",
                                                    { url: baseUrlPlaceholder },
                                                )}
                                            </p>
                                        )}
                                    </div>

                                    {/* Connection Management - Only for logged in users */}
                                    {isLoggedIn && (
                                        <>
                                            {/* Connection Name */}
                                            <div className="space-y-2">
                                                <Label htmlFor="ai-connection-name">
                                                    {t(
                                                        "settings.aiProvider.connectionNameLabel",
                                                    )}
                                                </Label>
                                                <Input
                                                    id="ai-connection-name"
                                                    value={connectionName}
                                                    onChange={(e) =>
                                                        onConnectionNameChange(
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder={t(
                                                        "settings.aiProvider.connectionNamePlaceholder",
                                                    )}
                                                />
                                            </div>

                                            {/* Cloud Connections */}
                                            {cloudConnections.length > 0 && (
                                                <div className="space-y-2">
                                                    <Label htmlFor="ai-connection-select">
                                                        {t(
                                                            "settings.aiProvider.connectionSelectLabel",
                                                        )}
                                                    </Label>
                                                    <Select
                                                        value={connectionName}
                                                        onValueChange={
                                                            onSelectCloudConnection
                                                        }
                                                    >
                                                        <SelectTrigger id="ai-connection-select">
                                                            <SelectValue
                                                                placeholder={t(
                                                                    "settings.aiProvider.connectionSelectPlaceholder",
                                                                )}
                                                            />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {cloudConnections.map(
                                                                (conn) => {
                                                                    const name =
                                                                        conn.name ||
                                                                        "default"
                                                                    const key = `${
                                                                        conn.provider ||
                                                                        provider
                                                                    }-${name}`
                                                                    return (
                                                                        <SelectItem
                                                                            key={
                                                                                key
                                                                            }
                                                                            value={
                                                                                name
                                                                            }
                                                                        >
                                                                            <span className="flex items-center gap-1.5">
                                                                                <Cloud className="h-3 w-3 text-muted-foreground" />
                                                                                {
                                                                                    name
                                                                                }
                                                                                {conn.isDefault && (
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        (
                                                                                        {t(
                                                                                            "settings.aiProvider.defaultTag",
                                                                                        )}
                                                                                        )
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        </SelectItem>
                                                                    )
                                                                },
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-[0.8rem] text-muted-foreground">
                                                        {isLoadingConnections
                                                            ? t(
                                                                  "settings.aiProvider.connectionsLoading",
                                                              )
                                                            : t(
                                                                  "settings.aiProvider.connectionsCount",
                                                                  {
                                                                      count: cloudConnections.length,
                                                                  },
                                                              )}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Default Connection */}
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="ai-connection-default"
                                                    checked={
                                                        connectionIsDefault
                                                    }
                                                    onCheckedChange={(value) =>
                                                        onConnectionDefaultChange(
                                                            value === true,
                                                        )
                                                    }
                                                />
                                                <Label htmlFor="ai-connection-default">
                                                    {t(
                                                        "settings.aiProvider.setAsDefault",
                                                    )}
                                                </Label>
                                            </div>
                                        </>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
