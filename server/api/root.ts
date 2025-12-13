import { conversationRouter } from "@/server/api/routers/conversation"
import { exampleRouter } from "@/server/api/routers/example"
import { providerConfigRouter } from "@/server/api/routers/provider-config"
import { createTRPCRouter } from "@/server/api/trpc"

export const appRouter = createTRPCRouter({
    conversation: conversationRouter,
    example: exampleRouter,
    providerConfig: providerConfigRouter,
})

export type AppRouter = typeof appRouter
