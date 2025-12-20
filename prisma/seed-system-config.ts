import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    console.log("开始初始化 SystemConfig 数据...")

    // AI 默认配置
    await prisma.systemConfig.upsert({
        where: { key: "ai.default.provider" },
        update: {},
        create: {
            key: "ai.default.provider",
            value: "openrouter",
            category: "ai",
            description:
                "默认 AI Provider (openrouter | openai | anthropic | google | ollama)",
        },
    })

    await prisma.systemConfig.upsert({
        where: { key: "ai.default.model" },
        update: {},
        create: {
            key: "ai.default.model",
            value: "qwen/qwen-2.5-coder-32b-instruct",
            category: "ai",
            description: "默认 AI 模型 ID",
        },
    })

    await prisma.systemConfig.upsert({
        where: { key: "ai.openrouter.apiKey" },
        update: {},
        create: {
            key: "ai.openrouter.apiKey",
            value: process.env.OPENROUTER_API_KEY || "",
            category: "ai",
            description: "OpenRouter API Key（服务端默认）",
        },
    })

    await prisma.systemConfig.upsert({
        where: { key: "ai.fallback.models" },
        update: {},
        create: {
            key: "ai.fallback.models",
            value: [
                "qwen/qwen-2.5-coder-32b-instruct",
                "deepseek/deepseek-chat",
                "anthropic/claude-3.5-sonnet",
            ],
            category: "ai",
            description: "备用模型列表（主模型失败时自动切换）",
        },
    })

    // 聊天文件持久化配置
    await prisma.systemConfig.upsert({
        where: { key: "chat.persistUploadedFiles" },
        update: {},
        create: {
            key: "chat.persistUploadedFiles",
            value: { enabled: false },
            category: "general",
            description:
                "是否将用户上传的文件（图片 base64）保存到数据库。关闭可节省约 48% 存储空间",
        },
    })

    console.log("✅ SystemConfig 初始化完成")

    console.log("开始初始化 ProviderCatalog 数据...")

    // 建议模型格式: { id: string, label?: string }[]
    const providerCatalogSeeds: Array<{
        key: string
        displayName: string
        compatibility: string
        authType: string
        defaultBaseUrl?: string | null
        defaultParams?: Record<string, string>
        suggestedModels?: Array<{ id: string; label?: string }>
    }> = [
        {
            key: "openai",
            displayName: "OpenAI",
            compatibility: "native",
            authType: "apiKey",
            defaultBaseUrl: "https://api.openai.com/v1",
            suggestedModels: [
                { id: "gpt-4o" },
                { id: "gpt-4o-mini" },
                { id: "gpt-4.1" },
                { id: "gpt-4.1-mini" },
                { id: "o3-mini" },
            ],
        },
        {
            key: "openai_compatible",
            displayName: "OpenAI 兼容模式",
            compatibility: "openai_compat",
            authType: "apiKey",
            defaultBaseUrl: null,
            suggestedModels: [], // 用户自行输入
        },
        {
            key: "anthropic",
            displayName: "Anthropic",
            compatibility: "native",
            authType: "apiKey",
            defaultBaseUrl: "https://api.anthropic.com",
            suggestedModels: [
                { id: "claude-sonnet-4-5-20250514" },
                { id: "claude-3-5-sonnet-latest" },
                { id: "claude-3-5-haiku-latest" },
                { id: "claude-3-opus-latest" },
            ],
        },
        {
            key: "google",
            displayName: "Google (Gemini)",
            compatibility: "native",
            authType: "apiKey",
            defaultBaseUrl: "https://generativelanguage.googleapis.com",
            suggestedModels: [
                { id: "gemini-2.0-flash" },
                { id: "gemini-2.5-flash" },
                { id: "gemini-2.5-pro" },
                { id: "gemini-1.5-pro" },
            ],
        },
        {
            key: "azure",
            displayName: "Azure OpenAI",
            compatibility: "openai_compat",
            authType: "apiKey",
            defaultBaseUrl: null,
            defaultParams: { apiVersion: "2024-02-15-preview" },
            suggestedModels: [
                { id: "gpt-4o", label: "部署名以实际为准" },
                { id: "gpt-4.1" },
            ],
        },
        {
            key: "bedrock",
            displayName: "Amazon Bedrock",
            compatibility: "native",
            authType: "aws",
            defaultBaseUrl: null,
            defaultParams: { region: "us-west-2" },
            suggestedModels: [
                { id: "anthropic.claude-3-5-sonnet-20241022-v2:0" },
                { id: "anthropic.claude-3-5-haiku-20241022-v1:0" },
                { id: "us.amazon.nova-pro-v1:0" },
            ],
        },
        {
            key: "ollama",
            displayName: "Ollama",
            compatibility: "openai_compat",
            authType: "none",
            defaultBaseUrl: "http://localhost:11434",
            suggestedModels: [
                { id: "qwen2.5-coder:32b" },
                { id: "llama3.3:70b" },
                { id: "deepseek-r1:32b" },
            ],
        },
        {
            key: "openrouter",
            displayName: "OpenRouter",
            compatibility: "openai_compat",
            authType: "apiKey",
            defaultBaseUrl: "https://openrouter.ai/api/v1",
            suggestedModels: [
                { id: "google/gemini-2.5-pro" },
                { id: "google/gemini-2.5-flash" },
                { id: "anthropic/claude-3.5-sonnet" },
                { id: "openai/gpt-4o" },
                { id: "qwen/qwen-2.5-coder-32b-instruct" },
            ],
        },
        {
            key: "deepseek",
            displayName: "DeepSeek",
            compatibility: "openai_compat",
            authType: "apiKey",
            defaultBaseUrl: "https://api.deepseek.com/v1",
            suggestedModels: [
                { id: "deepseek-chat" },
                { id: "deepseek-reasoner" },
            ],
        },
        {
            key: "siliconflow",
            displayName: "SiliconFlow",
            compatibility: "openai_compat",
            authType: "apiKey",
            defaultBaseUrl: "https://api.siliconflow.cn/v1",
            suggestedModels: [
                { id: "deepseek-ai/DeepSeek-V3" },
                { id: "deepseek-ai/DeepSeek-R1" },
                { id: "Qwen/Qwen2.5-72B-Instruct" },
            ],
        },
    ]

    for (const seed of providerCatalogSeeds) {
        await prisma.providerCatalog.upsert({
            where: { key: seed.key },
            update: {
                displayName: seed.displayName,
                compatibility: seed.compatibility,
                authType: seed.authType,
                defaultBaseUrl: seed.defaultBaseUrl,
                defaultParams: seed.defaultParams,
                suggestedModels: seed.suggestedModels,
            },
            create: {
                key: seed.key,
                displayName: seed.displayName,
                compatibility: seed.compatibility,
                authType: seed.authType,
                defaultBaseUrl: seed.defaultBaseUrl,
                defaultParams: seed.defaultParams,
                suggestedModels: seed.suggestedModels,
            },
        })
    }

    console.log("✅ ProviderCatalog 初始化完成")

    // 验证数据
    const configs = await prisma.systemConfig.findMany({
        where: { category: "ai" },
        orderBy: { key: "asc" },
    })

    console.log("\n已创建的系统配置：")
    for (const config of configs) {
        console.log(`  - ${config.key}: ${JSON.stringify(config.value)}`)
    }
}

main()
    .catch((e) => {
        console.error("❌ 初始化失败：", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
