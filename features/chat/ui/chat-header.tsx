"use client"

import {
    MessageSquarePlus,
    PanelRightClose,
    PanelRightOpen,
    Settings,
} from "lucide-react"
import Image from "next/image"
import { FaGithub } from "react-icons/fa"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
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
    signOutLabel,
    onSignIn,
    onSignOut,
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
    sessionSwitcherPlaceholder,
    deleteLabel,
    onSelectConversation,
    onDeleteConversation,
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
    signOutLabel: string
    onSignIn: () => void
    onSignOut: () => void
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
    sessionSwitcherPlaceholder: string
    deleteLabel: string
    onSelectConversation: (id: string) => void
    onDeleteConversation: (id: string) => void
}) {
    return (
        <header
            className={`${isMobile ? "px-3 py-2" : "px-5 py-4"} border-b border-border/50`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/favicon.ico"
                            alt={title}
                            width={isMobile ? 24 : 28}
                            height={isMobile ? 24 : 28}
                            className="rounded"
                        />
                        <h1
                            className={`${isMobile ? "text-sm" : "text-base"} font-semibold tracking-tight whitespace-nowrap`}
                        >
                            {title}
                        </h1>
                    </div>
                    {!isMobile && noticeTooltip ? (
                        <span className="sr-only">{noticeTooltip}</span>
                    ) : null}
                </div>

                <div className="flex items-center gap-1">
                    <AuthButton
                        authStatus={authStatus}
                        userImage={userImage}
                        signInLabel={signInLabel}
                        signOutLabel={signOutLabel}
                        onSignIn={onSignIn}
                        onSignOut={onSignOut}
                    />

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
                        sessionSwitcherPlaceholder={sessionSwitcherPlaceholder}
                        onSelectConversation={onSelectConversation}
                        onDeleteConversation={onDeleteConversation}
                    />

                    <ButtonWithTooltip
                        tooltipContent={newSessionTooltip}
                        variant="ghost"
                        size="icon"
                        onClick={onNewSession}
                        className="hover:bg-accent"
                    >
                        <MessageSquarePlus
                            className={`${isMobile ? "h-4 w-4" : "h-5 w-5"} text-muted-foreground`}
                        />
                    </ButtonWithTooltip>

                    <div className="w-px h-5 bg-border mx-1" />
                    <a
                        href="https://github.com/DayuanJiang/next-ai-draw-io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                        <FaGithub
                            className={`${isMobile ? "w-4 h-4" : "w-5 h-5"}`}
                        />
                    </a>

                    <ButtonWithTooltip
                        tooltipContent={settingsTooltip}
                        variant="ghost"
                        size="icon"
                        onClick={onShowSettings}
                        className="hover:bg-accent"
                    >
                        <Settings
                            className={`${isMobile ? "h-4 w-4" : "h-5 w-5"} text-muted-foreground`}
                        />
                    </ButtonWithTooltip>

                    {!isMobile && (
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
                    )}
                </div>
            </div>
        </header>
    )
}
