"use client"

import { AlertCircle, Ban, Globe, Shield, Trash2 } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/lib/use-permissions"

export default function IPManagementPage() {
    const hasWritePermission = usePermission("quotas:write")
    const [newIPHash, setNewIPHash] = useState("")
    const [newReason, setNewReason] = useState("")

    // Mock data - 实际应该从 tRPC 获取
    const ipBlacklist = [
        {
            id: "1",
            ipHash: "a1b2c3d4e5f6",
            reason: "恶意请求",
            createdAt: new Date("2024-01-15T10:00:00"),
            createdBy: "admin@example.com",
            requestCount: 1523,
        },
        {
            id: "2",
            ipHash: "x7y8z9w1v2u3",
            reason: "频繁超限",
            createdAt: new Date("2024-01-14T15:30:00"),
            createdBy: "admin@example.com",
            requestCount: 892,
        },
    ]

    const rateLimitStats = [
        {
            ipHash: "m3n4o5p6q7r8",
            requestCount: 450,
            lastRequest: new Date("2024-01-15T14:20:00"),
            status: "warning" as const,
        },
        {
            ipHash: "s9t0u1v2w3x4",
            requestCount: 280,
            lastRequest: new Date("2024-01-15T14:15:00"),
            status: "normal" as const,
        },
    ]

    const handleAddBlacklist = () => {
        if (!newIPHash || !newReason) {
            alert("请填写 IP Hash 和原因")
            return
        }
        // TODO: 调用 tRPC mutation
        console.log("Add to blacklist:", {
            ipHash: newIPHash,
            reason: newReason,
        })
        setNewIPHash("")
        setNewReason("")
    }

    const handleRemoveBlacklist = (id: string) => {
        // TODO: 调用 tRPC mutation
        console.log("Remove from blacklist:", id)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">IP 限流管理</h1>
                <p className="text-muted-foreground mt-2">
                    管理匿名用户 IP 限流和黑名单
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            黑名单数量
                        </CardTitle>
                        <Ban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {ipBlacklist.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            已封禁 IP
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            监控中 IP
                        </CardTitle>
                        <Globe className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {rateLimitStats.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            近期活跃 IP
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            触发警告
                        </CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {
                                rateLimitStats.filter(
                                    (s) => s.status === "warning",
                                ).length
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">
                            接近限流阈值
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Add to Blacklist Form */}
            {hasWritePermission && (
                <Card>
                    <CardHeader>
                        <CardTitle>添加到黑名单</CardTitle>
                        <CardDescription>
                            将恶意 IP 添加到黑名单中
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="ipHash">IP Hash</Label>
                                <Input
                                    id="ipHash"
                                    placeholder="输入 IP Hash"
                                    value={newIPHash}
                                    onChange={(e) =>
                                        setNewIPHash(e.target.value)
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reason">封禁原因</Label>
                                <Textarea
                                    id="reason"
                                    placeholder="描述封禁原因"
                                    value={newReason}
                                    onChange={(e) =>
                                        setNewReason(e.target.value)
                                    }
                                    rows={1}
                                />
                            </div>
                        </div>
                        <Button onClick={handleAddBlacklist}>
                            <Shield className="h-4 w-4 mr-2" />
                            添加到黑名单
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* IP Blacklist Table */}
            <Card>
                <CardHeader>
                    <CardTitle>IP 黑名单</CardTitle>
                    <CardDescription>已封禁的 IP 列表</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>IP Hash</TableHead>
                                <TableHead>封禁原因</TableHead>
                                <TableHead>请求次数</TableHead>
                                <TableHead>添加时间</TableHead>
                                <TableHead>操作人</TableHead>
                                <TableHead className="text-right">
                                    操作
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ipBlacklist.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="text-center text-muted-foreground"
                                    >
                                        暂无黑名单 IP
                                    </TableCell>
                                </TableRow>
                            ) : (
                                ipBlacklist.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono">
                                            {item.ipHash}
                                        </TableCell>
                                        <TableCell>{item.reason}</TableCell>
                                        <TableCell>
                                            <Badge variant="destructive">
                                                {item.requestCount}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {item.createdAt.toLocaleString(
                                                "zh-CN",
                                            )}
                                        </TableCell>
                                        <TableCell>{item.createdBy}</TableCell>
                                        <TableCell className="text-right">
                                            {hasWritePermission && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        handleRemoveBlacklist(
                                                            item.id,
                                                        )
                                                    }
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    移除
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Rate Limit Stats Table */}
            <Card>
                <CardHeader>
                    <CardTitle>限流统计</CardTitle>
                    <CardDescription>近期访问频繁的 IP 统计</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>IP Hash</TableHead>
                                <TableHead>请求次数</TableHead>
                                <TableHead>最后请求</TableHead>
                                <TableHead>状态</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rateLimitStats.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={4}
                                        className="text-center text-muted-foreground"
                                    >
                                        暂无限流记录
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rateLimitStats.map((stat, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-mono">
                                            {stat.ipHash}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    stat.status === "warning"
                                                        ? "destructive"
                                                        : "secondary"
                                                }
                                            >
                                                {stat.requestCount}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {stat.lastRequest.toLocaleString(
                                                "zh-CN",
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {stat.status === "warning" ? (
                                                <Badge variant="destructive">
                                                    警告
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    正常
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Info Alert */}
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                <CardContent className="pt-6">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        💡{" "}
                        <strong>
                            注意：此功能需要连接到实际的限流数据才能正常工作。
                        </strong>
                        <br />
                        当前显示的是模拟数据。需要实现对应的 tRPC 路由来管理 IP
                        黑名单和查询限流统计。
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
