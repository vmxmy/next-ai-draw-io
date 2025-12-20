import { generateText } from "ai"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { sanitizeClientOverrides } from "@/lib/ai-client-overrides"
import { getAIModel } from "@/lib/ai-providers"
import { authOptions } from "@/server/auth"
import { db } from "@/server/db"
import { decryptCredentials } from "@/server/encryption"
import {
    enforceQuotaLimit,
    QuotaExceededError,
    recordTokenUsage,
} from "@/server/quota-enforcement"

export const maxDuration = 30

const bodySchema = z.object({
    conversationId: z.string().min(1),
    locale: z.string().optional(),
    xml: z.string().optional(),
})

function extractXmlFromPayload(payload: any): string | null {
    if (!payload) return null
    const xml = typeof payload.xml === "string" ? payload.xml : ""
    if (xml.trim()) return xml

    const versions = Array.isArray(payload.diagramVersions)
        ? payload.diagramVersions
        : []
    for (let i = versions.length - 1; i >= 0; i--) {
        const candidate = versions[i]?.xml
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate
        }
    }
    return null
}

function buildPrompt(xml: string, locale?: string): string {
    const isZh = locale && locale.startsWith("zh")
    const isEn = locale && locale.startsWith("en")
    const languageInstruction = isZh
        ? "请用简体中文输出标题，仅依据图表内容，不要夹杂其他语言。"
        : isEn
          ? "Respond with an English title based only on the diagram."
          : "Title language should follow the user's UI language."

    return [
        "你是会话标题助手，下面是一个 draw.io 图表的 XML。",
        languageInstruction,
        "要求：",
        "- 仅根据图表结构/节点/连线含义生成标题，不要杜撰细节",
        "- 长度：中文 4-16 个汉字，英文 4-40 个字符",
        "- 避免标点和引号，只输出标题本身",
        "",
        "图表 XML：",
        xml,
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

    const { conversationId, locale } = parsed.data
    let xml = parsed.data.xml?.trim() || ""

    // 尝试从数据库读取（仅登录用户且未提供 xml 时）
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    if (!xml) {
        if (!userId) {
            return Response.json(
                { error: "XML is required for anonymous users" },
                { status: 400 },
            )
        }

        const conversation = await db.conversation.findUnique({
            where: { userId_id: { userId, id: conversationId } },
            select: { data: true },
        })

        const payload = conversation?.data as any
        xml = extractXmlFromPayload(payload) || ""
    }

    if (!xml.trim()) {
        return Response.json(
            { error: "No diagram content available for this session" },
            { status: 400 },
        )
    }

    // 控制 XML 长度，避免超长输入
    const xmlSnippet = xml.slice(0, 8000)

    const clientOverrides = sanitizeClientOverrides(req.headers)

    // 登录用户云端配置（BYOK 未提供时才读取）
    let userCloudConfig: {
        provider?: string | null
        apiKey?: string | null
        baseUrl?: string | null
        modelId?: string | null
    } = {}

    if (userId && !clientOverrides.apiKey) {
        const requestedProvider =
            clientOverrides.provider ||
            req.headers.get("x-ai-provider-hint") ||
            null

        const userConfig = await db.providerConfig.findFirst({
            where: {
                userId,
                ...(requestedProvider
                    ? { provider: requestedProvider }
                    : { isDefault: true }),
                isDisabled: false,
            },
            orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        })

        if (userConfig?.encryptedCredentials) {
            try {
                const decrypted = decryptCredentials({
                    encryptedData: userConfig.encryptedCredentials,
                    iv: userConfig.credentialsIv!,
                    authTag: userConfig.credentialsAuthTag!,
                    keyVersion: userConfig.credentialsVersion,
                })
                const credentials = JSON.parse(decrypted)

                userCloudConfig = {
                    provider: userConfig.provider,
                    apiKey: credentials.apiKey,
                    baseUrl: userConfig.baseUrl || undefined,
                    modelId: userConfig.modelId || undefined,
                }
            } catch (error) {
                console.error(
                    "[/api/conversation/title/diagram] Failed to decrypt user credentials:",
                    error,
                )
            }
        }
    }

    // 配额检查：BYOK/用户云端配置绕过
    const hasBYOK = !!(clientOverrides.provider && clientOverrides.apiKey)
    const hasUserCloudConfig = !!userCloudConfig.apiKey
    let quotaContext: Awaited<ReturnType<typeof enforceQuotaLimit>> = null
    try {
        quotaContext = await enforceQuotaLimit({
            headers: req.headers,
            userId,
            bypassBYOK: hasBYOK || hasUserCloudConfig,
        })
    } catch (error) {
        if (error instanceof QuotaExceededError) {
            return Response.json({ error: error.message }, { status: 429 })
        }
        throw error
    }

    // 系统默认配置
    const { getDefaultAIConfig } = await import("@/server/system-config")
    const defaultConfig = await getDefaultAIConfig()

    const finalOverrides = {
        provider:
            clientOverrides.provider ||
            userCloudConfig.provider ||
            defaultConfig.provider,
        modelId:
            clientOverrides.modelId ||
            userCloudConfig.modelId ||
            defaultConfig.model,
        apiKey:
            clientOverrides.apiKey ||
            userCloudConfig.apiKey ||
            defaultConfig.apiKey,
        baseUrl:
            clientOverrides.baseUrl ||
            userCloudConfig.baseUrl ||
            defaultConfig.baseUrl,
    }

    try {
        const { model, providerOptions, headers, modelId } =
            getAIModel(finalOverrides)

        console.log("[/api/conversation/title/diagram] Using model:", modelId, {
            conversationId,
            xmlLength: xmlSnippet.length,
        })

        const result = await generateText({
            model,
            prompt: buildPrompt(xmlSnippet, locale),
            maxOutputTokens: 40,
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

        const rawText = result.text || ""
        const normalized = normalizeTitle(rawText)
        const contentPreview = Array.isArray((result as any)?.content)
            ? JSON.stringify((result as any).content.slice(0, 2)).slice(0, 300)
            : undefined
        console.log("[/api/conversation/title/diagram] Generation result", {
            rawText: rawText.slice(0, 120),
            rawLength: rawText.length,
            normalized,
            normalizedLength: normalized.length,
            contentPreview,
            warnings: (result as any)?.warnings,
        })
        if (!normalized) {
            const fallback =
                locale && locale.startsWith("zh")
                    ? "未命名图表"
                    : "Untitled diagram"
            console.warn(
                "[/api/conversation/title/diagram] Empty title, using fallback",
                { fallback },
            )
            return Response.json({ title: fallback, fallback: true })
        }

        return Response.json({ title: normalized })
    } catch (error) {
        if (error instanceof QuotaExceededError) {
            return Response.json({ error: error.message }, { status: 429 })
        }

        console.error(
            "[/api/conversation/title/diagram] Failed to generate title:",
            error,
        )
        return Response.json(
            { error: "Failed to generate title" },
            { status: 500 },
        )
    }
}
