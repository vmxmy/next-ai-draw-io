"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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

export default function TierManagementPage() {
    const hasReadPermission = usePermission("tiers:read")
    const hasWritePermission = usePermission("tiers:write")
    const [editingTier, setEditingTier] = useState<string | null>(null)

    // 获取所有等级配置
    const { data: tiers, refetch } = api.tierConfig.adminList.useQuery(
        undefined,
        {
            enabled: hasReadPermission,
        },
    )

    // 获取用户等级统计
    const { data: stats } = api.tierConfig.adminGetStats.useQuery(undefined, {
        enabled: hasReadPermission,
    })

    // 更新等级配置 mutation
    const updateMutation = api.tierConfig.adminUpdate.useMutation({
        onSuccess: () => {
            toast.success("等级配置已更新")
            void refetch()
            setEditingTier(null)
        },
        onError: (error) => {
            toast.error(`更新失败：${error.message}`)
        },
    })

    // 权限检查
    if (!hasReadPermission) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-destructive">403</h1>
                    <p className="mt-2 text-lg">访问被拒绝</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        您没有权限访问此页面
                    </p>
                </div>
            </div>
        )
    }

    const handleSave = (
        tier: string,
        data: {
            displayName?: string
            dailyRequestLimit?: number
            dailyTokenLimit?: number
            tpmLimit?: number
            enabled?: boolean
        },
    ) => {
        updateMutation.mutate({ tier: tier as any, ...data })
    }

    const formatNumber = (num: number | bigint) => {
        const n = Number(num)
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
        return n.toString()
    }

    return (
        <div className="container mx-auto p-8 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">等级配额管理</h1>
                <p className="text-muted-foreground">
                    管理用户等级和配额配置，更改将立即生效
                </p>
            </div>

            {/* 统计信息 */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                {stats?.map((stat) => (
                    <Card key={stat.tier}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.tier}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stat.count}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                用户数
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* 配额配置表 */}
            <Card>
                <CardHeader>
                    <CardTitle>等级配置</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">
                                        等级
                                    </TableHead>
                                    <TableHead>显示名称</TableHead>
                                    <TableHead className="text-right">
                                        每日请求数
                                    </TableHead>
                                    <TableHead className="text-right">
                                        每日 Token 数
                                    </TableHead>
                                    <TableHead className="text-right">
                                        TPM 限制
                                    </TableHead>
                                    <TableHead className="text-center w-[80px]">
                                        启用
                                    </TableHead>
                                    <TableHead className="text-right w-[150px]">
                                        操作
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tiers?.map((tier) => (
                                    <TableRow key={tier.tier}>
                                        <TableCell className="font-mono font-medium">
                                            {tier.tier}
                                        </TableCell>
                                        <TableCell>
                                            {editingTier === tier.tier ? (
                                                <Input
                                                    defaultValue={
                                                        tier.displayName
                                                    }
                                                    id={`displayName-${tier.tier}`}
                                                    className="max-w-[200px]"
                                                />
                                            ) : (
                                                tier.displayName
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {editingTier === tier.tier ? (
                                                <Input
                                                    type="number"
                                                    defaultValue={
                                                        tier.dailyRequestLimit
                                                    }
                                                    id={`dailyRequestLimit-${tier.tier}`}
                                                    className="max-w-[120px] ml-auto"
                                                />
                                            ) : tier.dailyRequestLimit === 0 ? (
                                                <span className="text-muted-foreground">
                                                    无限
                                                </span>
                                            ) : (
                                                formatNumber(
                                                    tier.dailyRequestLimit,
                                                )
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {editingTier === tier.tier ? (
                                                <Input
                                                    type="number"
                                                    defaultValue={Number(
                                                        tier.dailyTokenLimit,
                                                    )}
                                                    id={`dailyTokenLimit-${tier.tier}`}
                                                    className="max-w-[120px] ml-auto"
                                                />
                                            ) : Number(tier.dailyTokenLimit) ===
                                              0 ? (
                                                <span className="text-muted-foreground">
                                                    无限
                                                </span>
                                            ) : (
                                                formatNumber(
                                                    tier.dailyTokenLimit,
                                                )
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {editingTier === tier.tier ? (
                                                <Input
                                                    type="number"
                                                    defaultValue={tier.tpmLimit}
                                                    id={`tpmLimit-${tier.tier}`}
                                                    className="max-w-[120px] ml-auto"
                                                />
                                            ) : tier.tpmLimit === 0 ? (
                                                <span className="text-muted-foreground">
                                                    无限
                                                </span>
                                            ) : (
                                                formatNumber(tier.tpmLimit)
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {editingTier === tier.tier ? (
                                                <div className="flex justify-center">
                                                    <Switch
                                                        defaultChecked={
                                                            tier.enabled
                                                        }
                                                        id={`enabled-${tier.tier}`}
                                                    />
                                                </div>
                                            ) : tier.enabled ? (
                                                <span className="text-green-600">
                                                    ✓
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    ✗
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {editingTier === tier.tier ? (
                                                <div className="flex gap-2 justify-end">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            const displayName =
                                                                (
                                                                    document.getElementById(
                                                                        `displayName-${tier.tier}`,
                                                                    ) as HTMLInputElement
                                                                )?.value
                                                            const dailyRequestLimit =
                                                                Number(
                                                                    (
                                                                        document.getElementById(
                                                                            `dailyRequestLimit-${tier.tier}`,
                                                                        ) as HTMLInputElement
                                                                    )?.value,
                                                                )
                                                            const dailyTokenLimit =
                                                                Number(
                                                                    (
                                                                        document.getElementById(
                                                                            `dailyTokenLimit-${tier.tier}`,
                                                                        ) as HTMLInputElement
                                                                    )?.value,
                                                                )
                                                            const tpmLimit =
                                                                Number(
                                                                    (
                                                                        document.getElementById(
                                                                            `tpmLimit-${tier.tier}`,
                                                                        ) as HTMLInputElement
                                                                    )?.value,
                                                                )
                                                            const enabled = (
                                                                document.getElementById(
                                                                    `enabled-${tier.tier}`,
                                                                ) as HTMLInputElement
                                                            )?.checked

                                                            handleSave(
                                                                tier.tier,
                                                                {
                                                                    displayName,
                                                                    dailyRequestLimit,
                                                                    dailyTokenLimit,
                                                                    tpmLimit,
                                                                    enabled,
                                                                },
                                                            )
                                                        }}
                                                        disabled={
                                                            updateMutation.isPending ||
                                                            !hasWritePermission
                                                        }
                                                    >
                                                        保存
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setEditingTier(null)
                                                        }
                                                    >
                                                        取消
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setEditingTier(
                                                            tier.tier,
                                                        )
                                                    }
                                                    disabled={
                                                        !hasWritePermission
                                                    }
                                                >
                                                    编辑
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-6 p-4 bg-muted rounded-lg">
                        <h3 className="font-medium mb-2">使用说明</h3>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• 设置为 0 表示无限制</li>
                            <li>
                                • anonymous 等级适用于未登录用户（基于 IP 限流）
                            </li>
                            <li>• 配置更新后立即生效，无需重启服务</li>
                            <li>
                                •
                                禁用等级后，该等级的用户将无法使用服务（除非使用
                                BYOK）
                            </li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
