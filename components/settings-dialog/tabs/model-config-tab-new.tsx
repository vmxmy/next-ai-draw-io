"use client"

import {
    Brain,
    ChevronDown,
    Plus,
    Search,
    Star,
    Trash2,
    Zap,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { STORAGE_KEYS } from "@/lib/storage"
import { useAIMode } from "@/lib/use-ai-mode"
import {
    useModelSelector,
    useProviderCatalog,
    useUserCredential,
    useUserModeConfig,
} from "../hooks"

export type ModelModeType = "fast" | "max"

interface CredentialForm {
    provider: string
    name: string
    apiKey: string
    baseUrl: string
    isDefault: boolean
}

const initialCredentialForm: CredentialForm = {
    provider: "",
    name: "default",
    apiKey: "",
    baseUrl: "",
    isDefault: true,
}

interface NewModelConfigTabProps {
    isLoggedIn: boolean
}

export function NewModelConfigTab({ isLoggedIn }: NewModelConfigTabProps) {
    // Hooks
    const { providers } = useProviderCatalog()
    const {
        credentials,
        isLoading: isLoadingCredentials,
        isSaving: isSavingCredential,
        isDeleting: isDeletingCredential,
        saveCredential,
        deleteCredential,
        setDefaultCredential,
        hasCredentialForProvider,
    } = useUserCredential()

    const {
        fastConfig,
        maxConfig,
        isSaving: isSavingModeConfig,
        saveModeConfig,
    } = useUserModeConfig()

    const {
        mode: aiMode,
        hasByokConfig: hasAnyByokConfig,
        isLoading: isModeLoading,
        setMode,
    } = useAIMode()

    // Local state
    const [activeMode, setActiveMode] = useState<ModelModeType>("fast")
    const [isCredentialDialogOpen, setIsCredentialDialogOpen] = useState(false)
    const [editingCredential, setEditingCredential] = useState<{
        provider: string
        name: string
    } | null>(null)
    const [credentialForm, setCredentialForm] = useState<CredentialForm>(
        initialCredentialForm,
    )

    // Mode config local state
    const [fastProvider, setFastProvider] = useState("")
    const [fastCredentialName, setFastCredentialName] = useState("")
    const [fastModelId, setFastModelId] = useState("")
    const [maxProvider, setMaxProvider] = useState("")
    const [maxCredentialName, setMaxCredentialName] = useState("")
    const [maxModelId, setMaxModelId] = useState("")

    // Model selector state
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
    const [modelSearchValue, setModelSearchValue] = useState("")

    // Initialize mode configs from server
    useEffect(() => {
        if (fastConfig) {
            setFastProvider(fastConfig.provider || "")
            setFastCredentialName(fastConfig.credentialName || "")
            setFastModelId(fastConfig.modelId || "")
        }
        if (maxConfig) {
            setMaxProvider(maxConfig.provider || "")
            setMaxCredentialName(maxConfig.credentialName || "")
            setMaxModelId(maxConfig.modelId || "")
        }
    }, [fastConfig, maxConfig])

    // Get current mode's provider for model loading
    const currentProvider = activeMode === "fast" ? fastProvider : maxProvider
    const currentModelId = activeMode === "fast" ? fastModelId : maxModelId

    // Model selector hook
    const { modelOptions, isLoadingModels, filterModels } = useModelSelector({
        provider: currentProvider,
        apiKey: "", // Will be fetched from server
        baseUrl: "",
        isDialogOpen: true,
        isLoggedIn,
        hasCloudConfig: hasCredentialForProvider(currentProvider),
    })

    // Filter models based on search
    const filteredModels = filterModels(modelSearchValue)

    // Get credentials for current provider
    const getCredentialsForProvider = (provider: string) => {
        return credentials.filter((c) => c.provider === provider)
    }

    // Provider options
    const providerOptions = providers.map((p) => ({
        value: p.key,
        label: p.displayName,
    }))

    // AI mode toggle
    const [isSwitchingMode, setIsSwitchingMode] = useState(false)
    const handleModeToggle = async (checked: boolean) => {
        if (!isLoggedIn) return
        setIsSwitchingMode(true)
        try {
            await setMode(checked ? "byok" : "system_default")
        } catch (_error) {
            toast.error("Failed to switch mode")
        } finally {
            setIsSwitchingMode(false)
        }
    }

    // Credential management
    const handleAddCredential = () => {
        setEditingCredential(null)
        setCredentialForm(initialCredentialForm)
        setIsCredentialDialogOpen(true)
    }

    const handleEditCredential = (provider: string, name: string) => {
        const cred = credentials.find(
            (c) => c.provider === provider && c.name === name,
        )
        if (cred) {
            setEditingCredential({ provider, name })
            setCredentialForm({
                provider: cred.provider,
                name: cred.name,
                apiKey: "",
                baseUrl: cred.baseUrl || "",
                isDefault: cred.isDefault,
            })
            setIsCredentialDialogOpen(true)
        }
    }

    const handleDeleteCredential = async (provider: string, name: string) => {
        if (confirm(`确定要删除凭证 "${name}" 吗？`)) {
            try {
                await deleteCredential(provider, name)
                toast.success("凭证已删除")
            } catch {
                toast.error("删除失败")
            }
        }
    }

    const handleSaveCredential = async () => {
        if (!credentialForm.provider) {
            toast.error("请选择 Provider")
            return
        }
        if (!credentialForm.name.trim()) {
            toast.error("请输入凭证名称")
            return
        }
        if (!editingCredential && !credentialForm.apiKey) {
            toast.error("请输入 API Key")
            return
        }

        try {
            await saveCredential({
                provider: credentialForm.provider,
                name: credentialForm.name.trim(),
                apiKey: credentialForm.apiKey || undefined,
                baseUrl: credentialForm.baseUrl || undefined,
                isDefault: credentialForm.isDefault,
            })
            toast.success(editingCredential ? "凭证已更新" : "凭证已创建")
            setIsCredentialDialogOpen(false)
        } catch {
            toast.error("保存失败")
        }
    }

    // Mode config save
    const handleSaveModeConfig = async (mode: ModelModeType) => {
        const provider = mode === "fast" ? fastProvider : maxProvider
        const credentialName =
            mode === "fast" ? fastCredentialName : maxCredentialName
        const modelId = mode === "fast" ? fastModelId : maxModelId

        try {
            await saveModeConfig(mode, {
                provider: provider || null,
                credentialName: credentialName || null,
                modelId: modelId || null,
            })
            toast.success(`${mode === "fast" ? "Fast" : "Max"} 模式配置已保存`)
        } catch {
            toast.error("保存失败")
        }
    }

    // Handle model selection
    const handleSelectModel = (modelId: string) => {
        if (activeMode === "fast") {
            setFastModelId(modelId)
        } else {
            setMaxModelId(modelId)
        }
        setIsModelMenuOpen(false)
        setModelSearchValue("")
    }

    // Non-logged-in users: localStorage fallback with fast/max modes
    const [localActiveMode, setLocalActiveMode] =
        useState<ModelModeType>("fast")
    // Fast mode local state
    const [localFastProvider, setLocalFastProvider] = useState("")
    const [localFastApiKey, setLocalFastApiKey] = useState("")
    const [localFastBaseUrl, setLocalFastBaseUrl] = useState("")
    const [localFastModel, setLocalFastModel] = useState("")
    // Max mode local state
    const [localMaxProvider, setLocalMaxProvider] = useState("")
    const [localMaxApiKey, setLocalMaxApiKey] = useState("")
    const [localMaxBaseUrl, setLocalMaxBaseUrl] = useState("")
    const [localMaxModel, setLocalMaxModel] = useState("")

    useEffect(() => {
        if (!isLoggedIn && typeof window !== "undefined") {
            // Load fast mode config
            setLocalFastProvider(
                localStorage.getItem(STORAGE_KEYS.fastProvider) || "",
            )
            setLocalFastApiKey(
                localStorage.getItem(STORAGE_KEYS.fastApiKey) || "",
            )
            setLocalFastBaseUrl(
                localStorage.getItem(STORAGE_KEYS.fastBaseUrl) || "",
            )
            setLocalFastModel(
                localStorage.getItem(STORAGE_KEYS.fastModel) || "",
            )
            // Load max mode config
            setLocalMaxProvider(
                localStorage.getItem(STORAGE_KEYS.maxProvider) || "",
            )
            setLocalMaxApiKey(
                localStorage.getItem(STORAGE_KEYS.maxApiKey) || "",
            )
            setLocalMaxBaseUrl(
                localStorage.getItem(STORAGE_KEYS.maxBaseUrl) || "",
            )
            setLocalMaxModel(localStorage.getItem(STORAGE_KEYS.maxModel) || "")
        }
    }, [isLoggedIn])

    const handleLocalSave = (mode: ModelModeType) => {
        if (mode === "fast") {
            if (localFastProvider) {
                localStorage.setItem(
                    STORAGE_KEYS.fastProvider,
                    localFastProvider,
                )
                localStorage.setItem(STORAGE_KEYS.aiProvider, localFastProvider) // Legacy compatibility
            } else {
                localStorage.removeItem(STORAGE_KEYS.fastProvider)
            }
            if (localFastApiKey) {
                localStorage.setItem(STORAGE_KEYS.fastApiKey, localFastApiKey)
                localStorage.setItem(STORAGE_KEYS.aiApiKey, localFastApiKey) // Legacy compatibility
            } else {
                localStorage.removeItem(STORAGE_KEYS.fastApiKey)
            }
            if (localFastBaseUrl) {
                localStorage.setItem(STORAGE_KEYS.fastBaseUrl, localFastBaseUrl)
                localStorage.setItem(STORAGE_KEYS.aiBaseUrl, localFastBaseUrl) // Legacy compatibility
            } else {
                localStorage.removeItem(STORAGE_KEYS.fastBaseUrl)
                localStorage.removeItem(STORAGE_KEYS.aiBaseUrl)
            }
            if (localFastModel) {
                localStorage.setItem(STORAGE_KEYS.fastModel, localFastModel)
                localStorage.setItem(STORAGE_KEYS.aiModel, localFastModel) // Legacy compatibility
            } else {
                localStorage.removeItem(STORAGE_KEYS.fastModel)
            }
        } else {
            if (localMaxProvider) {
                localStorage.setItem(STORAGE_KEYS.maxProvider, localMaxProvider)
            } else {
                localStorage.removeItem(STORAGE_KEYS.maxProvider)
            }
            if (localMaxApiKey) {
                localStorage.setItem(STORAGE_KEYS.maxApiKey, localMaxApiKey)
            } else {
                localStorage.removeItem(STORAGE_KEYS.maxApiKey)
            }
            if (localMaxBaseUrl) {
                localStorage.setItem(STORAGE_KEYS.maxBaseUrl, localMaxBaseUrl)
            } else {
                localStorage.removeItem(STORAGE_KEYS.maxBaseUrl)
            }
            if (localMaxModel) {
                localStorage.setItem(STORAGE_KEYS.maxModel, localMaxModel)
            } else {
                localStorage.removeItem(STORAGE_KEYS.maxModel)
            }
        }
        toast.success(`${mode === "fast" ? "Fast" : "Max"} 模式配置已保存`)
    }

    // Get current local mode values
    const currentLocalProvider =
        localActiveMode === "fast" ? localFastProvider : localMaxProvider
    const currentLocalApiKey =
        localActiveMode === "fast" ? localFastApiKey : localMaxApiKey
    const currentLocalBaseUrl =
        localActiveMode === "fast" ? localFastBaseUrl : localMaxBaseUrl
    const currentLocalModel =
        localActiveMode === "fast" ? localFastModel : localMaxModel

    // Model selector for anonymous users
    const [localModelMenuOpen, setLocalModelMenuOpen] = useState(false)
    const [localModelSearchValue, setLocalModelSearchValue] = useState("")

    const {
        modelOptions: localModelOptions,
        isLoadingModels: isLoadingLocalModels,
        filterModels: filterLocalModels,
    } = useModelSelector({
        provider: currentLocalProvider,
        apiKey: currentLocalApiKey,
        baseUrl: currentLocalBaseUrl,
        isDialogOpen: true,
        isLoggedIn: false,
        hasCloudConfig: false,
    })

    const filteredLocalModels = filterLocalModels(localModelSearchValue)

    // BYOK mode toggle for anonymous users
    const [isSwitchingLocalMode, setIsSwitchingLocalMode] = useState(false)
    const handleLocalModeToggle = async (checked: boolean) => {
        setIsSwitchingLocalMode(true)
        try {
            await setMode(checked ? "byok" : "system_default")
        } catch {
            toast.error("Failed to switch mode")
        } finally {
            setIsSwitchingLocalMode(false)
        }
    }

    const setCurrentLocalProvider = (v: string) => {
        if (localActiveMode === "fast") setLocalFastProvider(v)
        else setLocalMaxProvider(v)
    }
    const setCurrentLocalApiKey = (v: string) => {
        if (localActiveMode === "fast") setLocalFastApiKey(v)
        else setLocalMaxApiKey(v)
    }
    const setCurrentLocalBaseUrl = (v: string) => {
        if (localActiveMode === "fast") setLocalFastBaseUrl(v)
        else setLocalMaxBaseUrl(v)
    }

    // Handle local model selection
    const handleLocalSelectModel = (modelId: string) => {
        if (localActiveMode === "fast") {
            setLocalFastModel(modelId)
        } else {
            setLocalMaxModel(modelId)
        }
        setLocalModelMenuOpen(false)
        setLocalModelSearchValue("")
    }

    // Render for non-logged-in users
    if (!isLoggedIn) {
        return (
            <div className="space-y-4 py-2">
                {/* AI Mode Toggle */}
                <div className="space-y-2 pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="local-ai-mode">
                                使用自定义配置 (BYOK)
                            </Label>
                            <p className="text-[0.8rem] text-muted-foreground">
                                {aiMode === "byok"
                                    ? "使用您配置的 API Key，不消耗系统额度"
                                    : "使用系统默认配置，消耗您的使用额度"}
                            </p>
                        </div>
                        <Switch
                            id="local-ai-mode"
                            checked={aiMode === "byok"}
                            disabled={
                                (aiMode !== "byok" && !hasAnyByokConfig) ||
                                isSwitchingLocalMode
                            }
                            onCheckedChange={handleLocalModeToggle}
                        />
                    </div>
                    {!hasAnyByokConfig && aiMode !== "byok" && (
                        <p className="text-sm text-muted-foreground">
                            请先配置 API Key
                        </p>
                    )}
                </div>

                {/* Mode Tabs */}
                <div className="flex gap-2">
                    <Button
                        variant={
                            localActiveMode === "fast" ? "default" : "outline"
                        }
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => setLocalActiveMode("fast")}
                    >
                        <Zap className="h-4 w-4" />
                        Fast 模式
                    </Button>
                    <Button
                        variant={
                            localActiveMode === "max" ? "default" : "outline"
                        }
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => setLocalActiveMode("max")}
                    >
                        <Brain className="h-4 w-4" />
                        Max 模式
                    </Button>
                </div>

                {/* Mode Config Form */}
                <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                    <div className="space-y-2">
                        <Label>Provider</Label>
                        <Select
                            value={currentLocalProvider || "default"}
                            onValueChange={(v) =>
                                setCurrentLocalProvider(
                                    v === "default" ? "" : v,
                                )
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="使用系统默认" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">
                                    使用系统默认
                                </SelectItem>
                                {providerOptions.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {currentLocalProvider && (
                        <>
                            <div className="space-y-2">
                                <Label>API Key</Label>
                                <Input
                                    type="password"
                                    value={currentLocalApiKey}
                                    onChange={(e) =>
                                        setCurrentLocalApiKey(e.target.value)
                                    }
                                    placeholder="输入 API Key"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Base URL (可选)</Label>
                                <Input
                                    value={currentLocalBaseUrl}
                                    onChange={(e) =>
                                        setCurrentLocalBaseUrl(e.target.value)
                                    }
                                    placeholder="留空使用默认"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>模型</Label>
                                <div className="relative">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={
                                                localModelSearchValue ||
                                                currentLocalModel
                                            }
                                            onChange={(e) => {
                                                setLocalModelSearchValue(
                                                    e.target.value,
                                                )
                                                setLocalModelMenuOpen(true)
                                            }}
                                            onFocus={() => {
                                                setLocalModelSearchValue(
                                                    currentLocalModel,
                                                )
                                                setLocalModelMenuOpen(true)
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    setLocalModelMenuOpen(false)
                                                    setLocalModelSearchValue("")
                                                }, 150)
                                            }}
                                            placeholder="输入或选择模型"
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
                                            onClick={() =>
                                                setLocalModelMenuOpen((v) => !v)
                                            }
                                        >
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                    {localModelMenuOpen &&
                                        filteredLocalModels.length > 0 && (
                                            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                                                <div className="max-h-56 overflow-auto">
                                                    {filteredLocalModels
                                                        .slice(0, 100)
                                                        .map((m) => (
                                                            <button
                                                                key={m.id}
                                                                type="button"
                                                                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                                                                onMouseDown={(
                                                                    e,
                                                                ) =>
                                                                    e.preventDefault()
                                                                }
                                                                onClick={() =>
                                                                    handleLocalSelectModel(
                                                                        m.id,
                                                                    )
                                                                }
                                                            >
                                                                <span className="truncate">
                                                                    {m.id}
                                                                </span>
                                                                {m.label && (
                                                                    <span className="ml-2 max-w-[45%] truncate text-xs text-muted-foreground">
                                                                        {
                                                                            m.label
                                                                        }
                                                                    </span>
                                                                )}
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {isLoadingLocalModels
                                        ? "加载模型列表中..."
                                        : localModelOptions.length > 0
                                          ? `已加载 ${localModelOptions.length} 个模型`
                                          : currentLocalApiKey
                                            ? "输入 API Key 后自动加载模型列表"
                                            : "请先输入 API Key"}
                                </p>
                            </div>
                        </>
                    )}

                    <Button
                        onClick={() => handleLocalSave(localActiveMode)}
                        className="w-full"
                        disabled={!currentLocalProvider}
                    >
                        保存 {localActiveMode === "fast" ? "Fast" : "Max"} 配置
                    </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                    登录后可享受云端同步和更多配置选项
                </p>
            </div>
        )
    }

    // Render for logged-in users
    return (
        <div className="space-y-6 py-2 overflow-y-auto flex-1">
            {/* AI Mode Toggle */}
            <div className="space-y-2 pb-4 border-b">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="ai-mode">使用自定义配置 (BYOK)</Label>
                        <p className="text-[0.8rem] text-muted-foreground">
                            {aiMode === "byok"
                                ? "使用您配置的 API Key，不消耗系统额度"
                                : "使用系统默认配置，消耗您的使用额度"}
                        </p>
                    </div>
                    <Switch
                        id="ai-mode"
                        checked={aiMode === "byok"}
                        disabled={
                            (aiMode !== "byok" && !hasAnyByokConfig) ||
                            isModeLoading ||
                            isSwitchingMode
                        }
                        onCheckedChange={handleModeToggle}
                    />
                </div>
                {!hasAnyByokConfig && aiMode !== "byok" && (
                    <p className="text-sm text-muted-foreground">
                        请先配置凭证和模式设置
                    </p>
                )}
            </div>

            {/* Credentials Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium">连接凭证</h3>
                        <p className="text-sm text-muted-foreground">
                            管理您的 API Key
                        </p>
                    </div>
                    <Button size="sm" onClick={handleAddCredential}>
                        <Plus className="h-4 w-4 mr-1" />
                        添加
                    </Button>
                </div>

                {isLoadingCredentials ? (
                    <p className="text-sm text-muted-foreground">加载中...</p>
                ) : credentials.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        暂无凭证，点击"添加"开始配置
                    </p>
                ) : (
                    <div className="space-y-2">
                        {credentials.map((cred) => (
                            <div
                                key={`${cred.provider}-${cred.name}`}
                                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                            {
                                                providers.find(
                                                    (p) =>
                                                        p.key === cred.provider,
                                                )?.displayName
                                            }
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="text-xs"
                                        >
                                            {cred.name}
                                        </Badge>
                                        {cred.isDefault && (
                                            <Badge
                                                variant="secondary"
                                                className="text-xs"
                                            >
                                                默认
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {cred.hasCredentials
                                            ? "已配置 API Key"
                                            : "未配置"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    {!cred.isDefault && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                setDefaultCredential(
                                                    cred.provider,
                                                    cred.name,
                                                )
                                            }
                                            title="设为默认"
                                        >
                                            <Star className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            handleEditCredential(
                                                cred.provider,
                                                cred.name,
                                            )
                                        }
                                    >
                                        编辑
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            handleDeleteCredential(
                                                cred.provider,
                                                cred.name,
                                            )
                                        }
                                        disabled={isDeletingCredential}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Mode Config Section */}
            <div className="space-y-4 pt-4 border-t">
                <div>
                    <h3 className="font-medium">模式配置</h3>
                    <p className="text-sm text-muted-foreground">
                        为 Fast 和 Max 模式分别配置 Provider 和模型
                    </p>
                </div>

                {/* Mode Tabs */}
                <div className="flex gap-2">
                    <Button
                        variant={activeMode === "fast" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => setActiveMode("fast")}
                    >
                        <Zap className="h-4 w-4" />
                        Fast 模式
                    </Button>
                    <Button
                        variant={activeMode === "max" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => setActiveMode("max")}
                    >
                        <Brain className="h-4 w-4" />
                        Max 模式
                    </Button>
                </div>

                {/* Mode Config Form */}
                <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                    {/* Provider */}
                    <div className="space-y-2">
                        <Label>Provider</Label>
                        <Select
                            value={
                                (activeMode === "fast"
                                    ? fastProvider
                                    : maxProvider) || "default"
                            }
                            onValueChange={(v) => {
                                const value = v === "default" ? "" : v
                                if (activeMode === "fast") {
                                    setFastProvider(value)
                                    setFastCredentialName("")
                                } else {
                                    setMaxProvider(value)
                                    setMaxCredentialName("")
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="使用系统默认" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">
                                    使用系统默认
                                </SelectItem>
                                {providerOptions.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Credential */}
                    {currentProvider && (
                        <div className="space-y-2">
                            <Label>使用凭证</Label>
                            <Select
                                value={
                                    (activeMode === "fast"
                                        ? fastCredentialName
                                        : maxCredentialName) || "default"
                                }
                                onValueChange={(v) => {
                                    const value = v === "default" ? "" : v
                                    if (activeMode === "fast") {
                                        setFastCredentialName(value)
                                    } else {
                                        setMaxCredentialName(value)
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="使用默认凭证" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">
                                        使用默认凭证
                                    </SelectItem>
                                    {getCredentialsForProvider(
                                        currentProvider,
                                    ).map((c) => (
                                        <SelectItem key={c.name} value={c.name}>
                                            {c.name}
                                            {c.isDefault && " (默认)"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!hasCredentialForProvider(currentProvider) && (
                                <p className="text-xs text-destructive">
                                    请先添加该 Provider 的凭证
                                </p>
                            )}
                        </div>
                    )}

                    {/* Model */}
                    {currentProvider && (
                        <div className="space-y-2">
                            <Label>模型</Label>
                            <div className="relative">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={
                                            modelSearchValue || currentModelId
                                        }
                                        onChange={(e) => {
                                            setModelSearchValue(e.target.value)
                                            setIsModelMenuOpen(true)
                                        }}
                                        onFocus={() => {
                                            setModelSearchValue(currentModelId)
                                            setIsModelMenuOpen(true)
                                        }}
                                        onBlur={() => {
                                            setTimeout(() => {
                                                setIsModelMenuOpen(false)
                                                setModelSearchValue("")
                                            }, 150)
                                        }}
                                        placeholder="输入或选择模型"
                                        className="pl-8 pr-9"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() =>
                                            setIsModelMenuOpen((v) => !v)
                                        }
                                    >
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                                {isModelMenuOpen &&
                                    filteredModels.length > 0 && (
                                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                                            <div className="max-h-56 overflow-auto">
                                                {filteredModels
                                                    .slice(0, 100)
                                                    .map((m) => (
                                                        <button
                                                            key={m.id}
                                                            type="button"
                                                            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                                                            onMouseDown={(e) =>
                                                                e.preventDefault()
                                                            }
                                                            onClick={() =>
                                                                handleSelectModel(
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
                            <p className="text-xs text-muted-foreground">
                                {isLoadingModels
                                    ? "加载模型列表中..."
                                    : modelOptions.length > 0
                                      ? `已加载 ${modelOptions.length} 个模型`
                                      : "输入模型 ID 或配置凭证后自动加载"}
                            </p>
                        </div>
                    )}

                    {/* Save Button */}
                    <Button
                        className="w-full"
                        onClick={() => handleSaveModeConfig(activeMode)}
                        disabled={isSavingModeConfig}
                    >
                        {isSavingModeConfig ? "保存中..." : "保存配置"}
                    </Button>
                </div>
            </div>

            {/* Credential Dialog */}
            <Dialog
                open={isCredentialDialogOpen}
                onOpenChange={setIsCredentialDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingCredential ? "编辑凭证" : "添加凭证"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCredential
                                ? "修改凭证配置，留空 API Key 将保留原有值"
                                : "为 Provider 添加新的 API Key 凭证"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Provider</Label>
                            <Select
                                value={credentialForm.provider}
                                onValueChange={(v) =>
                                    setCredentialForm({
                                        ...credentialForm,
                                        provider: v,
                                    })
                                }
                                disabled={!!editingCredential}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择 Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    {providerOptions.map((p) => (
                                        <SelectItem
                                            key={p.value}
                                            value={p.value}
                                        >
                                            {p.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>凭证名称</Label>
                            <Input
                                value={credentialForm.name}
                                onChange={(e) =>
                                    setCredentialForm({
                                        ...credentialForm,
                                        name: e.target.value,
                                    })
                                }
                                placeholder="例如：default, backup"
                                disabled={!!editingCredential}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input
                                type="password"
                                value={credentialForm.apiKey}
                                onChange={(e) =>
                                    setCredentialForm({
                                        ...credentialForm,
                                        apiKey: e.target.value,
                                    })
                                }
                                placeholder={
                                    editingCredential
                                        ? "留空保留原有值"
                                        : "输入 API Key"
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Base URL (可选)</Label>
                            <Input
                                value={credentialForm.baseUrl}
                                onChange={(e) =>
                                    setCredentialForm({
                                        ...credentialForm,
                                        baseUrl: e.target.value,
                                    })
                                }
                                placeholder="留空使用默认"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsCredentialDialogOpen(false)}
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleSaveCredential}
                            disabled={isSavingCredential}
                        >
                            {isSavingCredential ? "保存中..." : "保存"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
