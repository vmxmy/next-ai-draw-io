import {
    APICallError,
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    LoadAPIKeyError,
    stepCountIs,
    streamText,
} from "ai"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import {
    getAIModel,
    supportsHistoryXmlReplace,
    supportsPromptCaching,
} from "@/lib/ai-providers"
import { findCachedResponse } from "@/lib/cached-responses"
import { expandFileReferences } from "@/lib/file-reference"
import {
    getTelemetryConfig,
    setTraceInput,
    setTraceMetadata,
    setTraceOutput,
    wrapWithObserve,
} from "@/lib/langfuse"
import { MAX_FILE_SIZE_BYTES, MAX_FILES } from "@/lib/limits"
import { applyMessageWindow } from "@/lib/message-window"
import { getSystemPrompt } from "@/lib/system-prompts"
import {
    ANALYZE_DIAGRAM_DESCRIPTION,
    DISPLAY_DIAGRAM_DESCRIPTION,
    EDIT_DIAGRAM_DESCRIPTION,
} from "@/lib/tool-descriptions"
import { analyzeDiagramXml } from "@/lib/xml-analyzer"
import { generateXmlDiff } from "@/lib/xml-diff"
import { buildDiagramSummary } from "@/lib/xml-summary"
import { authOptions } from "@/server/auth"
import { db } from "@/server/db"
import { decryptCredentials } from "@/server/encryption"
import {
    enforceQuotaLimit,
    QuotaExceededError,
    recordTokenUsage,
} from "@/server/quota-enforcement"

export const maxDuration = 120

function sanitizeClientOverrides(headers: Headers): {
    provider: string | null
    baseUrl: string | null
    apiKey: string | null
    modelId: string | null
} {
    const allowClientOverrides =
        process.env.ENABLE_CLIENT_AI_OVERRIDES === "true" ||
        process.env.NODE_ENV === "development"

    console.log(
        "[Client Overrides] allowClientOverrides:",
        allowClientOverrides,
    )
    console.log("[Client Overrides] NODE_ENV:", process.env.NODE_ENV)
    console.log(
        "[Client Overrides] ENABLE_CLIENT_AI_OVERRIDES:",
        process.env.ENABLE_CLIENT_AI_OVERRIDES,
    )

    if (!allowClientOverrides) {
        return { provider: null, baseUrl: null, apiKey: null, modelId: null }
    }

    const provider = headers.get("x-ai-provider")
    const baseUrl = headers.get("x-ai-base-url")
    const apiKey = headers.get("x-ai-api-key")
    const modelId = headers.get("x-ai-model")

    console.log("[Client Overrides] Headers received:", {
        provider,
        baseUrl: baseUrl ? `${baseUrl.substring(0, 30)}...` : null,
        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : null,
        modelId,
    })

    // KISS：没有 API Key 时不接受任何覆写，避免"强行切 provider 但走服务端默认密钥"的混淆与风险。
    if (!apiKey) {
        console.log(
            "[Client Overrides] No API key provided, rejecting overrides",
        )
        return { provider: null, baseUrl: null, apiKey: null, modelId: null }
    }

    const allowlist = (process.env.AI_BASE_URL_ALLOWLIST || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)

    let sanitizedBaseUrl: string | null = null
    if (baseUrl) {
        try {
            const url = new URL(baseUrl)
            const hostname = url.hostname.toLowerCase()

            // 仅允许 https；开发环境下允许 localhost 走 http 便于本地联调
            const isLocalhost =
                hostname === "localhost" ||
                hostname === "127.0.0.1" ||
                hostname === "::1"
            const isHttpAllowed =
                process.env.NODE_ENV === "development" && isLocalhost
            if (
                url.protocol !== "https:" &&
                !(isHttpAllowed && url.protocol === "http:")
            ) {
                throw new Error("protocol not allowed")
            }

            // 基础 SSRF 防护：禁用 localhost/内网后缀；更严格的 DNS/IP 校验需要在网关层实现
            if (
                isLocalhost ||
                hostname.endsWith(".local") ||
                hostname.endsWith(".internal")
            ) {
                throw new Error("hostname not allowed")
            }

            // 白名单为空时允许所有 HTTPS URL，否则检查白名单
            if (allowlist.length === 0 || allowlist.includes(hostname)) {
                sanitizedBaseUrl = url.toString()
            }
        } catch {
            sanitizedBaseUrl = null
        }
    }

    const result = {
        provider: provider || null,
        baseUrl: sanitizedBaseUrl,
        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : null,
        modelId: modelId || null,
    }

    console.log("[Client Overrides] Final result:", result)

    return {
        provider: provider || null,
        baseUrl: sanitizedBaseUrl,
        apiKey,
        modelId: modelId || null,
    }
}

