"use client"

import {
    Check,
    ChevronDown,
    Cloud,
    HardDrive,
    Moon,
    Palette,
    Search,
    Sun,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/contexts/i18n-context"
import { useTheme } from "@/contexts/theme-context"
import { api } from "@/lib/trpc/client"
import { tweakcnThemes } from "@/lib/tweakcn-themes"

interface ModelOption {
    id: string
    label?: string
}

interface SettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCloseProtectionChange?: (enabled: boolean) => void
    drawioUi: "min" | "sketch"
    onToggleDrawioUi: () => void
    darkMode: boolean
    onToggleDarkMode: () => void
}

export const STORAGE_ACCESS_CODE_KEY = "next-ai-draw-io-access-code"
export const STORAGE_CLOSE_PROTECTION_KEY = "next-ai-draw-io-close-protection"
const STORAGE_ACCESS_CODE_REQUIRED_KEY = "next-ai-draw-io-access-code-required"
export const STORAGE_AI_PROVIDER_KEY = "next-ai-draw-io-ai-provider"
export const STORAGE_AI_BASE_URL_KEY = "next-ai-draw-io-ai-base-url"
export const STORAGE_AI_API_KEY_KEY = "next-ai-draw-io-ai-api-key"
export const STORAGE_AI_MODEL_KEY = "next-ai-draw-io-ai-model"

