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

interface ConversationLimitDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onDeleteOldest: () => void
    onRegister: () => void
}

export function ConversationLimitDialog({
    open,
    onOpenChange,
    onDeleteOldest,
    onRegister,
}: ConversationLimitDialogProps) {
    const { t } = useI18n()

    const handleDeleteAndContinue = () => {
        onDeleteOldest()
        onOpenChange(false)
    }

    const handleRegister = () => {
        onRegister()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t("conversationLimit.title")}</DialogTitle>
                    <DialogDescription>
                        {t("conversationLimit.description")}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {t("conversationLimit.message")}
                    </p>
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">
                            {t("conversationLimit.options")}
                        </h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>{t("conversationLimit.option1")}</li>
                            <li>{t("conversationLimit.option2")}</li>
                        </ul>
                    </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={handleDeleteAndContinue}
                        className="w-full sm:w-auto"
                    >
                        {t("conversationLimit.deleteButton")}
                    </Button>
                    <Button
                        onClick={handleRegister}
                        className="w-full sm:w-auto"
                    >
                        {t("conversationLimit.registerButton")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
