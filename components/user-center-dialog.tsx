"use client"

import { signOut } from "next-auth/react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useI18n } from "@/contexts/i18n-context"

interface UserCenterDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user?: {
        name?: string | null
        email?: string | null
        image?: string | null
        phone?: string | null
    } | null
}

export function UserCenterDialog({
    open,
    onOpenChange,
    user,
}: UserCenterDialogProps) {
    const { t } = useI18n()
    const [isSigningOut, setIsSigningOut] = useState(false)

    const handleSignOut = async () => {
        setIsSigningOut(true)
        try {
            await signOut({ callbackUrl: "/" })
        } catch (error) {
            console.error("Sign out error:", error)
            setIsSigningOut(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl">
                        {t("userCenter.title")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("userCenter.description")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* User Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            {t("userCenter.accountInfo")}
                        </h3>
                        <div className="space-y-3">
                            {user?.name && (
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">
                                        {t("userCenter.name")}
                                    </span>
                                    <span className="text-sm font-medium">
                                        {user.name}
                                    </span>
                                </div>
                            )}
                            {user?.email && (
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">
                                        {t("userCenter.email")}
                                    </span>
                                    <span className="text-sm font-medium">
                                        {user.email}
                                    </span>
                                </div>
                            )}
                            {user?.phone && (
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">
                                        {t("userCenter.phone")}
                                    </span>
                                    <span className="text-sm font-medium">
                                        {user.phone}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-border" />

                    {/* Sign Out */}
                    <div className="space-y-3">
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                        >
                            {isSigningOut
                                ? t("userCenter.signingOut")
                                : t("userCenter.signOut")}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
