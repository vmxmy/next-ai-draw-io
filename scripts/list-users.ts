import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
    console.log("📋 数据库中的用户列表:\n")

    const users = await db.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            tier: true,
            status: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    })

    if (users.length === 0) {
        console.log("❌ 数据库中没有用户")
        return
    }

    console.log(`找到 ${users.length} 个用户:\n`)

    users.forEach((user, index) => {
        console.log(`${index + 1}. 📧 ${user.email || "未设置邮箱"}`)
        console.log(`   姓名: ${user.name || "未设置"}`)
        console.log(`   等级: ${user.tier}`)
        console.log(`   状态: ${user.status}`)
        console.log(`   ID: ${user.id}`)
        console.log(`   创建时间: ${user.createdAt.toLocaleString("zh-CN")}`)
        console.log("")
    })

    console.log("\n💡 提示: 请选择一个或多个邮箱地址配置为管理员")
}

main()
    .catch((e) => {
        console.error("❌ 查询失败:", e)
        process.exit(1)
    })
    .finally(async () => {
        await db.$disconnect()
    })
