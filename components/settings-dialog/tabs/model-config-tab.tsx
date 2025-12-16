"use client"

import { Check, ChevronDown, Cloud, HardDrive, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/contexts/i18n-context"
import {
    type CloudConfig,
    getBaseUrlPlaceholder,
    getModelPlaceholder,
    type ModelOption,
} from "../hooks"

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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            onAccessCodeSave()
        }
    }

    const filteredModels = filterModels(modelId)

    return (
        <div className="space-y-4 py-2 overflow-y-auto flex-1">
            {/* Access Code Section */}
            {accessCodeRequired && (
                <div className="space-y-2">
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
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="anthropic">
                                    Anthropic
                                </SelectItem>
                                <SelectItem value="google">Google</SelectItem>
                                <SelectItem value="azure">
                                    Azure OpenAI
                                </SelectItem>
                                <SelectItem value="openrouter">
                                    OpenRouter
                                </SelectItem>
                                <SelectItem value="deepseek">
                                    DeepSeek
                                </SelectItem>
                                <SelectItem value="siliconflow">
                                    SiliconFlow
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Provider-specific fields */}
                    {provider && provider !== "default" && (
                        <>
                            {/* Model ID */}
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
                                            placeholder={getModelPlaceholder(
                                                provider,
                                                t(
                                                    "settings.aiProvider.modelIdLabel",
                                                ),
                                            )}
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

                            {/* API Key */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="ai-api-key"
                                    className="flex items-center gap-1.5"
                                >
                                    {t("settings.aiProvider.apiKeyLabel")}
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

                            {/* Base URL */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="ai-base-url"
                                    className="flex items-center gap-1.5"
                                >
                                    {t("settings.aiProvider.baseUrlLabel")}
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
                                    placeholder={getBaseUrlPlaceholder(
                                        provider,
                                        t(
                                            "settings.aiProvider.baseUrlPlaceholder",
                                        ),
                                    )}
                                />
                            </div>

                            {/* Sync to Cloud Button */}
                            {isLoggedIn && provider && apiKey && baseUrl && (
                                <Button
                                    variant={
                                        syncSuccess ? "outline" : "default"
                                    }
                                    size="sm"
                                    className="w-full"
                                    disabled={isSyncing || syncSuccess}
                                    onClick={onSyncToCloud}
                                >
                                    {syncSuccess ? (
                                        <>
                                            <Check className="h-4 w-4 mr-2 text-green-600" />
                                            {t("settings.aiProvider.synced")}
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
                                    className="w-full"
                                    disabled={isRestoring || restoreSuccess}
                                    onClick={onRestoreFromCloud}
                                >
                                    {restoreSuccess ? (
                                        <>
                                            <Check className="h-4 w-4 mr-2 text-green-600" />
                                            {t("settings.aiProvider.restored")}
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
                                className="w-full"
                                onClick={onClearConfig}
                            >
                                {t("settings.aiProvider.clear")}
                                {isLoggedIn && isDeleting && (
                                    <Cloud className="ml-2 h-3 w-3 animate-pulse" />
                                )}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
