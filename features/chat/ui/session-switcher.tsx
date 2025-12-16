"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { History, Loader2, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectTrigger } from "@/components/ui/select"
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
    sessionSwitcherPlaceholder,
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
    sessionSwitcherPlaceholder: string
    onSelectConversation: (id: string) => void
    onDeleteConversation: (id: string) => void
    isLoadingSwitch?: boolean
    sessionListTitle?: string
}) {
    const [mounted, setMounted] = useState(false)
    const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    // 移动端：显示 icon button
    if (isMobile) {
        return (
            <>
                <ButtonWithTooltip
                    tooltipContent={sessionListTitle || "Sessions"}
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileSheetOpen(true)}
                    className="hover:bg-accent"
                    disabled={isLoadingSwitch}
                >
                    {isLoadingSwitch ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                        <History className="h-4 w-4 text-muted-foreground" />
                    )}
                </ButtonWithTooltip>

                <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
                    <SheetContent
                        side="left"
                        className="w-[300px] sm:w-[400px]"
                    >
                        <SheetHeader>
                            <SheetTitle>
                                {sessionListTitle || "Sessions"}
                            </SheetTitle>
                        </SheetHeader>
                        <div className="mt-4 space-y-2">
                            {conversations.map((c) => {
                                const displayTitle =
                                    getConversationDisplayTitle(c.id)
                                const time = new Date(
                                    c.updatedAt || c.createdAt,
                                ).toLocaleString(locale)
                                const isCurrent = c.id === currentConversationId

                                return (
                                    <div
                                        key={c.id}
                                        className={`relative flex items-center justify-between rounded-lg border p-3 transition-colors ${
                                            isCurrent
                                                ? "border-primary bg-accent"
                                                : "border-border hover:bg-accent/50"
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            className="flex-1 text-left"
                                            onClick={() => {
                                                onSelectConversation(c.id)
                                                setMobileSheetOpen(false)
                                            }}
                                        >
                                            <div className="flex flex-col gap-1">
                                                <span
                                                    className={`truncate text-sm ${
                                                        isCurrent
                                                            ? "font-medium"
                                                            : ""
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
                                            className="ml-2 h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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

    // 桌面端：显示下拉选择器
    return (
        <div className="mr-1">
            <Select
                value={currentConversationId}
                onValueChange={onSelectConversation}
                disabled={isLoadingSwitch}
            >
                <SelectTrigger className="h-8 w-[160px]">
                    {isLoadingSwitch ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Loading...</span>
                        </div>
                    ) : (
                        <span className="truncate">
                            {currentConversationId
                                ? getConversationDisplayTitle(
                                      currentConversationId,
                                  )
                                : sessionSwitcherPlaceholder}
                        </span>
                    )}
                </SelectTrigger>
                <SelectContent>
                    {conversations.map((c) => {
                        const displayTitle = getConversationDisplayTitle(c.id)
                        const time = new Date(
                            c.updatedAt || c.createdAt,
                        ).toLocaleString(locale)
                        return (
                            <SelectPrimitive.Item
                                key={c.id}
                                value={c.id}
                                className="relative flex w-full cursor-default items-center rounded-sm py-1.5 pl-2 pr-10 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            >
                                <SelectPrimitive.ItemText>
                                    <span className="flex flex-col gap-0.5">
                                        <span className="truncate">
                                            {displayTitle}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {time}
                                        </span>
                                    </span>
                                </SelectPrimitive.ItemText>
                                <span
                                    className="absolute right-2 z-10"
                                    onPointerDownCapture={(e) => {
                                        e.stopPropagation()
                                    }}
                                    onClickCapture={(e) => {
                                        e.stopPropagation()
                                    }}
                                >
                                    <button
                                        type="button"
                                        title={deleteLabel}
                                        aria-label={deleteLabel}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                        onMouseDown={(e) => {
                                            if (e.button !== 0) return
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onDeleteConversation(c.id)
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                        }}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key !== "Enter" &&
                                                e.key !== " "
                                            ) {
                                                return
                                            }
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onDeleteConversation(c.id)
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </span>
                            </SelectPrimitive.Item>
                        )
                    })}
                </SelectContent>
            </Select>
        </div>
    )
}
