import { generateText } from "ai"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { getAIModel } from "@/lib/ai-providers"
import { authOptions } from "@/server/auth"
import {
    enforceQuotaLimit,
    QuotaExceededError,
    recordTokenUsage,
} from "@/server/quota-enforcement"

export const maxDuration = 30

const bodySchema = z.object({
    prompt: z.string().min(1),
    locale: z.string().optional(),
})

function buildTitlePrompt(prompt: string, locale?: string): string {
    const isZh = locale && locale.startsWith("zh")
    const isEn = locale && locale.startsWith("en")
    const languageInstruction = isZh
        ? "界面语言为中文，请使用简体中文输出标题，不要包含英文或其他语言。"
        : isEn
          ? "The UI language is English. Respond with an English title only."
          : "标题语言跟随用户请求。"

    return [
        "你是会话标题助手。",
        languageInstruction,
        "要求：",
        "- 基于用户最初的请求意图，不要臆造细节",
        "- 长度：中文 4-16 个汉字，英文 4-40 个字符",
        "- 避免引号/句号等标点，只输出标题本身",
        "",
        "用户请求：",
        prompt,
    ].join("\n")
}

function normalizeTitle(raw: string): string {
    const cleaned = raw
        .replace(/["'“”‘’<>]/g, "")
        .replace(/\s+/g, " ")
        .replace(/[。！!?.]+$/g, "")
        .trim()

    if (!cleaned) return ""
    return cleaned.slice(0, 32)
}

export async function POST(req: Request) {
    // Access code 校验（与 /api/chat 保持一致）
    const accessCodes =
        process.env.ACCESS_CODE_LIST?.split(",")
            .map((code) => code.trim())
            .filter(Boolean) || []
    if (accessCodes.length > 0) {
        const accessCodeHeader = req.headers.get("x-access-code")
        if (!accessCodeHeader || !accessCodes.includes(accessCodeHeader)) {
            return Response.json(
                {
                    error: "Invalid or missing access code. Please configure it in Settings.",
                },
                { status: 401 },
            )
        }
    }

    const json = await req.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
        return Response.json({ error: "Invalid body" }, { status: 400 })
    }

    const rawPrompt = parsed.data.prompt.trim()
    if (!rawPrompt) {
        return Response.json({ error: "Prompt is empty" }, { status: 400 })
    }

    // 控制输入长度，避免将大文件文本传给模型
    const promptSnippet = rawPrompt.slice(0, 500)

    // 获取用户 session
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    // 使用统一的配置解析器
    const { resolveAIConfig } = await import("@/server/ai-config-resolver")
    const aiConfig = await resolveAIConfig({ userId, headers: req.headers })

    // 配额限额检查
    let quotaContext: Awaited<ReturnType<typeof enforceQuotaLimit>> = null
    try {
        quotaContext = await enforceQuotaLimit({
            headers: req.headers,
            userId,
            bypassBYOK: aiConfig.bypassQuota,
        })
    } catch (error) {
        if (error instanceof QuotaExceededError) {
            return Response.json({ error: error.message }, { status: 429 })
        }
        throw error
    }

    try {
        const { model, providerOptions, headers, modelId } = getAIModel({
            provider: aiConfig.provider,
            apiKey: aiConfig.apiKey,
            baseUrl: aiConfig.baseUrl,
            modelId: aiConfig.modelId,
        })

        console.log("[/api/conversation/title] Using model:", modelId, {
            promptLength: promptSnippet.length,
        })

        // Gemini thinking 模式需要更多 token 空间
        const isGeminiThinking =
            modelId?.includes("gemini-3") || modelId?.includes("gemini-2.5")
        const result = await generateText({
            model,
            prompt: buildTitlePrompt(promptSnippet, parsed.data.locale),
            maxOutputTokens: isGeminiThinking ? 200 : 60,
            temperature: 0.2,
            ...(providerOptions && { providerOptions }),
            ...(headers && { headers }),
        })

        const totalUsage = result.totalUsage || result.usage
        const totalTokens =
            Number(
                (totalUsage as any)?.inputTokens ??
                    (totalUsage as any)?.promptTokens ??
                    0,
            ) +
            Number(
                (totalUsage as any)?.outputTokens ??
                    (totalUsage as any)?.completionTokens ??
                    0,
            )
        if (totalTokens > 0) {
            await recordTokenUsage({
                context: quotaContext,
                tokens: totalTokens,
            })
        }

        // 提取文本：优先 result.text，否则从 content 数组中提取（Gemini thinking 模式）
        let rawText = result.text || ""
        if (!rawText && Array.isArray((result as any)?.content)) {
            const textParts = (result as any).content
                .filter((part: any) => part.type === "text" && part.text)
                .map((part: any) => part.text)
            rawText = textParts.join("").trim()
        }
        const normalized = normalizeTitle(rawText)
        const contentPreview = Array.isArray((result as any)?.content)
            ? JSON.stringify((result as any).content.slice(0, 2)).slice(0, 300)
            : undefined
        console.log("[/api/conversation/title] Generation result", {
            rawText: rawText.slice(0, 120),
            rawLength: rawText.length,
            normalized,
            normalizedLength: normalized.length,
            contentPreview,
            warnings: (result as any)?.warnings,
        })
        const title =
            normalized ||
            (parsed.data.locale?.startsWith("zh")
                ? "未命名对话"
                : "Untitled session")

        return Response.json({ title })
    } catch (error) {
        if (error instanceof QuotaExceededError) {
            return Response.json({ error: error.message }, { status: 429 })
        }

        console.error(
            "[/api/conversation/title] Failed to generate title:",
            error,
        )
        return Response.json(
            { error: "Failed to generate title" },
            { status: 500 },
        )
    }
}
