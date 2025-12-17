"use client"

import { AlertCircle, CheckCircle2, CloudOff, RefreshCw } from "lucide-react"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { Button } from "@/components/ui/button"

export function CloudSyncStatusButton({
    visible,
    isOnline,
    syncInFlightCount,
    lastSyncOkAt,
    lastSyncErrorAt,
    okLabel,
    okAtLabel,
    syncingLabel,
    offlineLabel,
    errorLabel,
    locale,
    onClick,
    isMobile = false,
}: {
    visible: boolean
    isOnline: boolean
    syncInFlightCount: number
    lastSyncOkAt: number | null
    lastSyncErrorAt: number | null
    okLabel: string
    okAtLabel: (time: string) => string
    syncingLabel: string
    offlineLabel: string
    errorLabel: string
    locale: string
    onClick: () => void
    isMobile?: boolean
}) {
    if (!visible) return null

    const label = !isOnline
        ? offlineLabel
        : syncInFlightCount > 0
          ? syncingLabel
          : lastSyncErrorAt && (!lastSyncOkAt || lastSyncErrorAt > lastSyncOkAt)
            ? errorLabel
            : lastSyncOkAt
              ? okAtLabel(new Date(lastSyncOkAt).toLocaleTimeString(locale))
              : okLabel

    const icon = !isOnline ? (
        <CloudOff className="h-5 w-5 text-muted-foreground" />
    ) : syncInFlightCount > 0 ? (
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
    ) : lastSyncErrorAt && (!lastSyncOkAt || lastSyncErrorAt > lastSyncOkAt) ? (
        <AlertCircle className="h-5 w-5 text-warning" />
    ) : (
        <CheckCircle2 className="h-5 w-5 text-success" />
    )

    if (isMobile) {
        return (
            <Button
                variant="ghost"
                size="icon"
                aria-label={label}
                onClick={onClick}
                className="h-11 w-11 rounded-xl hover:bg-accent"
            >
                {icon}
            </Button>
        )
    }

    return (
        <ButtonWithTooltip
            tooltipContent={label}
            aria-label={label}
            variant="ghost"
            size="icon"
            onClick={onClick}
            className="hover:bg-accent"
        >
            {icon}
        </ButtonWithTooltip>
    )
}
