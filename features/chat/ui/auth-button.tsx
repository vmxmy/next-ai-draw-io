"use client"

import { LogIn, User } from "lucide-react"
import Image from "next/image"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"

export function AuthButton({
    authStatus,
    userImage,
    signInLabel,
    profileLabel,
    onSignIn,
    onProfileClick,
}: {
    authStatus: "authenticated" | "loading" | "unauthenticated"
    userImage?: string | null
    signInLabel: string
    profileLabel: string
    onSignIn: () => void
    onProfileClick: () => void
}) {
    return (
        <ButtonWithTooltip
            tooltipContent={
                authStatus === "authenticated" ? profileLabel : signInLabel
            }
            aria-label={
                authStatus === "authenticated" ? profileLabel : signInLabel
            }
            variant="ghost"
            size="icon"
            disabled={authStatus === "loading"}
            onClick={() => {
                if (authStatus === "authenticated") {
                    onProfileClick()
                    return
                }
                onSignIn()
            }}
            className="hover:bg-accent"
        >
            {authStatus === "authenticated" ? (
                userImage ? (
                    <Image
                        src={userImage}
                        alt="User avatar"
                        width={18}
                        height={18}
                        className="rounded-full"
                    />
                ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                )
            ) : (
                <LogIn className="h-4 w-4 text-muted-foreground" />
            )}
        </ButtonWithTooltip>
    )
}
