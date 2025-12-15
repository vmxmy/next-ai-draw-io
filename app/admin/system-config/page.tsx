"use client"

import { redirect } from "next/navigation"
import { useSession } from "next-auth/react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

const AI_PROVIDERS = [
    { value: "openrouter", label: "OpenRouter" },
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic (Claude)" },
    { value: "google", label: "Google (Gemini)" },
    { value: "deepseek", label: "DeepSeek" },
    { value: "ollama", label: "Ollama (本地)" },
]

const POPULAR_MODELS = {
    openrouter: [
        "qwen/qwen-2.5-coder-32b-instruct",
        "deepseek/deepseek-chat",
        "anthropic/claude-3.5-sonnet",
        "openai/gpt-4o",
        "google/gemini-2.0-flash-exp:free",
    ],
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    anthropic: [
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
    ],
    google: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
}

export default function SystemConfigPage() {
    const { data: session, status } = useSession()
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<string>("")

    // 获取 AI 类别的配置
    const { data: configs, refetch } = api.systemConfig.adminList.useQuery(
        { category: "ai" },
        {
            enabled: status === "authenticated",
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

    // 权限检查
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)

    if (status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-lg text-muted-foreground">加载中...</div>
            </div>
        )
    }

    if (
        status === "unauthenticated" ||
        !adminEmails.includes(session?.user?.email || "")
    ) {
        redirect("/")
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
        })
    }

    const handleCancel = () => {
        setEditingKey(null)
        setEditValue("")
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
            "ai.fallback.models": "备用模型列表",
        }
        return labels[key] || key
    }

    return (
        <div className="container mx-auto p-8 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">系统配置管理</h1>
                <p className="text-muted-foreground">
                    管理 AI 模型、API 密钥等系统级配置，更改将立即生效（带 1
                    分钟缓存）
                </p>
            </div>

            {/* AI 配置快捷面板 */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>AI 模型快捷配置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Provider 选择 */}
                        <div className="space-y-2">
                            <Label>AI Provider</Label>
                            <Select
                                value={
                                    configs?.find(
                                        (c) => c.key === "ai.default.provider",
                                    )?.value as string
                                }
                                onValueChange={(value) => {
                                    updateMutation.mutate({
                                        key: "ai.default.provider",
                                        value,
                                    })
                                }}
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

                        {/* 模型选择 */}
                        <div className="space-y-2">
                            <Label>默认模型</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={
                                        configs?.find(
                                            (c) => c.key === "ai.default.model",
                                        )?.value as string
                                    }
                                    onChange={(_e) => {
                                        // 实时更新输入框，但不保存
                                    }}
                                    placeholder="输入模型 ID"
                                />
                                <Select
                                    onValueChange={(value) => {
                                        updateMutation.mutate({
                                            key: "ai.default.model",
                                            value,
                                        })
                                    }}
                                >
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="常用模型" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {POPULAR_MODELS.openrouter.map(
                                            (model) => (
                                                <SelectItem
                                                    key={model}
                                                    value={model}
                                                >
                                                    {model.split("/")[1] ||
                                                        model}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
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
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px]">
                                    配置项
                                </TableHead>
                                <TableHead>当前值</TableHead>
                                <TableHead>说明</TableHead>
                                <TableHead className="w-[120px]">
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
                                            typeof config.value === "object" ? (
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
                                    <TableCell className="text-sm text-muted-foreground">
                                        {config.description || "-"}
                                    </TableCell>
                                    <TableCell>
                                        {editingKey === config.key ? (
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleSave(config.key)
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
                                            >
                                                编辑
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {!configs || configs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            暂无配置数据
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            {/* 使用说明 */}
            <Card className="mt-6">
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
                            4. 备用模型列表：
                        </strong>
                        <p className="text-muted-foreground ml-4">
                            格式为 JSON 数组，当主模型失败时自动切换
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
