import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { decryptCredentials, encryptCredentials } from "@/server/encryption"

// Provider 枚举（与 lib/ai-providers.ts 对齐）
const providerEnum = z.enum([
    "bedrock",
    "openai",
    "anthropic",
    "google",
    "azure",
    "ollama",
    "openrouter",
    "deepseek",
    "siliconflow",
    "openai_compatible",
])

// Base URL 白名单配置（防止 SSRF 攻击）
const ALLOWED_BASE_URLS: Record<string, string[] | RegExp> = {
    openai: ["https://api.openai.com"],
    anthropic: ["https://api.anthropic.com"],
    google: [
        "https://generativelanguage.googleapis.com",
        "https://ai.google.dev",
    ],
    azure: /^https:\/\/[a-z0-9-]+\.openai\.azure\.com$/i,
    ollama: /^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\d+)?$/,
    openrouter: ["https://openrouter.ai"],
    deepseek: ["https://api.deepseek.com"],
    siliconflow: ["https://api.siliconflow.com", "https://api.siliconflow.cn"],
    // OpenAI 兼容模式：允许任意 HTTPS（仍受内部网段拦截）
    openai_compatible: /.*/,
}

/**
 * 验证 Base URL 是否在允许的白名单中
 * 防止 SSRF 攻击和访问内部资源
 */
function validateBaseUrl(provider: string, baseUrl: string): boolean {
    if (!baseUrl) return true // 空值允许（使用默认）

    const allowed = ALLOWED_BASE_URLS[provider]
    if (!allowed) {
        return false
    }

    try {
        const url = new URL(baseUrl)

        // 安全检查：禁止非 HTTPS（除了 localhost 的 ollama/openai_compatible）
        if (url.protocol !== "https:") {
            const isLocalhost =
                url.hostname === "localhost" ||
                url.hostname === "127.0.0.1" ||
                url.hostname === "::1"
            if (
                !(
                    (provider === "ollama" ||
                        provider === "openai_compatible") &&
                    isLocalhost
                )
            ) {
                return false
            }
        }

        // 禁止内部网络地址
        const hostname = url.hostname.toLowerCase()
        const forbiddenPatterns = [
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[01])\./,
            /^192\.168\./,
            /^169\.254\./,
            /\.local$/,
            /\.internal$/,
        ]

        for (const pattern of forbiddenPatterns) {
            if (pattern.test(hostname)) {
                // 例外：ollama/openai_compatible 允许 localhost
                if (
                    !(
                        (provider === "ollama" ||
                            provider === "openai_compatible") &&
                        hostname.match(/^(localhost|127\.0\.0\.1|::1)$/)
                    )
                ) {
                    return false
                }
            }
        }

        // 检查白名单
        if (Array.isArray(allowed)) {
            return allowed.some((allowedUrl) => baseUrl.startsWith(allowedUrl))
        }
        return allowed.test(baseUrl)
    } catch {
        return false
    }
}

const DEFAULT_CONNECTION_NAME = "default"

type CredentialPayload = Record<string, string>

function normalizeCredentialsPayload(
    payload: Record<string, unknown>,
): CredentialPayload {
    const normalized: CredentialPayload = {}
    for (const [key, value] of Object.entries(payload)) {
        if (value === undefined || value === null) continue
        normalized[key] = String(value)
    }
    return normalized
}

function parseCredentialsPayload(raw: string): CredentialPayload {
    try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return normalizeCredentialsPayload(
                parsed as Record<string, unknown>,
            )
        }
    } catch {
        // 兼容旧版（纯 API Key 字符串）
    }

    return { apiKey: raw }
}

function resolveCredentialType(
    provider: string,
    inputType: string | undefined,
    credentials: CredentialPayload | null,
): string {
    if (inputType) return inputType
    if (provider === "ollama") return "none"
    if (provider === "bedrock") return "aws"
    if (!credentials) return "none"
    if (credentials.apiKey) return "apiKey"
    return "custom"
}

