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
    // 优先使用用户第一条消息作为上下文（更语义化）
    firstUserMessage: z.string().optional(),
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

/**
 * 从会话 payload 中提取第一条用户消息
 */
function extractFirstUserMessageFromPayload(payload: any): string | null {
    if (!payload?.messages || !Array.isArray(payload.messages)) return null
    const firstUserMsg = payload.messages.find(
        (msg: any) => msg.role === "user",
    )
    if (!firstUserMsg?.parts || !Array.isArray(firstUserMsg.parts)) return null
    const textParts = firstUserMsg.parts
        .filter((part: any) => part.type === "text" && part.text)
        .map((part: any) => part.text)
    const result = textParts.join(" ").trim()
    return result || null
}

/**
 * 从 XML 提取结构化语义信息
 */
interface DiagramSemantics {
    diagramType: string
    nodeLabels: string[]
    connections: string[]
    summary: string
}

function extractDiagramSemantics(xml: string): DiagramSemantics {
    // 提取所有 value 属性中的文本
    const valueMatches = Array.from(xml.matchAll(/value="([^"]{1,200})"/g)).map(
        (m) => m[1],
    )

    // 清理 HTML 实体和标签
    const cleanLabel = (text: string): string => {
        return text
            .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+);/g, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    }

    // 过滤有意义的标签
    const isValidLabel = (label: string): boolean => {
        if (label.length < 2 || label.length > 100) return false
        // 过滤纯数字、纯符号、编号前缀
        if (/^[\d\s.、\-:：]+$/.test(label)) return false
        // 过滤只有编号的标签如 "1." "2." "步骤1"
        if (/^(步骤|step|Stage|Phase)?\s*\d+\.?\s*$/i.test(label)) return false
        return true
    }

    // 提取并去除编号前缀
    const removeNumberPrefix = (label: string): string => {
        return label
            .replace(/^[\d\s.、\-:：]+/, "")
            .replace(/^(步骤|step|Stage|Phase)\s*\d+\.?\s*/i, "")
            .trim()
    }

    const nodeLabels = valueMatches
        .map(cleanLabel)
        .filter(isValidLabel)
        .map(removeNumberPrefix)
        .filter((label) => label.length >= 2)

    // 去重并保留顺序
    const uniqueLabels = Array.from(new Set(nodeLabels))

    // 检测图表类型
    const detectDiagramType = (): string => {
        const xmlLower = xml.toLowerCase()

        // 检测常见形状模式
        const hasArrows =
            xmlLower.includes("edgestyle") || xmlLower.includes("arrow")
        const hasSwimLanes =
            xmlLower.includes("swimlane") || xmlLower.includes("lane")
        const hasDecision =
            xmlLower.includes("rhombus") || xmlLower.includes("decision")
        const hasDatabase =
            xmlLower.includes("cylinder") || xmlLower.includes("database")
        const hasActor =
            xmlLower.includes("actor") || xmlLower.includes("stickman")
        const hasCloud =
            xmlLower.includes("cloud") ||
            xmlLower.includes("ellipse;shape=cloud")
        const hasRectangles =
            xmlLower.includes("rounded=1") || xmlLower.includes("rectangle")

        // 检测关键词
        const labelsText = uniqueLabels.join(" ").toLowerCase()
        const hasApiKeywords = /api|request|response|http|endpoint/i.test(
            labelsText,
        )
        const hasFlowKeywords = /开始|结束|start|end|begin|finish/i.test(
            labelsText,
        )
        const hasArchKeywords =
            /server|client|database|service|component|module/i.test(labelsText)
        const hasUiKeywords = /button|input|form|page|screen|view|ui/i.test(
            labelsText,
        )
        const hasDataKeywords = /data|process|transform|input|output/i.test(
            labelsText,
        )

        if (hasSwimLanes) return "泳道图/跨职能流程图"
        if (hasActor) return "用例图/时序图"
        if (hasDatabase && hasArchKeywords) return "系统架构图"
        if (hasCloud && hasArchKeywords) return "云架构图"
        if (hasDecision && hasFlowKeywords) return "流程图"
        if (hasApiKeywords) return "API 流程图"
        if (hasArchKeywords) return "架构图"
        if (hasUiKeywords) return "UI 设计图"
        if (hasDataKeywords && hasArrows) return "数据流图"
        if (hasArrows && hasRectangles) return "流程图"

        return "图表"
    }

    // 提取连接关系（简化版）
    const connections: string[] = []
    const edgeMatches = xml.matchAll(/source="([^"]+)"[^>]*target="([^"]+)"/g)
    for (const match of edgeMatches) {
        if (connections.length < 5) {
            connections.push(`${match[1]} → ${match[2]}`)
        }
    }

    // 生成摘要
    const diagramType = detectDiagramType()
    const topLabels = uniqueLabels.slice(0, 8)
    const summary =
        topLabels.length > 0
            ? `${diagramType}，包含节点：${topLabels.join("、")}`
            : diagramType

    return {
        diagramType,
        nodeLabels: uniqueLabels.slice(0, 15),
        connections,
        summary,
    }
}

