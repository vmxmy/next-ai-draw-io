/**
 * 服务端系统配置管理
 * 从数据库读取配置，fallback 到环境变量
 */
import { db } from "@/server/db"
import { withDbRetry } from "@/server/db-retry"
import { decryptCredentials } from "@/server/encryption"

// 缓存配置，避免每次都查数据库
const configCache = new Map<string, { value: any; expiry: number }>()
const credentialCache = new Map<string, { value: any; expiry: number }>()
const CACHE_TTL = 60_000 // 1 分钟缓存

/**
 * 从数据库获取系统配置（带缓存）
 */
async function getSystemConfig(key: string): Promise<any | null> {
    // 检查缓存
    const cached = configCache.get(key)
    if (cached && Date.now() < cached.expiry) {
        return cached.value
    }

    // 从数据库查询
    try {
        const config = await withDbRetry(() =>
            db.systemConfig.findUnique({
                where: { key },
            }),
        )

        if (config) {
            // 更新缓存
            configCache.set(key, {
                value: config.value,
                expiry: Date.now() + CACHE_TTL,
            })
            return config.value
        }
    } catch (error) {
        console.warn(`[SystemConfig] Failed to fetch ${key}:`, error)
    }

    return null
}

/**
 * 从 SystemCredential 表获取凭证（带缓存）
 */
export async function getSystemCredential(
    provider: string,
    credentialName?: string,
): Promise<{ apiKey: string; baseUrl?: string } | null> {
    const cacheKey = `${provider}:${credentialName || "default"}`

    // 检查缓存
    const cached = credentialCache.get(cacheKey)
    if (cached && Date.now() < cached.expiry) {
        return cached.value
    }

    try {
        // 如果指定了凭证名称，查找指定凭证
        // 否则查找该 provider 的默认凭证
        let credential = credentialName
            ? await withDbRetry(() =>
                  db.systemCredential.findUnique({
                      where: {
                          provider_name: { provider, name: credentialName },
                      },
                  }),
              )
            : await withDbRetry(() =>
                  db.systemCredential.findFirst({
                      where: {
                          provider,
                          isDefault: true,
                          isDisabled: false,
                      },
                  }),
              )

        // 如果没有默认凭证，尝试获取任意一个可用的
        if (!credential && !credentialName) {
            credential = await withDbRetry(() =>
                db.systemCredential.findFirst({
                    where: {
                        provider,
                        isDisabled: false,
                    },
                    orderBy: { createdAt: "asc" },
                }),
            )
        }

        if (!credential || !credential.encryptedCredentials) {
            return null
        }

        // 解密凭证
        const decrypted = decryptCredentials({
            encryptedData: credential.encryptedCredentials,
            iv: credential.credentialsIv!,
            authTag: credential.credentialsAuthTag!,
            keyVersion: credential.credentialsVersion,
        })

        const parsed = JSON.parse(decrypted)
        const result = {
            apiKey: parsed.apiKey || "",
            baseUrl: credential.baseUrl || undefined,
        }

        // 更新缓存
        credentialCache.set(cacheKey, {
            value: result,
            expiry: Date.now() + CACHE_TTL,
        })

        return result
    } catch (error) {
        console.warn(
            `[SystemConfig] Failed to fetch credential for ${provider}:`,
            error,
        )
        return null
    }
}

export type ModelMode = "fast" | "max"

/**
 * 获取 AI 默认配置
 * 优先级：SystemCredential > SystemConfig (旧) > 环境变量
 * @param modelMode - 模型模式：fast（快速）或 max（深度思考）
 */
