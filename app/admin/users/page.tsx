"use client"

import {
    CheckCircle2,
    MoreHorizontal,
    Search,
    UserCheck,
    UserX,
    XCircle,
} from "lucide-react"
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
import { usePermission } from "@/lib/use-permissions"

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

export default function UsersPage() {
    const router = useRouter()
    const [page, setPage] = useState(1)
    const [pageSize] = useState(20)
    const [search, setSearch] = useState("")
    const [tierFilter, setTierFilter] = useState<string | undefined>(undefined)
    const [statusFilter, setStatusFilter] = useState<
        "active" | "suspended" | undefined
    >(undefined)
    const [sortBy, _setSortBy] = useState<"createdAt" | "email" | "tier">(
        "createdAt",
    )
    const [sortOrder, _setSortOrder] = useState<"asc" | "desc">("desc")

    const _hasWritePermission = usePermission("users:write")

    const { data, isLoading, refetch } = api.userManagement.list.useQuery({
        page,
        pageSize,
        search: search || undefined,
        tier: tierFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
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

    const handleSuspend = async (userId: string) => {
        if (confirm("确定要禁用此用户吗？")) {
            await suspendMutation.mutateAsync({ userId })
        }
    }

    const handleActivate = async (userId: string) => {
        if (confirm("确定要启用此用户吗？")) {
            await activateMutation.mutateAsync({ userId })
        }
    }

    const handleViewDetails = (userId: string) => {
        router.push(`/admin/users/${userId}`)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
                <p className="text-muted-foreground mt-1">查看和管理系统用户</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>用户列表</CardTitle>
                    <CardDescription>
                        共 {data?.total ?? 0} 个用户
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col gap-4 mb-6 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索邮箱、姓名、手机号..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Select
                            value={tierFilter ?? "all"}
                            onValueChange={(value) =>
                                setTierFilter(
                                    value === "all" ? undefined : value,
                                )
                            }
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="筛选等级" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部等级</SelectItem>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="basic">Basic</SelectItem>
                                <SelectItem value="pro">Pro</SelectItem>
                                <SelectItem value="enterprise">
                                    Enterprise
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={statusFilter ?? "all"}
                            onValueChange={(value) =>
                                setStatusFilter(
                                    value === "all"
                                        ? undefined
                                        : (value as "active" | "suspended"),
                                )
                            }
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="筛选状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="active">活跃</SelectItem>
                                <SelectItem value="suspended">禁用</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
                                <p className="mt-4 text-sm text-muted-foreground">
                                    加载中...
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>用户</TableHead>
                                            <TableHead>等级</TableHead>
                                            <TableHead>状态</TableHead>
                                            <TableHead>角色</TableHead>
                                            <TableHead>注册时间</TableHead>
                                            <TableHead className="text-right">
                                                操作
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data?.users &&
                                        data.users.length > 0 ? (
                                            data.users.map((user) => (
                                                <TableRow key={user.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">
                                                                {user.name ??
                                                                    "未设置"}
                                                            </span>
                                                            <span className="text-sm text-muted-foreground">
                                                                {user.email}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className="capitalize"
                                                        >
                                                            {user.tier}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {user.status ===
                                                        "active" ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-green-500 text-green-700"
                                                            >
                                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                                                活跃
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-red-500 text-red-700"
                                                            >
                                                                <XCircle className="mr-1 h-3 w-3" />
                                                                禁用
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {user.roles.map(
                                                                (ur) => (
                                                                    <Badge
                                                                        key={
                                                                            ur.roleId
                                                                        }
                                                                        variant="secondary"
                                                                        className="text-xs"
                                                                    >
                                                                        {
                                                                            ur
                                                                                .role
                                                                                .displayName
                                                                        }
                                                                    </Badge>
                                                                ),
                                                            )}
                                                            {user.roles
                                                                .length ===
                                                                0 && (
                                                                <span className="text-sm text-muted-foreground">
                                                                    无
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDate(
                                                            user.createdAt,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                            >
                                                                <Button
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0"
                                                                >
                                                                    <span className="sr-only">
                                                                        打开菜单
                                                                    </span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>
                                                                    操作
                                                                </DropdownMenuLabel>
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        handleViewDetails(
                                                                            user.id,
                                                                        )
                                                                    }
                                                                >
                                                                    查看详情
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <PermissionGate permission="users:write">
                                                                    {user.status ===
                                                                    "active" ? (
                                                                        <DropdownMenuItem
                                                                            onClick={() =>
                                                                                handleSuspend(
                                                                                    user.id,
                                                                                )
                                                                            }
                                                                            className="text-red-600"
                                                                        >
                                                                            <UserX className="mr-2 h-4 w-4" />
                                                                            禁用用户
                                                                        </DropdownMenuItem>
                                                                    ) : (
                                                                        <DropdownMenuItem
                                                                            onClick={() =>
                                                                                handleActivate(
                                                                                    user.id,
                                                                                )
                                                                            }
                                                                            className="text-green-600"
                                                                        >
                                                                            <UserCheck className="mr-2 h-4 w-4" />
                                                                            启用用户
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                </PermissionGate>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={6}
                                                    className="h-24 text-center"
                                                >
                                                    暂无数据
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {data && data.totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        第 {page} 页，共 {data.totalPages} 页
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setPage((p) =>
                                                    Math.max(1, p - 1),
                                                )
                                            }
                                            disabled={page === 1}
                                        >
                                            上一页
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setPage((p) =>
                                                    Math.min(
                                                        data.totalPages,
                                                        p + 1,
                                                    ),
                                                )
                                            }
                                            disabled={page === data.totalPages}
                                        >
                                            下一页
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
