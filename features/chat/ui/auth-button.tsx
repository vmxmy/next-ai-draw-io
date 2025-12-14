"use client"

import { LogIn } from "lucide-react"
import Image from "next/image"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"

export function AuthButton({
    authStatus,
    userImage,
    signInLabel,
    signOutLabel,
    onSignIn,
    onSignOut,
}: {
    authStatus: "authenticated" | "loading" | "unauthenticated"
    userImage?: string | null
    signInLabel: string
    signOutLabel: string
    onSignIn: () => void
    onSignOut: () => void
}) {
    return (
        <ButtonWithTooltip
            tooltipContent={
                authStatus === "authenticated" ? signOutLabel : signInLabel
            }
            aria-label={
                authStatus === "authenticated" ? signOutLabel : signInLabel
            }
            variant="ghost"
            size="icon"
            disabled={authStatus === "loading"}
            onClick={() => {
                if (authStatus === "authenticated") {
                    onSignOut()
                    return
                }
                onSignIn()
            }}
            className="hover:bg-accent"
        >
            {authStatus === "authenticated" && userImage ? (
                <Image
                    src={userImage}
                    alt="User avatar"
                    width={18}
                    height={18}
                    className="rounded-full"
                />
            ) : (
                <LogIn className="h-4 w-4 text-muted-foreground" />
            )}
        </ButtonWithTooltip>
    )
}
