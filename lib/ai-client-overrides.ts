import type { ClientOverrides } from "@/lib/ai-providers"

/**
 * 清洗客户端传入的 AI Provider 覆写信息，限制协议、域名等。
 * - 仅在开发环境或显式开启时允许 BYOK 覆写
 * - 校验 Base URL 协议/内网风险并应用可选白名单
 */
export function sanitizeClientOverrides(
    headers: Headers,
): ClientOverrides & Record<string, string | null> {
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

    // KISS：没有 API Key 时不接受任何覆写，避免“强行切 provider 但走服务端默认密钥”的混淆与风险。
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
