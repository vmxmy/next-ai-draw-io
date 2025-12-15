"use client"

import { Activity, TrendingUp, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export default function QuotaMonitoringPage() {
    const { data: dashboard, isLoading: isDashboardLoading } =
        api.quotaMonitoring.getDashboard.useQuery()

    if (isDashboardLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
                    <p className="mt-4 text-sm text-muted-foreground">
                        加载配额数据...
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">配额监控</h1>
                <p className="text-muted-foreground mt-1">
                    监控系统配额使用情况
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatCard
                    title="总使用量"
                    value={dashboard?.totalUsage.toLocaleString() ?? 0}
                    icon={Activity}
                    description="累计请求/Token数"
                />
                <StatCard
                    title="活跃用户"
                    value={dashboard?.totalUsers ?? 0}
                    icon={Users}
                    description="有使用记录的用户"
                />
                <StatCard
                    title="平均使用"
                    value={
                        dashboard?.totalUsers
                            ? Math.round(
                                  dashboard.totalUsage / dashboard.totalUsers,
                              ).toLocaleString()
                            : 0
                    }
                    icon={TrendingUp}
                    description="每用户平均使用量"
                />
            </div>

            {/* Tier Stats */}
            <Card>
                <CardHeader>
                    <CardTitle>按等级统计</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {dashboard?.tierStats &&
                        dashboard.tierStats.length > 0 ? (
                            dashboard.tierStats.map((stat) => (
                                <div key={stat.tier} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className="capitalize"
                                            >
                                                {stat.tier}
                                            </Badge>
                                            <span className="text-muted-foreground">
                                                {stat.userCount} 用户
                                            </span>
                                        </div>
                                        <span>
                                            总使用:{" "}
                                            {stat.totalUsed.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                        <div
                                            className="h-full bg-primary transition-all"
                                            style={{
                                                width: `${Math.min(
                                                    (stat.totalUsed /
                                                        (dashboard.totalUsage ||
                                                            1)) *
                                                        100,
                                                    100,
                                                )}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                暂无数据
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Info */}
            <Card>
                <CardHeader>
                    <CardTitle>说明</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        配额监控基于 UserQuotaUsage
                        表中的请求计数数据。显示各等级用户的累计使用情况。
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
