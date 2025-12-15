/**
 * 服务端系统配置管理
 * 从数据库读取配置，fallback 到环境变量
 */
import { db } from "@/server/db"
import { withDbRetry } from "@/server/db-retry"

// 缓存配置，避免每次都查数据库
const configCache = new Map<string, { value: any; expiry: number }>()
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
 * 获取 AI 默认配置
 * 优先级：数据库 > 环境变量
 */
export async function getDefaultAIConfig(): Promise<{
    provider: string
    model: string
    apiKey: string
    fallbackModels: string[]
}> {
    const [dbProvider, dbModel, dbApiKey, dbFallbackModels] = await Promise.all(
        [
            getSystemConfig("ai.default.provider"),
            getSystemConfig("ai.default.model"),
            getSystemConfig("ai.openrouter.apiKey"),
            getSystemConfig("ai.fallback.models"),
        ],
    )

    return {
        provider:
            (dbProvider as string) || process.env.AI_PROVIDER || "openrouter",
        model:
            (dbModel as string) ||
            process.env.AI_MODEL ||
            "qwen/qwen-2.5-coder-32b-instruct",
        apiKey:
            (dbApiKey as string) ||
            process.env.OPENROUTER_API_KEY ||
            process.env.OPENAI_API_KEY ||
            process.env.ANTHROPIC_API_KEY ||
            "",
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