// Helper function to validate file parts in messages
function validateFileParts(messages: any[]): {
    valid: boolean
    error?: string
} {
    const lastMessage = messages[messages.length - 1]
    const fileParts =
        lastMessage?.parts?.filter((p: any) => p.type === "file") || []

    if (fileParts.length > MAX_FILES) {
        return {
            valid: false,
            error: `Too many files. Maximum ${MAX_FILES} allowed.`,
        }
    }

    for (const filePart of fileParts) {
        // Data URLs format: data:image/png;base64,<data>
        // Base64 increases size by ~33%, so we check the decoded size
        if (filePart.url?.startsWith("data:")) {
            const base64Data = filePart.url.split(",")[1]
            if (base64Data) {
                const sizeInBytes = Math.ceil((base64Data.length * 3) / 4)
                if (sizeInBytes > MAX_FILE_SIZE_BYTES) {
                    return {
                        valid: false,
                        error: `File exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit.`,
                    }
                }
            }
        }
    }

    return { valid: true }
}

// Helper function to check if diagram is minimal/empty
function isMinimalDiagram(xml: string): boolean {
    const stripped = xml.replace(/\s/g, "")
    return !stripped.includes('id="2"')
}

// Helper function to replace historical tool call XML with placeholders
// This reduces token usage and forces LLM to rely on the current diagram XML (source of truth)
function replaceHistoricalToolInputs(messages: any[]): any[] {
    return messages.map((msg) => {
        if (msg.role !== "assistant" || !Array.isArray(msg.content)) {
            return msg
        }
        const replacedContent = msg.content.map((part: any) => {
            if (part.type === "tool-call") {
                const toolName = part.toolName
                if (
                    toolName === "display_diagram" ||
                    toolName === "edit_diagram"
                ) {
                    return {
                        ...part,
                        input: {
                            placeholder:
                                "[XML content replaced - see current diagram XML in system context]",
                        },
                    }
                }
            }
            return part
        })
        return { ...msg, content: replacedContent }
    })
}

// Helper function to fix tool call inputs for Bedrock API
// Bedrock requires toolUse.input to be a JSON object, not a string
function fixToolCallInputs(messages: any[]): any[] {
    return messages.map((msg) => {
        if (msg.role !== "assistant" || !Array.isArray(msg.content)) {
            return msg
        }
        const fixedContent = msg.content.map((part: any) => {
            if (part.type === "tool-call") {
                if (typeof part.input === "string") {
                    try {
                        const parsed = JSON.parse(part.input)
                        return { ...part, input: parsed }
                    } catch {
                        // If parsing fails, wrap the string in an object
                        return { ...part, input: { rawInput: part.input } }
                    }
                }
                // Input is already an object, but verify it's not null/undefined
                if (part.input === null || part.input === undefined) {
                    return { ...part, input: {} }
                }
            }
            return part
        })
        return { ...msg, content: fixedContent }
    })
}

function sanitizeGoogleToolCallingHistory(messages: any[]): any[] {
    // Gemini（Google GenAI）对工具调用历史的顺序更严格：
    // - 含 functionCall 的模型回合必须紧跟在 user 回合或 functionResponse 回合之后
    // - functionCall 回合后必须立刻跟 functionResponse 回合（否则会 400）
    // 本项目会做消息裁剪（windowing），以及在 UI 侧持久化消息；这可能造成 tool-call/tool 断裂。
    // 这里做保守清洗：合并连续 assistant、去掉“没有紧邻 tool 响应”的 tool-call、去掉“没有前置 tool-call”的孤儿 tool。

    const merged: any[] = []
    for (const msg of messages) {
        const prev = merged[merged.length - 1]
        if (
            prev?.role === "assistant" &&
            msg?.role === "assistant" &&
            Array.isArray(prev.content) &&
            Array.isArray(msg.content)
        ) {
            // 合并时需保留 OpenRouter/Gemini 的 reasoning_details（包含 thought_signature），否则后续请求会 400。
            const prevDetails =
                prev?.providerOptions?.openrouter?.reasoning_details
            const nextDetails =
                msg?.providerOptions?.openrouter?.reasoning_details
            const mergedDetails =
                Array.isArray(prevDetails) || Array.isArray(nextDetails)
                    ? [
                          ...(Array.isArray(prevDetails) ? prevDetails : []),
                          ...(Array.isArray(nextDetails) ? nextDetails : []),
                      ]
                    : undefined

            merged[merged.length - 1] = {
                ...prev,
                content: [...prev.content, ...msg.content],
                ...(mergedDetails?.length
                    ? {
                          providerOptions: {
                              ...(prev.providerOptions ?? {}),
                              openrouter: {
                                  ...(prev.providerOptions?.openrouter ?? {}),
                                  reasoning_details: mergedDetails,
                              },
                          },
                      }
                    : {}),
            }
            continue
        }
        merged.push(msg)
    }

    const hasToolCall = (m: any) =>
        m?.role === "assistant" &&
        Array.isArray(m?.content) &&
        m.content.some((p: any) => p?.type === "tool-call")

    const stripped: any[] = []
    for (let i = 0; i < merged.length; i++) {
        const msg = merged[i]
        if (!msg) continue

        if (msg.role === "tool") {
            const prev = stripped[stripped.length - 1]
            // 孤儿 tool: 前面没有 tool-call，跳过
            if (!hasToolCall(prev)) {
                console.warn(
                    "[Google/Gemini] Skipping orphan tool response (no preceding tool-call)",
                )
                continue
            }
            stripped.push(msg)
            continue
        }

        if (hasToolCall(msg)) {
            const next = merged[i + 1]
            // 孤儿 tool-call: 后面没有紧跟 tool 响应
            if (!next || next.role !== "tool") {
                console.warn(
                    "[Google/Gemini] Stripping tool-call from assistant message (no following tool response)",
                )
                const keptParts = Array.isArray(msg.content)
                    ? msg.content.filter((p: any) => p?.type !== "tool-call")
                    : msg.content
                if (Array.isArray(keptParts) && keptParts.length > 0) {
                    stripped.push({ ...msg, content: keptParts })
                } else if (!Array.isArray(keptParts) && keptParts) {
                    stripped.push({ ...msg, content: keptParts })
                }
                continue
            }
        }

        stripped.push(msg)
    }

    return stripped.filter(
        (m) =>
            m?.role !== "assistant" ||
            !Array.isArray(m.content) ||
            m.content.length > 0,
    )
}

