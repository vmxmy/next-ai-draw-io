"use client"

import Image from "next/image"
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
import { useDiagram } from "@/contexts/diagram-context"
import { useI18n } from "@/contexts/i18n-context"

interface HistoryDialogProps {
    showHistory: boolean
    onToggleHistory: (show: boolean) => void
}

export function HistoryDialog({
    showHistory,
    onToggleHistory,
}: HistoryDialogProps) {
    const { t } = useI18n()
    const { restoreHistoryIndex, diagramHistory } = useDiagram()
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

    const handleClose = () => {
        setSelectedIndex(null)
        onToggleHistory(false)
    }

    const handleConfirmRestore = () => {
        if (selectedIndex !== null) {
            restoreHistoryIndex(selectedIndex)
            handleClose()
        }
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

                {diagramHistory.length === 0 ? (
                    <div className="text-center p-4 text-gray-500">
                        {t("dialog.history.empty")}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
                        {diagramHistory.map((item, index) => (
                            <div
                                key={index}
                                className={`border rounded-md p-2 cursor-pointer hover:border-primary transition-colors ${
                                    selectedIndex === index
                                        ? "border-primary ring-2 ring-primary"
                                        : ""
                                }`}
                                onClick={() => setSelectedIndex(index)}
                            >
                                <div className="aspect-video bg-white rounded overflow-hidden flex items-center justify-center">
                                    <Image
                                        src={item.svg}
                                        alt={`Diagram version ${index + 1}`}
                                        width={200}
                                        height={100}
                                        className="object-contain w-full h-full p-1"
                                    />
                                </div>
                                <div className="text-xs text-center mt-1 text-gray-500">
                                    Version {index + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <DialogFooter>
                    {selectedIndex !== null ? (
                        <>
                            <div className="flex-1 text-sm text-muted-foreground">
                                {t("dialog.history.restorePrompt", {
                                    version: selectedIndex + 1,
                                })}
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setSelectedIndex(null)}
                            >
                                {t("dialog.history.cancel")}
                            </Button>
                            <Button onClick={handleConfirmRestore}>
                                {t("dialog.history.confirm")}
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={handleClose}>
                            {t("dialog.history.close")}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
