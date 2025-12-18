"use client"

import { Activity, LogOut, Monitor, Users } from "lucide-react"
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { usePermission } from "@/lib/use-permissions"

export default function SessionsPage() {
    const hasWritePermission = usePermission("users:write")

    // Mock data - 实际应该从 tRPC 获取
    const sessions = [
        {
            id: "1",
            userId: "user123",
            userName: "张三",
            email: "zhangsan@example.com",
            ipAddress: "192.168.1.100",
            userAgent: "Chrome 120.0.0.0",
            createdAt: new Date("2024-01-15T10:30:00"),
            lastActivity: new Date("2024-01-15T14:20:00"),
            status: "active" as const,
        },
        {
            id: "2",
            userId: "user456",
            userName: "李四",
            email: "lisi@example.com",
            ipAddress: "192.168.1.101",
            userAgent: "Safari 17.2",
            createdAt: new Date("2024-01-15T09:00:00"),
            lastActivity: new Date("2024-01-15T14:15:00"),
            status: "active" as const,
        },
    ]

    const handleForceLogout = (sessionId: string) => {
        // TODO: 实现强制登出
        console.log("Force logout session:", sessionId)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold">会话管理</h1>
                <p className="text-muted-foreground mt-2">
                    监控和管理当前活跃的用户会话
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            活跃会话
                        </CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {sessions.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            当前在线用户数
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            独立用户
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Set(sessions.map((s) => s.userId)).size}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            不重复用户数
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            设备类型
                        </CardTitle>
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {
                                new Set(
                                    sessions.map((s) =>
                                        s.userAgent.includes("Chrome")
                                            ? "Chrome"
                                            : "Other",
                                    ),
                                ).size
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">
                            不同浏览器
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Sessions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>活跃会话列表</CardTitle>
                    <CardDescription>
                        当前所有在线用户的会话信息
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table className="min-w-[800px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>用户</TableHead>
                                    <TableHead>IP 地址</TableHead>
                                    <TableHead>设备</TableHead>
                                    <TableHead>登录时间</TableHead>
                                    <TableHead>最后活动</TableHead>
                                    <TableHead>状态</TableHead>
                                    <TableHead className="text-right">
                                        操作
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessions.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={7}
                                            className="text-center text-muted-foreground"
                                        >
                                            暂无活跃会话
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sessions.map((session) => (
                                        <TableRow key={session.id}>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium">
                                                        {session.userName}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {session.email}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {session.ipAddress}
                                            </TableCell>
                                            <TableCell>
                                                {session.userAgent}
                                            </TableCell>
                                            <TableCell>
                                                {session.createdAt.toLocaleString(
                                                    "zh-CN",
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {session.lastActivity.toLocaleString(
                                                    "zh-CN",
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        session.status ===
                                                        "active"
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                >
                                                    {session.status === "active"
                                                        ? "活跃"
                                                        : "非活跃"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {hasWritePermission && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleForceLogout(
                                                                session.id,
                                                            )
                                                        }
                                                    >
                                                        <LogOut className="h-4 w-4 mr-2" />
                                                        强制登出
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Info Alert */}
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                <CardContent className="pt-6">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        💡{" "}
                        <strong>
                            注意：此功能需要实现会话存储机制才能正常工作。
                        </strong>
                        <br />
                        当前显示的是模拟数据。需要集成 Redis
                        或数据库来跟踪用户会话。
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
