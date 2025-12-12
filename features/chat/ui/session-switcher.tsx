"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { Trash2 } from "lucide-react"
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
    if (isMobile || conversations.length <= 1) return null

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
                                <button
                                    type="button"
                                    title={deleteLabel}
                                    aria-label={deleteLabel}
                                    className="absolute right-2 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                                    onPointerDownCapture={(e) => {
                                        // Radix Select 可能在 pointerdown 阶段就完成“选中并关闭”，
                                        // 导致 onClick 触发前组件已卸载，从而表现为“删除按钮无效”。
                                        // 在捕获阶段拦截并直接执行删除，可避免与 Item 的选择行为冲突。
                                        if (e.button !== 0) return
                                        e.preventDefault()
                                        e.stopPropagation()
                                        onDeleteConversation(c.id)
                                    }}
                                    onClickCapture={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                    }}
                                    onKeyDownCapture={(e) => {
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
                            </SelectPrimitive.Item>
                        )
                    })}
                </SelectContent>
            </Select>
        </div>
    )
}
