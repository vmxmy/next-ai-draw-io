import { ChevronDown, HardDrive, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface ModelOption {
    id: string
    label?: string
}

interface ProviderCatalog {
    key: string
    displayName: string
    compatibility: string
    authType: string
    defaultBaseUrl: string | null
    isActive: boolean
}

interface ProviderOption {
    value: string
    label: string
}

interface SystemDefaultsTabProps {
    currentProvider: string
    currentModel: string
    currentBaseUrl: string
    currentApiKey: string
    currentProviderCatalog: ProviderCatalog | undefined
    providerOptions: ProviderOption[]
    modelOptions: ModelOption[]
    isLoadingModels: boolean
    isModelMenuOpen: boolean
    setIsModelMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
    modelSearchValue: string
    setModelSearchValue: React.Dispatch<React.SetStateAction<string>>
    hasWritePermission: boolean
    onQuickUpdate: (key: string, value: string) => void
    baseUrlInput: string
    setBaseUrlInput: React.Dispatch<React.SetStateAction<string>>
}

export function SystemDefaultsTab({
    currentProvider,
    currentModel,
    currentBaseUrl,
    currentApiKey,
    currentProviderCatalog,
    providerOptions,
    modelOptions,
    isLoadingModels,
    isModelMenuOpen,
    setIsModelMenuOpen,
    modelSearchValue,
    setModelSearchValue,
    hasWritePermission,
    onQuickUpdate,
    baseUrlInput,
    setBaseUrlInput,
}: SystemDefaultsTabProps) {
    const maskSecret = (value: string) => {
        if (!value) return "未配置"
        const trimmed = value.trim()
        if (trimmed.length <= 6) return "******"
        return `******${trimmed.slice(-6)}`
    }

    const formatBaseUrl = (value: string) => {
        if (!value) return "默认"
        if (value.length <= 36) return value
        return `${value.slice(0, 32)}...`
    }

    const effectiveBaseUrl =
        String(currentBaseUrl || "") ||
        currentProviderCatalog?.defaultBaseUrl ||
        ""

    const filteredModelOptions = modelOptions.filter((m) => {
        const query = modelSearchValue.trim().toLowerCase()
        if (!query) return true
        return (
            String(m.id).toLowerCase().includes(query) ||
            String(m.label || "")
                .toLowerCase()
                .includes(query)
        )
    })

    const currentProviderBaseUrlKey = `ai.${currentProvider}.baseUrl`

    return (
        <div className="space-y-6">
            {/* 配置层级引导 */}
            <Card>
                <CardHeader>
                    <CardTitle>配置层级</CardTitle>
                    <CardDescription>
                        直观理解 Provider 与系统配置的层级关系与生效顺序
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">用户 BYOK</Badge>
                        <span>→</span>
                        <Badge variant="outline">系统默认配置</Badge>
                        <span>→</span>
                        <Badge variant="outline">Provider 目录</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            {
                                title: "Provider 目录",
                                desc: "维护默认能力、Base URL、鉴权方式等基础参数",
                                badge: "3",
                            },
                            {
                                title: "系统默认配置",
                                desc: "选择默认 Provider/模型，并可覆盖 Base URL",
                                badge: "2",
                            },
                            {
                                title: "用户 BYOK",
                                desc: "客户端自定义连接优先级最高（覆盖系统默认）",
                                badge: "1",
                            },
                        ].map((item) => (
                            <div
                                key={item.title}
                                className="rounded-lg border bg-muted/20 p-4 space-y-2"
                            >
                                <Badge variant="outline">{item.badge}</Badge>
                                <div className="text-sm font-medium">
                                    {item.title}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {item.desc}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* AI 配置面板 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        默认 AI 配置
                        <Badge variant="outline">应用层</Badge>
                    </CardTitle>
                    <CardDescription>
                        管理系统默认 Provider 与模型，优先级低于用户自定义配置
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
                        <div className="text-sm text-muted-foreground">
                            当前生效链路
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                                Provider: {currentProvider}
                            </Badge>
                            <Badge variant="outline">
                                Catalog Base URL:{" "}
                                {formatBaseUrl(
                                    String(
                                        currentProviderCatalog?.defaultBaseUrl ||
                                            "",
                                    ),
                                )}
                            </Badge>
                            <Badge variant="outline">
                                System Base URL:{" "}
                                {formatBaseUrl(String(currentBaseUrl))}
                            </Badge>
                            <Badge variant="outline">
                                Effective:{" "}
                                {formatBaseUrl(String(effectiveBaseUrl))}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                                Auth: {currentProviderCatalog?.authType || "-"}
                            </Badge>
                            <Badge variant="outline">
                                Compat:{" "}
                                {currentProviderCatalog?.compatibility || "-"}
                            </Badge>
                            <Badge variant="outline">
                                API Key: {maskSecret(currentApiKey)}
                            </Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Provider 选择 */}
                        <div className="space-y-2">
                            <Label>默认 Provider</Label>
                            <Select
                                value={String(currentProvider)}
                                onValueChange={(value) => {
                                    onQuickUpdate("ai.default.provider", value)
                                }}
                                disabled={!hasWritePermission}
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
                            <div className="text-[0.8rem] text-muted-foreground">
                                仅影响未配置 BYOK 的请求
                            </div>
                        </div>

                        {/* Base URL 配置 */}
                        <div className="space-y-2">
                            <Label htmlFor="base-url">
                                Base URL（可选覆盖）
                            </Label>
                            <Input
                                id="base-url"
                                value={baseUrlInput}
                                onChange={(e) => {
                                    setBaseUrlInput(e.target.value)
                                }}
                                onBlur={(e) => {
                                    const value = e.target.value.trim()
                                    if (value !== currentBaseUrl) {
                                        onQuickUpdate(
                                            currentProviderBaseUrlKey,
                                            value,
                                        )
                                    }
                                }}
                                placeholder={
                                    currentProviderCatalog?.defaultBaseUrl ||
                                    "留空使用 Provider 目录默认"
                                }
                                disabled={!hasWritePermission}
                            />
                            <p className="text-[0.8rem] text-muted-foreground">
                                失焦后自动保存，留空则使用 Provider 目录的默认值
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* 模型选择 */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="ai-model"
                                className="flex items-center gap-1.5"
                            >
                                默认模型
                                {currentModel && (
                                    <HardDrive className="h-3 w-3 text-muted-foreground" />
                                )}
                            </Label>
                            <div className="relative">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="ai-model"
                                        value={
                                            modelSearchValue ||
                                            String(currentModel)
                                        }
                                        onChange={(e) => {
                                            setModelSearchValue(e.target.value)
                                            setIsModelMenuOpen(true)
                                        }}
                                        onFocus={() => {
                                            setModelSearchValue(
                                                String(currentModel),
                                            )
                                            setIsModelMenuOpen(true)
                                        }}
                                        onBlur={() => {
                                            setTimeout(() => {
                                                setIsModelMenuOpen(false)
                                                setModelSearchValue("")
                                            }, 150)
                                        }}
                                        placeholder="输入或选择模型 ID"
                                        className="pl-8 pr-9"
                                        disabled={!hasWritePermission}
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
                                            setIsModelMenuOpen((v) => !v)
                                        }
                                        disabled={!hasWritePermission}
                                    >
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                                {isModelMenuOpen &&
                                    filteredModelOptions.length > 0 && (
                                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                                            <div className="max-h-56 overflow-auto">
                                                {filteredModelOptions
                                                    .slice(0, 100)
                                                    .map((m) => (
                                                        <button
                                                            key={m.id}
                                                            type="button"
                                                            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                                                            onMouseDown={(
                                                                e,
                                                            ) => {
                                                                e.preventDefault()
                                                            }}
                                                            onClick={() => {
                                                                onQuickUpdate(
                                                                    "ai.default.model",
                                                                    m.id,
                                                                )
                                                                setIsModelMenuOpen(
                                                                    false,
                                                                )
                                                                setModelSearchValue(
                                                                    "",
                                                                )
                                                            }}
                                                        >
                                                            <span className="truncate">
                                                                {m.id}
                                                            </span>
                                                            {m.label ? (
                                                                <span className="ml-2 max-w-[45%] truncate text-xs text-muted-foreground">
                                                                    {m.label}
                                                                </span>
                                                            ) : null}
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                            </div>
                            <p className="text-[0.8rem] text-muted-foreground">
                                {isLoadingModels
                                    ? "加载模型列表中..."
                                    : modelOptions.length > 0
                                      ? `已加载 ${modelOptions.length} 个模型`
                                      : currentApiKey
                                        ? "无法加载模型列表"
                                        : "配置 API Key 后可自动加载模型"}
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                            提示：修改配置后，新的 AI 请求将使用更新后的设置；
                            客户端自定义配置（BYOK）优先级更高。
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
