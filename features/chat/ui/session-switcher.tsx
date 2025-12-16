"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import {
    Select,
    SelectContent,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
}) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (isMobile || !mounted) return null

    return (
        <div className="mr-1">
            <Select
                value={currentConversationId}
                onValueChange={onSelectConversation}
            >
                <SelectTrigger className="h-8 w-[160px]">
                    <SelectValue placeholder={sessionSwitcherPlaceholder}>
                        {currentConversationId
                            ? getConversationDisplayTitle(currentConversationId)
                            : undefined}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent key={currentConversationId || "none"}>
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
