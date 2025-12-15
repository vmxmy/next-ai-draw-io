"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

export function useOfflineDetector() {
    const [isOnline, setIsOnline] = useState(() => {
        if (typeof navigator === "undefined") return true
        return navigator.onLine
    })

    useEffect(() => {
        const handleOffline = () => {
            setIsOnline(false)
            toast.error("网络已断开，无法操作", {
                duration: Number.POSITIVE_INFINITY,
                id: "offline-status",
            })
        }

        const handleOnline = () => {
            setIsOnline(true)
            toast.dismiss("offline-status")
            toast.success("网络已恢复", {
                duration: 3000,
            })
        }

        window.addEventListener("offline", handleOffline)
        window.addEventListener("online", handleOnline)

        return () => {
            window.removeEventListener("offline", handleOffline)
            window.removeEventListener("online", handleOnline)
        }
    }, [])

    return { isOnline }
}