function preserveOpenRouterReasoningDetails(messages: any[]): any[] {
    // OpenRouter 的 Gemini 模型要求在后续请求里“原样带回” reasoning_details，
    // 否则会在包含 tool/function 调用历史时返回 400（例如缺少 thought_signature）。
    //
    // OpenRouter adapter 会从 message.providerOptions.openrouter.reasoning_details 读取并回传；
    // 但流式响应里该字段可能落在 message.providerMetadata 或 content[i].providerMetadata。
    return messages.map((msg) => {
        if (!msg || msg.role !== "assistant") return msg

        // 1) 收集 message + parts 上的 reasoning_details（Gemini 的 thought_signature 可能落在 tool-call part）
        const msgReasoning =
            msg?.providerMetadata?.openrouter?.reasoning_details
        const partReasonings = Array.isArray(msg.content)
            ? msg.content
                  .map(
                      (part: any) =>
                          part?.providerMetadata?.openrouter?.reasoning_details,
                  )
                  .filter((r: any) => Array.isArray(r) && r.length > 0)
                  .flat()
            : []

        const collected = (
            Array.isArray(msgReasoning) ? msgReasoning : []
        ).concat(partReasonings)

        const existing =
            msg?.providerOptions?.openrouter?.reasoning_details ?? null

        const shouldSet =
            (!Array.isArray(existing) || existing.length === 0) &&
            collected.length > 0

        let updatedMsg = shouldSet
            ? {
                  ...msg,
                  providerOptions: {
                      ...(msg.providerOptions ?? {}),
                      openrouter: {
                          ...(msg.providerOptions?.openrouter ?? {}),
                          reasoning_details: collected,
                      },
                  },
              }
            : msg

        // 2. 处理 Content Part 级别的 reasoning_details (针对 tool-call)
        if (Array.isArray(updatedMsg.content)) {
            const updatedContent = updatedMsg.content.map((part: any) => {
                const partReasoning =
                    part?.providerMetadata?.openrouter?.reasoning_details
                if (Array.isArray(partReasoning) && partReasoning.length > 0) {
                    return {
                        ...part,
                        providerOptions: {
                            ...(part.providerOptions ?? {}),
                            openrouter: {
                                ...(part.providerOptions?.openrouter ?? {}),
                                reasoning_details: partReasoning,
                            },
                        },
                    }
                }
                return part
            })
            updatedMsg = { ...updatedMsg, content: updatedContent }
        }

        return updatedMsg
    })
}

