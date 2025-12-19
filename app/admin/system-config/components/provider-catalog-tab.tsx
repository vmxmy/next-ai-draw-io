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
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

interface SelectOption {
    value: string
    label: string
}

interface ProviderCatalogForm {
    key: string
    displayName: string
    compatibility: string
    authType: string
    defaultBaseUrl: string
    defaultModelId: string
    defaultHeaders: string
    defaultParams: string
    isBuiltin: boolean
    isActive: boolean
}

interface ProviderCatalog {
    key: string
    displayName: string
    compatibility: string
    authType: string
    defaultBaseUrl: string | null
    defaultModelId: string | null
    defaultHeaders: unknown
    defaultParams: unknown
    isBuiltin: boolean
    isActive: boolean
}

interface ProviderCatalogTabProps {
    providerCatalogs: ProviderCatalog[] | undefined
    isLoadingCatalogs: boolean
    providerForm: ProviderCatalogForm
    setProviderForm: React.Dispatch<React.SetStateAction<ProviderCatalogForm>>
    editingProviderKey: string | null
    setEditingProviderKey: React.Dispatch<React.SetStateAction<string | null>>
    hasWritePermission: boolean
    onProviderSave: () => void
    isPending: boolean
    // 动态选项（从数据库获取）
    compatibilityOptions: SelectOption[]
    authTypeOptions: SelectOption[]
}

