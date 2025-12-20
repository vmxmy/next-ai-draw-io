"use client"

import {
    Check,
    History,
    Loader2,
    MoreVertical,
    Pencil,
    Sparkles,
    Trash2,
    X,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
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
import {
    useConversationList,
    useSessionActions,
    useSessionContext,
} from "@/features/chat/sessions/context"
import { readConversationPayloadFromStorage } from "@/features/chat/sessions/local-storage"
import { getAIConfig } from "@/lib/ai-config"

/**
 * Context-aware Session Switcher
 *
 * 使用 Session Context 替代 prop drilling
 * Props 从 15+ 减少到 6 个仅 UI 相关的 props
 *
 * @example
 * ```tsx
 * // 之前: 15+ props
 * <SessionSwitcher
 *     isMobile={isMobile}
 *     conversations={conversations}
 *     currentConversationId={currentConversationId}
 *     getConversationDisplayTitle={getConversationDisplayTitle}
 *     locale={locale}
 *     deleteLabel={deleteLabel}
 *     editLabel={editLabel}
 *     saveLabel={saveLabel}
 *     cancelLabel={cancelLabel}
 *     editPlaceholder={editPlaceholder}
 *     sessionListTitle={sessionListTitle}
 *     onSelectConversation={onSelectConversation}
 *     onDeleteConversation={onDeleteConversation}
 *     onUpdateConversationTitle={onUpdateConversationTitle}
 *     isLoadingSwitch={isLoadingSwitch}
 *     switchingToId={switchingToId}
 * />
 *
 * // 之后: 仅 6 个 UI props
 * <SessionSwitcherWithContext
 *     isMobile={isMobile}
 *     deleteLabel={deleteLabel}
 *     editLabel={editLabel}
 *     saveLabel={saveLabel}
 *     cancelLabel={cancelLabel}
 *     editPlaceholder={editPlaceholder}
 * />
 * ```
 */
export function SessionSwitcherWithContext({
    isMobile,
    deleteLabel,
    editLabel,
    saveLabel,
    cancelLabel,
    editPlaceholder,
}: {
    isMobile: boolean
    deleteLabel: string
    editLabel: string
    saveLabel: string
    cancelLabel: string
    editPlaceholder: string
}) {
    // 从 Context 获取数据和操作
    const { locale } = useSessionContext()
    const {
        conversations,
        currentConversationId,
        getConversationDisplayTitle,
        isLoadingSwitch,
        switchingToId,
    } = useConversationList()
    const {
        handleSelectConversation,
        handleDeleteConversation,
        handleUpdateConversationTitle,
    } = useSessionActions()
    const { status: authStatus } = useSession()
    const isAuthenticated = authStatus === "authenticated"
    const smartRenameLabel = locale.startsWith("zh")
        ? "智能命名"
        : "Smart rename"

    const [mounted, setMounted] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState("")
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const buildAIHeaders = () => {
        const config = getAIConfig()
        const isLoggedIn = isAuthenticated
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }
        if (config.accessCode) {
            headers["x-access-code"] = config.accessCode
        }
        if (config.aiProvider) {
            headers["x-ai-provider"] = config.aiProvider
            if (!isLoggedIn && config.aiBaseUrl) {
                headers["x-ai-base-url"] = config.aiBaseUrl
            }
            if (!isLoggedIn && config.aiApiKey) {
                headers["x-ai-api-key"] = config.aiApiKey
            }
            if (config.aiModel) {
                headers["x-ai-model"] = config.aiModel
            }
        }
        return headers
    }

    const extractXmlFromPayload = (payload: any): string => {
        if (!payload) return ""
        if (typeof payload.xml === "string" && payload.xml.trim()) {
            return payload.xml
        }
        const versions = Array.isArray(payload.diagramVersions)
            ? payload.diagramVersions
            : []
        for (let i = versions.length - 1; i >= 0; i--) {
            const candidate = versions[i]?.xml
            if (typeof candidate === "string" && candidate.trim()) {
                return candidate
            }
        }
        return ""
    }

    const handleSmartRename = async (conversationId: string) => {
        if (renamingId) return
        if (!handleUpdateConversationTitle) return
        setRenamingId(conversationId)
        try {
            let xml: string | undefined

            // 匿名用户：从本地存储读取图表 XML
            if (!isAuthenticated) {
                const payload = readConversationPayloadFromStorage(
                    "anonymous",
                    conversationId,
                )
                xml = extractXmlFromPayload(payload)
                if (!xml) {
                    throw new Error("未找到该会话的图表内容")
                }
            }

            const res = await fetch("/api/conversation/title/diagram", {
                method: "POST",
                headers: buildAIHeaders(),
                body: JSON.stringify({
                    conversationId,
                    locale,
                    ...(xml ? { xml } : {}),
                }),
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                const errMsg =
                    typeof data?.error === "string"
                        ? data.error
                        : `HTTP ${res.status}`
                throw new Error(errMsg)
            }

            const aiTitle =
                typeof data?.title === "string" ? data.title.trim() : ""
            if (!aiTitle) {
                throw new Error("未生成标题")
            }

            handleUpdateConversationTitle(conversationId, aiTitle)
            toast.success("已生成智能标题")
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "生成失败，请重试"
            toast.error("智能命名失败", {
                description: message,
            })
        } finally {
            setRenamingId(null)
        }
    }

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
        if (editingId && editingTitle.trim() && handleUpdateConversationTitle) {
            handleUpdateConversationTitle(editingId, editingTitle.trim())
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

    const sessionListTitle =
        conversations.length === 1
            ? `${conversations.length} session`
            : `${conversations.length} sessions`

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
                        aria-label={sessionListTitle}
                    >
                        {isLoadingSwitch ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                            <History className="h-5 w-5 text-muted-foreground" />
                        )}
                    </Button>
                    <span className="text-[11px] leading-none text-muted-foreground">
                        Sessions
                    </span>
                </div>
            ) : (
                <ButtonWithTooltip
                    tooltipContent={sessionListTitle}
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
                    <SheetHeader className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <SheetTitle>Sessions</SheetTitle>
                                <SheetDescription>
                                    {sessionListTitle}
                                </SheetDescription>
                            </div>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="gap-2"
                                disabled={
                                    !currentConversationId ||
                                    isLoadingSwitch ||
                                    !!renamingId
                                }
                                onClick={() =>
                                    currentConversationId &&
                                    void handleSmartRename(
                                        currentConversationId,
                                    )
                                }
                            >
                                {renamingId === currentConversationId ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4" />
                                )}
                                {smartRenameLabel}
                            </Button>
                        </div>
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
                                                    handleSelectConversation(
                                                        c.id,
                                                    )
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
                                                    <div className="flex-shrink-0 h-11 w-11" />
                                                ) : (
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
                                                                    void handleSmartRename(
                                                                        c.id,
                                                                    )
                                                                }
                                                                disabled={
                                                                    renamingId ===
                                                                        c.id ||
                                                                    isLoadingSwitch
                                                                }
                                                            >
                                                                {renamingId ===
                                                                c.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Sparkles className="h-4 w-4" />
                                                                )}
                                                                智能命名
                                                            </DropdownMenuItem>
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
                                                                    handleDeleteConversation(
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
                                                <Loader2 className="flex-shrink-0 h-5 w-5 animate-spin text-primary" />
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="flex-shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-accent transition-all"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            void handleSmartRename(
                                                                c.id,
                                                            )
                                                        }}
                                                        title={smartRenameLabel}
                                                        aria-label={
                                                            smartRenameLabel
                                                        }
                                                        disabled={
                                                            isLoadingSwitch ||
                                                            renamingId === c.id
                                                        }
                                                    >
                                                        {renamingId === c.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                        ) : (
                                                            <Sparkles className="h-4 w-4" />
                                                        )}
                                                    </Button>
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
                                                            handleDeleteConversation(
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
