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

// 调试用：记录验证失败的详情
const debugConversationMeta = z.preprocess(
    (val) => {
        console.log(
            "[conversation.push] Raw conversation meta:",
            JSON.stringify(val, null, 2).slice(0, 500),
        )
        return val
    },
    z.object({
        id: z.string().min(1),
        title: z.string().optional(),
        createdAt: z.number().int(),
        updatedAt: z.number().int(),
        deleted: z.boolean().optional(),
        payload: conversationPayloadSchema.optional(),
    }),
)

export const conversationMetaSchema = z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    deleted: z.boolean().optional(),
    payload: conversationPayloadSchema.optional(),
})

export const conversationRouter = createTRPCRouter({
    // 获取会话列表（只返回 meta，不含 payload）
    listMetas: protectedProcedure
        .input(
            z.object({
                limit: z.number().int().min(1).max(100).default(50),
                offset: z.number().int().min(0).default(0),
            }),
        )
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            return withDbRetry(async () => {
                const conversations = await ctx.db.conversation.findMany({
                    where: {
                        userId,
                        deletedAt: null, // 只返回未删除的
                    },
                    select: {
                        id: true,
                        title: true,
                        clientCreatedAt: true,
                        clientUpdatedAt: true,
                    },
                    orderBy: {
                        clientUpdatedAt: "desc",
                    },
                    take: input.limit,
                    skip: input.offset,
                })

                return {
                    conversations: conversations.map((c) => ({
                        id: c.id,
                        title: c.title ?? undefined,
                        createdAt: c.clientCreatedAt.getTime(),
                        updatedAt: c.clientUpdatedAt.getTime(),
                    })),
                }
            })
        }),

    // 获取单个会话的完整数据
    getById: protectedProcedure
        .input(
            z.object({
                id: z.string().min(1),
            }),
        )
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id
            console.log("[conversation.getById] Request:", {
                userId,
                id: input.id,
            })

            return withDbRetry(async () => {
                const conversation = await ctx.db.conversation.findUnique({
                    where: {
                        userId_id: {
                            userId,
                            id: input.id,
                        },
                    },
                    select: {
                        id: true,
                        title: true,
                        clientCreatedAt: true,
                        clientUpdatedAt: true,
                        data: true,
                    },
                })

                console.log("[conversation.getById] Found:", {
                    found: !!conversation,
                    id: conversation?.id,
                    title: conversation?.title,
                })

                if (!conversation) {
                    console.error("[conversation.getById] Not found:", {
                        userId,
                        id: input.id,
                    })
                    throw new Error("Conversation not found")
                }

                return {
                    id: conversation.id,
                    title: conversation.title ?? undefined,
                    createdAt: conversation.clientCreatedAt.getTime(),
                    updatedAt: conversation.clientUpdatedAt.getTime(),
                    payload: conversation.data,
                }
            })
        }),

    push: protectedProcedure
        .input(
            z
                .object({
                    conversations: z
                        .array(debugConversationMeta) // 临时使用调试 schema
                        .max(50, "批量上传最多 50 个会话"),
                })
                .refine(
                    (data) => {
                        const totalSize = JSON.stringify(data).length
                        return totalSize < 20_000_000 // 20MB 限制
                    },
                    { message: "请求数据过大，超过 20MB 限制" },
                )
                .transform((data) => {
                    // 调试日志：查看接收到的数据
                    console.log("[conversation.push] Input received:", {
                        count: data.conversations.length,
                        conversations: data.conversations.map((c) => ({
                            id: c.id,
                            title: c.title,
                            createdAt: c.createdAt,
                            updatedAt: c.updatedAt,
                            deleted: c.deleted,
                            hasPayload: !!c.payload,
                        })),
                    })
                    return data
                }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id
            const now = new Date()
            console.log("[conversation.push] Processing for user:", userId)

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
                includePayload: z.boolean().default(false), // 默认不包含 payload
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
                        data: input.includePayload, // 仅在需要时包含 payload
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
