"use client"

import { Check, History, Loader2, Pencil, Trash2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Sheet,
    SheetContent,
    SheetDescription,
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
    editLabel,
    saveLabel,
    cancelLabel,
    editPlaceholder,
    onSelectConversation,
    onDeleteConversation,
    onUpdateConversationTitle,
    isLoadingSwitch,
    sessionListTitle,
}: {
    isMobile: boolean
    conversations: ConversationMeta[]
    currentConversationId: string
    getConversationDisplayTitle: (id: string) => string
    locale: string
    deleteLabel: string
    editLabel: string
    saveLabel: string
    cancelLabel: string
    editPlaceholder: string
    onSelectConversation: (id: string) => void
    onDeleteConversation: (id: string) => void
    onUpdateConversationTitle: (id: string, title: string) => void
    isLoadingSwitch?: boolean
    sessionListTitle?: string
}) {
    const [mounted, setMounted] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [editingId])

    const handleStartEdit = (id: string, currentTitle: string) => {
        setEditingId(id)
        setEditingTitle(currentTitle)
    }

    const handleSaveEdit = () => {
        if (editingId && editingTitle.trim()) {
            onUpdateConversationTitle(editingId, editingTitle.trim())
            setEditingId(null)
            setEditingTitle("")
        }
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setEditingTitle("")
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSaveEdit()
        } else if (e.key === "Escape") {
            e.preventDefault()
            handleCancelEdit()
        }
    }

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
                        <SheetDescription>
                            {conversations.length}{" "}
                            {conversations.length === 1
                                ? "session"
                                : "sessions"}
                        </SheetDescription>
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

                            const isEditing = editingId === c.id

                            return (
                                <div
                                    key={c.id}
                                    className={`group relative flex items-center gap-2 rounded-lg border p-3 transition-all ${
                                        isCurrent
                                            ? "border-primary bg-accent shadow-sm"
                                            : "border-border hover:border-primary/50 hover:bg-accent/50"
                                    }`}
                                >
                                    {isEditing ? (
                                        <>
                                            <div className="flex-1 min-w-0">
                                                <Input
                                                    ref={inputRef}
                                                    value={editingTitle}
                                                    onChange={(e) =>
                                                        setEditingTitle(
                                                            e.target.value,
                                                        )
                                                    }
                                                    onKeyDown={handleKeyDown}
                                                    placeholder={
                                                        editPlaceholder
                                                    }
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="flex-shrink-0 h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700"
                                                onClick={handleSaveEdit}
                                                title={saveLabel}
                                                aria-label={saveLabel}
                                            >
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:bg-accent"
                                                onClick={handleCancelEdit}
                                                title={cancelLabel}
                                                aria-label={cancelLabel}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                className="flex-1 min-w-0 text-left"
                                                onClick={() => {
                                                    onSelectConversation(c.id)
                                                    setSheetOpen(false)
                                                }}
                                            >
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <span
                                                        className={`truncate text-sm ${
                                                            isCurrent
                                                                ? "font-semibold"
                                                                : "font-medium"
                                                        }`}
                                                    >
                                                        {displayTitle}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground truncate">
                                                        {time}
                                                    </span>
                                                </div>
                                            </button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`flex-shrink-0 h-8 w-8 text-muted-foreground hover:bg-accent transition-all ${
                                                    isMobile
                                                        ? "opacity-70"
                                                        : "opacity-0 group-hover:opacity-100"
                                                }`}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleStartEdit(
                                                        c.id,
                                                        displayTitle,
                                                    )
                                                }}
                                                title={editLabel}
                                                aria-label={editLabel}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`flex-shrink-0 h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all ${
                                                    isMobile
                                                        ? "opacity-70"
                                                        : "opacity-0 group-hover:opacity-100"
                                                }`}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onDeleteConversation(c.id)
                                                }}
                                                title={deleteLabel}
                                                aria-label={deleteLabel}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    )
}
