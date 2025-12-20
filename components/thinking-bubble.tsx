"use client"

import { useEffect, useState } from "react"
import { useI18n } from "@/contexts/i18n-context"

interface ThinkingBubbleProps {
    className?: string
}

export function ThinkingBubble({ className }: ThinkingBubbleProps) {
    const { t } = useI18n()
    const [elapsedSeconds, setElapsedSeconds] = useState(0)

    useEffect(() => {
        const startTime = Date.now()
        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)

        return () => clearInterval(interval)
    }, [])

    // Format elapsed time
    const formatTime = (seconds: number) => {
        if (seconds < 60) {
            return `${seconds}s`
        }
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}m ${secs}s`
    }

    return (
        <div
            className={`flex w-full justify-start animate-message-in ${className || ""}`}
        >
            <div className="max-w-[85%] min-w-0">
                <div className="px-4 py-3 text-sm leading-relaxed bg-muted/60 text-foreground rounded-2xl rounded-bl-md">
                    <div className="flex items-center gap-2">
                        {/* Typing dots animation */}
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
                        </div>
                        <span className="text-muted-foreground">
                            {t("chat.thinking")}
                        </span>
                        {/* Show elapsed time after 3 seconds */}
                        {elapsedSeconds >= 3 && (
                            <span className="text-xs text-muted-foreground/60 ml-1">
                                ({formatTime(elapsedSeconds)})
                            </span>
                        )}
                    </div>
                    {/* Show tip for long waits */}
                    {elapsedSeconds >= 10 && (
                        <div className="mt-2 text-xs text-muted-foreground/70 border-t border-border/30 pt-2">
                            {t("chat.slowResponseTip")}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
