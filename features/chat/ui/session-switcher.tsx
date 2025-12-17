"use client"

import {
    Check,
    History,
    Loader2,
    MoreVertical,
    Pencil,
    Trash2,
    X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
    switchingToId,
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
    switchingToId?: string | null
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

    // 切换完成后关闭 Sheet
    const prevSwitchingToIdRef = useRef<string | null>(null)
    useEffect(() => {
        // 从有值变为 null 表示切换完成
        if (prevSwitchingToIdRef.current && !switchingToId) {
            setSheetOpen(false)
        }
        prevSwitchingToIdRef.current = switchingToId ?? null
    }, [switchingToId])

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

    const triggerLabel = sessionListTitle || "Sessions"

    // 移动端和桌面端统一使用 Sheet
    return (
        <>
            {isMobile ? (
                <div className="flex flex-col items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSheetOpen(true)}
                        className="h-11 w-11 rounded-xl hover:bg-accent"
                        disabled={isLoadingSwitch}
                        aria-label={triggerLabel}
                    >
                        {isLoadingSwitch ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                            <History className="h-5 w-5 text-muted-foreground" />
                        )}
                    </Button>
                    <span className="text-[11px] leading-none text-muted-foreground">
                        {triggerLabel}
                    </span>
                </div>
            ) : (
                <ButtonWithTooltip
                    tooltipContent={triggerLabel}
                    variant="ghost"
                    size="icon"
                    onClick={() => setSheetOpen(true)}
                    className="hover:bg-accent"
                    disabled={isLoadingSwitch}
                >
                    {isLoadingSwitch ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                        <History className="h-5 w-5 text-muted-foreground" />
                    )}
                </ButtonWithTooltip>
            )}

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent
                    side={isMobile ? "bottom" : "right"}
                    className={
                        isMobile
                            ? "w-full max-w-full h-[75vh] rounded-t-2xl pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),12px)]"
                            : "w-[400px]"
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
                    <div
                        className={`mt-6 space-y-2 overflow-y-auto ${
                            isMobile
                                ? "max-h-[calc(75vh-140px)] pr-1"
                                : "max-h-[calc(100vh-120px)]"
                        }`}
                    >
                        {conversations.map((c) => {
                            const displayTitle = getConversationDisplayTitle(
                                c.id,
                            )
                            const time = new Date(
                                c.updatedAt || c.createdAt,
                            ).toLocaleString(locale)
                            const isCurrent = c.id === currentConversationId
                            const isSwitchingTo = switchingToId === c.id

                            const isEditing = editingId === c.id

                            return (
                                <div
                                    key={c.id}
                                    className={`group relative flex items-center gap-2 rounded-xl border transition-all ${
                                        isMobile ? "p-3.5" : "p-3"
                                    } ${
                                        isSwitchingTo
                                            ? "border-primary bg-accent shadow-sm"
                                            : isCurrent
                                              ? "border-primary bg-accent shadow-sm"
                                              : "border-border hover:border-primary/50 hover:bg-accent/50 active:bg-accent/70"
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
                                                    className={`text-sm ${isMobile ? "h-11 text-base" : "h-9"}`}
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`flex-shrink-0 text-green-600 hover:bg-green-100 hover:text-green-700 active:bg-green-200 ${
                                                    isMobile
                                                        ? "h-11 w-11 rounded-xl"
                                                        : "h-9 w-9"
                                                }`}
                                                onClick={handleSaveEdit}
                                                title={saveLabel}
                                                aria-label={saveLabel}
                                            >
                                                <Check
                                                    className={`${
                                                        isMobile
                                                            ? "h-5 w-5"
                                                            : "h-4 w-4"
                                                    }`}
                                                />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`flex-shrink-0 text-muted-foreground hover:bg-accent active:bg-accent/80 ${
                                                    isMobile
                                                        ? "h-11 w-11 rounded-xl"
                                                        : "h-9 w-9"
                                                }`}
                                                onClick={handleCancelEdit}
                                                title={cancelLabel}
                                                aria-label={cancelLabel}
                                            >
                                                <X
                                                    className={`${
                                                        isMobile
                                                            ? "h-5 w-5"
                                                            : "h-4 w-4"
                                                    }`}
                                                />
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            {/* iOS 风格：选中项显示勾选标记或加载状态 */}
                                            {isMobile && (
                                                <div
                                                    className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                                        switchingToId === c.id
                                                            ? "bg-primary text-primary-foreground"
                                                            : isCurrent
                                                              ? "bg-primary text-primary-foreground"
                                                              : "bg-transparent"
                                                    }`}
                                                >
                                                    {switchingToId === c.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        isCurrent && (
                                                            <Check className="h-3 w-3" />
                                                        )
                                                    )}
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                className={`flex-1 min-w-0 text-left active:opacity-70 transition-opacity ${
                                                    isLoadingSwitch
                                                        ? "pointer-events-none opacity-50"
                                                        : ""
                                                }`}
                                                disabled={isLoadingSwitch}
                                                onClick={() => {
                                                    onSelectConversation(c.id)
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
                                            {isMobile ? (
                                                isSwitchingTo ? (
                                                    // 移动端：加载状态占位（spinner 已在左侧圆形中显示）
                                                    <div className="flex-shrink-0 h-11 w-11" />
                                                ) : (
                                                    // iOS 风格：点击更多按钮显示下拉菜单
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger
                                                            asChild
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="flex-shrink-0 h-11 w-11 rounded-xl text-muted-foreground"
                                                                onClick={(e) =>
                                                                    e.stopPropagation()
                                                                }
                                                                disabled={
                                                                    isLoadingSwitch
                                                                }
                                                            >
                                                                <MoreVertical className="h-5 w-5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent
                                                            align="end"
                                                            className="w-40"
                                                        >
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    handleStartEdit(
                                                                        c.id,
                                                                        displayTitle,
                                                                    )
                                                                }
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                                {editLabel}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                variant="destructive"
                                                                onClick={() =>
                                                                    onDeleteConversation(
                                                                        c.id,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                {deleteLabel}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )
                                            ) : isSwitchingTo ? (
                                                // 桌面端：加载状态显示 spinner
                                                <Loader2 className="flex-shrink-0 h-5 w-5 animate-spin text-primary" />
                                            ) : (
                                                // 桌面端：hover 显示按钮
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="flex-shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-accent transition-all"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleStartEdit(
                                                                c.id,
                                                                displayTitle,
                                                            )
                                                        }}
                                                        title={editLabel}
                                                        aria-label={editLabel}
                                                        disabled={
                                                            isLoadingSwitch
                                                        }
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="flex-shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onDeleteConversation(
                                                                c.id,
                                                            )
                                                        }}
                                                        title={deleteLabel}
                                                        aria-label={deleteLabel}
                                                        disabled={
                                                            isLoadingSwitch
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
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