// 输入验证 Schema（增强安全性）
const upsertInputSchema = z
    .object({
        provider: providerEnum,
        name: z.string().min(1).max(100).optional(),
        isDefault: z.boolean().optional(),
        isDisabled: z.boolean().optional(),
        credentialType: z
            .enum(["apiKey", "aws", "oauth", "none", "custom"])
            .optional(),
        credentials: z.record(z.string(), z.string()).optional(),
        apiKey: z
            .string()
            .min(1)
            .max(1000, "API key too long")
            .regex(
                /^[A-Za-z0-9_\-./:+=]+$/,
                "API key contains invalid characters",
            )
            .optional(),
        baseUrl: z.string().url().max(500).optional().or(z.literal("")),
        modelId: z.string().max(200).optional(),
        headers: z.record(z.string(), z.any()).nullish(),
        extraConfig: z.record(z.string(), z.any()).nullish(),
        orgId: z.string().max(200).optional(),
        apiVersion: z.string().max(100).optional(),
        region: z.string().max(100).optional(),
        resourceName: z.string().max(200).optional(),
    })
    .refine(
        (data) => {
            if (data.baseUrl && data.baseUrl !== "") {
                return validateBaseUrl(data.provider, data.baseUrl)
            }
            return true
        },
        {
            message: "Base URL not allowed for this provider",
            path: ["baseUrl"],
        },
    )
    .refine(
        (data) => {
            if (data.provider === "openai_compatible") {
                return !!(data.baseUrl && data.baseUrl !== "")
            }
            return true
        },
        {
            message: "Base URL is required for openai_compatible",
            path: ["baseUrl"],
        },
    )

/**
 * 生成 API Key 的脱敏预览
 * 例如：sk-proj-1234567890abcdef -> sk-***def
 */
function generateApiKeyPreview(apiKey: string): string {
    if (apiKey.length <= 8) return "***"

    const prefix = apiKey.slice(0, 3)
    const suffix = apiKey.slice(-3)

    return `${prefix}***${suffix}`
}