/**
 * 基于用户第一条消息生成标题 prompt（优先使用）
 */
function buildPromptFromUserMessage(
    userMessage: string,
    locale?: string,
): string {
    const isZh = locale?.startsWith("zh")
    const isEn = locale?.startsWith("en")

    const languageInstruction = isZh
        ? "请用简体中文输出标题。"
        : isEn
          ? "Respond with an English title."
          : "Output title in appropriate language."

    // 截取用户消息的核心部分
    const messageSnippet = userMessage.slice(0, 500).trim()

    return [
        "你是图表标题生成助手。根据用户的绘图请求，生成一个简洁准确的标题。",
        "",
        languageInstruction,
        "",
        "## 用户请求",
        messageSnippet,
        "",
        "## 要求",
        "1. 标题应概括用户想要绘制的图表主题",
        "2. 长度：中文 4-12 个汉字，英文 15-35 个字符",
        "3. 不要包含标点符号、引号",
        "4. 不要使用 '图表'、'流程' 等泛化词汇开头",
        "",
        "## 示例",
        "用户请求: '画一个用户登录的流程图' → 标题: '用户登录流程'",
        "用户请求: '帮我设计微服务架构' → 标题: '微服务架构设计'",
        "用户请求: '订单从创建到完成的状态变化' → 标题: '订单状态流转'",
        "",
        "直接输出标题，不要解释：",
    ].join("\n")
}

/**
 * 基于 XML 语义生成标题 prompt（fallback）
 */
