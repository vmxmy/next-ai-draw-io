import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    console.log("开始初始化 TierConfig 数据...")

    await prisma.tierConfig.createMany({
        data: [
            {
                tier: "anonymous",
                displayName: "匿名用户",
                dailyRequestLimit: 10,
                dailyTokenLimit: 20000,
                tpmLimit: 5000,
                sortOrder: 0,
                description: "未登录用户，基于 IP 限流",
            },
            {
                tier: "free",
                displayName: "免费版",
                dailyRequestLimit: 50,
                dailyTokenLimit: 100000,
                tpmLimit: 10000,
                sortOrder: 1,
                description: "已登录用户，免费等级",
            },
            {
                tier: "pro",
                displayName: "专业版",
                dailyRequestLimit: 500,
                dailyTokenLimit: 2000000,
                tpmLimit: 50000,
                sortOrder: 2,
                description: "付费用户，适合个人深度使用",
            },
            {
                tier: "enterprise",
                displayName: "企业版",
                dailyRequestLimit: 0, // 0 表示无限
                dailyTokenLimit: 0,
                tpmLimit: 0,
                sortOrder: 3,
                description: "无限额，适合团队/企业用户",
            },
        ],
        skipDuplicates: true,
    })

    console.log("✅ TierConfig 初始化完成")

    // 验证数据
    const tiers = await prisma.tierConfig.findMany({
        orderBy: { sortOrder: "asc" },
    })

    console.log("\n已创建的等级配置：")
    for (const tier of tiers) {
        console.log(
            `  - ${tier.tier}: ${tier.displayName} (请求: ${tier.dailyRequestLimit || "无限"}, Token: ${tier.dailyTokenLimit || "无限"}, TPM: ${tier.tpmLimit || "无限"})`,
        )
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
