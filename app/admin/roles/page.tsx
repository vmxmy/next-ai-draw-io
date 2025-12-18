"use client"

import { Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/trpc/client"

export default function RolesPage() {
    const { data: roles, isLoading } = api.userManagement.listRoles.useQuery()

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
                    <p className="mt-4 text-sm text-muted-foreground">
                        加载角色信息...
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    角色管理
                </h1>
                <p className="text-muted-foreground mt-1">
                    查看系统角色和权限配置
                </p>
            </div>

            {/* Roles List */}
            <div className="grid gap-4 md:grid-cols-2">
                {roles?.map((role) => (
                    <Card key={role.id}>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-primary" />
                                    <div>
                                        <CardTitle>
                                            {role.displayName}
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {role.description}
                                        </p>
                                    </div>
                                </div>
                                <Badge
                                    variant="outline"
                                    className="font-mono text-xs"
                                >
                                    {role.name}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="text-sm font-medium">
                                    权限列表:
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {role.permissions.map((perm) => (
                                        <Badge
                                            key={perm.id}
                                            variant="secondary"
                                            className="font-mono text-xs"
                                        >
                                            {perm.name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Permission Matrix */}
            <Card>
                <CardHeader>
                    <CardTitle>权限矩阵</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">
                                        权限
                                    </TableHead>
                                    {roles?.map((role) => (
                                        <TableHead
                                            key={role.id}
                                            className="text-center"
                                        >
                                            {role.displayName}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Collect all unique permissions */}
                                {Array.from(
                                    new Set(
                                        roles?.flatMap((r) =>
                                            r.permissions.map((p) => p.name),
                                        ) ?? [],
                                    ),
                                ).map((permName) => (
                                    <TableRow key={permName}>
                                        <TableCell>
                                            <code className="text-xs bg-secondary px-2 py-1 rounded">
                                                {permName}
                                            </code>
                                        </TableCell>
                                        {roles?.map((role) => {
                                            const hasPermission =
                                                role.permissions.some(
                                                    (p) => p.name === permName,
                                                )
                                            return (
                                                <TableCell
                                                    key={role.id}
                                                    className="text-center"
                                                >
                                                    {hasPermission ? (
                                                        <span className="text-green-600 text-xl">
                                                            ✓
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xl">
                                                            ○
                                                        </span>
                                                    )}
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Permission Details */}
            <Card>
                <CardHeader>
                    <CardTitle>权限说明</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        {Array.from(
                            new Map(
                                roles
                                    ?.flatMap((r) => r.permissions)
                                    .map((p) => [p.id, p]) ?? [],
                            ).values(),
                        ).map((perm) => (
                            <div
                                key={perm.id}
                                className="rounded-lg border p-4 space-y-2"
                            >
                                <div className="flex items-center justify-between">
                                    <code className="text-sm font-semibold">
                                        {perm.name}
                                    </code>
                                    <Badge
                                        variant="outline"
                                        className="text-xs"
                                    >
                                        {perm.resource}:{perm.action}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {perm.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
