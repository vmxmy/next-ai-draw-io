import { z } from "zod"
import { getModelOptions } from "@/lib/model-catalog"

const querySchema = z.object({
    provider: z.string().optional(),
})

const postBodySchema = z.object({
    provider: z.string().min(1),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
})

type ModelRow = { id: string; label?: string }

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
        models: getModelOptions(provider),
    })
}

export async function POST(req: Request) {
    const json = await req.json().catch(() => null)
    const parsed = postBodySchema.safeParse(json)
    if (!parsed.success) {
        return Response.json({ error: "Invalid body" }, { status: 400 })
    }

    const provider = parsed.data.provider.trim().toLowerCase()
    const apiKey = (parsed.data.apiKey || "").trim()
    const baseUrl = (parsed.data.baseUrl || "").trim()

    if (!apiKey) {
        return Response.json({ models: getModelOptions(provider) })
    }

    try {
        switch (provider) {
            case "openai":
                return Response.json({
                    models: await listModelsFromOpenAICompatible({
                        baseUrl: baseUrl || "https://api.openai.com/v1",
                        apiKey,
                    }),
                })
            case "deepseek":
            case "siliconflow":
                return Response.json({
                    models: await listModelsFromOpenAICompatible({
                        baseUrl: baseUrl || "https://api.siliconflow.com/v1",
                        apiKey,
                    }),
                })
            case "openrouter":
                return Response.json({
                    models: await listModelsFromOpenRouter({
                        baseUrl: baseUrl || "https://openrouter.ai/api/v1",
                        apiKey,
                    }),
                })
            case "google":
                return Response.json({
                    models: await listModelsFromGoogle({
                        baseUrl:
                            baseUrl ||
                            "https://generativelanguage.googleapis.com/v1beta",
                        apiKey,
                    }),
                })
            default:
                return Response.json({ models: getModelOptions(provider) })
        }
    } catch {
        return Response.json({ models: getModelOptions(provider) })
    }
}
