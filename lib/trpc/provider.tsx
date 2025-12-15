"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink, loggerLink } from "@trpc/client"
import type React from "react"
import { useState } from "react"
import superjson from "superjson"
import { api } from "@/lib/trpc/client"

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())
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
        <api.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </api.Provider>
    )
}
