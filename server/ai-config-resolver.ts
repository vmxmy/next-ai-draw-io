/**
 * 服务端 AI 配置解析器
 * 单一数据源，根据用户模式决定使用哪个配置
 */
import { db } from "@/server/db"
import { decryptCredentials } from "@/server/encryption"
import { getDefaultAIConfig, type ModelMode } from "@/server/system-config"

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

    // 获取模型模式（fast 或 max）
    const modelMode = (headers.get("x-model-mode") as ModelMode) || "fast"

    // 检查匿名 BYOK (headers 包含 API key)
    const headerApiKey = headers.get("x-ai-api-key")
    const headerProvider = headers.get("x-ai-provider")

    if (!userId && headerApiKey && headerProvider) {
        // 匿名 BYOK: 直接使用 headers
        const config = {
            source: "anonymous_byok" as const,
            provider: headerProvider,
            apiKey: headerApiKey,
            baseUrl: headers.get("x-ai-base-url") || undefined,
            modelId: headers.get("x-ai-model") || undefined,
            bypassQuota: true,
        }
        console.log("[resolveAIConfig] Anonymous BYOK:", {
            provider: config.provider,
            modelId: config.modelId,
            hasApiKey: !!config.apiKey,
        })
        return config
    }

    // 登录用户: 检查 aiMode 和对应模式的配置
    if (userId) {
        const user = await db.user.findUnique({
            where: { id: userId },
            select: {
                aiMode: true,
                providerConfigs: {
                    where: {
                        modelMode: modelMode,
                        isDisabled: false,
                    },
                    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
                    take: 1,
                    select: {
                        id: true,
                        provider: true,
                        modelId: true,
                        baseUrl: true,
                        modelMode: true,
                        encryptedCredentials: true,
                        credentialsIv: true,
                        credentialsAuthTag: true,
                        credentialsVersion: true,
                    },
                },
            },
        })

        const modeConfig = user?.providerConfigs?.[0]

        console.log("[resolveAIConfig] User lookup:", {
            userId,
            aiMode: user?.aiMode,
            modelMode,
            hasConfigForMode: !!modeConfig,
            configProvider: modeConfig?.provider,
        })

        if (user?.aiMode === "byok" && modeConfig) {
            // 检查配置是否有效
            if (modeConfig.encryptedCredentials) {
                try {
                    const decrypted = decryptCredentials({
                        encryptedData: modeConfig.encryptedCredentials,
                        iv: modeConfig.credentialsIv!,
                        authTag: modeConfig.credentialsAuthTag!,
                        keyVersion: modeConfig.credentialsVersion,
                    })
                    const credentials = JSON.parse(decrypted)

                    const resolvedConfig = {
                        source: "byok" as const,
                        provider: modeConfig.provider,
                        apiKey: credentials.apiKey,
                        baseUrl: modeConfig.baseUrl || undefined,
                        modelId: modeConfig.modelId || undefined,
                        bypassQuota: true,
                    }
                    console.log(
                        "[resolveAIConfig] Using BYOK config for mode:",
                        {
                            modelMode,
                            provider: resolvedConfig.provider,
                            modelId: resolvedConfig.modelId,
                            hasApiKey: !!resolvedConfig.apiKey,
                        },
                    )
                    return resolvedConfig
                } catch (error) {
                    console.error(
                        "[resolveAIConfig] Failed to decrypt credentials:",
                        error,
                    )
                    // 解密失败，回退到系统默认
                }
            } else {
                console.log(
                    "[resolveAIConfig] Config for mode has no credentials:",
                    modelMode,
                )
            }
        }
    }

    // 系统默认配置（根据 modelMode 选择不同的模型）
    const defaultConfig = await getDefaultAIConfig(modelMode)
    const systemConfig = {
        source: "system" as const,
        provider: defaultConfig.provider,
        apiKey: defaultConfig.apiKey,
        baseUrl: defaultConfig.baseUrl || undefined,
        modelId: defaultConfig.model,
        bypassQuota: false,
    }
    console.log("[resolveAIConfig] Using system default:", {
        modelMode,
        provider: systemConfig.provider,
        modelId: systemConfig.modelId,
        hasApiKey: !!systemConfig.apiKey,
        userId: userId || "anonymous",
    })
    return systemConfig
}
