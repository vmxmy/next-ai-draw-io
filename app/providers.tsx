"use client"

import { SessionProvider } from "next-auth/react"
import type React from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DiagramProvider } from "@/contexts/diagram-context"
import { I18nProvider } from "@/contexts/i18n-context"
import { TRPCReactProvider } from "@/lib/trpc/provider"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <TRPCReactProvider>
                <TooltipProvider>
                    <I18nProvider>
                        <DiagramProvider>{children}</DiagramProvider>
                    </I18nProvider>
                </TooltipProvider>
            </TRPCReactProvider>
        </SessionProvider>
    )
}
