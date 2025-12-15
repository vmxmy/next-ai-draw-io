"use client"

import { Activity, TrendingUp, Users, UserX } from "lucide-react"
import { PermissionGate } from "@/components/admin/permission-gate"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/trpc/client"

function StatCard({
    title,
    value,
    icon: Icon,
    description,
    trend,
}: {
    title: string
    value: number | string
    icon: React.ComponentType<{ className?: string }>
    description?: string
    trend?: { value: number; isPositive: boolean }
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
                {trend && (
                    <p
                        className={`text-xs mt-1 flex items-center gap-1 ${
                            trend.isPositive ? "text-green-600" : "text-red-600"
                        }`}
                    >
                        <TrendingUp
                            className={`h-3 w-3 ${!trend.isPositive ? "rotate-180" : ""}`}
                        />
                        {trend.value > 0 ? "+" : ""}
                        {trend.value}% 与上周相比
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

export default function AdminDashboard() {
    const { data: userStats, isLoading: isLoadingUserStats } =
        api.userManagement.getStats.useQuery(undefined, {
            enabled: true,
        })

    if (isLoadingUserStats) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
                    <p className="mt-4 text-sm text-muted-foreground">
                        加载统计数据...
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">仪表板</h1>
                <p className="text-muted-foreground mt-1">
                    欢迎来到运维管理平台
                </p>
            </div>

            {/* Key Metrics */}
            <PermissionGate permission="users:read">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="总用户数"
                        value={userStats?.totalUsers ?? 0}
                        icon={Users}
                        description="系统注册用户总数"
                    />
                    <StatCard
                        title="活跃用户"
                        value={userStats?.activeUsers ?? 0}
                        icon={Activity}
                        description="状态为 active 的用户"
                    />
                    <StatCard
                        title="禁用用户"
                        value={userStats?.suspendedUsers ?? 0}
                        icon={UserX}
                        description="已被禁用的用户"
                    />
                    <StatCard
                        title="活跃率"
                        value={
                            userStats?.totalUsers
                                ? `${Math.round((userStats.activeUsers / userStats.totalUsers) * 100)}%`
                                : "0%"
                        }
                        icon={TrendingUp}
                        description="活跃用户占比"
                    />
                </div>
            </PermissionGate>

            {/* Tier Distribution */}
            <PermissionGate permission="users:read">
                <Card>
                    <CardHeader>
                        <CardTitle>用户等级分布</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {userStats?.tierStats &&
                            userStats.tierStats.length > 0 ? (
                                userStats.tierStats.map((stat) => {
                                    const percentage = userStats.totalUsers
                                        ? Math.round(
                                              (stat.count /
                                                  userStats.totalUsers) *
                                                  100,
                                          )
                                        : 0

                                    return (
                                        <div
                                            key={stat.tier}
                                            className="space-y-2"
                                        >
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium capitalize">
                                                    {stat.tier}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {stat.count} 用户 (
                                                    {percentage}%)
                                                </span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                                <div
                                                    className="h-full bg-primary transition-all"
                                                    style={{
                                                        width: `${percentage}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    暂无数据
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </PermissionGate>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>快捷操作</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <PermissionGate permission="users:read">
                            <a
                                href="/admin/users"
                                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
                            >
                                <Users className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="font-medium">用户管理</p>
                                    <p className="text-sm text-muted-foreground">
                                        查看和管理用户
                                    </p>
                                </div>
                            </a>
                        </PermissionGate>
                        <PermissionGate permission="quotas:read">
                            <a
                                href="/admin/quotas"
                                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
                            >
                                <Activity className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="font-medium">配额监控</p>
                                    <p className="text-sm text-muted-foreground">
                                        监控配额使用情况
                                    </p>
                                </div>
                            </a>
                        </PermissionGate>
                        <PermissionGate permission="logs:read">
                            <a
                                href="/admin/audit-logs"
                                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
                            >
                                <Activity className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="font-medium">操作日志</p>
                                    <p className="text-sm text-muted-foreground">
                                        查看审计日志
                                    </p>
                                </div>
                            </a>
                        </PermissionGate>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