function stripOpenRouterGeminiToolCallsMissingThoughtSignature(
    messages: any[],
): any[] {
    // OpenRouter 转发 Gemini 时，如果历史里包含 tool/function 调用，
    // 上游（Google）可能要求每个 functionCall 都带 thought_signature。
    // 中途切换模型时，历史 tool-call 常来自 Claude/OpenAI 等，不可能带该签名；
    // 这会导致 400（missing thought_signature）。
    //
    // 保守策略：仅剥离“缺少签名”的 tool-call part，随后由 sanitizeGoogleToolCallingHistory
    // 清理孤儿 tool 响应，避免整个请求被拒绝。

    const hasThoughtSignature = (details: any): boolean => {
        if (!Array.isArray(details) || details.length === 0) return false
        for (const entry of details) {
            if (!entry) continue
            if (typeof entry === "string") {
                if (
                    entry.includes("thought_signature") ||
                    entry.includes("thoughtSignature")
                ) {
                    return true
                }
                continue
            }
            if (typeof entry === "object") {
                if (
                    "thought_signature" in (entry as any) ||
                    "thoughtSignature" in (entry as any)
                ) {
                    return true
                }
            }
        }
        return false
    }

    const getDetails = (msg: any, part: any): any => {
        return (
            part?.providerOptions?.openrouter?.reasoning_details ??
            part?.providerMetadata?.openrouter?.reasoning_details ??
            msg?.providerOptions?.openrouter?.reasoning_details ??
            msg?.providerMetadata?.openrouter?.reasoning_details ??
            null
        )
    }

    let strippedCount = 0
    const next = messages.map((msg) => {
        if (!msg || msg.role !== "assistant" || !Array.isArray(msg.content)) {
            return msg
        }
        const filtered = msg.content.filter((part: any) => {
            const isToolCall =
                part?.type === "tool-call" || part?.type === "function-call"
            if (!isToolCall) return true

            const details = getDetails(msg, part)
            const ok = hasThoughtSignature(details)
            if (!ok) strippedCount++
            return ok
        })
        return filtered.length === msg.content.length
            ? msg
            : { ...msg, content: filtered }
    })

    if (strippedCount > 0) {
        console.warn(
            `[OpenRouter/Gemini] Stripped ${strippedCount} historical tool-call parts missing thought_signature to avoid 400`,
        )
    }

    return next
}

// Helper function to create cached stream response
function createCachedStreamResponse(xml: string): Response {
    const toolCallId = `cached-${Date.now()}`

    const stream = createUIMessageStream({
        execute: async ({ writer }) => {
            writer.write({ type: "start" })
            writer.write({
                type: "tool-input-start",
                toolCallId,
                toolName: "display_diagram",
            })
            writer.write({
                type: "tool-input-delta",
                toolCallId,
                inputTextDelta: xml,
            })
            writer.write({
                type: "tool-input-available",
                toolCallId,
                toolName: "display_diagram",
                input: { xml },
            })
            writer.write({ type: "finish" })
        },
    })

    return createUIMessageStreamResponse({ stream })
}

