import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { withDbRetry } from "@/server/db-retry"

// 导出 schema 供客户端验证使用
export const conversationPayloadSchema = z.object({
    messages: z.array(z.unknown()),
    xml: z.string().max(10_000_000), // 限制 XML 大小为 10MB
    snapshots: z.array(z.tuple([z.number(), z.string()])).optional(),
    diagramVersions: z
        .array(
            z.object({
                id: z.string().min(1),
                createdAt: z.number().int(),
                xml: z.string().max(10_000_000),
                note: z.string().optional(),
            }),
        )
        .max(100) // 限制最多 100 个版本
        .optional(),
    diagramVersionCursor: z.number().int().optional(),
    diagramVersionMarks: z
        .record(z.string(), z.coerce.number().int())
        .optional(),
    sessionId: z.string(),
})

export const conversationMetaSchema = z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    deleted: z.boolean().optional(),
    payload: conversationPayloadSchema.optional(),
})

export const conversationRouter = createTRPCRouter({
    push: protectedProcedure
        .input(
            z
                .object({
                    conversations: z
                        .array(conversationMetaSchema)
                        .max(50, "批量上传最多 50 个会话"),
                })
                .refine(
                    (data) => {
                        const totalSize = JSON.stringify(data).length
                        return totalSize < 20_000_000 // 20MB 限制
                    },
                    { message: "请求数据过大，超过 20MB 限制" },
                ),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id
            const now = new Date()

            return withDbRetry(async () => {
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
                                : {
                                      data: (c.payload ??
                                          {}) as unknown as object,
                                  }),
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
            })
        }),

    pull: protectedProcedure
        .input(
            z.object({
                cursor: z
                    .string()
                    .optional()
                    .refine(
                        (val) => {
                            if (!val) return true
                            try {
                                const num = BigInt(val)
                                return (
                                    num >= 0n &&
                                    num < BigInt("9007199254740991")
                                ) // Number.MAX_SAFE_INTEGER
                            } catch {
                                return false
                            }
                        },
                        { message: "无效的游标值" },
                    ),
                limit: z.number().int().min(1).max(100).optional(), // 降低到 100
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id
            const cursor = BigInt(input.cursor ?? "0")
            const limit = input.limit ?? 100

            return withDbRetry(async () => {
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
                    return {
                        cursor: cursor.toString(),
                        conversations: [] as any[],
                    }
                }

                const conversationIds = Array.from(
                    new Set(events.map((e) => e.conversationId)),
                )

                const conversations = await ctx.db.conversation.findMany({
                    where: {
                        userId,
                        id: { in: conversationIds },
                        // 不排除已删除的，因为需要同步删除状态
                    },
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
            })
        }),
})
