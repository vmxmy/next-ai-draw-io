"use client"

import { ChartNoAxesColumn } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { useI18n } from "@/contexts/i18n-context"

interface QuotaDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tier?: string
    config: {
        dailyRequestLimit: number
        dailyTokenLimit: number
        tpmLimit: number
    } | null
    usage: {
        dailyRequests: number
        dailyTokens: number
        minuteTokens: number
    }
}

export function QuotaDialog({
    open,
    onOpenChange,
    tier,
    config,
    usage,
}: QuotaDialogProps) {
    const { t } = useI18n()

    if (!config) {
        return null
    }

    const dailyRequestsPercent = config.dailyRequestLimit
        ? (usage.dailyRequests / config.dailyRequestLimit) * 100
        : 0

    const dailyTokensPercent = config.dailyTokenLimit
        ? (usage.dailyTokens / config.dailyTokenLimit) * 100
        : 0

    const tpmPercent = config.tpmLimit
        ? (usage.minuteTokens / config.tpmLimit) * 100
        : 0

    const formatNumber = (num: number) => {
        return num.toLocaleString()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ChartNoAxesColumn className="h-5 w-5" />
                        {t("userCenter.tier.quotaUsage")}
                    </DialogTitle>
                    <DialogDescription>
                        {tier
                            ? `${t("userCenter.tier.current")}: ${tier}`
                            : t("userCenter.description")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Daily Requests */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                                {t("userCenter.tier.dailyRequests")}
                            </span>
                            <span className="text-muted-foreground">
                                {formatNumber(usage.dailyRequests)} /{" "}
                                {config.dailyRequestLimit > 0
                                    ? formatNumber(config.dailyRequestLimit)
                                    : t("userCenter.tier.unlimited")}
                            </span>
                        </div>
                        {config.dailyRequestLimit > 0 && (
                            <Progress
                                value={Math.min(dailyRequestsPercent, 100)}
                                className="h-2"
                            />
                        )}
                    </div>

                    {/* Daily Tokens */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                                {t("userCenter.tier.dailyTokens")}
                            </span>
                            <span className="text-muted-foreground">
                                {formatNumber(usage.dailyTokens)} /{" "}
                                {config.dailyTokenLimit > 0
                                    ? formatNumber(config.dailyTokenLimit)
                                    : t("userCenter.tier.unlimited")}
                            </span>
                        </div>
                        {config.dailyTokenLimit > 0 && (
                            <Progress
                                value={Math.min(dailyTokensPercent, 100)}
                                className="h-2"
                            />
                        )}
                    </div>

                    {/* TPM (Tokens Per Minute) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                                {t("userCenter.tier.tpmUsage")}
                            </span>
                            <span className="text-muted-foreground">
                                {formatNumber(usage.minuteTokens)} /{" "}
                                {config.tpmLimit > 0
                                    ? formatNumber(config.tpmLimit)
                                    : t("userCenter.tier.unlimited")}
                            </span>
                        </div>
                        {config.tpmLimit > 0 && (
                            <Progress
                                value={Math.min(tpmPercent, 100)}
                                className="h-2"
                            />
                        )}
                    </div>

                    {tier === "anonymous" && (
                        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                            💡 {t("settings.aiProvider.note")}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
