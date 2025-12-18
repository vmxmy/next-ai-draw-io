"use client"

import { ChevronDown, HardDrive, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/trpc/client"
import { usePermission } from "@/lib/use-permissions"

const AI_PROVIDERS = [
    { value: "openrouter", label: "OpenRouter" },
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic (Claude)" },
    { value: "google", label: "Google (Gemini)" },
    { value: "deepseek", label: "DeepSeek" },
    { value: "siliconflow", label: "SiliconFlow" },
    { value: "ollama", label: "Ollama (本地)" },
]

interface ModelOption {
    id: string
    label?: string
}

export default function SystemConfigPage() {
    const hasReadPermission = usePermission("system:read")
    const hasWritePermission = usePermission("system:write")

    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<string>("")

    // 模型选择相关状态
    const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
    const [modelSearchValue, setModelSearchValue] = useState("")

    // Base URL 本地编辑状态
    const [baseUrlInput, setBaseUrlInput] = useState<string>("")

    // 获取 AI 类别的配置
    const { data: configs, refetch } = api.systemConfig.adminList.useQuery(
        { category: "ai" },
        {
            enabled: hasReadPermission,
        },
    )

    // 更新配置
    const updateMutation = api.systemConfig.adminUpdate.useMutation({
        onSuccess: () => {
            toast.success("配置已更新")
            void refetch()
            setEditingKey(null)
            setEditValue("")
        },
        onError: (error) => {
            toast.error(`更新失败：${error.message}`)
        },
    })

    // 获取当前 provider 和 API key（用于加载模型）
    const currentProvider =
        configs?.find((c) => c.key === "ai.default.provider")?.value ||
        "openrouter"
    const currentApiKey =
        configs?.find((c) => c.key === `ai.${currentProvider}.apiKey`)?.value ||
        ""
    const currentBaseUrl =
        configs?.find((c) => c.key === `ai.${currentProvider}.baseUrl`)
            ?.value || ""
    const currentModel =
        configs?.find((c) => c.key === "ai.default.model")?.value || ""

    // 同步 base URL 到本地状态
    useEffect(() => {
        setBaseUrlInput(String(currentBaseUrl))
    }, [currentBaseUrl])

    // 自动加载模型列表（参考 settings-dialog 实现）
    useEffect(() => {
        if (!currentProvider) {
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
                    provider: currentProvider,
                    apiKey: currentApiKey,
                    baseUrl: currentBaseUrl,
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
    }, [currentProvider, currentApiKey, currentBaseUrl])

    // 权限检查
    if (!hasReadPermission) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-destructive">403</h1>
                    <p className="mt-2 text-lg">访问被拒绝</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        您没有权限访问此页面
                    </p>
                </div>
            </div>
        )
    }

    const handleEdit = (key: string, currentValue: any) => {
        setEditingKey(key)
        setEditValue(
            typeof currentValue === "string"
                ? currentValue
                : JSON.stringify(currentValue, null, 2),
        )
    }

    const handleSave = (key: string) => {
        let parsedValue: any
        try {
            // 尝试解析 JSON
            parsedValue = JSON.parse(editValue)
        } catch {
            // 如果不是 JSON，就当字符串
            parsedValue = editValue
        }

        updateMutation.mutate({
            key,
            value: parsedValue,
            category: "ai",
        })
    }

    const handleCancel = () => {
        setEditingKey(null)
        setEditValue("")
    }

    const handleQuickUpdate = (key: string, value: any) => {
        updateMutation.mutate({ key, value, category: "ai" })
    }

    const getDisplayValue = (value: any) => {
        if (typeof value === "string") return value
        return JSON.stringify(value, null, 2)
    }

    const getConfigLabel = (key: string) => {
        const labels: Record<string, string> = {
            "ai.default.provider": "默认 AI Provider",
            "ai.default.model": "默认 AI 模型",
            "ai.openrouter.apiKey": "OpenRouter API Key",
            "ai.openrouter.baseUrl": "OpenRouter Base URL",
            "ai.openai.apiKey": "OpenAI API Key",
            "ai.openai.baseUrl": "OpenAI Base URL",
            "ai.anthropic.apiKey": "Anthropic API Key",
            "ai.anthropic.baseUrl": "Anthropic Base URL",
            "ai.google.apiKey": "Google API Key",
            "ai.google.baseUrl": "Google Base URL",
            "ai.deepseek.apiKey": "DeepSeek API Key",
            "ai.deepseek.baseUrl": "DeepSeek Base URL",
            "ai.siliconflow.apiKey": "SiliconFlow API Key",
            "ai.siliconflow.baseUrl": "SiliconFlow Base URL",
            "ai.ollama.baseUrl": "Ollama Base URL",
            "ai.fallback.models": "备用模型列表",
        }
        return labels[key] || key
    }

    // 过滤模型选项
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold">系统配置管理</h1>
                <p className="text-muted-foreground mt-2">
                    管理 AI 模型、API 密钥等系统级配置，更改将立即生效（带 1
                    分钟缓存）
                </p>
            </div>

            {/* AI 配置快捷面板 */}
            <Card>
                <CardHeader>
                    <CardTitle>AI 模型快捷配置</CardTitle>
                    <CardDescription>
                        快速配置默认 AI 提供商和模型
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Provider 选择 */}
                        <div className="space-y-2">
                            <Label>AI Provider</Label>
                            <Select
                                value={String(currentProvider)}
                                onValueChange={(value) => {
                                    handleQuickUpdate(
                                        "ai.default.provider",
                                        value,
                                    )
                                }}
                                disabled={!hasWritePermission}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择 Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    {AI_PROVIDERS.map((p) => (
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

                        {/* Base URL 配置 */}
                        <div className="space-y-2">
                            <Label htmlFor="base-url">Base URL（可选）</Label>
                            <Input
                                id="base-url"
                                value={baseUrlInput}
                                onChange={(e) => {
                                    setBaseUrlInput(e.target.value)
                                }}
                                onBlur={(e) => {
                                    const value = e.target.value.trim()
                                    // 只有当值改变时才更新
                                    if (value !== currentBaseUrl) {
                                        handleQuickUpdate(
                                            `ai.${currentProvider}.baseUrl`,
                                            value,
                                        )
                                    }
                                }}
                                placeholder={
                                    currentProvider === "openrouter"
                                        ? "https://openrouter.ai/api/v1"
                                        : currentProvider === "openai"
                                          ? "https://api.openai.com/v1"
                                          : currentProvider === "anthropic"
                                            ? "https://api.anthropic.com"
                                            : currentProvider === "google"
                                              ? "https://generativelanguage.googleapis.com"
                                              : currentProvider === "deepseek"
                                                ? "https://api.deepseek.com"
                                                : currentProvider ===
                                                    "siliconflow"
                                                  ? "https://api.siliconflow.cn/v1"
                                                  : currentProvider === "ollama"
                                                    ? "http://localhost:11434"
                                                    : "留空使用默认地址"
                                }
                                disabled={!hasWritePermission}
                            />
                            <p className="text-[0.8rem] text-muted-foreground">
                                自定义 API 端点地址，留空则使用提供商默认地址
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* 模型选择 - 参考 settings-dialog 实现 */}
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
                                        placeholder={
                                            currentProvider === "openai"
                                                ? "e.g., gpt-4o"
                                                : currentProvider ===
                                                    "anthropic"
                                                  ? "e.g., claude-3-5-sonnet-latest"
                                                  : currentProvider === "google"
                                                    ? "e.g., gemini-2.0-flash-exp"
                                                    : currentProvider ===
                                                        "deepseek"
                                                      ? "e.g., deepseek-chat"
                                                      : "输入或选择模型 ID"
                                        }
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
                                                                handleQuickUpdate(
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
                            💡 提示：修改配置后，新的 AI
                            请求将使用更新后的设置。客户端自定义配置（BYOK）优先级更高。
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* 完整配置表格 */}
            <Card>
                <CardHeader>
                    <CardTitle>完整配置列表</CardTitle>
                    <CardDescription>所有系统配置项的详细视图</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table className="min-w-[700px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">
                                        配置项
                                    </TableHead>
                                    <TableHead>当前值</TableHead>
                                    <TableHead className="hidden md:table-cell">
                                        说明
                                    </TableHead>
                                    <TableHead className="w-[100px]">
                                        操作
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {configs?.map((config) => (
                                    <TableRow key={config.key}>
                                        <TableCell className="font-mono text-sm">
                                            {getConfigLabel(config.key)}
                                        </TableCell>
                                        <TableCell>
                                            {editingKey === config.key ? (
                                                Array.isArray(config.value) ||
                                                typeof config.value ===
                                                    "object" ? (
                                                    <Textarea
                                                        value={editValue}
                                                        onChange={(e) =>
                                                            setEditValue(
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="font-mono text-xs"
                                                        rows={5}
                                                    />
                                                ) : (
                                                    <Input
                                                        value={editValue}
                                                        onChange={(e) =>
                                                            setEditValue(
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="font-mono text-sm"
                                                    />
                                                )
                                            ) : (
                                                <div className="max-w-md">
                                                    {config.key.includes(
                                                        "apiKey",
                                                    ) ? (
                                                        <span className="text-muted-foreground">
                                                            {config.value
                                                                ? "••••••••" +
                                                                  String(
                                                                      config.value,
                                                                  ).slice(-8)
                                                                : "未配置"}
                                                        </span>
                                                    ) : (
                                                        <pre className="text-xs overflow-auto">
                                                            {getDisplayValue(
                                                                config.value,
                                                            )}
                                                        </pre>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                            {config.description || "-"}
                                        </TableCell>
                                        <TableCell>
                                            {editingKey === config.key ? (
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            handleSave(
                                                                config.key,
                                                            )
                                                        }
                                                        disabled={
                                                            updateMutation.isPending
                                                        }
                                                    >
                                                        保存
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={handleCancel}
                                                    >
                                                        取消
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleEdit(
                                                            config.key,
                                                            config.value,
                                                        )
                                                    }
                                                    disabled={
                                                        !hasWritePermission
                                                    }
                                                >
                                                    编辑
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {!configs || configs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            暂无配置数据
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            {/* 使用说明 */}
            <Card>
                <CardHeader>
                    <CardTitle>使用说明</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div>
                        <strong className="text-foreground">
                            1. 配置优先级：
                        </strong>
                        <p className="text-muted-foreground ml-4">
                            客户端自定义（BYOK） {">"} 数据库配置 {">"} 环境变量
                        </p>
                    </div>
                    <div>
                        <strong className="text-foreground">
                            2. 生效时间：
                        </strong>
                        <p className="text-muted-foreground ml-4">
                            立即生效，带 1 分钟缓存（最多延迟 1 分钟）
                        </p>
                    </div>
                    <div>
                        <strong className="text-foreground">
                            3. API Key 安全：
                        </strong>
                        <p className="text-muted-foreground ml-4">
                            API Key 仅显示后 8 位，完整密钥仅服务端可见
                        </p>
                    </div>
                    <div>
                        <strong className="text-foreground">
                            4. 自动加载模型：
                        </strong>
                        <p className="text-muted-foreground ml-4">
                            配置 API Key 后，系统会自动从提供商加载可用模型列表
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
