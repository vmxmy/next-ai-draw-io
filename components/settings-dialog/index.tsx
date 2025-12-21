"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/contexts/i18n-context"
import { STORAGE_KEYS } from "@/lib/storage"
import { AboutTab, InterfaceTab, NewModelConfigTab } from "./tabs"

// Re-export storage keys for backward compatibility
export const STORAGE_ACCESS_CODE_KEY = STORAGE_KEYS.accessCode
export const STORAGE_CLOSE_PROTECTION_KEY = STORAGE_KEYS.closeProtection
export const STORAGE_AI_PROVIDER_KEY = STORAGE_KEYS.aiProvider
export const STORAGE_AI_PROVIDER_CONNECTION_KEY =
    STORAGE_KEYS.aiProviderConnection
export const STORAGE_AI_BASE_URL_KEY = STORAGE_KEYS.aiBaseUrl
export const STORAGE_AI_API_KEY_KEY = STORAGE_KEYS.aiApiKey
export const STORAGE_AI_MODEL_KEY = STORAGE_KEYS.aiModel

interface SettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCloseProtectionChange?: (enabled: boolean) => void
    drawioUi: "kennedy" | "atlas"
    onToggleDrawioUi: () => void
    darkMode: boolean
    onToggleDarkMode: () => void
}

export function SettingsDialog({
    open,
    onOpenChange,
    onCloseProtectionChange,
    drawioUi,
    onToggleDrawioUi,
    darkMode,
    onToggleDarkMode,
}: SettingsDialogProps) {
    const { t } = useI18n()
    const { data: session } = useSession()
    const isLoggedIn = Boolean(session?.user)

    // Interface state
    const [closeProtection, setCloseProtection] = useState(true)

    // Load close protection setting
    useEffect(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem(STORAGE_KEYS.closeProtection)
            setCloseProtection(stored !== "false")
        }
    }, [])

    // Handle close protection change
    const handleCloseProtectionChange = (enabled: boolean) => {
        setCloseProtection(enabled)
        localStorage.setItem(
            STORAGE_KEYS.closeProtection,
            enabled ? "true" : "false",
        )
        onCloseProtectionChange?.(enabled)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t("dialog.settings.title")}</DialogTitle>
                    <DialogDescription>
                        {t("dialog.settings.description")}
                    </DialogDescription>
                </DialogHeader>

                <Tabs
                    defaultValue="model"
                    className="flex-1 flex flex-col min-h-0"
                >
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="model">
                            {t("settings.tabs.model")}
                        </TabsTrigger>
                        <TabsTrigger value="interface">
                            {t("settings.tabs.interface")}
                        </TabsTrigger>
                        <TabsTrigger value="about">
                            {t("settings.tabs.about")}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent
                        value="model"
                        className="flex-1 overflow-y-auto"
                    >
                        <NewModelConfigTab isLoggedIn={isLoggedIn} />
                    </TabsContent>

                    <TabsContent
                        value="interface"
                        className="flex-1 overflow-y-auto"
                    >
                        <InterfaceTab
                            closeProtection={closeProtection}
                            onCloseProtectionChange={
                                handleCloseProtectionChange
                            }
                            drawioUi={drawioUi}
                            onToggleDrawioUi={onToggleDrawioUi}
                            darkMode={darkMode}
                            onToggleDarkMode={onToggleDarkMode}
                        />
                    </TabsContent>

                    <TabsContent
                        value="about"
                        className="flex-1 overflow-y-auto"
                    >
                        <AboutTab />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
