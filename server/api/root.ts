import { conversationRouter } from "@/server/api/routers/conversation"
import { exampleRouter } from "@/server/api/routers/example"
import { createTRPCRouter } from "@/server/api/trpc"

export const appRouter = createTRPCRouter({
    conversation: conversationRouter,
    example: exampleRouter,
})

export type AppRouter = typeof appRouter