export const providerConfigRouter = createTRPCRouter({
    /**
     * 获取特定 provider 的配置
     */
    get: protectedProcedure
        .input(
            z.object({
                provider: providerEnum,
                name: z.string().max(100).optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            const name = (input.name || "").trim()
            const config =
                name.length > 0
                    ? await ctx.db.providerConfig.findUnique({
                          where: {
                              userId_provider_name: {
                                  userId,
                                  provider: input.provider,
                                  name,
                              },
                          },
                          select: {
                              id: true,
                              provider: true,
                              name: true,
                              isDefault: true,
                              isDisabled: true,
                              encryptedCredentials: true,
                              credentialsIv: true,
                              credentialsAuthTag: true,
                              credentialsVersion: true,
                              credentialType: true,
                              baseUrl: true,
                              modelId: true,
                              headers: true,
                              extraConfig: true,
                              orgId: true,
                              apiVersion: true,
                              region: true,
                              resourceName: true,
                              updatedAt: true,
                          },
                      })
                    : await ctx.db.providerConfig.findFirst({
                          where: {
                              userId,
                              provider: input.provider,
                          },
                          orderBy: [
                              { isDefault: "desc" },
                              { updatedAt: "desc" },
                          ],
                          select: {
                              id: true,
                              provider: true,
                              name: true,
                              isDefault: true,
                              isDisabled: true,
                              encryptedCredentials: true,
                              credentialsIv: true,
                              credentialsAuthTag: true,
                              credentialsVersion: true,
                              credentialType: true,
                              baseUrl: true,
                              modelId: true,
                              headers: true,
                              extraConfig: true,
                              orgId: true,
                              apiVersion: true,
                              region: true,
                              resourceName: true,
                              updatedAt: true,
                          },
                      })

            if (!config) {
                return null
            }

            // 解密凭证用于生成预览（不返回完整密钥）
            let apiKeyPreview: string | undefined
            let decryptionFailed = false
            let credentials: CredentialPayload | null = null
            if (
                config.encryptedCredentials &&
                config.credentialsIv &&
                config.credentialsAuthTag
            ) {
                try {
                    const decrypted = decryptCredentials({
                        encryptedData: config.encryptedCredentials,
                        iv: config.credentialsIv,
                        authTag: config.credentialsAuthTag,
                        keyVersion: config.credentialsVersion,
                    })
                    credentials = parseCredentialsPayload(decrypted)
                    if (credentials.apiKey) {
                        apiKeyPreview = generateApiKeyPreview(
                            credentials.apiKey,
                        )
                    }
                } catch (error) {
                    console.error(
                        "[provider-config] Failed to decrypt credentials:",
                        error,
                    )
                    decryptionFailed = true
                }
            }

            return {
                id: config.id,
                provider: config.provider,
                name: config.name,
                isDefault: config.isDefault,
                isDisabled: config.isDisabled,
                credentialType: config.credentialType,
                hasApiKey: !!credentials?.apiKey,
                decryptionFailed,
                apiKeyPreview,
                baseUrl: config.baseUrl || undefined,
                modelId: config.modelId || undefined,
                headers: config.headers || undefined,
                extraConfig: config.extraConfig || undefined,
                orgId: config.orgId || undefined,
                apiVersion: config.apiVersion || undefined,
                region: config.region || undefined,
                resourceName: config.resourceName || undefined,
                updatedAt: config.updatedAt,
            }
        }),

    /**
     * 获取所有已保存的 provider 配置
     */
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.user.id

        const configs = await ctx.db.providerConfig.findMany({
            where: { userId },
            select: {
                id: true,
                provider: true,
                name: true,
                isDefault: true,
                isDisabled: true,
                encryptedCredentials: true,
                credentialsIv: true,
                credentialsAuthTag: true,
                credentialsVersion: true,
                credentialType: true,
                baseUrl: true,
                modelId: true,
                headers: true,
                extraConfig: true,
                orgId: true,
                apiVersion: true,
                region: true,
                resourceName: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
        })

        return configs.map((config) => {
            let apiKeyPreview: string | undefined
            let decryptionFailed = false
            let credentials: CredentialPayload | null = null
            if (
                config.encryptedCredentials &&
                config.credentialsIv &&
                config.credentialsAuthTag
            ) {
                try {
                    const decrypted = decryptCredentials({
                        encryptedData: config.encryptedCredentials,
                        iv: config.credentialsIv,
                        authTag: config.credentialsAuthTag,
                        keyVersion: config.credentialsVersion,
                    })
                    credentials = parseCredentialsPayload(decrypted)
                    if (credentials.apiKey) {
                        apiKeyPreview = generateApiKeyPreview(
                            credentials.apiKey,
                        )
                    }
                } catch (error) {
                    console.error(
                        "[provider-config] Decryption failed for provider:",
                        config.provider,
                        error,
                    )
                    decryptionFailed = true
                }
            }

            return {
                id: config.id,
                provider: config.provider,
                name: config.name,
                isDefault: config.isDefault,
                isDisabled: config.isDisabled,
                credentialType: config.credentialType,
                hasApiKey: !!credentials?.apiKey,
                decryptionFailed,
                apiKeyPreview,
                baseUrl: config.baseUrl || undefined,
                modelId: config.modelId || undefined,
                headers: config.headers || undefined,
                extraConfig: config.extraConfig || undefined,
                orgId: config.orgId || undefined,
                apiVersion: config.apiVersion || undefined,
                region: config.region || undefined,
                resourceName: config.resourceName || undefined,
                updatedAt: config.updatedAt,
            }
        })
    }),

    /**
     * 保存/更新 provider 配置
     */
    upsert: protectedProcedure
        .input(upsertInputSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            const connectionName =
                (input.name || "").trim() || DEFAULT_CONNECTION_NAME
            const shouldSetDefault =
                input.isDefault === true ||
                (input.isDefault === undefined &&
                    connectionName === DEFAULT_CONNECTION_NAME)

            if (shouldSetDefault) {
                await ctx.db.providerConfig.updateMany({
                    where: {
                        userId,
                        provider: input.provider,
                        name: { not: connectionName },
                        isDefault: true,
                    },
                    data: { isDefault: false },
                })
            }

            const credentialsPayload: CredentialPayload | null =
                input.credentials && Object.keys(input.credentials).length > 0
                    ? (input.credentials as CredentialPayload)
                    : input.apiKey
                      ? { apiKey: input.apiKey }
                      : null

            // 检查是否是新建配置
            const existingConfig = await ctx.db.providerConfig.findUnique({
                where: {
                    userId_provider_name: {
                        userId,
                        provider: input.provider,
                        name: connectionName,
                    },
                },
                select: { id: true, encryptedCredentials: true },
            })

            // 新建配置必须有 API Key
            if (!existingConfig && !credentialsPayload) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message:
                        "API Key is required when creating a new configuration",
                })
            }

            const credentialType = resolveCredentialType(
                input.provider,
                input.credentialType,
                credentialsPayload,
            )
            const shouldUpdateCredentialType =
                input.credentialType !== undefined || !!credentialsPayload

            // 加密凭证（如果提供）
            let encryptedData: {
                encryptedCredentials?: string
                credentialsIv?: string
                credentialsAuthTag?: string
                credentialsVersion?: number
            } = {}

            if (credentialsPayload) {
                const encrypted = encryptCredentials(
                    JSON.stringify(credentialsPayload),
                )
                encryptedData = {
                    encryptedCredentials: encrypted.encryptedData,
                    credentialsIv: encrypted.iv,
                    credentialsAuthTag: encrypted.authTag,
                    credentialsVersion: encrypted.keyVersion,
                }
            }

            const config = await ctx.db.providerConfig.upsert({
                where: {
                    userId_provider_name: {
                        userId,
                        provider: input.provider,
                        name: connectionName,
                    },
                },
                create: {
                    userId,
                    provider: input.provider,
                    name: connectionName,
                    isDefault: shouldSetDefault,
                    isDisabled: input.isDisabled || false,
                    credentialType,
                    ...encryptedData,
                    baseUrl: input.baseUrl || null,
                    modelId: input.modelId || null,
                    headers: input.headers ?? undefined,
                    extraConfig: input.extraConfig ?? undefined,
                    orgId: input.orgId || null,
                    apiVersion: input.apiVersion || null,
                    region: input.region || null,
                    resourceName: input.resourceName || null,
                },
                update: {
                    // 只更新提供的字段
                    ...(credentialsPayload ? encryptedData : {}),
                    ...(input.baseUrl !== undefined
                        ? { baseUrl: input.baseUrl || null }
                        : {}),
                    ...(input.modelId !== undefined
                        ? { modelId: input.modelId || null }
                        : {}),
                    ...(input.headers !== undefined
                        ? { headers: input.headers ?? undefined }
                        : {}),
                    ...(input.extraConfig !== undefined
                        ? { extraConfig: input.extraConfig ?? undefined }
                        : {}),
                    ...(input.orgId !== undefined
                        ? { orgId: input.orgId || null }
                        : {}),
                    ...(input.apiVersion !== undefined
                        ? { apiVersion: input.apiVersion || null }
                        : {}),
                    ...(input.region !== undefined
                        ? { region: input.region || null }
                        : {}),
                    ...(input.resourceName !== undefined
                        ? { resourceName: input.resourceName || null }
                        : {}),
                    ...(input.isDefault !== undefined
                        ? { isDefault: input.isDefault }
                        : {}),
                    ...(input.isDisabled !== undefined
                        ? { isDisabled: input.isDisabled }
                        : {}),
                    ...(shouldUpdateCredentialType ? { credentialType } : {}),
                },
                select: {
                    provider: true,
                    name: true,
                    updatedAt: true,
                },
            })

            return {
                ok: true,
                provider: config.provider,
                name: config.name,
                updatedAt: config.updatedAt,
            }
        }),

    /**
     * 删除 provider 配置
     */
    delete: protectedProcedure
        .input(
            z.object({
                provider: providerEnum,
                name: z.string().max(100).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id

            const name = (input.name || "").trim()
            if (name.length > 0) {
                await ctx.db.providerConfig.delete({
                    where: {
                        userId_provider_name: {
                            userId,
                            provider: input.provider,
                            name,
                        },
                    },
                })
                return { ok: true }
            }

            const fallback = await ctx.db.providerConfig.findFirst({
                where: { userId, provider: input.provider },
                orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
                select: { name: true },
            })

            if (fallback) {
                await ctx.db.providerConfig.delete({
                    where: {
                        userId_provider_name: {
                            userId,
                            provider: input.provider,
                            name: fallback.name,
                        },
                    },
                })
            }

            return { ok: true }
        }),
})
