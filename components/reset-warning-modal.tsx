"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/contexts/i18n-context"

interface ResetWarningModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onClear: (options: { clearDiagram: boolean }) => void
}

const STORAGE_CLEAR_DIAGRAM_KEY = "next-ai-draw-io-clear-diagram-on-reset"

export function ResetWarningModal({
    open,
    onOpenChange,
    onClear,
}: ResetWarningModalProps) {
    const { t } = useI18n()
    const [clearDiagram, setClearDiagram] = useState(true)

    useEffect(() => {
        if (!open) return
        try {
            const saved = localStorage.getItem(STORAGE_CLEAR_DIAGRAM_KEY)
            if (saved === "true" || saved === "false") {
                setClearDiagram(saved === "true")
            } else {
                setClearDiagram(true)
            }
        } catch {
            setClearDiagram(true)
        }
    }, [open])

    const toggleClearDiagram = (next: boolean) => {
        setClearDiagram(next)
        try {
            localStorage.setItem(STORAGE_CLEAR_DIAGRAM_KEY, String(next))
        } catch {
            // ignore
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("reset.title")}</DialogTitle>
                    <DialogDescription>
                        {t("reset.description")}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 py-2">
                    <input
                        id="reset-clear-diagram"
                        type="checkbox"
                        checked={clearDiagram}
                        onChange={(e) => toggleClearDiagram(e.target.checked)}
                        className="h-4 w-4 rounded border border-border bg-background accent-primary"
                    />
                    <Label
                        htmlFor="reset-clear-diagram"
                        className="text-sm text-muted-foreground select-none"
                    >
                        {t("reset.clearDiagram")}
                    </Label>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t("reset.cancel")}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => onClear({ clearDiagram })}
                    >
                        {t("reset.clear")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
