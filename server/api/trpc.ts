import { initTRPC, TRPCError } from "@trpc/server"
import { getServerSession } from "next-auth/next"
import superjson from "superjson"
import { authOptions } from "@/server/auth"
import { db } from "@/server/db"

export async function createTRPCContext() {
    const session = await getServerSession(authOptions)
    return { db, session }
}

const t = initTRPC
    .context<Awaited<ReturnType<typeof createTRPCContext>>>()
    .create({
        transformer: superjson,
    })

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

const requireAuth = t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
    }
    return next({
        ctx: {
            session: ctx.session,
        },
    })
})

export const protectedProcedure = t.procedure.use(requireAuth)
