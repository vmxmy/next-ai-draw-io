import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/server/auth"
import { db } from "@/server/db"
import { decryptCredentials } from "@/server/encryption"
import { getSystemCredential } from "@/server/system-config"

export const maxDuration = 30

const querySchema = z.object({
    provider: z.string().optional(),
})

const postBodySchema = z.object({
    provider: z.string().min(1),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
})

// 从用户云端配置获取凭证
async function getUserCloudCredentials(
    userId: string,
    provider: string,
): Promise<{ apiKey: string; baseUrl?: string } | null> {
    const userConfig = await db.providerConfig.findFirst({
        where: {
            userId,
            provider,
            isDisabled: false,
        },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    })

    if (!userConfig?.encryptedCredentials) {
        return null
    }

    try {
        const decrypted = decryptCredentials({
            encryptedData: userConfig.encryptedCredentials,
            iv: userConfig.credentialsIv!,
            authTag: userConfig.credentialsAuthTag!,
            keyVersion: userConfig.credentialsVersion,
        })
        const credentials = JSON.parse(decrypted)
        return {
            apiKey: credentials.apiKey,
            baseUrl: userConfig.baseUrl || undefined,
        }
    } catch (error) {
        console.error(
            "[/api/models] Failed to decrypt user credentials:",
            error,
        )
        return null
    }
}

type ModelRow = { id: string; label?: string }

// 从数据库获取 Provider 的建议模型
async function getSuggestedModels(provider: string): Promise<ModelRow[]> {
    const catalog = await db.providerCatalog.findUnique({
        where: { key: provider },
        select: { suggestedModels: true },
    })
    if (!catalog?.suggestedModels) return []
    const models = catalog.suggestedModels as unknown
    if (!Array.isArray(models)) return []
    return models
        .filter(
            (m): m is { id: string; label?: string } =>
                typeof m === "object" &&
                m !== null &&
                typeof (m as { id?: unknown }).id === "string",
        )
        .map((m) => ({ id: m.id, label: m.label }))
}

function normalizeBaseUrl(url: string) {
    return url.replace(/\/+$/, "")
}

async function listModelsFromOpenAICompatible(opts: {
    baseUrl: string
    apiKey: string
}): Promise<ModelRow[]> {
    const res = await fetch(`${normalizeBaseUrl(opts.baseUrl)}/models`, {
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        cache: "no-store",
    })
    if (!res.ok) return []
    const json = await res.json()
    const data = Array.isArray(json?.data) ? json.data : []
    return data
        .map((m: any) => ({ id: String(m?.id || "") }))
        .filter((m: ModelRow) => m.id)
}

async function listModelsFromOpenRouter(opts: {
    baseUrl: string
    apiKey: string
}): Promise<ModelRow[]> {
    const res = await fetch(`${normalizeBaseUrl(opts.baseUrl)}/models`, {
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        cache: "no-store",
    })
    if (!res.ok) return []
    const json = await res.json()
    const data = Array.isArray(json?.data) ? json.data : []
    return data
        .map((m: any) => ({
            id: String(m?.id || ""),
            label: m?.name ? String(m.name) : undefined,
        }))
        .filter((m: ModelRow) => m.id)
}

async function listModelsFromGoogle(opts: {
    baseUrl: string
    apiKey: string
}): Promise<ModelRow[]> {
    const baseUrl = normalizeBaseUrl(opts.baseUrl)
    const url = new URL(`${baseUrl}/models`)
    url.searchParams.set("key", opts.apiKey)

    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return []
    const json = await res.json()
    const models = Array.isArray(json?.models) ? json.models : []

    return models
        .map((m: any) => {
            const name = String(m?.name || "")
            const displayName = m?.displayName ? String(m.displayName) : ""
            const normalized = name.startsWith("models/")
                ? name.slice("models/".length)
                : name
            return {
                id: normalized,
                label: displayName || undefined,
            }
        })
        .filter((m: ModelRow) => m.id)
}

