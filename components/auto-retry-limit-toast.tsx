"use client"

import { Button } from "@/components/ui/button"

interface AutoRetryLimitToastProps {
    title: string
    detail?: string
    regenerateLabel: string
    copyLabel: string
    settingsLabel: string
    closeLabel: string
    onRegenerate: () => void
    onCopy: () => void
    onOpenSettings: () => void
    onDismiss: () => void
}

export function AutoRetryLimitToast({
    title,
    detail,
    regenerateLabel,
    copyLabel,
    settingsLabel,
    closeLabel,
    onRegenerate,
    onCopy,
    onOpenSettings,
    onDismiss,
}: AutoRetryLimitToastProps) {
    return (
        <div
            role="alert"
            aria-live="polite"
            className="w-full max-w-[520px] bg-card border border-border/50 rounded-xl shadow-sm px-4 py-3"
        >
            <div className="text-sm font-medium text-foreground">{title}</div>
            {detail ? (
                <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                    {detail}
                </div>
            ) : null}
            <div className="mt-3 flex items-center justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={onRegenerate}>
                    {regenerateLabel}
                </Button>
                <Button variant="outline" size="sm" onClick={onCopy}>
                    {copyLabel}
                </Button>
                <Button variant="outline" size="sm" onClick={onOpenSettings}>
                    {settingsLabel}
                </Button>
                <Button variant="ghost" size="sm" onClick={onDismiss}>
                    {closeLabel}
                </Button>
            </div>
        </div>
    )
}
