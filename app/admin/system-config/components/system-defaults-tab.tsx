"use client"

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
import { api } from "@/lib/trpc/client"

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
    currentCredential: string
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
    maxProvider: string
    maxModel: string
    maxCredential: string
    // Max 模式模型选择
    maxModelOptions: ModelOption[]
    isLoadingMaxModels: boolean
    isMaxModelMenuOpen: boolean
    setIsMaxModelMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
    maxModelSearchValue: string
    setMaxModelSearchValue: React.Dispatch<React.SetStateAction<string>>
}

export function SystemDefaultsTab({
    currentProvider,
    currentModel,
    currentCredential,
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
    maxProvider,
    maxModel,
    maxCredential,
    maxModelOptions,
    isLoadingMaxModels,
    isMaxModelMenuOpen,
    setIsMaxModelMenuOpen,
    maxModelSearchValue,
    setMaxModelSearchValue,
}: SystemDefaultsTabProps) {
    // 获取所有凭证
    const { data: credentials } = api.systemCredential.adminList.useQuery()

    // 获取当前 provider 的凭证选项
    const getCredentialOptions = (provider: string) => {
        return (
            credentials
                ?.filter((c) => c.provider === provider)
                .map((c) => ({
                    value: c.name,
                    label: c.isDefault ? `${c.name} (默认)` : c.name,
                })) || []
        )
    }

    const fastCredentialOptions = getCredentialOptions(currentProvider)
    const maxCredentialOptions = getCredentialOptions(
        maxProvider || currentProvider,
    )

    // 获取当前选中凭证的信息
    const currentCredentialInfo = credentials?.find(
        (c) => c.provider === currentProvider && c.name === currentCredential,
    )

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

    const filteredMaxModelOptions = maxModelOptions.filter((m) => {
        const query = maxModelSearchValue.trim().toLowerCase()
        if (!query) return true
        return (
            String(m.id).toLowerCase().includes(query) ||
            String(m.label || "")
                .toLowerCase()
                .includes(query)
        )
    })

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

            {/* Fast 模式配置面板 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Fast 模式配置
                        <Badge variant="outline">快速响应</Badge>
                    </CardTitle>
                    <CardDescription>
                        用于日常对话，优先选择响应速度快、成本低的模型
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
                        <div className="text-sm text-muted-foreground">
                            当前配置
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                                Provider: {currentProvider}
                            </Badge>
                            <Badge variant="outline">
                                凭证: {currentCredential || "默认"}
                            </Badge>
                            <Badge variant="outline">
                                Model: {currentModel || "未配置"}
                            </Badge>
                            {currentCredentialInfo?.hasCredentials ? (
                                <Badge variant="secondary">
                                    API Key 已配置
                                </Badge>
                            ) : (
                                <Badge variant="destructive">
                                    API Key 未配置
                                </Badge>
                            )}
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

                        {/* 凭证选择 */}
                        <div className="space-y-2">
                            <Label>使用凭证</Label>
                            <Select
                                value={currentCredential || ""}
                                onValueChange={(value) => {
                                    onQuickUpdate(
                                        "ai.default.credential",
                                        value,
                                    )
                                }}
                                disabled={!hasWritePermission}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="使用默认凭证" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fastCredentialOptions.length === 0 ? (
                                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                            请先在"连接凭证"中配置
                                        </div>
                                    ) : (
                                        fastCredentialOptions.map((c) => (
                                            <SelectItem
                                                key={c.value}
                                                value={c.value}
                                            >
                                                {c.label}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <div className="text-[0.8rem] text-muted-foreground">
                                选择该 Provider 使用的 API Key 凭证
                            </div>
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
                                      : currentCredentialInfo?.hasCredentials
                                        ? "无法加载模型列表"
                                        : "配置凭证后可自动加载模型"}
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                            提示：Fast 模式适合日常对话，响应速度快、成本低
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Max 模式配置面板 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Max 模式配置
                        <Badge variant="secondary">深度思考</Badge>
                    </CardTitle>
                    <CardDescription>
                        用于复杂任务，优先选择推理能力强的模型（如需要深度分析时）
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
                        <div className="text-sm text-muted-foreground">
                            当前配置
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                                Provider: {maxProvider || "未配置（继承 Fast）"}
                            </Badge>
                            <Badge variant="outline">
                                Model: {maxModel || "未配置（继承 Fast）"}
                            </Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Max Provider 选择 */}
                        <div className="space-y-2">
                            <Label>Max 模式 Provider</Label>
                            <Select
                                value={maxProvider || ""}
                                onValueChange={(value) => {
                                    onQuickUpdate("ai.max.provider", value)
                                }}
                                disabled={!hasWritePermission}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="未配置（继承 Fast 模式）" />
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
                                未配置时继承 Fast 模式的 Provider
                            </div>
                        </div>

                        {/* Max 凭证选择 */}
                        <div className="space-y-2">
                            <Label>使用凭证</Label>
                            <Select
                                value={maxCredential || ""}
                                onValueChange={(value) => {
                                    onQuickUpdate("ai.max.credential", value)
                                }}
                                disabled={!hasWritePermission}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="未配置（继承 Fast 模式）" />
                                </SelectTrigger>
                                <SelectContent>
                                    {maxCredentialOptions.length === 0 ? (
                                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                            请先在"连接凭证"中配置
                                        </div>
                                    ) : (
                                        maxCredentialOptions.map((c) => (
                                            <SelectItem
                                                key={c.value}
                                                value={c.value}
                                            >
                                                {c.label}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <div className="text-[0.8rem] text-muted-foreground">
                                未配置时继承 Fast 模式的凭证
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Max Model 选择 */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="max-model"
                                className="flex items-center gap-1.5"
                            >
                                Max 模式模型
                                {maxModel && (
                                    <HardDrive className="h-3 w-3 text-muted-foreground" />
                                )}
                            </Label>
                            <div className="relative">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="max-model"
                                        value={
                                            maxModelSearchValue ||
                                            String(maxModel)
                                        }
                                        onChange={(e) => {
                                            setMaxModelSearchValue(
                                                e.target.value,
                                            )
                                            setIsMaxModelMenuOpen(true)
                                        }}
                                        onFocus={() => {
                                            setMaxModelSearchValue(
                                                String(maxModel),
                                            )
                                            setIsMaxModelMenuOpen(true)
                                        }}
                                        onBlur={() => {
                                            setTimeout(() => {
                                                setIsMaxModelMenuOpen(false)
                                                setMaxModelSearchValue("")
                                            }, 150)
                                        }}
                                        placeholder="输入或选择模型 ID（留空继承 Fast）"
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
                                            setIsMaxModelMenuOpen((v) => !v)
                                        }
                                        disabled={!hasWritePermission}
                                    >
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                                {isMaxModelMenuOpen &&
                                    filteredMaxModelOptions.length > 0 && (
                                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                                            <div className="max-h-56 overflow-auto">
                                                {filteredMaxModelOptions
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
                                                                    "ai.max.model",
                                                                    m.id,
                                                                )
                                                                setIsMaxModelMenuOpen(
                                                                    false,
                                                                )
                                                                setMaxModelSearchValue(
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
                                {isLoadingMaxModels
                                    ? "加载模型列表中..."
                                    : maxModelOptions.length > 0
                                      ? `已加载 ${maxModelOptions.length} 个模型`
                                      : "留空则继承 Fast 模式的模型"}
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                            提示：Max 模式适合复杂任务，推理能力更强但成本更高；
                            用户可通过点击聊天框左侧的🧠按钮切换模式
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
