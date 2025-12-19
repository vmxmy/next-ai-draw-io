import { useState } from "react"
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface ProviderCatalog {
    key: string
    displayName: string
    compatibility: string
    authType: string
    defaultBaseUrl: string | null
    isActive: boolean
}

interface SystemConfig {
    key: string
    value: unknown
    description: string | null
}

interface CredentialsTabProps {
    configs: SystemConfig[] | undefined
    providerCatalogs: ProviderCatalog[] | undefined
    hasWritePermission: boolean
    onUpdateConfig: (key: string, value: string) => void
    isPending: boolean
}

export function CredentialsTab({
    configs,
    providerCatalogs,
    hasWritePermission,
    onUpdateConfig,
    isPending,
}: CredentialsTabProps) {
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [editValue, setEditValue] = useState("")

    const activeProviders = providerCatalogs?.filter((p) => p.isActive) || []

    const getConfigValue = (key: string): string => {
        const config = configs?.find((c) => c.key === key)
        return config?.value ? String(config.value) : ""
    }

    const maskSecret = (value: string) => {
        if (!value) return "未配置"
        const trimmed = value.trim()
        if (trimmed.length <= 8) return "********"
        return `********${trimmed.slice(-4)}`
    }

    const formatBaseUrl = (value: string) => {
        if (!value) return "-"
        if (value.length <= 40) return value
        return `${value.slice(0, 36)}...`
    }

    const handleEdit = (key: string, currentValue: string) => {
        setEditingKey(key)
        setEditValue(currentValue)
    }

    const handleSave = (key: string) => {
        onUpdateConfig(key, editValue)
        setEditingKey(null)
        setEditValue("")
    }

    const handleCancel = () => {
        setEditingKey(null)
        setEditValue("")
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    连接凭证配置
                    <Badge variant="outline">系统层</Badge>
                </CardTitle>
                <CardDescription>
                    为各 Provider 配置 API Key 和 Base URL 覆盖
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                    系统级凭证用于未配置 BYOK 的请求，用户自定义配置优先级更高
                </div>

                <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">
                                    Provider
                                </TableHead>
                                <TableHead>API Key</TableHead>
                                <TableHead>Base URL 覆盖</TableHead>
                                <TableHead className="w-[100px]">
                                    状态
                                </TableHead>
                                <TableHead className="w-[160px]">
                                    操作
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeProviders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        暂无启用的 Provider
                                    </TableCell>
                                </TableRow>
                            ) : (
                                activeProviders.map((provider) => {
                                    const apiKeyKey = `ai.${provider.key}.apiKey`
                                    const baseUrlKey = `ai.${provider.key}.baseUrl`
                                    const apiKeyValue =
                                        getConfigValue(apiKeyKey)
                                    const baseUrlValue =
                                        getConfigValue(baseUrlKey)
                                    const isEditingApiKey =
                                        editingKey === apiKeyKey
                                    const isEditingBaseUrl =
                                        editingKey === baseUrlKey

                                    return (
                                        <TableRow key={provider.key}>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {provider.displayName}
                                                </div>
                                                <div className="text-xs text-muted-foreground font-mono">
                                                    {provider.key}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {isEditingApiKey ? (
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            value={editValue}
                                                            onChange={(e) =>
                                                                setEditValue(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            type="password"
                                                            className="h-8 font-mono text-sm"
                                                            placeholder="输入 API Key"
                                                        />
                                                        <Button
                                                            size="sm"
                                                            onClick={() =>
                                                                handleSave(
                                                                    apiKeyKey,
                                                                )
                                                            }
                                                            disabled={isPending}
                                                        >
                                                            保存
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={
                                                                handleCancel
                                                            }
                                                        >
                                                            取消
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm text-muted-foreground">
                                                            {maskSecret(
                                                                apiKeyValue,
                                                            )}
                                                        </span>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                handleEdit(
                                                                    apiKeyKey,
                                                                    apiKeyValue,
                                                                )
                                                            }
                                                            disabled={
                                                                !hasWritePermission
                                                            }
                                                        >
                                                            编辑
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {isEditingBaseUrl ? (
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            value={editValue}
                                                            onChange={(e) =>
                                                                setEditValue(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="h-8 font-mono text-sm"
                                                            placeholder={
                                                                provider.defaultBaseUrl ||
                                                                "留空使用默认"
                                                            }
                                                        />
                                                        <Button
                                                            size="sm"
                                                            onClick={() =>
                                                                handleSave(
                                                                    baseUrlKey,
                                                                )
                                                            }
                                                            disabled={isPending}
                                                        >
                                                            保存
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={
                                                                handleCancel
                                                            }
                                                        >
                                                            取消
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="font-mono text-sm text-muted-foreground truncate max-w-[200px]"
                                                            title={
                                                                baseUrlValue ||
                                                                undefined
                                                            }
                                                        >
                                                            {formatBaseUrl(
                                                                baseUrlValue,
                                                            )}
                                                        </span>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                handleEdit(
                                                                    baseUrlKey,
                                                                    baseUrlValue,
                                                                )
                                                            }
                                                            disabled={
                                                                !hasWritePermission
                                                            }
                                                        >
                                                            编辑
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        apiKeyValue
                                                            ? "secondary"
                                                            : "outline"
                                                    }
                                                >
                                                    {apiKeyValue
                                                        ? "已配置"
                                                        : "未配置"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs text-muted-foreground">
                                                    {provider.authType ===
                                                    "none"
                                                        ? "无需鉴权"
                                                        : provider.authType ===
                                                            "aws"
                                                          ? "AWS 凭证"
                                                          : "API Key"}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="pt-4 border-t text-sm text-muted-foreground space-y-2">
                    <p>
                        <strong>提示：</strong>API Key
                        以加密形式存储，仅显示最后 4 位用于识别
                    </p>
                    <p>
                        Base URL 覆盖用于自定义接口地址（如代理），留空则使用
                        Provider 目录的默认值
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