function buildPromptFromXml(xml: string, locale?: string): string {
    const isZh = locale?.startsWith("zh")
    const isEn = locale?.startsWith("en")

    const semantics = extractDiagramSemantics(xml)

    const languageInstruction = isZh
        ? "请用简体中文输出标题。"
        : isEn
          ? "Respond with an English title."
          : "Output title in appropriate language."

    // 构建结构化上下文
    const context = [
        `图表类型: ${semantics.diagramType}`,
        `主要节点: ${semantics.nodeLabels.join(", ") || "无明确标签"}`,
        semantics.connections.length > 0
            ? `关系: ${semantics.connections.join("; ")}`
            : "",
    ]
        .filter(Boolean)
        .join("\n")

    return [
        "你是图表标题生成助手。根据以下图表语义信息，生成一个简洁准确的标题。",
        "",
        languageInstruction,
        "",
        "## 图表信息",
        context,
        "",
        "## 要求",
        "1. 标题应概括图表的主题或目的，而非罗列节点名称",
        "2. 长度：中文 4-12 个汉字，英文 15-35 个字符",
        "3. 不要包含标点符号、引号",
        "4. 不要使用 '图表'、'流程' 等泛化词汇开头",
        "",
        "## 示例",
        "- 好标题: '用户登录认证流程'、'微服务架构设计'、'订单处理系统'",
        "- 差标题: '流程图'、'1. 请求 / 2. 响应'、'系统图表'",
        "",
        "直接输出标题，不要解释：",
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

function deriveTitleFromXml(xml: string, locale?: string): string | null {
    const semantics = extractDiagramSemantics(xml)

    if (semantics.nodeLabels.length === 0) {
        return null
    }

    // 使用语义信息生成更好的 fallback 标题
    const isZh = locale?.startsWith("zh")
    const topLabels = semantics.nodeLabels.slice(0, 3)

    // 如果只有一个有意义的标签，直接使用
    if (topLabels.length === 1 && topLabels[0].length >= 4) {
        return topLabels[0].slice(0, 20)
    }

    // 根据图表类型生成标题
    const typePrefix = isZh
        ? semantics.diagramType.split("/")[0]
        : semantics.diagramType.includes("流程")
          ? "Flow"
          : semantics.diagramType.includes("架构")
            ? "Architecture"
            : "Diagram"

    // 组合：类型 + 主要标签
    const mainLabel = topLabels[0] || ""
    if (mainLabel.length >= 3) {
        return `${mainLabel}${isZh ? "相关" : " related"}${typePrefix}`
            .slice(0, 20)
            .trim()
    }

    return topLabels.join(isZh ? "与" : " & ").slice(0, 20) || null
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

    const { conversationId, locale, firstUserMessage } = parsed.data
    let xml = parsed.data.xml?.trim() || ""

    // 尝试从数据库读取（仅登录用户且未提供完整数据时）
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    let userMessage = firstUserMessage?.trim() || ""

    // 如果没有 XML 或用户消息，从数据库读取
    if (!xml || !userMessage) {
        if (!userId && !xml && !userMessage) {
            return Response.json(
                {
                    error: "XML or user message is required for anonymous users",
                },
                { status: 400 },
            )
        }

        if (userId) {
            const conversation = await db.conversation.findUnique({
                where: { userId_id: { userId, id: conversationId } },
                select: { data: true },
            })

            const payload = conversation?.data as any
            if (!xml) {
                xml = extractXmlFromPayload(payload) || ""
            }
            if (!userMessage) {
                userMessage = extractFirstUserMessageFromPayload(payload) || ""
            }
        }
    }

    // 必须至少有 XML 或用户消息之一
    if (!xml.trim() && !userMessage) {
        return Response.json(
            { error: "No content available for this session" },
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
        // 直接从 headers 读取 provider（sanitizeClientOverrides 在无 apiKey 时返回 null）
        const requestedProvider =
            req.headers.get("x-ai-provider") ||
            req.headers.get("x-ai-provider-hint") ||
            null

        // 如果指定了 provider，按 provider 查询；否则查询任意可用配置（优先 isDefault）
        const userConfig = await db.providerConfig.findFirst({
            where: {
                userId,
                ...(requestedProvider ? { provider: requestedProvider } : {}),
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

        // 优先使用用户消息，否则使用 XML 语义提取
        const useUserMessageForPrompt = !!userMessage
        const prompt = useUserMessageForPrompt
            ? buildPromptFromUserMessage(userMessage, locale)
            : buildPromptFromXml(xmlSnippet, locale)

        const semanticsPreview = useUserMessageForPrompt
            ? null
            : extractDiagramSemantics(xmlSnippet)
        console.log("[/api/conversation/title/diagram] Using model:", modelId, {
            conversationId,
            source: useUserMessageForPrompt ? "userMessage" : "xml",
            ...(useUserMessageForPrompt
                ? { messagePreview: userMessage.slice(0, 50) }
                : {
                      xmlLength: xmlSnippet.length,
                      diagramType: semanticsPreview?.diagramType,
                      nodeLabels: semanticsPreview?.nodeLabels.slice(0, 5),
                  }),
        })

        // Gemini thinking 模式需要更多 token 空间
        const isGeminiThinking =
            modelId?.includes("gemini-3") || modelId?.includes("gemini-2.5")
        const result = await generateText({
            model,
            prompt,
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
        console.log("[/api/conversation/title/diagram] Generation result", {
            rawText: rawText.slice(0, 120),
            rawLength: rawText.length,
            normalized,
            normalizedLength: normalized.length,
            contentPreview,
            warnings: (result as any)?.warnings,
        })
        if (!normalized) {
            const fallback = locale?.startsWith("zh")
                ? "未命名图表"
                : "Untitled diagram"
            const derived = deriveTitleFromXml(xmlSnippet, locale)
            const finalTitle = derived || fallback
            console.warn(
                "[/api/conversation/title/diagram] Empty title, using fallback",
                { fallback: finalTitle, derived, rawText },
            )
            return Response.json({
                title: finalTitle,
                fallback: true,
                derived: !!derived,
            })
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
