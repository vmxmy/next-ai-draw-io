"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useI18n } from "@/contexts/i18n-context"

interface ResetWarningModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onClear: () => void
}

export function ResetWarningModal({
    open,
    onOpenChange,
    onClear,
}: ResetWarningModalProps) {
    const { t } = useI18n()
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("reset.title")}</DialogTitle>
                    <DialogDescription>
                        {t("reset.description")}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t("reset.cancel")}
                    </Button>
                    <Button variant="destructive" onClick={onClear}>
                        {t("reset.clear")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
