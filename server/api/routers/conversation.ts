import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"

const conversationPayloadSchema = z.object({
    messages: z.array(z.unknown()),
    xml: z.string(),
    snapshots: z.array(z.tuple([z.number(), z.string()])).optional(),
    diagramVersions: z
        .array(
            z.object({
                id: z.string().min(1),
                createdAt: z.number().int(),
                xml: z.string(),
                note: z.string().optional(),
            }),
        )
        .optional(),
    diagramVersionCursor: z.number().int().optional(),
    diagramVersionMarks: z
        .record(z.string(), z.coerce.number().int())
        .optional(),
    sessionId: z.string(),
})

const conversationMetaSchema = z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    deleted: z.boolean().optional(),
    payload: conversationPayloadSchema.optional(),
})

export const conversationRouter = createTRPCRouter({
    push: protectedProcedure
        .input(z.object({ conversations: z.array(conversationMetaSchema) }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id
            const now = new Date()

            const upserts = input.conversations.map((c) => {
                const clientCreatedAt = new Date(c.createdAt)
                const clientUpdatedAt = new Date(c.updatedAt)
                const deletedAt = c.deleted ? now : null

                return ctx.db.conversation.upsert({
                    where: {
                        userId_id: { userId, id: c.id },
                    },
                    create: {
                        userId,
                        id: c.id,
                        title: c.title,
                        clientCreatedAt,
                        clientUpdatedAt,
                        data: (c.payload ?? {}) as unknown as object,
                        deletedAt,
                    },
                    update: {
                        userId,
                        title: c.title,
                        clientCreatedAt,
                        clientUpdatedAt,
                        ...(c.deleted
                            ? {}
                            : { data: (c.payload ?? {}) as unknown as object }),
                        deletedAt,
                    },
                    select: { id: true },
                })
            })

            const typeByConversationId = new Map(
                input.conversations.map((c) => [
                    c.id,
                    c.deleted ? "delete" : "upsert",
                ]),
            )

            const results = await ctx.db.$transaction([
                ...upserts,
                ctx.db.syncEvent.createMany({
                    data: input.conversations.map((c) => ({
                        userId,
                        conversationId: c.id,
                        type: typeByConversationId.get(c.id) ?? "upsert",
                    })),
                }),
            ])

            const upserted = results.slice(
                0,
                input.conversations.length,
            ) as Array<{ id: string }>

            const lastEvent = await ctx.db.syncEvent.findFirst({
                where: { userId },
                orderBy: { id: "desc" },
                select: { id: true },
            })

            return {
                ok: true,
                pushedIds: upserted.map((r) => r.id),
                cursor: lastEvent?.id.toString() ?? "0",
            }
        }),

    pull: protectedProcedure
        .input(
            z.object({
                cursor: z.string().optional(),
                limit: z.number().int().min(1).max(200).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id
            const cursor = BigInt(input.cursor ?? "0")
            const limit = input.limit ?? 200

            const events = await ctx.db.syncEvent.findMany({
                where: {
                    userId,
                    id: { gt: cursor },
                },
                orderBy: { id: "asc" },
                take: limit,
                select: { id: true, conversationId: true, type: true },
            })

            if (events.length === 0) {
                return { cursor: cursor.toString(), conversations: [] as any[] }
            }

            const conversationIds = Array.from(
                new Set(events.map((e) => e.conversationId)),
            )

            const conversations = await ctx.db.conversation.findMany({
                where: { userId, id: { in: conversationIds } },
                select: {
                    id: true,
                    title: true,
                    clientCreatedAt: true,
                    clientUpdatedAt: true,
                    deletedAt: true,
                    data: true,
                },
            })

            const last = events[events.length - 1]?.id ?? cursor

            return {
                cursor: last.toString(),
                conversations: conversations.map((c) => ({
                    id: c.id,
                    title: c.title ?? undefined,
                    createdAt: c.clientCreatedAt.getTime(),
                    updatedAt: c.clientUpdatedAt.getTime(),
                    deleted: !!c.deletedAt,
                    payload: c.data,
                })),
            }
        }),
})
