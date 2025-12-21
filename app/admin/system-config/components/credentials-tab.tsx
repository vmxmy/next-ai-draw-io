"use client"

import { Plus, Star, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/trpc/client"

interface ProviderCatalog {
    key: string
    displayName: string
    compatibility: string
    authType: string
    defaultBaseUrl: string | null
    isActive: boolean
}

interface CredentialsTabProps {
    providerCatalogs: ProviderCatalog[] | undefined
    hasWritePermission: boolean
}

interface CredentialForm {
    provider: string
    name: string
    apiKey: string
    baseUrl: string
    isDefault: boolean
}

const initialForm: CredentialForm = {
    provider: "",
    name: "default",
    apiKey: "",
    baseUrl: "",
    isDefault: false,
}

export function CredentialsTab({
    providerCatalogs,
    hasWritePermission,
}: CredentialsTabProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingCredential, setEditingCredential] = useState<{
        provider: string
        name: string
    } | null>(null)
    const [form, setForm] = useState<CredentialForm>(initialForm)

    const activeProviders = providerCatalogs?.filter((p) => p.isActive) || []

    // 获取所有凭证
    const {
        data: credentials,
        refetch,
        isLoading,
        error,
    } = api.systemCredential.adminList.useQuery(undefined, {
        retry: false,
    })

    // 调试：打印错误
    if (error) {
        console.error("[CredentialsTab] Query error:", error)
    }

    // 创建/更新凭证
    const upsertMutation = api.systemCredential.adminUpsert.useMutation({
        onSuccess: () => {
            toast.success(editingCredential ? "凭证已更新" : "凭证已创建")
            setIsDialogOpen(false)
            setEditingCredential(null)
            setForm(initialForm)
            void refetch()
        },
        onError: (error) => {
            toast.error(`操作失败：${error.message}`)
        },
    })

    // 删除凭证
    const deleteMutation = api.systemCredential.adminDelete.useMutation({
        onSuccess: () => {
            toast.success("凭证已删除")
            void refetch()
        },
        onError: (error) => {
            toast.error(`删除失败：${error.message}`)
        },
    })

    // 设置默认凭证
    const setDefaultMutation = api.systemCredential.adminSetDefault.useMutation(
        {
            onSuccess: () => {
                toast.success("已设为默认凭证")
                void refetch()
            },
            onError: (error) => {
                toast.error(`设置失败：${error.message}`)
            },
        },
    )

    const handleAddNew = () => {
        setEditingCredential(null)
        setForm(initialForm)
        setIsDialogOpen(true)
    }

    const handleEdit = (provider: string, name: string) => {
        const credential = credentials?.find(
            (c) => c.provider === provider && c.name === name,
        )
        if (credential) {
            setEditingCredential({ provider, name })
            setForm({
                provider: credential.provider,
                name: credential.name,
                apiKey: "", // 不回填 API Key
                baseUrl: credential.baseUrl || "",
                isDefault: credential.isDefault,
            })
            setIsDialogOpen(true)
        }
    }

    const handleDelete = (provider: string, name: string) => {
        if (confirm(`确定要删除凭证 "${name}" 吗？`)) {
            deleteMutation.mutate({ provider: provider as any, name })
        }
    }

    const handleSetDefault = (provider: string, name: string) => {
        setDefaultMutation.mutate({ provider: provider as any, name })
    }

    const handleSubmit = () => {
        if (!form.provider) {
            toast.error("请选择 Provider")
            return
        }
        if (!form.name.trim()) {
            toast.error("请输入凭证名称")
            return
        }
        // 新建时必须有 API Key
        if (!editingCredential && !form.apiKey) {
            toast.error("请输入 API Key")
            return
        }

        upsertMutation.mutate({
            provider: form.provider as any,
            name: form.name.trim(),
            apiKey: form.apiKey || undefined,
            baseUrl: form.baseUrl || undefined,
            isDefault: form.isDefault,
        })
    }

    // 按 provider 分组凭证
    const credentialsByProvider = credentials?.reduce(
        (acc, cred) => {
            if (!acc[cred.provider]) {
                acc[cred.provider] = []
            }
            acc[cred.provider].push(cred)
            return acc
        },
        {} as Record<string, typeof credentials>,
    )

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            连接凭证管理
                            <Badge variant="outline">系统层</Badge>
                        </CardTitle>
                        <CardDescription>
                            管理系统级 API Key，支持每个 Provider 配置多套凭证
                        </CardDescription>
                    </div>
                    <Button
                        onClick={handleAddNew}
                        disabled={!hasWritePermission}
                        size="sm"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        添加凭证
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                        加载中...
                    </div>
                ) : !credentials || credentials.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        暂无配置的凭证，点击"添加凭证"开始配置
                    </div>
                ) : (
                    activeProviders.map((provider) => {
                        const providerCredentials =
                            credentialsByProvider?.[provider.key] || []
                        if (providerCredentials.length === 0) return null

                        return (
                            <div
                                key={provider.key}
                                className="border rounded-lg"
                            >
                                <div className="px-4 py-3 bg-muted/30 border-b">
                                    <div className="font-medium">
                                        {provider.displayName}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono">
                                        {provider.key}
                                    </div>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[180px]">
                                                名称
                                            </TableHead>
                                            <TableHead>Base URL</TableHead>
                                            <TableHead className="w-[100px]">
                                                状态
                                            </TableHead>
                                            <TableHead className="w-[180px]">
                                                操作
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {providerCredentials.map((cred) => (
                                            <TableRow
                                                key={`${cred.provider}-${cred.name}`}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">
                                                            {cred.name}
                                                        </span>
                                                        {cred.isDefault && (
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-xs"
                                                            >
                                                                默认
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-sm text-muted-foreground truncate max-w-[200px] block">
                                                        {cred.baseUrl || "-"}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            cred.hasCredentials
                                                                ? "secondary"
                                                                : "outline"
                                                        }
                                                    >
                                                        {cred.hasCredentials
                                                            ? "已配置"
                                                            : "未配置"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {!cred.isDefault && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    handleSetDefault(
                                                                        cred.provider,
                                                                        cred.name,
                                                                    )
                                                                }
                                                                disabled={
                                                                    !hasWritePermission ||
                                                                    setDefaultMutation.isPending
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
                                                                handleEdit(
                                                                    cred.provider,
                                                                    cred.name,
                                                                )
                                                            }
                                                            disabled={
                                                                !hasWritePermission
                                                            }
                                                        >
                                                            编辑
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                handleDelete(
                                                                    cred.provider,
                                                                    cred.name,
                                                                )
                                                            }
                                                            disabled={
                                                                !hasWritePermission ||
                                                                deleteMutation.isPending
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )
                    })
                )}

                <div className="pt-4 border-t text-sm text-muted-foreground space-y-2">
                    <p>
                        <strong>提示：</strong>
                        每个 Provider 可配置多套凭证，在"系统默认"中可选择
                        Fast/Max 模式使用哪套凭证
                    </p>
                    <p>
                        <Star className="h-3 w-3 inline mr-1" />
                        标记为"默认"的凭证将在未指定凭证名称时使用
                    </p>
                </div>
            </CardContent>

            {/* 添加/编辑凭证对话框 */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                                value={form.provider}
                                onValueChange={(value) =>
                                    setForm({ ...form, provider: value })
                                }
                                disabled={!!editingCredential}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择 Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeProviders.map((p) => (
                                        <SelectItem key={p.key} value={p.key}>
                                            {p.displayName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>凭证名称</Label>
                            <Input
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                                placeholder="例如：default, backup, team-a"
                                disabled={!!editingCredential}
                            />
                            <p className="text-xs text-muted-foreground">
                                用于区分同一 Provider 的多套凭证
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input
                                value={form.apiKey}
                                onChange={(e) =>
                                    setForm({ ...form, apiKey: e.target.value })
                                }
                                type="password"
                                placeholder={
                                    editingCredential
                                        ? "留空保留原有值"
                                        : "输入 API Key"
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Base URL（可选）</Label>
                            <Input
                                value={form.baseUrl}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        baseUrl: e.target.value,
                                    })
                                }
                                placeholder="留空使用 Provider 默认值"
                            />
                            <p className="text-xs text-muted-foreground">
                                覆盖 Provider 目录中的默认端点
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={upsertMutation.isPending}
                        >
                            {upsertMutation.isPending ? "保存中..." : "保存"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
