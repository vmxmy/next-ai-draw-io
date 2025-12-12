import { z } from "zod"
import {
    createTRPCRouter,
    protectedProcedure,
    publicProcedure,
} from "@/server/api/trpc"

export const exampleRouter = createTRPCRouter({
    ping: publicProcedure.query(() => ({ ok: true })),
    whoAmI: protectedProcedure.query(({ ctx }) => ({
        userId: ctx.session.user.id,
    })),
    echo: publicProcedure
        .input(z.object({ text: z.string().min(1) }))
        .query(({ input }) => input),
})