export function ProviderCatalogTab({
    providerCatalogs,
    isLoadingCatalogs,
    providerForm,
    setProviderForm,
    editingProviderKey,
    setEditingProviderKey,
    hasWritePermission,
    onProviderSave,
    isPending,
    compatibilityOptions,
    authTypeOptions,
}: ProviderCatalogTabProps) {
    const getCompatibilityBadge = (value: string) =>
        value === "native" ? "secondary" : "outline"

    const getAuthBadge = (value: string) =>
        value === "apiKey" ? "secondary" : "outline"

    const handleProviderEditStart = (provider: ProviderCatalog) => {
        setEditingProviderKey(provider.key)
        const headers = provider.defaultHeaders
        const params = provider.defaultParams
        setProviderForm({
            key: provider.key,
            displayName: provider.displayName || "",
            compatibility: provider.compatibility || "openai_compat",
            authType: provider.authType || "apiKey",
            defaultBaseUrl: provider.defaultBaseUrl || "",
            defaultModelId: provider.defaultModelId || "",
            defaultHeaders:
                headers && typeof headers === "object"
                    ? JSON.stringify(headers, null, 2)
                    : "",
            defaultParams:
                params && typeof params === "object"
                    ? JSON.stringify(params, null, 2)
                    : "",
            isBuiltin: provider.isBuiltin ?? false,
            isActive: provider.isActive ?? true,
        })
    }

    const handleProviderCreate = () => {
        setEditingProviderKey("__new__")
        setProviderForm({
            key: "",
            displayName: "",
            compatibility: "openai_compat",
            authType: "apiKey",
            defaultBaseUrl: "",
            defaultModelId: "",
            defaultHeaders: "",
            defaultParams: "",
            isBuiltin: false,
            isActive: true,
        })
    }

    const handleProviderCancel = () => {
        setEditingProviderKey(null)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Provider 目录配置
                    <Badge variant="outline">基础层</Badge>
                </CardTitle>
                <CardDescription>
                    管理内置与自定义 Provider 的默认参数配置
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                        默认参数用于统一展示和预填，不影响用户 BYOK 配置优先级
                    </p>
                    <Button
                        size="sm"
                        onClick={handleProviderCreate}
                        disabled={!hasWritePermission}
                    >
                        新增 Provider
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <Table className="min-w-[900px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Key</TableHead>
                                <TableHead>显示名称</TableHead>
                                <TableHead>兼容模式</TableHead>
                                <TableHead>鉴权方式</TableHead>
                                <TableHead>默认 Base URL</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead className="w-[120px]">
                                    操作
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingCatalogs ? (
                                <TableRow>
                                    <TableCell colSpan={7}>加载中...</TableCell>
                                </TableRow>
                            ) : providerCatalogs &&
                              providerCatalogs.length > 0 ? (
                                providerCatalogs.map((provider) => (
                                    <TableRow key={provider.key}>
                                        <TableCell className="font-mono text-sm">
                                            {provider.key}
                                        </TableCell>
                                        <TableCell>
                                            {provider.displayName}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={getCompatibilityBadge(
                                                    provider.compatibility,
                                                )}
                                            >
                                                {provider.compatibility}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={getAuthBadge(
                                                    provider.authType,
                                                )}
                                            >
                                                {provider.authType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[240px] truncate">
                                            {provider.defaultBaseUrl || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={
                                                        provider.isActive
                                                            ? "secondary"
                                                            : "outline"
                                                    }
                                                >
                                                    {provider.isActive
                                                        ? "启用"
                                                        : "停用"}
                                                </Badge>
                                                {provider.isBuiltin ? (
                                                    <Badge variant="outline">
                                                        内置
                                                    </Badge>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    handleProviderEditStart(
                                                        provider,
                                                    )
                                                }
                                                disabled={!hasWritePermission}
                                            >
                                                编辑
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7}>
                                        暂无 Provider 配置
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {editingProviderKey && (
                    <div className="space-y-4 border-t pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="provider-key">
                                    Provider Key
                                </Label>
                                <Input
                                    id="provider-key"
                                    value={providerForm.key}
                                    onChange={(e) =>
                                        setProviderForm((prev) => ({
                                            ...prev,
                                            key: e.target.value,
                                        }))
                                    }
                                    disabled={
                                        !hasWritePermission ||
                                        editingProviderKey !== "__new__"
                                    }
                                />
                                <p className="text-[0.8rem] text-muted-foreground">
                                    建议使用小写+下划线，例如 openai_compatible
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="provider-display-name">
                                    显示名称
                                </Label>
                                <Input
                                    id="provider-display-name"
                                    value={providerForm.displayName}
                                    onChange={(e) =>
                                        setProviderForm((prev) => ({
                                            ...prev,
                                            displayName: e.target.value,
                                        }))
                                    }
                                    disabled={!hasWritePermission}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>兼容模式</Label>
                                <Select
                                    value={providerForm.compatibility}
                                    onValueChange={(value) =>
                                        setProviderForm((prev) => ({
                                            ...prev,
                                            compatibility: value,
                                        }))
                                    }
                                    disabled={!hasWritePermission}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择兼容模式" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {compatibilityOptions.map((item) => (
                                            <SelectItem
                                                key={item.value}
                                                value={item.value}
                                            >
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>鉴权方式</Label>
                                <Select
                                    value={providerForm.authType}
                                    onValueChange={(value) =>
                                        setProviderForm((prev) => ({
                                            ...prev,
                                            authType: value,
                                        }))
                                    }
                                    disabled={!hasWritePermission}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择鉴权方式" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {authTypeOptions.map((item) => (
                                            <SelectItem
                                                key={item.value}
                                                value={item.value}
                                            >
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="provider-base-url">
                                    默认 Base URL
                                </Label>
                                <Input
                                    id="provider-base-url"
                                    value={providerForm.defaultBaseUrl}
                                    onChange={(e) =>
                                        setProviderForm((prev) => ({
                                            ...prev,
                                            defaultBaseUrl: e.target.value,
                                        }))
                                    }
                                    placeholder="留空使用 SDK 默认"
                                    disabled={!hasWritePermission}
                                />
                                <p className="text-[0.8rem] text-muted-foreground">
                                    若兼容 OpenAI，建议以 /v1 结尾
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="provider-model-id">
                                    默认模型 ID
                                </Label>
                                <Input
                                    id="provider-model-id"
                                    value={providerForm.defaultModelId}
                                    onChange={(e) =>
                                        setProviderForm((prev) => ({
                                            ...prev,
                                            defaultModelId: e.target.value,
                                        }))
                                    }
                                    placeholder="可选"
                                    disabled={!hasWritePermission}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="provider-headers">
                                    Default Headers (JSON)
                                </Label>
                                <Textarea
                                    id="provider-headers"
                                    value={providerForm.defaultHeaders}
                                    onChange={(e) =>
                                        setProviderForm((prev) => ({
                                            ...prev,
                                            defaultHeaders: e.target.value,
                                        }))
                                    }
                                    placeholder='{"x-foo":"bar"}'
                                    rows={4}
                                    disabled={!hasWritePermission}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="provider-params">
                                    Default Params (JSON)
                                </Label>
                                <Textarea
                                    id="provider-params"
                                    value={providerForm.defaultParams}
                                    onChange={(e) =>
                                        setProviderForm((prev) => ({
                                            ...prev,
                                            defaultParams: e.target.value,
                                        }))
                                    }
                                    placeholder='{"apiVersion":"2024-02-15-preview"}'
                                    rows={4}
                                    disabled={!hasWritePermission}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={providerForm.isActive}
                                    onCheckedChange={(value) =>
                                        setProviderForm((prev) => ({
                                            ...prev,
                                            isActive: value,
                                        }))
                                    }
                                    disabled={!hasWritePermission}
                                />
                                <span className="text-sm">启用 Provider</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {providerForm.isBuiltin
                                    ? "内置 Provider"
                                    : "自定义 Provider"}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                onClick={onProviderSave}
                                disabled={!hasWritePermission || isPending}
                            >
                                保存
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleProviderCancel}
                            >
                                取消
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
