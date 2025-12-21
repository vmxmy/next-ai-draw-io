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
 * 从 UserCredential 获取解密的凭证
 */
async function getUserCredential(
    userId: string,
    provider: string,
    credentialName?: string | null,
): Promise<{ apiKey: string; baseUrl?: string } | null> {
    // 查找指定凭证，或该 provider 的默认凭证
    let credential = credentialName
        ? await db.userCredential.findUnique({
              where: {
                  userId_provider_name: {
                      userId,
                      provider,
                      name: credentialName,
                  },
              },
          })
        : await db.userCredential.findFirst({
              where: {
                  userId,
                  provider,
                  isDefault: true,
                  isDisabled: false,
              },
          })

    // 如果没有默认凭证，尝试获取任意一个可用的
    if (!credential && !credentialName) {
        credential = await db.userCredential.findFirst({
            where: {
                userId,
                provider,
                isDisabled: false,
            },
            orderBy: { createdAt: "asc" },
        })
    }

    if (!credential || !credential.encryptedCredentials) {
        return null
    }

    try {
        const decrypted = decryptCredentials({
            encryptedData: credential.encryptedCredentials,
            iv: credential.credentialsIv!,
            authTag: credential.credentialsAuthTag!,
            keyVersion: credential.credentialsVersion,
        })
        const parsed = JSON.parse(decrypted)
        return {
            apiKey: parsed.apiKey,
            baseUrl: credential.baseUrl || undefined,
        }
    } catch (error) {
        console.error("[getUserCredential] Failed to decrypt:", error)
        return null
    }
}

/**
 * 服务端单一配置解析入口
 *
 * 优先级:
 * 1. 匿名用户 + BYOK headers -> 使用 headers，绕过配额
 * 2. 登录用户 aiMode="byok" -> 使用 UserModeConfig + UserCredential，绕过配额
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
                modeConfigs: {
                    where: { mode: modelMode },
                    take: 1,
                },
            },
        })

        const modeConfig = user?.modeConfigs?.[0]

        console.log("[resolveAIConfig] User lookup:", {
            userId,
            aiMode: user?.aiMode,
            modelMode,
            hasConfigForMode: !!modeConfig,
            configProvider: modeConfig?.provider,
        })

        if (user?.aiMode === "byok" && modeConfig?.provider) {
            // 从 UserCredential 获取凭证
            const credential = await getUserCredential(
                userId,
                modeConfig.provider,
                modeConfig.credentialName,
            )

            if (credential?.apiKey) {
                const resolvedConfig = {
                    source: "byok" as const,
                    provider: modeConfig.provider,
                    apiKey: credential.apiKey,
                    baseUrl: credential.baseUrl,
                    modelId: modeConfig.modelId || undefined,
                    bypassQuota: true,
                }
                console.log("[resolveAIConfig] Using BYOK config for mode:", {
                    modelMode,
                    provider: resolvedConfig.provider,
                    modelId: resolvedConfig.modelId,
                    hasApiKey: !!resolvedConfig.apiKey,
                })
                return resolvedConfig
            }
            console.log(
                "[resolveAIConfig] No valid credential for mode:",
                modelMode,
            )
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
