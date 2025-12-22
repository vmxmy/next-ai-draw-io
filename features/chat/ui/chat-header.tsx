"use client"

import {
    ChartNoAxesColumn,
    MessageSquarePlus,
    PanelRightClose,
    PanelRightOpen,
    Settings,
} from "lucide-react"
import Image from "next/image"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { Button } from "@/components/ui/button"
import type { ConversationMeta } from "@/features/chat/sessions/storage"
import { AuthButton } from "@/features/chat/ui/auth-button"
import { CloudSyncStatusButton } from "@/features/chat/ui/cloud-sync-status-button"
import { SessionSwitcher } from "@/features/chat/ui/session-switcher"

export function ChatHeader({
    isMobile,
    isVisible,
    onToggleVisibility,
    title,
    noticeTooltip,
    onShowSettings,
    newSessionTooltip,
    onNewSession,
    settingsTooltip,
    hideTooltip,
    showTooltip,
    authStatus,
    userImage,
    signInLabel,
    profileLabel,
    onSignIn,
    onProfileClick,
    showSync,
    isOnline,
    syncInFlightCount,
    lastSyncOkAt,
    lastSyncErrorAt,
    syncOkLabel,
    syncOkAtLabel,
    syncSyncingLabel,
    syncOfflineLabel,
    syncErrorLabel,
    locale,
    onSyncClick,
    conversations,
    currentConversationId,
    getConversationDisplayTitle,
    sessionListTitle,
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
    quotaTooltip,
    onShowQuota,
    getCurrentMessages,
    isBYOK,
    quotaStatus,
}: {
    isMobile: boolean
    isVisible: boolean
    onToggleVisibility: () => void
    title: string
    noticeTooltip: string
    onShowSettings: () => void
    newSessionTooltip: string
    onNewSession: () => void
    settingsTooltip: string
    hideTooltip: string
    showTooltip: string
    authStatus: "authenticated" | "loading" | "unauthenticated"
    userImage?: string | null
    signInLabel: string
    profileLabel: string
    onSignIn: () => void
    onProfileClick: () => void
    showSync: boolean
    isOnline: boolean
    syncInFlightCount: number
    lastSyncOkAt: number | null
    lastSyncErrorAt: number | null
    syncOkLabel: string
    syncOkAtLabel: (time: string) => string
    syncSyncingLabel: string
    syncOfflineLabel: string
    syncErrorLabel: string
    locale: string
    onSyncClick: () => void
    conversations: ConversationMeta[]
    currentConversationId: string
    getConversationDisplayTitle: (id: string) => string
    sessionListTitle: string
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
    quotaTooltip: string
    onShowQuota: () => void
    /** 获取当前会话的消息列表（用于智能命名） */
    getCurrentMessages?: () => any[]
    /** 是否使用 BYOK（用户自带密钥），影响配额按钮样式 */
    isBYOK?: boolean
    /** 配额状态: normal | warning (>=80%) | exceeded (>=100%) */
    quotaStatus?: "normal" | "warning" | "exceeded"
}) {
    // 根据配额状态确定图标颜色
    const getQuotaIconColor = () => {
        if (isBYOK) return "text-emerald-500"
        if (quotaStatus === "exceeded") return "text-red-500"
        if (quotaStatus === "warning") return "text-amber-500"
        return "text-muted-foreground"
    }
    const quotaIconColor = getQuotaIconColor()
    return (
        <header
            className={`${isMobile ? "px-3 py-2" : "px-5 py-4"} border-b border-border/50`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/favicon.ico"
                            alt={title}
                            width={isMobile ? 24 : 28}
                            height={isMobile ? 24 : 28}
                            className="rounded"
                        />
                        {!isMobile ? (
                            <h1 className="text-base font-semibold tracking-tight whitespace-nowrap">
                                {title}
                            </h1>
                        ) : (
                            <span className="sr-only">{title}</span>
                        )}
                    </div>
                    {!isMobile && noticeTooltip ? (
                        <span className="sr-only">{noticeTooltip}</span>
                    ) : null}
                </div>

                {isMobile ? (
                    <div className="flex items-center gap-2">
                        <SessionSwitcher
                            isMobile={isMobile}
                            conversations={conversations}
                            currentConversationId={currentConversationId}
                            getConversationDisplayTitle={
                                getConversationDisplayTitle
                            }
                            locale={locale}
                            deleteLabel={deleteLabel}
                            editLabel={editLabel}
                            saveLabel={saveLabel}
                            cancelLabel={cancelLabel}
                            editPlaceholder={editPlaceholder}
                            sessionListTitle={sessionListTitle}
                            onSelectConversation={onSelectConversation}
                            onDeleteConversation={onDeleteConversation}
                            onUpdateConversationTitle={
                                onUpdateConversationTitle
                            }
                            isLoadingSwitch={isLoadingSwitch}
                            switchingToId={switchingToId}
                            getCurrentMessages={getCurrentMessages}
                        />

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 rounded-xl hover:bg-accent"
                            aria-label={newSessionTooltip}
                            onClick={onNewSession}
                        >
                            <MessageSquarePlus className="h-5 w-5 text-muted-foreground" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 rounded-xl hover:bg-accent"
                            aria-label={quotaTooltip}
                            onClick={onShowQuota}
                        >
                            <ChartNoAxesColumn
                                className={`h-5 w-5 ${quotaIconColor}`}
                            />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 rounded-xl hover:bg-accent"
                            aria-label={settingsTooltip}
                            onClick={onShowSettings}
                        >
                            <Settings className="h-5 w-5 text-muted-foreground" />
                        </Button>

                        <CloudSyncStatusButton
                            visible={showSync}
                            isOnline={isOnline}
                            syncInFlightCount={syncInFlightCount}
                            lastSyncOkAt={lastSyncOkAt}
                            lastSyncErrorAt={lastSyncErrorAt}
                            okLabel={syncOkLabel}
                            okAtLabel={syncOkAtLabel}
                            syncingLabel={syncSyncingLabel}
                            offlineLabel={syncOfflineLabel}
                            errorLabel={syncErrorLabel}
                            locale={locale}
                            onClick={onSyncClick}
                            isMobile
                            isLoading={!!isLoadingSwitch}
                            loadingLabel={syncSyncingLabel}
                        />

                        <AuthButton
                            authStatus={authStatus}
                            userImage={userImage}
                            signInLabel={signInLabel}
                            profileLabel={profileLabel}
                            onSignIn={onSignIn}
                            onProfileClick={onProfileClick}
                        />
                    </div>
                ) : (
                    <div className="flex items-center gap-1">
                        <CloudSyncStatusButton
                            visible={showSync}
                            isOnline={isOnline}
                            syncInFlightCount={syncInFlightCount}
                            lastSyncOkAt={lastSyncOkAt}
                            lastSyncErrorAt={lastSyncErrorAt}
                            okLabel={syncOkLabel}
                            okAtLabel={syncOkAtLabel}
                            syncingLabel={syncSyncingLabel}
                            offlineLabel={syncOfflineLabel}
                            errorLabel={syncErrorLabel}
                            locale={locale}
                            onClick={onSyncClick}
                            isLoading={!!isLoadingSwitch}
                            loadingLabel={syncSyncingLabel}
                        />

                        <SessionSwitcher
                            isMobile={isMobile}
                            conversations={conversations}
                            currentConversationId={currentConversationId}
                            getConversationDisplayTitle={
                                getConversationDisplayTitle
                            }
                            locale={locale}
                            deleteLabel={deleteLabel}
                            editLabel={editLabel}
                            saveLabel={saveLabel}
                            cancelLabel={cancelLabel}
                            editPlaceholder={editPlaceholder}
                            sessionListTitle={sessionListTitle}
                            onSelectConversation={onSelectConversation}
                            onDeleteConversation={onDeleteConversation}
                            onUpdateConversationTitle={
                                onUpdateConversationTitle
                            }
                            isLoadingSwitch={isLoadingSwitch}
                            switchingToId={switchingToId}
                            getCurrentMessages={getCurrentMessages}
                        />

                        <ButtonWithTooltip
                            tooltipContent={newSessionTooltip}
                            variant="ghost"
                            size="icon"
                            onClick={onNewSession}
                            className="hover:bg-accent"
                        >
                            <MessageSquarePlus className="h-5 w-5 text-muted-foreground" />
                        </ButtonWithTooltip>

                        <ButtonWithTooltip
                            tooltipContent={quotaTooltip}
                            variant="ghost"
                            size="icon"
                            onClick={onShowQuota}
                            className="hover:bg-accent"
                        >
                            <ChartNoAxesColumn
                                className={`h-5 w-5 ${quotaIconColor}`}
                            />
                        </ButtonWithTooltip>

                        <ButtonWithTooltip
                            tooltipContent={settingsTooltip}
                            variant="ghost"
                            size="icon"
                            onClick={onShowSettings}
                            className="hover:bg-accent"
                        >
                            <Settings className="h-5 w-5 text-muted-foreground" />
                        </ButtonWithTooltip>

                        <AuthButton
                            authStatus={authStatus}
                            userImage={userImage}
                            signInLabel={signInLabel}
                            profileLabel={profileLabel}
                            onSignIn={onSignIn}
                            onProfileClick={onProfileClick}
                        />

                        <ButtonWithTooltip
                            tooltipContent={
                                isVisible ? hideTooltip : showTooltip
                            }
                            variant="ghost"
                            size="icon"
                            onClick={onToggleVisibility}
                            className="hover:bg-accent"
                        >
                            {isVisible ? (
                                <PanelRightClose className="h-5 w-5 text-muted-foreground" />
                            ) : (
                                <PanelRightOpen className="h-5 w-5 text-muted-foreground" />
                            )}
                        </ButtonWithTooltip>
                    </div>
                )}
            </div>
        </header>
    )
}
