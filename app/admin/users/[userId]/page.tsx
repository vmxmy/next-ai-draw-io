"use client"

import { ArrowLeft, Calendar, Mail, Phone, User, UserCog } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { PermissionGate } from "@/components/admin/permission-gate"
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

function formatDate(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export default function UserDetailPage({
    params,
}: {
    params: { userId: string }
}) {
    const router = useRouter()
    const [editingTier, setEditingTier] = useState(false)
    const [newTier, setNewTier] = useState("")

    const {
        data: user,
        isLoading,
        refetch,
    } = api.userManagement.getDetail.useQuery({
        userId: params.userId,
    })

    const { data: quotaDetail } =
        api.quotaMonitoring.getUserQuotaDetail.useQuery({
            userId: params.userId,
        })

    const { data: userHistory } = api.auditLog.getUserHistory.useQuery({
        userId: params.userId,
        limit: 20,
    })

    const { data: roles } = api.userManagement.listRoles.useQuery()

    const updateMutation = api.userManagement.update.useMutation({
        onSuccess: () => {
            void refetch()
            setEditingTier(false)
        },
    })

    const suspendMutation = api.userManagement.suspend.useMutation({
        onSuccess: () => {
            void refetch()
        },
    })

    const activateMutation = api.userManagement.activate.useMutation({
        onSuccess: () => {
            void refetch()
        },
    })

    const assignRoleMutation = api.userManagement.assignRole.useMutation({
        onSuccess: () => {
            void refetch()
        },
    })

    const removeRoleMutation = api.userManagement.removeRole.useMutation({
        onSuccess: () => {
            void refetch()
        },
    })

    const handleUpdateTier = async () => {
        if (newTier) {
            await updateMutation.mutateAsync({
                userId: params.userId,
                tier: newTier,
            })
        }
    }

    const handleSuspend = async () => {
        if (confirm("确定要禁用此用户吗？")) {
            await suspendMutation.mutateAsync({ userId: params.userId })
        }
    }

    const handleActivate = async () => {
        if (confirm("确定要启用此用户吗？")) {
            await activateMutation.mutateAsync({ userId: params.userId })
        }
    }

    const handleAssignRole = async (roleId: string) => {
        await assignRoleMutation.mutateAsync({
            userId: params.userId,
            roleId,
        })
    }

    const handleRemoveRole = async (roleId: string) => {
        if (confirm("确定要移除此角色吗？")) {
            await removeRoleMutation.mutateAsync({
                userId: params.userId,
                roleId,
            })
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
                    <p className="mt-4 text-sm text-muted-foreground">
                        加载用户信息...
                    </p>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-lg font-semibold">用户不存在</p>
                    <Button
                        onClick={() => router.push("/admin/users")}
                        className="mt-4"
                    >
                        返回用户列表
                    </Button>
                </div>
            </div>
        )
    }

    const userRoleIds =
        ((user as any).roles as any[] | undefined)?.map(
            (ur: any) => ur.roleId,
        ) ?? []
    const availableRoles =
        roles?.filter((r) => !userRoleIds.includes(r.id)) ?? []

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push("/admin/users")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {user.name ?? "未设置"}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {user.email}
                        </p>
                    </div>
                </div>
                <PermissionGate permission="users:write">
                    <div className="flex gap-2">
                        {user.status === "active" ? (
                            <Button
                                variant="destructive"
                                onClick={handleSuspend}
                                disabled={suspendMutation.isPending}
                            >
                                禁用用户
                            </Button>
                        ) : (
                            <Button
                                variant="default"
                                onClick={handleActivate}
                                disabled={activateMutation.isPending}
                            >
                                启用用户
                            </Button>
                        )}
                    </div>
                </PermissionGate>
            </div>

            {/* Basic Info */}
            <Card>
                <CardHeader>
                    <CardTitle>基本信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">邮箱:</span>
                            <span className="text-sm">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">姓名:</span>
                            <span className="text-sm">
                                {user.name ?? "未设置"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">手机:</span>
                            <span className="text-sm">
                                {user.phone ?? "未绑定"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                                注册时间:
                            </span>
                            <span className="text-sm">
                                {formatDate(user.createdAt)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t">
                        <span className="text-sm font-medium">等级:</span>
                        {editingTier ? (
                            <div className="flex items-center gap-2">
                                <Select
                                    value={newTier}
                                    onValueChange={setNewTier}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="选择等级" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="free">
                                            Free
                                        </SelectItem>
                                        <SelectItem value="basic">
                                            Basic
                                        </SelectItem>
                                        <SelectItem value="pro">Pro</SelectItem>
                                        <SelectItem value="enterprise">
                                            Enterprise
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    size="sm"
                                    onClick={handleUpdateTier}
                                    disabled={updateMutation.isPending}
                                >
                                    保存
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingTier(false)}
                                >
                                    取消
                                </Button>
                            </div>
                        ) : (
                            <>
                                <Badge variant="outline" className="capitalize">
                                    {user.tier}
                                </Badge>
                                <PermissionGate permission="users:write">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            setNewTier(user.tier)
                                            setEditingTier(true)
                                        }}
                                    >
                                        修改
                                    </Button>
                                </PermissionGate>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">状态:</span>
                        {user.status === "active" ? (
                            <Badge
                                variant="outline"
                                className="border-green-500 text-green-700"
                            >
                                活跃
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="border-red-500 text-red-700"
                            >
                                禁用
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Roles */}
            <Card>
                <CardHeader>
                    <CardTitle>角色和权限</CardTitle>
                    <CardDescription>用户当前拥有的角色及权限</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {(user as any).roles.map((ur: any) => (
                            <div
                                key={ur.roleId}
                                className="flex items-center gap-2 rounded-lg border p-2"
                            >
                                <UserCog className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                    {ur.role.displayName}
                                </span>
                                <PermissionGate permission="users:write">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            handleRemoveRole(ur.roleId)
                                        }
                                        disabled={removeRoleMutation.isPending}
                                        className="h-6 w-6 p-0"
                                    >
                                        ×
                                    </Button>
                                </PermissionGate>
                            </div>
                        ))}
                        {(user as any).roles.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                未分配任何角色
                            </p>
                        )}
                    </div>

                    <PermissionGate permission="users:write">
                        {availableRoles.length > 0 && (
                            <div className="pt-4 border-t">
                                <p className="text-sm font-medium mb-2">
                                    分配新角色:
                                </p>
                                <Select onValueChange={handleAssignRole}>
                                    <SelectTrigger className="w-[240px]">
                                        <SelectValue placeholder="选择角色" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableRoles.map((role) => (
                                            <SelectItem
                                                key={role.id}
                                                value={role.id}
                                            >
                                                {role.displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </PermissionGate>
                </CardContent>
            </Card>

            {/* Quota Usage */}
            <PermissionGate permission="quotas:read">
                <Card>
                    <CardHeader>
                        <CardTitle>配额使用情况</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(quotaDetail?.userQuotaUsage ||
                            quotaDetail?.quotaUsage) &&
                        (quotaDetail?.userQuotaUsage || quotaDetail?.quotaUsage)
                            ?.length > 0 ? (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>类型</TableHead>
                                            <TableHead>时间桶</TableHead>
                                            <TableHead>计数</TableHead>
                                            <TableHead>更新时间</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(
                                            quotaDetail.userQuotaUsage ||
                                            quotaDetail.quotaUsage ||
                                            []
                                        ).map((q: any) => (
                                            <TableRow
                                                key={`${q.userId}-${q.bucketType}-${q.bucketKey}`}
                                            >
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {q.bucketType}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {q.bucketKey}
                                                </TableCell>
                                                <TableCell>
                                                    {Number(
                                                        q.count,
                                                    ).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    {formatDate(q.updatedAt)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                暂无配额数据
                            </p>
                        )}
                    </CardContent>
                </Card>
            </PermissionGate>

            {/* Operation History */}
            <PermissionGate permission="logs:read">
                <Card>
                    <CardHeader>
                        <CardTitle>最近操作</CardTitle>
                        <CardDescription>
                            该用户最近20条操作记录
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {userHistory && userHistory.length > 0 ? (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>操作</TableHead>
                                            <TableHead>资源</TableHead>
                                            <TableHead>状态</TableHead>
                                            <TableHead>时间</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {userHistory.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="font-mono text-xs">
                                                    {log.action}
                                                </TableCell>
                                                <TableCell>
                                                    {log.resourceType}:
                                                    {log.resourceId}
                                                </TableCell>
                                                <TableCell>
                                                    {log.status ===
                                                    "success" ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-green-500 text-green-700"
                                                        >
                                                            成功
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-red-500 text-red-700"
                                                        >
                                                            失败
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {formatDate(log.createdAt)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                暂无操作记录
                            </p>
                        )}
                    </CardContent>
                </Card>
            </PermissionGate>
        </div>
    )
}
