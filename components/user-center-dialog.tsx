"use client"

import { signOut, useSession } from "next-auth/react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/contexts/i18n-context"
import { api } from "@/lib/trpc/client"

interface UserCenterDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user?: {
        name?: string | null
        email?: string | null
        image?: string | null
        phone?: string | null
    } | null
}

export function UserCenterDialog({
    open,
    onOpenChange,
    user,
}: UserCenterDialogProps) {
    const { t, locale } = useI18n()
    const { status } = useSession()
    const [isSigningOut, setIsSigningOut] = useState(false)

    // 获取用户等级信息
    const { data: tierData } = api.tierConfig.getUserTier.useQuery(undefined, {
        enabled: status === "authenticated",
    })

    // 获取配额使用情况
    const { data: usageData } = api.tierConfig.getUserQuotaUsage.useQuery(
        undefined,
        {
            enabled: status === "authenticated",
            refetchInterval: 10_000, // 每 10 秒刷新
        },
    )

    const handleSignOut = async () => {
        setIsSigningOut(true)
        try {
            await signOut({ callbackUrl: "/" })
        } catch (error) {
            console.error("Sign out error:", error)
            setIsSigningOut(false)
        }
    }

    // 格式化数字
    const formatNumber = (num: number) => {
        if (num >= 1_000_000) {
            return `${(num / 1_000_000).toFixed(1)}M`
        }
        if (num >= 1_000) {
            return `${(num / 1_000).toFixed(1)}K`
        }
        return num.toString()
    }

    // 计算使用百分比
    const calculatePercentage = (used: number, limit: number) => {
        if (limit === 0) return 0
        return Math.min((used / limit) * 100, 100)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl">
                        {t("userCenter.title")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("userCenter.description")}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="basic">
                            {t("userCenter.tabs.basic")}
                        </TabsTrigger>
                        <TabsTrigger value="tier">
                            {t("userCenter.tabs.tier")}
                        </TabsTrigger>
                    </TabsList>

                    {/* 基础信息 Tab */}
                    <TabsContent value="basic" className="space-y-6 py-4">
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground">
                                {t("userCenter.accountInfo")}
                            </h3>
                            <div className="space-y-3">
                                {user?.name && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">
                                            {t("userCenter.name")}
                                        </span>
                                        <span className="text-sm font-medium">
                                            {user.name}
                                        </span>
                                    </div>
                                )}
                                {user?.email && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">
                                            {t("userCenter.email")}
                                        </span>
                                        <span className="text-sm font-medium">
                                            {user.email}
                                        </span>
                                    </div>
                                )}
                                {user?.phone && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">
                                            {t("userCenter.phone")}
                                        </span>
                                        <span className="text-sm font-medium">
                                            {user.phone}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-border" />

                        <div className="space-y-3">
                            <Button
                                variant="destructive"
                                className="w-full"
                                onClick={handleSignOut}
                                disabled={isSigningOut}
                            >
                                {isSigningOut
                                    ? t("userCenter.signingOut")
                                    : t("userCenter.signOut")}
                            </Button>
                        </div>
                    </TabsContent>

                    {/* 用户等级 Tab */}
                    <TabsContent value="tier" className="space-y-6 py-4">
                        {tierData && (
                            <>
                                {/* 当前等级 */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-muted-foreground">
                                            {t("userCenter.tier.current")}
                                        </h3>
                                        <Badge
                                            variant={
                                                tierData.tier === "pro"
                                                    ? "default"
                                                    : tierData.tier ===
                                                        "enterprise"
                                                      ? "default"
                                                      : "secondary"
                                            }
                                        >
                                            {tierData.config?.displayName ||
                                                tierData.tier}
                                        </Badge>
                                    </div>

                                    {tierData.config?.description && (
                                        <p className="text-sm text-muted-foreground">
                                            {tierData.config.description}
                                        </p>
                                    )}

                                    {tierData.tierExpiresAt && (
                                        <div className="text-sm text-muted-foreground">
                                            {t("userCenter.tier.expiresIn")}:{" "}
                                            {new Date(
                                                tierData.tierExpiresAt,
                                            ).toLocaleDateString(
                                                locale === "zh-CN"
                                                    ? "zh-CN"
                                                    : "en-US",
                                                {
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                },
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-border" />

                                {/* 配额使用情况 */}
                                {tierData.config && usageData && (
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium text-muted-foreground">
                                            {t("userCenter.tier.quotaUsage")}
                                        </h3>

                                        {/* 每日请求数 */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    {t(
                                                        "userCenter.tier.dailyRequests",
                                                    )}
                                                </span>
                                                <span className="font-medium">
                                                    {formatNumber(
                                                        usageData.dailyRequests,
                                                    )}{" "}
                                                    /{" "}
                                                    {tierData.config
                                                        .dailyRequestLimit === 0
                                                        ? t(
                                                              "userCenter.tier.unlimited",
                                                          )
                                                        : formatNumber(
                                                              tierData.config
                                                                  .dailyRequestLimit,
                                                          )}
                                                </span>
                                            </div>
                                            {tierData.config.dailyRequestLimit >
                                                0 && (
                                                <Progress
                                                    value={calculatePercentage(
                                                        usageData.dailyRequests,
                                                        tierData.config
                                                            .dailyRequestLimit,
                                                    )}
                                                    className="h-2"
                                                />
                                            )}
                                        </div>

                                        {/* 每日 Token 数 */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    {t(
                                                        "userCenter.tier.dailyTokens",
                                                    )}
                                                </span>
                                                <span className="font-medium">
                                                    {formatNumber(
                                                        usageData.dailyTokens,
                                                    )}{" "}
                                                    /{" "}
                                                    {Number(
                                                        tierData.config
                                                            .dailyTokenLimit,
                                                    ) === 0
                                                        ? t(
                                                              "userCenter.tier.unlimited",
                                                          )
                                                        : formatNumber(
                                                              Number(
                                                                  tierData
                                                                      .config
                                                                      .dailyTokenLimit,
                                                              ),
                                                          )}
                                                </span>
                                            </div>
                                            {Number(
                                                tierData.config.dailyTokenLimit,
                                            ) > 0 && (
                                                <Progress
                                                    value={calculatePercentage(
                                                        usageData.dailyTokens,
                                                        Number(
                                                            tierData.config
                                                                .dailyTokenLimit,
                                                        ),
                                                    )}
                                                    className="h-2"
                                                />
                                            )}
                                        </div>

                                        {/* TPM 限制 */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    {t(
                                                        "userCenter.tier.tpmUsage",
                                                    )}
                                                </span>
                                                <span className="font-medium">
                                                    {formatNumber(
                                                        usageData.minuteTokens,
                                                    )}{" "}
                                                    /{" "}
                                                    {tierData.config
                                                        .tpmLimit === 0
                                                        ? t(
                                                              "userCenter.tier.unlimited",
                                                          )
                                                        : formatNumber(
                                                              tierData.config
                                                                  .tpmLimit,
                                                          )}
                                                </span>
                                            </div>
                                            {tierData.config.tpmLimit > 0 && (
                                                <Progress
                                                    value={calculatePercentage(
                                                        usageData.minuteTokens,
                                                        tierData.config
                                                            .tpmLimit,
                                                    )}
                                                    className="h-2"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 升级提示 */}
                                {tierData.tier === "free" && (
                                    <>
                                        <div className="border-t border-border" />
                                        <div className="rounded-lg bg-muted p-4 space-y-3">
                                            <p className="text-sm font-medium">
                                                {t(
                                                    "userCenter.tier.upgradePrompt",
                                                )}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {t(
                                                    "userCenter.tier.upgradeDescription",
                                                )}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
