/**
 * 服务端 AI 配置解析器
 * 单一数据源，根据用户模式决定使用哪个配置
 */
import { db } from "@/server/db"
import { decryptCredentials } from "@/server/encryption"
import { getDefaultAIConfig } from "@/server/system-config"

export interface ResolvedAIConfig {
    source: "system" | "byok" | "anonymous_byok"
    provider: string
    apiKey: string
    baseUrl?: string
    modelId?: string
    bypassQuota: boolean
}

/**
 * 服务端单一配置解析入口
 *
 * 优先级:
 * 1. 匿名用户 + BYOK headers -> 使用 headers，绕过配额
 * 2. 登录用户 aiMode="byok" -> 使用云端 ProviderConfig，绕过配额
 * 3. 登录用户 aiMode="system_default" -> 使用系统配置，受配额限制
 * 4. 匿名用户无 BYOK -> 使用系统配置，受配额限制
 */
export async function resolveAIConfig(params: {
    userId?: string
    headers: Headers
}): Promise<ResolvedAIConfig> {
    const { userId, headers } = params

    // 检查匿名 BYOK (headers 包含 API key)
    const headerApiKey = headers.get("x-ai-api-key")
    const headerProvider = headers.get("x-ai-provider")

    if (!userId && headerApiKey && headerProvider) {
        // 匿名 BYOK: 直接使用 headers
        return {
            source: "anonymous_byok",
            provider: headerProvider,
            apiKey: headerApiKey,
            baseUrl: headers.get("x-ai-base-url") || undefined,
            modelId: headers.get("x-ai-model") || undefined,
            bypassQuota: true,
        }
    }

    // 登录用户: 检查 aiMode
    if (userId) {
        const user = await db.user.findUnique({
            where: { id: userId },
            select: { aiMode: true },
        })

        if (user?.aiMode === "byok") {
            // 加载默认 ProviderConfig
            const config = await db.providerConfig.findFirst({
                where: { userId, isDefault: true, isDisabled: false },
            })

            if (config?.encryptedCredentials) {
                try {
                    const decrypted = decryptCredentials({
                        encryptedData: config.encryptedCredentials,
                        iv: config.credentialsIv!,
                        authTag: config.credentialsAuthTag!,
                        keyVersion: config.credentialsVersion,
                    })
                    const credentials = JSON.parse(decrypted)

                    return {
                        source: "byok",
                        provider: config.provider,
                        apiKey: credentials.apiKey,
                        baseUrl: config.baseUrl || undefined,
                        modelId: config.modelId || undefined,
                        bypassQuota: true,
                    }
                } catch (error) {
                    console.error(
                        "[resolveAIConfig] Failed to decrypt credentials:",
                        error,
                    )
                    // 解密失败，回退到系统默认
                }
            }
        }
    }

    // 系统默认配置
    const defaultConfig = await getDefaultAIConfig()
    return {
        source: "system",
        provider: defaultConfig.provider,
        apiKey: defaultConfig.apiKey,
        baseUrl: defaultConfig.baseUrl || undefined,
        modelId: defaultConfig.model,
        bypassQuota: false,
    }
}
