"use client"

import { useState } from "react"
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

interface HistoryDialogProps {
    showHistory: boolean
    onToggleHistory: (show: boolean) => void
    versions: Array<{ id: string; createdAt: number; note?: string }>
    cursor: number
    onRestore: (index: number) => void
}

export function HistoryDialog({
    showHistory,
    onToggleHistory,
    versions,
    cursor,
    onRestore,
}: HistoryDialogProps) {
    const { t } = useI18n()
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

    const handleClose = () => {
        setSelectedIndex(null)
        onToggleHistory(false)
    }

    const handleConfirmRestore = () => {
        const index = selectedIndex ?? cursor
        if (index < 0) return
        onRestore(index)
        handleClose()
    }

    return (
        <Dialog open={showHistory} onOpenChange={onToggleHistory}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t("dialog.history.title")}</DialogTitle>
                    <DialogDescription>
                        Here saved each diagram before AI modification.
                        <br />
                        Click on a diagram to restore it
                    </DialogDescription>
                </DialogHeader>

                {versions.length === 0 ? (
                    <div className="text-center p-4 text-gray-500">
                        {t("dialog.history.empty")}
                    </div>
                ) : (
                    <div className="py-4 space-y-2">
                        {versions.map((item, index) => {
                            const isSelected =
                                (selectedIndex ?? cursor) === index
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`w-full text-left border rounded-md px-3 py-2 hover:border-primary transition-colors ${
                                        isSelected
                                            ? "border-primary ring-2 ring-primary"
                                            : ""
                                    }`}
                                    onClick={() => setSelectedIndex(index)}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-medium">
                                            Version {index + 1}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Date(
                                                item.createdAt,
                                            ).toLocaleString()}
                                        </div>
                                    </div>
                                    {item.note ? (
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {item.note}
                                        </div>
                                    ) : null}
                                </button>
                            )
                        })}
                    </div>
                )}

                <DialogFooter>
                    <div className="flex-1 text-sm text-muted-foreground">
                        {selectedIndex !== null
                            ? t("dialog.history.restorePrompt", {
                                  version: selectedIndex + 1,
                              })
                            : cursor >= 0
                              ? t("dialog.history.restorePrompt", {
                                    version: cursor + 1,
                                })
                              : ""}
                    </div>
                    {selectedIndex !== null ? (
                        <Button
                            variant="outline"
                            onClick={() => setSelectedIndex(null)}
                        >
                            {t("dialog.history.cancel")}
                        </Button>
                    ) : (
                        <Button variant="outline" onClick={handleClose}>
                            {t("dialog.history.close")}
                        </Button>
                    )}
                    <Button
                        onClick={handleConfirmRestore}
                        disabled={
                            versions.length === 0 ||
                            (selectedIndex === null && cursor < 0)
                        }
                    >
                        {t("dialog.history.confirm")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
