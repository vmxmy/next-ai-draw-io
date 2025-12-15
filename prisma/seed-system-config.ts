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

    console.log("✅ SystemConfig 初始化完成")

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
