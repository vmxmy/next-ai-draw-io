"use client"

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react"
import { toast } from "sonner"

interface BackgroundRequest {
    sessionId: string
    sessionTitle: string
    startedAt: number
}

interface BackgroundRequestContextValue {
    /** 当前活跃的后台请求 */
    activeRequests: Map<string, BackgroundRequest>
    /** 注册一个后台请求 */
    registerRequest: (sessionId: string, sessionTitle: string) => void
    /** 完成一个后台请求 */
    completeRequest: (sessionId: string, success: boolean) => void
    /** 检查会话是否有活跃请求 */
    hasActiveRequest: (sessionId: string) => boolean
    /** 获取活跃请求数量 */
    activeRequestCount: number
}

const BackgroundRequestContext =
    createContext<BackgroundRequestContextValue | null>(null)

export function BackgroundRequestProvider({
    children,
    locale = "en",
}: {
    children: React.ReactNode
    locale?: string
}) {
    const [activeRequests, setActiveRequests] = useState<
        Map<string, BackgroundRequest>
    >(new Map())

    const isZh = locale.startsWith("zh")

    const registerRequest = useCallback(
        (sessionId: string, sessionTitle: string) => {
            setActiveRequests((prev) => {
                const next = new Map(prev)
                next.set(sessionId, {
                    sessionId,
                    sessionTitle,
                    startedAt: Date.now(),
                })
                return next
            })
        },
        [],
    )

    const completeRequest = useCallback(
        (sessionId: string, success: boolean) => {
            setActiveRequests((prev) => {
                const request = prev.get(sessionId)
                if (!request) return prev

                const next = new Map(prev)
                next.delete(sessionId)

                // 显示完成通知
                const title = request.sessionTitle || sessionId.slice(0, 8)
                if (success) {
                    toast.success(
                        isZh
                            ? `"${title}" 响应完成`
                            : `"${title}" response ready`,
                        {
                            description: isZh
                                ? "点击切换到该会话查看"
                                : "Switch to this session to view",
                            duration: 5000,
                        },
                    )
                }

                return next
            })
        },
        [isZh],
    )

    const hasActiveRequest = useCallback(
        (sessionId: string) => activeRequests.has(sessionId),
        [activeRequests],
    )

    const value = useMemo(
        () => ({
            activeRequests,
            registerRequest,
            completeRequest,
            hasActiveRequest,
            activeRequestCount: activeRequests.size,
        }),
        [activeRequests, registerRequest, completeRequest, hasActiveRequest],
    )

    return (
        <BackgroundRequestContext.Provider value={value}>
            {children}
        </BackgroundRequestContext.Provider>
    )
}

export function useBackgroundRequest() {
    const context = useContext(BackgroundRequestContext)
    if (!context) {
        throw new Error(
            "useBackgroundRequest must be used within BackgroundRequestProvider",
        )
    }
    return context
}
