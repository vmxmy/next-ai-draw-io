export type ChatErrorInfo = {
    message: string
    originalMessage: string
    kind:
        | "aborted"
        | "network"
        | "auth"
        | "rateLimit"
        | "quota"
        | "modelNotFound"
        | "contextTooLong"
        | "requestTooLarge"
        | "providerPolicy"
        | "imageNotSupported"
        | "upstream"
        | "unknown"
}

function extractMessage(raw: string): string {
    const trimmed = String(raw || "").trim()
    if (!trimmed) return ""

    // 某些实现会把 JSON 直接塞进 message 里（例如 { error: { message } }）
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
            const parsed = JSON.parse(trimmed) as any
            const msg =
                parsed?.error?.message ||
                parsed?.error ||
                parsed?.message ||
                parsed?.raw?.message
            if (typeof msg === "string" && msg.trim()) return msg.trim()
        } catch {
            // ignore
        }
    }

    // 去掉常见前缀，提升匹配命中率
    return trimmed
        .replace(/^Error\s*\[[^\]]+\]\s*:\s*/i, "")
        .replace(/^AI_APICallError\s*:\s*/i, "")
        .trim()
}

export function classifyChatError(
    error: unknown,
    t: (key: any) => string,
): ChatErrorInfo {
    const originalMessage =
        error instanceof Error ? error.message : String(error ?? "")
    const message = extractMessage(originalMessage)
    const lower = message.toLowerCase()

    // 用户主动切换会话/停止请求导致的中断：不应提示为错误
    if (
        (error instanceof Error && error.name === "AbortError") ||
        lower.includes("aborterror") ||
        lower.includes("aborted")
    ) {
        return { message: "", originalMessage, kind: "aborted" }
    }

    // 网络层
    if (
        message === "Failed to fetch" ||
        lower.includes("networkerror") ||
        lower.includes("econnreset") ||
        lower.includes("enotfound") ||
        lower.includes("ecanceled") ||
        lower.includes("timeout") ||
        lower.includes("timed out")
    ) {
        return {
            message: t("toast.networkError"),
            originalMessage,
            kind: "network",
        }
    }

    // 鉴权/权限
    if (
        lower.includes("invalid api key") ||
        lower.includes("incorrect api key") ||
        lower.includes("authentication failed") ||
        lower.includes("unauthorized") ||
        lower.includes("forbidden")
    ) {
        return { message: t("toast.authFailed"), originalMessage, kind: "auth" }
    }

    // OpenRouter/Provider 策略：免费模型或隐私策略、合规策略等
    if (
        lower.includes("no endpoints found matching your data policy") ||
        lower.includes("data policy")
    ) {
        return {
            message: t("toast.providerPolicy"),
            originalMessage,
            kind: "providerPolicy",
        }
    }

    // 图片输入能力
    if (
        lower.includes("no endpoints found that support image input") ||
        lower.includes("support image input") ||
        lower.includes("image content block") ||
        lower.includes("doesn't support image")
    ) {
        return {
            message: t("toast.imageNotSupported"),
            originalMessage,
            kind: "imageNotSupported",
        }
    }

    // 限流
    if (
        lower.includes("rate limit") ||
        lower.includes("too many requests") ||
        lower.includes("429")
    ) {
        return {
            message: t("toast.rateLimited"),
            originalMessage,
            kind: "rateLimit",
        }
    }

    // 额度/余额
    if (
        lower.includes("insufficient_quota") ||
        lower.includes("insufficient quota") ||
        lower.includes("quota exceeded") ||
        lower.includes("exceeded your current quota") ||
        lower.includes("payment required") ||
        lower.includes("credits") ||
        lower.includes("balance")
    ) {
        return {
            message: t("toast.quotaExceeded"),
            originalMessage,
            kind: "quota",
        }
    }

    // 模型不存在/无权限
    if (
        lower.includes("model not found") ||
        lower.includes("no such model") ||
        lower.includes("model_not_found")
    ) {
        return {
            message: t("toast.modelNotFound"),
            originalMessage,
            kind: "modelNotFound",
        }
    }

    // 上下文太长
    if (
        lower.includes("context length") ||
        lower.includes("context_length_exceeded") ||
        lower.includes("maximum context length") ||
        lower.includes("prompt is too long")
    ) {
        return {
            message: t("toast.contextTooLong"),
            originalMessage,
            kind: "contextTooLong",
        }
    }

    // 请求过大（文件/输入过大）
    if (
        lower.includes("request too large") ||
        lower.includes("payload too large") ||
        lower.includes("entity too large") ||
        lower.includes("413")
    ) {
        return {
            message: t("toast.requestTooLarge"),
            originalMessage,
            kind: "requestTooLarge",
        }
    }

    // 上游错误（OpenRouter provider_name、5xx 等）
    if (
        lower.includes("upstream error") ||
        lower.includes("provider_name") ||
        lower.includes("502") ||
        lower.includes("503") ||
        lower.includes("504")
    ) {
        return {
            message: t("toast.upstreamError"),
            originalMessage,
            kind: "upstream",
        }
    }

    // 默认：直接展示服务端返回的 message（通常已经足够具体）
    return {
        message: message || t("toast.unknownError"),
        originalMessage,
        kind: "unknown",
    }
}