// Inner handler function
async function handleChatRequest(req: Request): Promise<Response> {
    // Check for access code
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

    const { messages, xml, previousXml, sessionId, conversationId, requestId } =
        await req.json()

    // Get user IP for Langfuse tracking
    const forwardedFor = req.headers.get("x-forwarded-for")
    const userIpForTracking = forwardedFor?.split(",")[0]?.trim() || "anonymous"

    // Validate sessionId for Langfuse (must be string, max 200 chars)
    const validSessionId =
        sessionId && typeof sessionId === "string" && sessionId.length <= 200
            ? sessionId
            : undefined

    const validConversationId =
        conversationId &&
        typeof conversationId === "string" &&
        conversationId.length <= 200
            ? conversationId
            : undefined

    const validRequestId =
        requestId && typeof requestId === "string" && requestId.length <= 200
            ? requestId
            : undefined

    // Extract user input text for Langfuse trace
    const currentMessage = messages[messages.length - 1]
    const userInputText =
        currentMessage?.parts?.find((p: any) => p.type === "text")?.text || ""

    // Update Langfuse trace with input, session, and user
    setTraceInput({
        input: userInputText,
        sessionId: validSessionId,
        userId: userIpForTracking,
    })

    // === FILE VALIDATION START ===
    const fileValidation = validateFileParts(messages)
    if (!fileValidation.valid) {
        return Response.json({ error: fileValidation.error }, { status: 400 })
    }
    // === FILE VALIDATION END ===

    // === CACHE CHECK START ===
    const isFirstMessage = messages.length === 1
    const isEmptyDiagram = !xml || xml.trim() === "" || isMinimalDiagram(xml)

    if (isFirstMessage && isEmptyDiagram) {
        const lastMessage = messages[0]
        const textPart = lastMessage.parts?.find((p: any) => p.type === "text")
        const filePart = lastMessage.parts?.find((p: any) => p.type === "file")

        const cached = findCachedResponse(textPart?.text || "", !!filePart)

        if (cached) {
            return createCachedStreamResponse(cached.xml)
        }
    }
    // === CACHE CHECK END ===

    // Read and sanitize client AI provider overrides from headers (BYOK)
    const clientOverrides = sanitizeClientOverrides(req.headers)

    // 获取用户 session（如果已登录）
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    // 获取用户云端配置（登录用户，从 ProviderConfig 读取）
    let userCloudConfig: {
        provider?: string
        apiKey?: string
        baseUrl?: string
        modelId?: string
    } = {}

    // 如果用户已登录且客户端没有传 API Key，尝试从云端获取配置
    if (userId && !clientOverrides.apiKey) {
        const requestedProvider =
            clientOverrides.provider ||
            req.headers.get("x-ai-provider-hint") ||
            null

        // 查询用户的 ProviderConfig
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

                console.log("[User Cloud Config] Loaded from database:", {
                    provider: userCloudConfig.provider,
                    hasApiKey: !!userCloudConfig.apiKey,
                    baseUrl: userCloudConfig.baseUrl
                        ? `${userCloudConfig.baseUrl.substring(0, 30)}...`
                        : null,
                    modelId: userCloudConfig.modelId,
                })
            } catch (error) {
                console.error(
                    "[User Cloud Config] Failed to decrypt credentials:",
                    error,
                )
            }
        }
    }

    // 配额限额检查：统一处理匿名和已认证用户，BYOK 用户绕过
    const hasBYOK = !!(clientOverrides.provider && clientOverrides.apiKey)
    const hasUserCloudConfig = !!userCloudConfig.apiKey
    const quotaContext = await enforceQuotaLimit({
        headers: req.headers,
        userId,
        bypassBYOK: hasBYOK || hasUserCloudConfig,
    })

    // 获取系统默认 AI 配置（数据库优先，fallback 到环境变量）
    const { getDefaultAIConfig } = await import("@/server/system-config")
    const defaultConfig = await getDefaultAIConfig()

    // 合并配置优先级：客户端 BYOK > 用户云端配置 > 系统默认配置
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

    // 确定配置来源
    const configSource = {
        provider: clientOverrides.provider
            ? "client"
            : userCloudConfig.provider
              ? "user-cloud"
              : "system",
        modelId: clientOverrides.modelId
            ? "client"
            : userCloudConfig.modelId
              ? "user-cloud"
              : "system",
        apiKey: clientOverrides.apiKey
            ? "client"
            : userCloudConfig.apiKey
              ? "user-cloud"
              : "system",
        baseUrl: clientOverrides.baseUrl
            ? "client"
            : userCloudConfig.baseUrl
              ? "user-cloud"
              : "system",
    }

    console.log("[Final Config] Using configuration:", {
        provider: finalOverrides.provider,
        modelId: finalOverrides.modelId,
        apiKey: finalOverrides.apiKey
            ? `${finalOverrides.apiKey.substring(0, 10)}...`
            : null,
        baseUrl: finalOverrides.baseUrl
            ? `${finalOverrides.baseUrl.substring(0, 30)}...`
            : null,
        source: configSource,
    })

    // Get AI model with merged configuration
    const { model, providerOptions, headers, modelId } =
        getAIModel(finalOverrides)

    // Check if model supports prompt caching
    const shouldCache = supportsPromptCaching(modelId)
    console.log(
        `[Prompt Caching] ${shouldCache ? "ENABLED" : "DISABLED"} for model: ${modelId}`,
    )

    // Get the appropriate system prompt based on model (extended for Opus/Haiku 4.5)
    const baseSystemMessage = getSystemPrompt(modelId)
    const enableAnalyzeTool = process.env.ENABLE_ANALYZE_TOOL !== "false"
    const systemMessage = enableAnalyzeTool
        ? `${baseSystemMessage}

When the current diagram XML is non-empty and the user requests incremental changes, call analyze_diagram first to summarize nodes/edges/containers, then use edit_diagram for precise edits.`
        : baseSystemMessage

    const lastMessage = messages[messages.length - 1]

    // Extract text from the last message parts
    const lastMessageText =
        lastMessage.parts?.find((part: any) => part.type === "text")?.text || ""

    // User input only - XML is now in a separate cached system message
    const formattedUserInput = `User input:
"""md
${lastMessageText}
"""`

    // Expand file references (fileId -> full content for last message)
    // This allows us to store only fileId in localStorage/database
    const expandedMessages = await expandFileReferences(messages)

    // Modify the last message's text BEFORE converting to ModelMessages
    // This ensures convertToModelMessages handles the file parts correctly
    if (expandedMessages.length > 0) {
        const lastExpandedMessage =
            expandedMessages[expandedMessages.length - 1]
        if (lastExpandedMessage.role === "user" && lastExpandedMessage.parts) {
            // Update the text part with formatted input
            const updatedParts = lastExpandedMessage.parts.map((part: any) => {
                if (part.type === "text") {
                    return { ...part, text: formattedUserInput }
                }
                return part
            })

            expandedMessages[expandedMessages.length - 1] = {
                ...lastExpandedMessage,
                parts: updatedParts,
            }
        }
    }

    // Convert UIMessages to ModelMessages
    // This will automatically handle file parts and convert them to image content
    const modelMessages = convertToModelMessages(expandedMessages as any)

    // Google（Gemini）工具调用的 thought signature 透传：
    // - API 返回的签名通常落在 part.providerMetadata.google.thoughtSignature
    // - @ai-sdk/google 在构造 functionCall parts 时读取 part.providerOptions.google.thoughtSignature
    //   因此这里做一次“元数据 → providerOptions”的兼容映射，避免历史消息回放时缺少签名而报错。
    const isGoogleProvider =
        clientOverrides.provider === "google" ||
        process.env.AI_PROVIDER === "google"
    if (isGoogleProvider) {
        for (const msg of modelMessages as any[]) {
            if (!Array.isArray(msg?.content)) continue
            for (const part of msg.content as any[]) {
                const thoughtSignature =
                    part?.providerMetadata?.google?.thoughtSignature
                if (!thoughtSignature) continue
                part.providerOptions = {
                    ...(part.providerOptions ?? {}),
                    google: {
                        ...(part.providerOptions?.google ?? {}),
                        thoughtSignature: String(thoughtSignature),
                    },
                }
            }
        }
    }

    // Fix tool call inputs for Bedrock API (requires JSON objects, not strings)
    const fixedMessages = fixToolCallInputs(modelMessages)

    // Replace historical tool call XML with placeholders to reduce tokens.
    // Some models copy placeholders; use a conservative whitelist unless forced by env.
    const historyReplaceEnv = process.env.ENABLE_HISTORY_XML_REPLACE
    const enableHistoryReplace =
        historyReplaceEnv === "true"
            ? true
            : historyReplaceEnv === "false"
              ? false
              : supportsHistoryXmlReplace(modelId)

    const placeholderMessages = enableHistoryReplace
        ? replaceHistoricalToolInputs(fixedMessages)
        : fixedMessages

    // Filter out messages with empty content arrays (Bedrock API rejects these)
    // This is a safety measure - ideally convertToModelMessages should handle all cases
    const enhancedMessages = placeholderMessages.filter(
        (msg: any) =>
            msg.content && Array.isArray(msg.content) && msg.content.length > 0,
    )

    // Add cache point to the last assistant message in conversation history
    // This caches the entire conversation prefix for subsequent requests
    // Strategy: system (cached) + history with last assistant (cached) + new user message
    if (shouldCache && enhancedMessages.length >= 2) {
        // Find the last assistant message (should be second-to-last, before current user message)
        for (let i = enhancedMessages.length - 2; i >= 0; i--) {
            if (enhancedMessages[i].role === "assistant") {
                enhancedMessages[i] = {
                    ...enhancedMessages[i],
                    providerOptions: {
                        bedrock: { cachePoint: { type: "default" } },
                    },
                }
                break // Only cache the last assistant message
            }
        }
    }

    // System messages with multiple cache breakpoints for optimal caching:
    // - Breakpoint 1: Static instructions (~1500 tokens) - rarely changes
    // - Breakpoint 2: Current XML context - changes per diagram, but constant within a conversation turn
    // This allows: if only user message changes, both system caches are reused
    //              if XML changes, instruction cache is still reused
    const enableXmlSummary = process.env.ENABLE_XML_SUMMARY !== "false"
    const diagramSummary = !enableXmlSummary
        ? null
        : buildDiagramSummary(xml || "")

    const systemMessages = [
        // Cache breakpoint 1: Instructions (rarely change)
        {
            role: "system" as const,
            content: systemMessage,
            ...(shouldCache && {
                providerOptions: {
                    bedrock: { cachePoint: { type: "default" } },
                },
            }),
        },
        ...(diagramSummary
            ? [
                  {
                      role: "system" as const,
                      content:
                          "Current diagram summary (non-authoritative, for quick reference):\n" +
                          diagramSummary +
                          "\n\nThe full Current diagram XML below is still the SINGLE SOURCE OF TRUTH.",
                      ...(shouldCache && {
                          providerOptions: {
                              bedrock: { cachePoint: { type: "default" } },
                          },
                      }),
                  },
              ]
            : []),
        // Cache breakpoint 2: Current diagram XML context with optional diff summary
        {
            role: "system" as const,
            content: `${previousXml && xml ? `${generateXmlDiff(previousXml, xml)}\n\n` : ""}Current diagram XML (AUTHORITATIVE - the source of truth):\n"""xml\n${xml || ""}\n"""\n\nIMPORTANT: The "Current diagram XML" is the SINGLE SOURCE OF TRUTH for what's on the canvas right now. The user can manually add, delete, or modify shapes directly in draw.io. Always count and describe elements based on the CURRENT XML, not on what you previously generated. When using edit_diagram, COPY search patterns exactly from the CURRENT XML - attribute order matters!`,
            ...(shouldCache && {
                providerOptions: {
                    bedrock: { cachePoint: { type: "default" } },
                },
            }),
        },
    ]

    const maxNonSystemMessages = Number(
        process.env.MAX_NON_SYSTEM_MESSAGES || 12,
    )
    const windowedMessages = applyMessageWindow(
        [...systemMessages, ...enhancedMessages],
        {
            maxNonSystemMessages: Number.isFinite(maxNonSystemMessages)
                ? maxNonSystemMessages
                : 12,
        },
    )

    const providerForSanitize =
        clientOverrides.provider || process.env.AI_PROVIDER || null
    const isGeminiModel = modelId.toLowerCase().includes("gemini")
    const isOpenRouterGemini =
        providerForSanitize === "openrouter" && isGeminiModel

    const preservedMessages = (() => {
        if (isOpenRouterGemini) {
            const withDetails =
                preserveOpenRouterReasoningDetails(windowedMessages)
            return stripOpenRouterGeminiToolCallsMissingThoughtSignature(
                withDetails,
            )
        }
        return windowedMessages
    })()

    const finalMessages =
        providerForSanitize === "google" || isGeminiModel
            ? sanitizeGoogleToolCallingHistory(preservedMessages)
            : preservedMessages

    // Record safe trace metadata for observability
    setTraceMetadata({
        modelId,
        provider: clientOverrides.provider || process.env.AI_PROVIDER || null,
        promptCaching: shouldCache,
        historyXmlReplace: enableHistoryReplace,
        xmlSummary: enableXmlSummary,
        analyzeTool: enableAnalyzeTool,
        maxNonSystemMessages,
        hasClientOverride: !!(
            clientOverrides.provider && clientOverrides.apiKey
        ),
        conversationId: validConversationId,
        requestId: validRequestId,
    })

    const result = streamText({
        model,
        stopWhen: stepCountIs(5),
        messages: finalMessages,
        ...(providerOptions && {
            providerOptions,
        }), // This now includes all reasoning configs
        ...(headers && { headers }),
        // Langfuse telemetry config (returns undefined if not configured)
        ...(getTelemetryConfig({ sessionId: validSessionId, userId }) && {
            experimental_telemetry: getTelemetryConfig({
                sessionId: validSessionId,
                userId,
            }),
        }),
        // Repair malformed tool calls (model sometimes generates invalid JSON with unescaped quotes)
        experimental_repairToolCall: async ({ toolCall }) => {
            // The toolCall.input contains the raw JSON string that failed to parse
            const rawJson =
                typeof toolCall.input === "string" ? toolCall.input : null

            if (rawJson) {
                try {
                    // Fix unescaped quotes: x="520" should be x=\"520\"
                    const fixed = rawJson.replace(
                        /([a-zA-Z])="(\d+)"/g,
                        '$1=\\"$2\\"',
                    )
                    const parsed = JSON.parse(fixed)
                    return {
                        type: "tool-call" as const,
                        toolCallId: toolCall.toolCallId,
                        toolName: toolCall.toolName,
                        input: JSON.stringify(parsed),
                    }
                } catch {
                    // Repair failed, return null
                }
            }
            return null
        },
        onFinish: ({ text, usage }) => {
            // Pass usage to Langfuse (Bedrock streaming doesn't auto-report tokens to telemetry)
            setTraceOutput(text, {
                promptTokens: usage?.inputTokens,
                completionTokens: usage?.outputTokens,
            })

            const totalTokens =
                (usage?.inputTokens || 0) + (usage?.outputTokens || 0)
            if (totalTokens > 0) {
                void recordTokenUsage({
                    context: quotaContext,
                    tokens: totalTokens,
                })
            }
        },
        tools: {
            // Client-side tool that will be executed on the client
            display_diagram: {
                description: DISPLAY_DIAGRAM_DESCRIPTION,
                inputSchema: z.object({
                    xml: z
                        .string()
                        .describe("XML string to be displayed on draw.io"),
                }),
            },
            edit_diagram: {
                description: EDIT_DIAGRAM_DESCRIPTION,
                inputSchema: z.object({
                    ops: z
                        .array(
                            z.discriminatedUnion("type", [
                                z.object({
                                    type: z.literal("setEdgePoints"),
                                    id: z.string().min(1),
                                    sourcePoint: z
                                        .object({
                                            x: z.number(),
                                            y: z.number(),
                                        })
                                        .optional(),
                                    targetPoint: z
                                        .object({
                                            x: z.number(),
                                            y: z.number(),
                                        })
                                        .optional(),
                                }),
                                z.object({
                                    type: z.literal("setCellValue"),
                                    id: z.string().min(1),
                                    value: z.string(),
                                    escape: z.boolean().optional(),
                                }),
                                z.object({
                                    type: z.literal("updateCell"),
                                    id: z.string().min(1),
                                    value: z.string().optional(),
                                    style: z.string().optional(),
                                    geometry: z
                                        .object({
                                            x: z.number().optional(),
                                            y: z.number().optional(),
                                            width: z.number().optional(),
                                            height: z.number().optional(),
                                        })
                                        .optional(),
                                }),
                                z.object({
                                    type: z.literal("addCell"),
                                    id: z.string().min(1),
                                    parent: z.string().min(1),
                                    value: z.string().optional(),
                                    style: z.string().optional(),
                                    vertex: z.boolean().optional(),
                                    edge: z.boolean().optional(),
                                    source: z.string().optional(),
                                    target: z.string().optional(),
                                    geometry: z
                                        .object({
                                            x: z.number().optional(),
                                            y: z.number().optional(),
                                            width: z.number().optional(),
                                            height: z.number().optional(),
                                        })
                                        .optional(),
                                }),
                                z.object({
                                    type: z.literal("deleteCell"),
                                    id: z.string().min(1),
                                }),
                            ]),
                        )
                        .describe("Array of structured edit operations"),
                }),
            },
            analyze_diagram: {
                description: ANALYZE_DIAGRAM_DESCRIPTION,
                inputSchema: z.object({
                    xml: z.string().describe("Current diagram XML to analyze"),
                }),
                execute: async ({ xml }) => {
                    return analyzeDiagramXml(xml)
                },
            },
        },
        ...(process.env.TEMPERATURE !== undefined && {
            temperature: parseFloat(process.env.TEMPERATURE),
        }),
    })

    return result.toUIMessageStreamResponse({
        // 部分 Gemini 模型会输出大量 reasoning；同时 OpenRouter/Gemini 的 reasoning 还涉及
        // thought_signature 透传（用于 tool-call）。即便上游强制 reasoning，这里也可以选择
        // 不把 reasoning 发给前端，从 UI 体验上“默认不显示 thinking”。
        sendReasoning: !isOpenRouterGemini,
        messageMetadata: ({ part }) => {
            if (part.type === "finish") {
                const usage = (part as any).totalUsage
                if (!usage) {
                    console.warn(
                        "[messageMetadata] No usage data in finish part",
                    )
                    return undefined
                }
                // Total input = non-cached + cached (these are separate counts)
                // Note: cacheWriteInputTokens is not available on finish part
                const totalInputTokens =
                    (usage.inputTokens ?? 0) + (usage.cachedInputTokens ?? 0)
                return {
                    inputTokens: totalInputTokens,
                    outputTokens: usage.outputTokens ?? 0,
                    ...(validConversationId && {
                        conversationId: validConversationId,
                    }),
                    ...(validRequestId && { requestId: validRequestId }),
                }
            }
            return undefined
        },
    })
}

