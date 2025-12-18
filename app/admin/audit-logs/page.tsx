"use client"

import { Activity, AlertCircle, CheckCircle2, FileText } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

function StatCard({
    title,
    value,
    icon: Icon,
    description,
}: {
    title: string
    value: number | string
    icon: React.ComponentType<{ className?: string }>
    description?: string
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

function formatDate(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })
}

export default function AuditLogsPage() {
    const [page, setPage] = useState(1)
    const [pageSize] = useState(20)
    const [actionFilter, _setActionFilter] = useState<string | undefined>(
        undefined,
    )
    const [statusFilter, setStatusFilter] = useState<
        "success" | "failed" | undefined
    >(undefined)
    const [resourceTypeFilter, setResourceTypeFilter] = useState<
        string | undefined
    >(undefined)

    const { data: stats } = api.auditLog.getStats.useQuery()

    const { data, isLoading } = api.auditLog.list.useQuery({
        page,
        pageSize,
        action: actionFilter,
        status: statusFilter,
        resourceType: resourceTypeFilter,
    })

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    操作日志
                </h1>
                <p className="text-muted-foreground mt-1">
                    查看系统操作审计日志
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="总日志数"
                    value={stats?.totalLogs.toLocaleString() ?? 0}
                    icon={FileText}
                    description="累计操作记录"
                />
                <StatCard
                    title="24小时内"
                    value={stats?.last24hLogs.toLocaleString() ?? 0}
                    icon={Activity}
                    description="最近一天的操作"
                />
                <StatCard
                    title="成功率"
                    value={`${stats?.successRate ?? 0}%`}
                    icon={CheckCircle2}
                    description={`${stats?.successLogs.toLocaleString() ?? 0} 成功 / ${stats?.failedLogs.toLocaleString() ?? 0} 失败`}
                />
                <StatCard
                    title="7天内"
                    value={stats?.last7dLogs.toLocaleString() ?? 0}
                    icon={Activity}
                    description="最近一周的操作"
                />
            </div>

            {/* Top Actions */}
            {stats?.topActions && stats.topActions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>最常见操作</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {stats.topActions.slice(0, 5).map((action) => (
                                <div
                                    key={action.action}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span className="font-mono">
                                        {action.action}
                                    </span>
                                    <Badge variant="secondary">
                                        {action.count.toLocaleString()} 次
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Logs Table */}
            <Card>
                <CardHeader>
                    <CardTitle>操作记录</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col gap-4 mb-6 sm:flex-row">
                        <Select
                            value={resourceTypeFilter ?? "all"}
                            onValueChange={(value) =>
                                setResourceTypeFilter(
                                    value === "all" ? undefined : value,
                                )
                            }
                        >
                            <SelectTrigger className="w-full sm:w-[160px]">
                                <SelectValue placeholder="资源类型" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部资源</SelectItem>
                                <SelectItem value="user">用户</SelectItem>
                                <SelectItem value="quota">配额</SelectItem>
                                <SelectItem value="tier_config">
                                    等级配置
                                </SelectItem>
                                <SelectItem value="system_config">
                                    系统配置
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={statusFilter ?? "all"}
                            onValueChange={(value) =>
                                setStatusFilter(
                                    value === "all"
                                        ? undefined
                                        : (value as "success" | "failed"),
                                )
                            }
                        >
                            <SelectTrigger className="w-full sm:w-[140px]">
                                <SelectValue placeholder="状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="success">成功</SelectItem>
                                <SelectItem value="failed">失败</SelectItem>
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
                            <div className="rounded-md border overflow-x-auto">
                                <Table className="min-w-[600px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>操作用户</TableHead>
                                            <TableHead>操作</TableHead>
                                            <TableHead>资源</TableHead>
                                            <TableHead>状态</TableHead>
                                            <TableHead>时间</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data?.logs && data.logs.length > 0 ? (
                                            data.logs.map((log) => (
                                                <TableRow key={log.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">
                                                                {log.user
                                                                    .name ??
                                                                    "未设置"}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {log.user.email}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <code className="text-xs bg-secondary px-2 py-1 rounded">
                                                            {log.action}
                                                        </code>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm">
                                                                {
                                                                    log.resourceType
                                                                }
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                ID:{" "}
                                                                {log.resourceId}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {log.status ===
                                                        "success" ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-green-500 text-green-700"
                                                            >
                                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                                                成功
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-red-500 text-red-700"
                                                            >
                                                                <AlertCircle className="mr-1 h-3 w-3" />
                                                                失败
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDate(
                                                            log.createdAt,
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={5}
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
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
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
