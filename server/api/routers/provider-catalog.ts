import { z } from "zod"
import * as trpc from "@/server/api/trpc"

const upsertSchema = z.object({
    key: z.string().min(1).max(64),
    displayName: z.string().min(1).max(100),
    compatibility: z.string().min(1).max(50),
    authType: z.string().min(1).max(50),
    defaultBaseUrl: z.string().url().max(500).nullish().or(z.literal("")),
    defaultModelId: z.string().max(200).nullish().or(z.literal("")),
    defaultHeaders: z.record(z.string(), z.any()).nullish(),
    defaultParams: z.record(z.string(), z.any()).nullish(),
    isBuiltin: z.boolean().optional(),
    isActive: z.boolean().optional(),
})

// 预定义的选项（作为建议，用户仍可输入自定义值）
const COMPATIBILITY_OPTIONS = [
    { value: "native", label: "原生" },
    { value: "openai_compat", label: "OpenAI 兼容" },
]

const AUTH_TYPE_OPTIONS = [
    { value: "apiKey", label: "API Key" },
    { value: "aws", label: "AWS 凭证" },
    { value: "oauth", label: "OAuth" },
    { value: "none", label: "无鉴权" },
    { value: "custom", label: "自定义" },
]

export const providerCatalogRouter = trpc.createTRPCRouter({
    // 公开接口：获取活跃的 Provider 列表（用于前端设置页面 BYOK 配置）
    list: trpc.publicProcedure.query(async ({ ctx }) => {
        return ctx.db.providerCatalog.findMany({
            where: { isActive: true },
            select: {
                key: true,
                displayName: true,
                defaultBaseUrl: true,
                suggestedModels: true,
            },
            orderBy: [{ isBuiltin: "desc" }, { key: "asc" }],
        })
    }),

    adminList: trpc.protectedProcedure.query(async ({ ctx }) => {
        return ctx.db.providerCatalog.findMany({
            orderBy: [{ isBuiltin: "desc" }, { key: "asc" }],
        })
    }),

    // 获取选项元数据（含预定义选项 + 数据库中已有的自定义值）
    getOptions: trpc.protectedProcedure.query(async ({ ctx }) => {
        // 获取数据库中已有的 distinct 值
        const catalogs = await ctx.db.providerCatalog.findMany({
            select: { compatibility: true, authType: true },
        })

        const dbCompatibilities = new Set(catalogs.map((c) => c.compatibility))
        const dbAuthTypes = new Set(catalogs.map((c) => c.authType))

        // 合并预定义选项和数据库中的自定义值
        const compatibilityOptions = [...COMPATIBILITY_OPTIONS]
        for (const value of dbCompatibilities) {
            if (!compatibilityOptions.some((o) => o.value === value)) {
                compatibilityOptions.push({ value, label: value })
            }
        }

        const authTypeOptions = [...AUTH_TYPE_OPTIONS]
        for (const value of dbAuthTypes) {
            if (!authTypeOptions.some((o) => o.value === value)) {
                authTypeOptions.push({ value, label: value })
            }
        }

        return {
            compatibilityOptions,
            authTypeOptions,
        }
    }),

    adminUpsert: trpc.protectedProcedure
        .input(upsertSchema)
        .mutation(async ({ ctx, input }) => {
            const baseUrl = input.defaultBaseUrl?.trim() || null
            const modelId = input.defaultModelId?.trim() || null
            const headers = input.defaultHeaders ?? undefined
            const params = input.defaultParams ?? undefined

            return ctx.db.providerCatalog.upsert({
                where: { key: input.key },
                update: {
                    displayName: input.displayName,
                    compatibility: input.compatibility,
                    authType: input.authType,
                    defaultBaseUrl: baseUrl,
                    defaultModelId: modelId,
                    defaultHeaders: headers,
                    defaultParams: params,
                    ...(input.isBuiltin !== undefined
                        ? { isBuiltin: input.isBuiltin }
                        : {}),
                    ...(input.isActive !== undefined
                        ? { isActive: input.isActive }
                        : {}),
                },
                create: {
                    key: input.key,
                    displayName: input.displayName,
                    compatibility: input.compatibility,
                    authType: input.authType,
                    defaultBaseUrl: baseUrl,
                    defaultModelId: modelId,
                    defaultHeaders: headers,
                    defaultParams: params,
                    isBuiltin: input.isBuiltin ?? false,
                    isActive: input.isActive ?? true,
                },
            })
        }),
})
