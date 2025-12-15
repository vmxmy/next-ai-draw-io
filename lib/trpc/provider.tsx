"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink, loggerLink } from "@trpc/client"
import type React from "react"
import { useState } from "react"
import superjson from "superjson"
import { api } from "@/lib/trpc/client"

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1分钟缓存
                        gcTime: 5 * 60 * 1000, // 5分钟垃圾回收
                        refetchOnWindowFocus: true, // 窗口聚焦时重新验证
                        refetchOnReconnect: true, // 网络重连时重新验证
                        retry: 3, // 失败重试3次
                        retryDelay: (attemptIndex) =>
                            Math.min(1000 * 2 ** attemptIndex, 30000), // 指数退避
                        networkMode: "online", // 强制在线模式（关键）
                    },
                    mutations: {
                        networkMode: "online", // Mutation 也强制在线
                        retry: 1, // Mutation 重试1次
                    },
                },
            }),
    )
    const [trpcClient] = useState(() =>
        api.createClient({
            links: [
                loggerLink({
                    enabled: (opts) =>
                        opts.direction === "down" &&
                        opts.result instanceof Error,
                }),
                httpBatchLink({
                    url: "/api/trpc",
                    transformer: superjson,
                }),
            ],
        }),
    )

    return (
        <QueryClientProvider client={queryClient}>
            <api.Provider client={trpcClient} queryClient={queryClient}>
                {children}
            </api.Provider>
        </QueryClientProvider>
    )
}
