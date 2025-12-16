"use client"

import { History, Loader2, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import type { ConversationMeta } from "@/features/chat/sessions/storage"

export function SessionSwitcher({
    isMobile,
    conversations,
    currentConversationId,
    getConversationDisplayTitle,
    locale,
    deleteLabel,
    onSelectConversation,
    onDeleteConversation,
    isLoadingSwitch,
    sessionListTitle,
}: {
    isMobile: boolean
    conversations: ConversationMeta[]
    currentConversationId: string
    getConversationDisplayTitle: (id: string) => string
    locale: string
    deleteLabel: string
    onSelectConversation: (id: string) => void
    onDeleteConversation: (id: string) => void
    isLoadingSwitch?: boolean
    sessionListTitle?: string
}) {
    const [mounted, setMounted] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    // 移动端和桌面端统一使用 Sheet
    return (
        <>
            <ButtonWithTooltip
                tooltipContent={sessionListTitle || "Sessions"}
                variant="ghost"
                size="icon"
                onClick={() => setSheetOpen(true)}
                className="hover:bg-accent"
                disabled={isLoadingSwitch}
            >
                {isLoadingSwitch ? (
                    <Loader2
                        className={`${isMobile ? "h-4 w-4" : "h-5 w-5"} animate-spin text-muted-foreground`}
                    />
                ) : (
                    <History
                        className={`${isMobile ? "h-4 w-4" : "h-5 w-5"} text-muted-foreground`}
                    />
                )}
            </ButtonWithTooltip>

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent
                    side={isMobile ? "left" : "right"}
                    className={
                        isMobile ? "w-[300px] sm:w-[400px]" : "w-[400px]"
                    }
                >
                    <SheetHeader>
                        <SheetTitle>
                            {sessionListTitle || "Sessions"}
                        </SheetTitle>
                        <p className="text-sm text-muted-foreground">
                            {conversations.length}{" "}
                            {conversations.length === 1
                                ? "session"
                                : "sessions"}
                        </p>
                    </SheetHeader>
                    <div className="mt-6 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
                        {conversations.map((c) => {
                            const displayTitle = getConversationDisplayTitle(
                                c.id,
                            )
                            const time = new Date(
                                c.updatedAt || c.createdAt,
                            ).toLocaleString(locale)
                            const isCurrent = c.id === currentConversationId

                            return (
                                <div
                                    key={c.id}
                                    className={`group relative flex items-center justify-between rounded-lg border p-3 transition-all ${
                                        isCurrent
                                            ? "border-primary bg-accent shadow-sm"
                                            : "border-border hover:border-primary/50 hover:bg-accent/50"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        className="flex-1 text-left"
                                        onClick={() => {
                                            onSelectConversation(c.id)
                                            setSheetOpen(false)
                                        }}
                                    >
                                        <div className="flex flex-col gap-1">
                                            <span
                                                className={`truncate text-sm ${
                                                    isCurrent
                                                        ? "font-semibold"
                                                        : "font-medium"
                                                }`}
                                            >
                                                {displayTitle}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {time}
                                            </span>
                                        </div>
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="ml-2 h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onDeleteConversation(c.id)
                                        }}
                                        title={deleteLabel}
                                        aria-label={deleteLabel}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    )
}