// Helper to categorize errors and return appropriate response
function handleError(error: unknown): Response {
    console.error("Error in chat route:", error)

    const isDev = process.env.NODE_ENV === "development"

    if (error instanceof QuotaExceededError) {
        return Response.json({ error: error.message }, { status: 429 })
    }

    // Check for specific AI SDK error types
    if (APICallError.isInstance(error)) {
        return Response.json(
            {
                error: error.message,
                ...(isDev && {
                    details: error.responseBody,
                    stack: error.stack,
                }),
            },
            { status: error.statusCode || 500 },
        )
    }

    if (LoadAPIKeyError.isInstance(error)) {
        return Response.json(
            {
                error: "Authentication failed. Please check your API key.",
                ...(isDev && {
                    stack: error.stack,
                }),
            },
            { status: 401 },
        )
    }

    // Fallback for other errors with safety filter
    const message =
        error instanceof Error ? error.message : "An unexpected error occurred"
    const status = (error as any)?.statusCode || (error as any)?.status || 500

    // Prevent leaking API keys, tokens, or other sensitive data
    const lowerMessage = message.toLowerCase()
    const safeMessage =
        lowerMessage.includes("key") ||
        lowerMessage.includes("token") ||
        lowerMessage.includes("sig") ||
        lowerMessage.includes("signature") ||
        lowerMessage.includes("secret") ||
        lowerMessage.includes("password") ||
        lowerMessage.includes("credential")
            ? "Authentication failed. Please check your credentials."
            : message

    return Response.json(
        {
            error: safeMessage,
            ...(isDev && {
                details: message,
                stack: error instanceof Error ? error.stack : undefined,
            }),
        },
        { status },
    )
}

// Wrap handler with error handling
async function safeHandler(req: Request): Promise<Response> {
    try {
        return await handleChatRequest(req)
    } catch (error) {
        return handleError(error)
    }
}

// Wrap with Langfuse observe (if configured)
const observedHandler = wrapWithObserve(safeHandler)

export async function POST(req: Request) {
    return observedHandler(req)
}
