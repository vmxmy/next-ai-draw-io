import { z } from "zod"
import { getModelOptions } from "@/lib/model-catalog"

const querySchema = z.object({
    provider: z.string().optional(),
})

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