export async function GET(req: Request) {
    const url = new URL(req.url)
    const parsed = querySchema.safeParse({
        provider: url.searchParams.get("provider") || undefined,
    })
    if (!parsed.success) {
        return Response.json({ error: "Invalid query" }, { status: 400 })
    }

    const provider = (parsed.data.provider || "").trim().toLowerCase()
    if (!provider) {
        return Response.json({ models: [] })
    }

    return Response.json({
        models: await getSuggestedModels(provider),
    })
}

export async function POST(req: Request) {
    const json = await req.json().catch(() => null)
    const parsed = postBodySchema.safeParse(json)
    if (!parsed.success) {
        return Response.json({ error: "Invalid body" }, { status: 400 })
    }

    const provider = parsed.data.provider.trim().toLowerCase()
    let apiKey = (parsed.data.apiKey || "").trim()
    let baseUrl = (parsed.data.baseUrl || "").trim()

    // 如果客户端没有传 apiKey，尝试从用户云端配置获取
    if (!apiKey) {
        const session = await getServerSession(authOptions)
        const userId = session?.user?.id

        if (userId) {
            const cloudCredentials = await getUserCloudCredentials(
                userId,
                provider,
            )
            if (cloudCredentials) {
                apiKey = cloudCredentials.apiKey
                // 只在客户端没有传 baseUrl 时使用云端的
                if (!baseUrl && cloudCredentials.baseUrl) {
                    baseUrl = cloudCredentials.baseUrl
                }
                console.log(
                    "[/api/models] Using user cloud credentials for:",
                    provider,
                )
            }
        }
    }

    // 如果仍无 apiKey，尝试从系统凭证获取
    if (!apiKey) {
        const systemCredential = await getSystemCredential(provider)
        if (systemCredential) {
            apiKey = systemCredential.apiKey
            if (!baseUrl && systemCredential.baseUrl) {
                baseUrl = systemCredential.baseUrl
            }
            console.log("[/api/models] Using system credentials for:", provider)
        }
    }

    if (!apiKey) {
        return Response.json({ models: await getSuggestedModels(provider) })
    }

    try {
        // Determine which baseURL to use (custom or default)
        const effectiveBaseUrl = baseUrl

        switch (provider) {
            case "openai":
                return Response.json({
                    models: await listModelsFromOpenAICompatible({
                        baseUrl:
                            effectiveBaseUrl || "https://api.openai.com/v1",
                        apiKey,
                    }),
                })
            case "openai_compatible":
                if (!effectiveBaseUrl) {
                    return Response.json({ models: [] })
                }
                return Response.json({
                    models: await listModelsFromOpenAICompatible({
                        baseUrl: effectiveBaseUrl,
                        apiKey,
                    }),
                })
            case "deepseek":
                return Response.json({
                    models: await listModelsFromOpenAICompatible({
                        baseUrl:
                            effectiveBaseUrl || "https://api.deepseek.com/v1",
                        apiKey,
                    }),
                })
            case "siliconflow":
                return Response.json({
                    models: await listModelsFromOpenAICompatible({
                        baseUrl:
                            effectiveBaseUrl || "https://api.siliconflow.cn/v1",
                        apiKey,
                    }),
                })
            case "openrouter":
                return Response.json({
                    models: await listModelsFromOpenRouter({
                        baseUrl:
                            effectiveBaseUrl || "https://openrouter.ai/api/v1",
                        apiKey,
                    }),
                })
            case "google":
                return Response.json({
                    models: await listModelsFromGoogle({
                        baseUrl:
                            effectiveBaseUrl ||
                            "https://generativelanguage.googleapis.com/v1beta",
                        apiKey,
                    }),
                })
            case "anthropic":
                // Anthropic uses OpenAI-compatible /v1/models endpoint
                return Response.json({
                    models: await listModelsFromOpenAICompatible({
                        baseUrl:
                            effectiveBaseUrl || "https://api.anthropic.com/v1",
                        apiKey,
                    }),
                })
            default:
                return Response.json({
                    models: await getSuggestedModels(provider),
                })
        }
    } catch {
        return Response.json({ models: await getSuggestedModels(provider) })
    }
}