function getStoredAccessCodeRequired(): boolean | null {
    if (typeof window === "undefined") return null
    const stored = localStorage.getItem(STORAGE_ACCESS_CODE_REQUIRED_KEY)
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
    const { t, locale, setLocale } = useI18n()
    const { data: session } = useSession()
    const [accessCode, setAccessCode] = useState("")
    const [closeProtection, setCloseProtection] = useState(true)
    const [isVerifying, setIsVerifying] = useState(false)
    const [error, setError] = useState("")
    const [accessCodeRequired, setAccessCodeRequired] = useState(
        () => getStoredAccessCodeRequired() ?? false,
    )
    const [provider, setProvider] = useState("")
    const [baseUrl, setBaseUrl] = useState("")
    const [apiKey, setApiKey] = useState("")
    const [modelId, setModelId] = useState("")
    const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
    const [cloudApiKeyPreview, setCloudApiKeyPreview] = useState<
        string | undefined
    >()
    const [cloudBaseUrl, setCloudBaseUrl] = useState<string | undefined>()
    const [cloudModelId, setCloudModelId] = useState<string | undefined>()
    const [syncSuccess, setSyncSuccess] = useState(false)

    // Theme hook
    const { palette, setPalette } = useTheme()

    // TRPC mutations and utils
    const utils = api.useUtils()
    const upsertConfigMutation = api.providerConfig.upsert.useMutation()
    const deleteConfigMutation = api.providerConfig.delete.useMutation()

    useEffect(() => {
        // Only fetch if not cached in localStorage
        if (getStoredAccessCodeRequired() !== null) return

        fetch("/api/config")
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.json()
            })
            .then((data) => {
                const required = data?.accessCodeRequired === true
                localStorage.setItem(
                    STORAGE_ACCESS_CODE_REQUIRED_KEY,
                    String(required),
                )
                setAccessCodeRequired(required)
            })
            .catch(() => {
                // Don't cache on error - allow retry on next mount
                setAccessCodeRequired(false)
            })
    }, [])

    useEffect(() => {
        if (open) {
            const storedCode =
                localStorage.getItem(STORAGE_ACCESS_CODE_KEY) || ""
            setAccessCode(storedCode)

            const storedCloseProtection = localStorage.getItem(
                STORAGE_CLOSE_PROTECTION_KEY,
            )
            // Default to true if not set
            setCloseProtection(storedCloseProtection !== "false")

            // Load AI provider settings from localStorage (local priority)
            const localProvider =
                localStorage.getItem(STORAGE_AI_PROVIDER_KEY) || ""
            const localBaseUrl =
                localStorage.getItem(STORAGE_AI_BASE_URL_KEY) || ""
            const localApiKey =
                localStorage.getItem(STORAGE_AI_API_KEY_KEY) || ""
            const localModelId =
                localStorage.getItem(STORAGE_AI_MODEL_KEY) || ""

            setProvider(localProvider)
            setBaseUrl(localBaseUrl)
            setApiKey(localApiKey)
            setModelId(localModelId)

            setError("")
            setCloudApiKeyPreview(undefined)
            setCloudBaseUrl(undefined)
            setCloudModelId(undefined)
        }
    }, [open])

    useEffect(() => {
        if (!open) return
        if (!provider) {
            setModelOptions([])
            return
        }
        if (!apiKey.trim()) {
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
                    apiKey,
                    baseUrl,
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
    }, [apiKey, baseUrl, open, provider])

    const handleSave = async () => {
        if (!accessCodeRequired) return

        setError("")
        setIsVerifying(true)

        try {
            const response = await fetch("/api/verify-access-code", {
                method: "POST",
                headers: {
                    "x-access-code": accessCode.trim(),
                },
            })

            const data = await response.json()

            if (!data.valid) {
                setError(data.message || t("settings.accessCode.invalid"))
                return
            }

            localStorage.setItem(STORAGE_ACCESS_CODE_KEY, accessCode.trim())
            onOpenChange(false)
        } catch {
            setError(t("settings.accessCode.verifyFailed"))
        } finally {
            setIsVerifying(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSave()
        }
    }

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
                    <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                        <TabsTrigger value="model">
                            {t("settings.tabs.model")}
                        </TabsTrigger>
                        <TabsTrigger value="interface">
                            {t("settings.tabs.interface")}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent
                        value="model"
                        className="space-y-4 py-2 overflow-y-auto flex-1"
                    >
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
                                        onChange={(e) =>
                                            setAccessCode(e.target.value)
                                        }
                                        onKeyDown={handleKeyDown}
                                        placeholder={t(
                                            "settings.accessCode.placeholder",
                                        )}
                                        autoComplete="off"
                                    />
                                    <Button
                                        onClick={handleSave}
                                        disabled={
                                            isVerifying || !accessCode.trim()
                                        }
                                    >
                                        {isVerifying
                                            ? "..."
                                            : t("settings.accessCode.save")}
                                    </Button>
                                </div>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    {t("settings.accessCode.requiredNote")}
                                </p>
                                {error && (
                                    <p className="text-[0.8rem] text-destructive">
                                        {error}
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>{t("settings.aiProvider.title")}</Label>
                            <p className="text-[0.8rem] text-muted-foreground">
                                {t("settings.aiProvider.note")}
                            </p>
                            <div className="space-y-3 pt-2">
                                <div className="space-y-2">
                                    <Label htmlFor="ai-provider">
                                        {t("settings.aiProvider.providerLabel")}
                                    </Label>
                                    <Select
                                        value={provider || "default"}
                                        onValueChange={async (value) => {
                                            const actualValue =
                                                value === "default" ? "" : value
                                            setProvider(actualValue)
                                            localStorage.setItem(
                                                STORAGE_AI_PROVIDER_KEY,
                                                actualValue,
                                            )

                                            // Load cloud config if available
                                            setCloudApiKeyPreview(undefined)
                                            setCloudBaseUrl(undefined)
                                            setCloudModelId(undefined)
                                            if (session?.user && actualValue) {
                                                try {
                                                    const cloudConfig =
                                                        await utils.providerConfig.get.fetch(
                                                            {
                                                                provider:
                                                                    actualValue as any,
                                                            },
                                                        )
                                                    if (cloudConfig) {
                                                        // Save cloud config for source indicators
                                                        if (
                                                            cloudConfig.baseUrl
                                                        ) {
                                                            setCloudBaseUrl(
                                                                cloudConfig.baseUrl,
                                                            )
                                                        }
                                                        if (
                                                            cloudConfig.modelId
                                                        ) {
                                                            setCloudModelId(
                                                                cloudConfig.modelId,
                                                            )
                                                        }
                                                        if (
                                                            cloudConfig.hasApiKey &&
                                                            cloudConfig.apiKeyPreview
                                                        ) {
                                                            setCloudApiKeyPreview(
                                                                cloudConfig.apiKeyPreview,
                                                            )
                                                        }

                                                        // Auto-fill from cloud if local is empty
                                                        if (
                                                            !baseUrl &&
                                                            cloudConfig.baseUrl
                                                        ) {
                                                            setBaseUrl(
                                                                cloudConfig.baseUrl,
                                                            )
                                                            localStorage.setItem(
                                                                STORAGE_AI_BASE_URL_KEY,
                                                                cloudConfig.baseUrl,
                                                            )
                                                        }
                                                        if (
                                                            !modelId &&
                                                            cloudConfig.modelId
                                                        ) {
                                                            setModelId(
                                                                cloudConfig.modelId,
                                                            )
                                                            localStorage.setItem(
                                                                STORAGE_AI_MODEL_KEY,
                                                                cloudConfig.modelId,
                                                            )
                                                        }
                                                    }
                                                } catch (error) {
                                                    console.error(
                                                        "Failed to load cloud config:",
                                                        error,
                                                    )
                                                }
                                            }
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
                                                {t(
                                                    "settings.aiProvider.useServerDefault",
                                                )}
                                            </SelectItem>
                                            <SelectItem value="openai">
                                                OpenAI
                                            </SelectItem>
                                            <SelectItem value="anthropic">
                                                Anthropic
                                            </SelectItem>
                                            <SelectItem value="google">
                                                Google
                                            </SelectItem>
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
                                {provider && provider !== "default" && (
                                    <>
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="ai-model"
                                                className="flex items-center gap-1.5"
                                            >
                                                {t(
                                                    "settings.aiProvider.modelIdLabel",
                                                )}
                                                {session?.user &&
                                                    (modelId ? (
                                                        <HardDrive className="h-3 w-3 text-muted-foreground" />
                                                    ) : cloudModelId ? (
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
                                                            const value =
                                                                e.target.value
                                                            setModelId(value)
                                                            localStorage.setItem(
                                                                STORAGE_AI_MODEL_KEY,
                                                                value,
                                                            )
                                                            setIsModelMenuOpen(
                                                                true,
                                                            )
                                                        }}
                                                        onFocus={() =>
                                                            setIsModelMenuOpen(
                                                                true,
                                                            )
                                                        }
                                                        onBlur={() => {
                                                            setTimeout(
                                                                () =>
                                                                    setIsModelMenuOpen(
                                                                        false,
                                                                    ),
                                                                150,
                                                            )
                                                        }}
                                                        placeholder={
                                                            provider ===
                                                            "openai"
                                                                ? "e.g., gpt-4o"
                                                                : provider ===
                                                                    "anthropic"
                                                                  ? "e.g., claude-3-5-sonnet-latest"
                                                                  : provider ===
                                                                      "google"
                                                                    ? "e.g., gemini-2.5-pro"
                                                                    : provider ===
                                                                        "deepseek"
                                                                      ? "e.g., deepseek-chat"
                                                                      : t(
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
                                                        onMouseDown={(e) => {
                                                            e.preventDefault()
                                                        }}
                                                        onClick={() =>
                                                            setIsModelMenuOpen(
                                                                (v) => !v,
                                                            )
                                                        }
                                                    >
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </div>
                                                {isModelMenuOpen &&
                                                    modelOptions.length > 0 && (
                                                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                                                            <div className="max-h-56 overflow-auto">
                                                                {modelOptions
                                                                    .filter(
                                                                        (m) => {
                                                                            const q =
                                                                                modelId
                                                                                    .trim()
                                                                                    .toLowerCase()
                                                                            if (
                                                                                !q
                                                                            )
                                                                                return true
                                                                            return (
                                                                                String(
                                                                                    m.id,
                                                                                )
                                                                                    .toLowerCase()
                                                                                    .includes(
                                                                                        q,
                                                                                    ) ||
                                                                                String(
                                                                                    m.label ||
                                                                                        "",
                                                                                )
                                                                                    .toLowerCase()
                                                                                    .includes(
                                                                                        q,
                                                                                    )
                                                                            )
                                                                        },
                                                                    )
                                                                    .slice(
                                                                        0,
                                                                        100,
                                                                    )
                                                                    .map(
                                                                        (m) => (
                                                                            <button
                                                                                key={
                                                                                    m.id
                                                                                }
                                                                                type="button"
                                                                                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                                                                                onMouseDown={(
                                                                                    e,
                                                                                ) => {
                                                                                    e.preventDefault()
                                                                                }}
                                                                                onClick={() => {
                                                                                    setModelId(
                                                                                        m.id,
                                                                                    )
                                                                                    localStorage.setItem(
                                                                                        STORAGE_AI_MODEL_KEY,
                                                                                        m.id,
                                                                                    )
                                                                                    setIsModelMenuOpen(
                                                                                        false,
                                                                                    )
                                                                                }}
                                                                            >
                                                                                <span className="truncate">
                                                                                    {
                                                                                        m.id
                                                                                    }
                                                                                </span>
                                                                                {m.label ? (
                                                                                    <span className="ml-2 max-w-[45%] truncate text-xs text-muted-foreground">
                                                                                        {
                                                                                            m.label
                                                                                        }
                                                                                    </span>
                                                                                ) : null}
                                                                            </button>
                                                                        ),
                                                                    )}
                                                            </div>
                                                        </div>
                                                    )}
                                            </div>
                                            <p className="text-[0.8rem] text-muted-foreground">
                                                {isLoadingModels
                                                    ? t(
                                                          "settings.aiProvider.modelsLoading",
                                                      )
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
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="ai-api-key"
                                                className="flex items-center gap-1.5"
                                            >
                                                {t(
                                                    "settings.aiProvider.apiKeyLabel",
                                                )}
                                                {session?.user &&
                                                    (apiKey ? (
                                                        <HardDrive className="h-3 w-3 text-muted-foreground" />
                                                    ) : cloudApiKeyPreview ? (
                                                        <Cloud className="h-3 w-3 text-muted-foreground" />
                                                    ) : null)}
                                            </Label>
                                            <Input
                                                id="ai-api-key"
                                                type="password"
                                                value={apiKey}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                    setApiKey(value)
                                                    localStorage.setItem(
                                                        STORAGE_AI_API_KEY_KEY,
                                                        value,
                                                    )

                                                    // Sync to cloud if logged in
                                                    if (
                                                        session?.user &&
                                                        provider
                                                    ) {
                                                        upsertConfigMutation.mutate(
                                                            {
                                                                provider:
                                                                    provider as any,
                                                                apiKey:
                                                                    value ||
                                                                    undefined,
                                                                baseUrl:
                                                                    baseUrl ||
                                                                    undefined,
                                                                modelId:
                                                                    modelId ||
                                                                    undefined,
                                                            },
                                                            {
                                                                onSuccess:
                                                                    () => {
                                                                        setCloudApiKeyPreview(
                                                                            undefined,
                                                                        )
                                                                    },
                                                            },
                                                        )
                                                    }
                                                }}
                                                placeholder={t(
                                                    "settings.aiProvider.apiKeyPlaceholder",
                                                )}
                                                autoComplete="off"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="ai-base-url"
                                                className="flex items-center gap-1.5"
                                            >
                                                {t(
                                                    "settings.aiProvider.baseUrlLabel",
                                                )}
                                                {session?.user &&
                                                    (baseUrl ? (
                                                        <HardDrive className="h-3 w-3 text-muted-foreground" />
                                                    ) : cloudBaseUrl ? (
                                                        <Cloud className="h-3 w-3 text-muted-foreground" />
                                                    ) : null)}
                                            </Label>
                                            <Input
                                                id="ai-base-url"
                                                value={baseUrl}
                                                onChange={(e) => {
                                                    setBaseUrl(e.target.value)
                                                    localStorage.setItem(
                                                        STORAGE_AI_BASE_URL_KEY,
                                                        e.target.value,
                                                    )
                                                }}
                                                placeholder={
                                                    provider === "anthropic"
                                                        ? "https://api.anthropic.com/v1"
                                                        : provider ===
                                                            "siliconflow"
                                                          ? "https://api.siliconflow.com/v1"
                                                          : t(
                                                                "settings.aiProvider.baseUrlPlaceholder",
                                                            )
                                                }
                                            />
                                        </div>
                                        {session?.user && provider && (
                                            <Button
                                                variant={
                                                    syncSuccess
                                                        ? "outline"
                                                        : "default"
                                                }
                                                size="sm"
                                                className="w-full"
                                                disabled={
                                                    upsertConfigMutation.isPending ||
                                                    syncSuccess
                                                }
                                                onClick={() => {
                                                    upsertConfigMutation.mutate(
                                                        {
                                                            provider:
                                                                provider as any,
                                                            apiKey:
                                                                apiKey ||
                                                                undefined,
                                                            baseUrl:
                                                                baseUrl ||
                                                                undefined,
                                                            modelId:
                                                                modelId ||
                                                                undefined,
                                                        },
                                                        {
                                                            onSuccess: () => {
                                                                console.log(
                                                                    "[settings] Synced to cloud:",
                                                                    provider,
                                                                )
                                                                setSyncSuccess(
                                                                    true,
                                                                )
                                                                setTimeout(
                                                                    () => {
                                                                        setSyncSuccess(
                                                                            false,
                                                                        )
                                                                    },
                                                                    2000,
                                                                )
                                                            },
                                                        },
                                                    )
                                                }}
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
                                                        {upsertConfigMutation.isPending
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
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => {
                                                // Clear local storage
                                                localStorage.removeItem(
                                                    STORAGE_AI_PROVIDER_KEY,
                                                )
                                                localStorage.removeItem(
                                                    STORAGE_AI_BASE_URL_KEY,
                                                )
                                                localStorage.removeItem(
                                                    STORAGE_AI_API_KEY_KEY,
                                                )
                                                localStorage.removeItem(
                                                    STORAGE_AI_MODEL_KEY,
                                                )
                                                setProvider("")
                                                setBaseUrl("")
                                                setApiKey("")
                                                setModelId("")
                                                setCloudApiKeyPreview(undefined)
                                                setCloudBaseUrl(undefined)
                                                setCloudModelId(undefined)

                                                // Delete from cloud if logged in
                                                if (session?.user && provider) {
                                                    deleteConfigMutation.mutate(
                                                        {
                                                            provider:
                                                                provider as any,
                                                        },
                                                        {
                                                            onSuccess: () => {
                                                                console.log(
                                                                    "[settings] Cloud config cleared for provider:",
                                                                    provider,
                                                                )
                                                            },
                                                            onError: (
                                                                error,
                                                            ) => {
                                                                console.error(
                                                                    "[settings] Failed to clear cloud config:",
                                                                    error,
                                                                )
                                                            },
                                                        },
                                                    )
                                                }
                                            }}
                                        >
                                            {t("settings.aiProvider.clear")}
                                            {session?.user &&
                                                deleteConfigMutation.isPending && (
                                                    <Cloud className="ml-2 h-3 w-3 animate-pulse" />
                                                )}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent
                        value="interface"
                        className="space-y-4 py-2 overflow-y-auto flex-1"
                    >
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="theme-toggle">
                                    {t("settings.theme.label")}
                                </Label>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    {t("settings.theme.note")}
                                </p>
                            </div>
                            <Button
                                id="theme-toggle"
                                variant="outline"
                                size="icon"
                                onClick={onToggleDarkMode}
                            >
                                {darkMode ? (
                                    <Sun className="h-4 w-4" />
                                ) : (
                                    <Moon className="h-4 w-4" />
                                )}
                            </Button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="theme-color-select">
                                    {t("settings.themeColor.label")}
                                </Label>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    {t("settings.themeColor.note")}
                                </p>
                            </div>
                            <Select
                                value={palette || "amber-minimal"}
                                onValueChange={(value) =>
                                    setPalette(value as any)
                                }
                            >
                                <SelectTrigger
                                    id="theme-color-select"
                                    className="w-[180px]"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {tweakcnThemes.map((theme) => (
                                        <SelectItem
                                            key={theme.name}
                                            value={theme.name}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Palette className="h-3.5 w-3.5" />
                                                {theme.title}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="language-select">
                                    {t("settings.language.label")}
                                </Label>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    {t("settings.language.note")}
                                </p>
                            </div>
                            <Select
                                value={locale}
                                onValueChange={(value) =>
                                    setLocale(value as any)
                                }
                            >
                                <SelectTrigger
                                    id="language-select"
                                    className="w-[140px]"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">
                                        {t("settings.language.en")}
                                    </SelectItem>
                                    <SelectItem value="zh-CN">
                                        {t("settings.language.zhCN")}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="drawio-ui">
                                    {t("settings.drawioStyle.label")}
                                </Label>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    {t("settings.drawioStyle.note", {
                                        style:
                                            drawioUi === "min"
                                                ? t(
                                                      "settings.drawioStyle.minimal",
                                                  )
                                                : t(
                                                      "settings.drawioStyle.sketch",
                                                  ),
                                    })}
                                </p>
                            </div>
                            <Button
                                id="drawio-ui"
                                variant="outline"
                                size="sm"
                                onClick={onToggleDrawioUi}
                            >
                                {t("settings.drawioStyle.switchTo", {
                                    style:
                                        drawioUi === "min"
                                            ? t("settings.drawioStyle.sketch")
                                            : t("settings.drawioStyle.minimal"),
                                })}
                            </Button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="close-protection">
                                    {t("settings.closeProtection.label")}
                                </Label>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    {t("settings.closeProtection.note")}
                                </p>
                            </div>
                            <Switch
                                id="close-protection"
                                checked={closeProtection}
                                onCheckedChange={(checked) => {
                                    setCloseProtection(checked)
                                    localStorage.setItem(
                                        STORAGE_CLOSE_PROTECTION_KEY,
                                        checked.toString(),
                                    )
                                    onCloseProtectionChange?.(checked)
                                }}
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