export async function getDefaultAIConfig(
    modelMode: ModelMode = "fast",
): Promise<{
    provider: string
    model: string
    apiKey: string
    baseUrl: string
    credentialName?: string
    fallbackModels: string[]
}> {
    // 获取模式对应的配置
    const [
        dbProvider,
        dbMaxProvider,
        dbModel,
        dbMaxModel,
        dbCredential,
        dbMaxCredential,
        dbFallbackModels,
    ] = await Promise.all([
        getSystemConfig("ai.default.provider"),
        getSystemConfig("ai.max.provider"),
        getSystemConfig("ai.default.model"),
        getSystemConfig("ai.max.model"),
        getSystemConfig("ai.default.credential"),
        getSystemConfig("ai.max.credential"),
        getSystemConfig("ai.fallback.models"),
    ])

    // 根据模式选择 provider、model 和 credential
    // max 模式：优先使用 ai.max.* 配置，fallback 到 ai.default.*
    const selectedProvider =
        modelMode === "max"
            ? (dbMaxProvider as string) || (dbProvider as string)
            : (dbProvider as string)
    const selectedModel =
        modelMode === "max"
            ? (dbMaxModel as string) || (dbModel as string)
            : (dbModel as string)
    const selectedCredential =
        modelMode === "max"
            ? (dbMaxCredential as string) || (dbCredential as string)
            : (dbCredential as string)

    // 确定最终的 provider
    const provider = selectedProvider || process.env.AI_PROVIDER || "openrouter"

    // 从 SystemCredential 表获取凭证
    const credential = await getSystemCredential(provider, selectedCredential)

    let finalApiKey = credential?.apiKey || ""
    let finalBaseUrl = credential?.baseUrl || ""

    // 如果新表没有凭证，回退到旧的 SystemConfig 方式（兼容性）
    if (!finalApiKey) {
        const [dbApiKey, dbBaseUrl] = await Promise.all([
            getSystemConfig(`ai.${provider}.apiKey`),
            getSystemConfig(`ai.${provider}.baseUrl`),
        ])

        if (dbApiKey) {
            finalApiKey = dbApiKey as string
        }
        if (dbBaseUrl && !finalBaseUrl) {
            finalBaseUrl = dbBaseUrl as string
        }
    }

    // 获取环境变量中的 API Key（作为最终 fallback）
    if (!finalApiKey) {
        const envApiKey =
            provider === "openrouter"
                ? process.env.OPENROUTER_API_KEY
                : provider === "openai" || provider === "openai_compatible"
                  ? process.env.OPENAI_API_KEY
                  : provider === "anthropic"
                    ? process.env.ANTHROPIC_API_KEY
                    : provider === "google"
                      ? process.env.GOOGLE_API_KEY
                      : provider === "deepseek"
                        ? process.env.DEEPSEEK_API_KEY
                        : ""
        finalApiKey = envApiKey || ""
    }

    const defaultModel =
        modelMode === "max"
            ? "anthropic/claude-sonnet-4" // max 模式默认使用更强的模型
            : "qwen/qwen-2.5-coder-32b-instruct" // fast 模式默认

    return {
        provider,
        model: selectedModel || process.env.AI_MODEL || defaultModel,
        apiKey: finalApiKey,
        baseUrl: finalBaseUrl,
        credentialName: selectedCredential || undefined,
        fallbackModels: (dbFallbackModels as string[]) || [],
    }
}

/**
 * 清除配置缓存（管理员更新配置后调用）
 */
export function clearConfigCache(key?: string) {
    if (key) {
        configCache.delete(key)
    } else {
        configCache.clear()
    }
}

/**
 * 清除凭证缓存（管理员更新凭证后调用）
 */
export function clearCredentialCache(provider?: string, name?: string) {
    if (provider) {
        const cacheKey = `${provider}:${name || "default"}`
        credentialCache.delete(cacheKey)
    } else {
        credentialCache.clear()
    }
}

/**
 * 更新系统配置
 */
export async function updateSystemConfig(
    key: string,
    value: any,
    description?: string,
) {
    await withDbRetry(() =>
        db.systemConfig.update({
            where: { key },
            data: { value, description },
        }),
    )

    // 清除缓存
    clearConfigCache(key)
}
