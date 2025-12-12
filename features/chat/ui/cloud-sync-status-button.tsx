"use client"

import { AlertCircle, CheckCircle2, CloudOff, RefreshCw } from "lucide-react"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"

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
}) {
    if (!visible) return null

    const tooltipContent = !isOnline
        ? offlineLabel
        : syncInFlightCount > 0
          ? syncingLabel
          : lastSyncErrorAt && (!lastSyncOkAt || lastSyncErrorAt > lastSyncOkAt)
            ? errorLabel
            : lastSyncOkAt
              ? okAtLabel(new Date(lastSyncOkAt).toLocaleTimeString(locale))
              : okLabel

    return (
        <ButtonWithTooltip
            tooltipContent={tooltipContent}
            aria-label={okLabel}
            variant="ghost"
            size="icon"
            onClick={onClick}
            className="hover:bg-accent"
        >
            {!isOnline ? (
                <CloudOff className="h-4 w-4 text-muted-foreground" />
            ) : syncInFlightCount > 0 ? (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : lastSyncErrorAt &&
              (!lastSyncOkAt || lastSyncErrorAt > lastSyncOkAt) ? (
                <AlertCircle className="h-4 w-4 text-amber-500" />
            ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
        </ButtonWithTooltip>
    )
}
