import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
    const email = "blueyang@gmail.com"

    console.log(`🔍 检查用户认证信息: ${email}\n`)

    const user = await db.user.findUnique({
        where: { email },
        include: {
            accounts: true,
        },
    })

    if (!user) {
        console.log("❌ 用户不存在")
        return
    }

    console.log(`👤 用户信息:`)
    console.log(`   姓名: ${user.name || "未设置"}`)
    console.log(`   邮箱: ${user.email}`)
    console.log(`   手机: ${user.phone || "未绑定"}`)
    console.log(`   ID: ${user.id}\n`)

    console.log(`🔑 认证方式:`)

    if (user.accounts.length === 0) {
        console.log(`   ❌ 没有配置任何认证方式`)
        console.log(`\n💡 该用户需要配置认证方式才能登录。可用方式:`)
        console.log(`   1. 邮箱密码登录 (credentials)`)
        console.log(`   2. GitHub OAuth`)
        console.log(`   3. Google OAuth`)
        console.log(`   4. 手机验证码登录`)
    } else {
        user.accounts.forEach((account) => {
            console.log(`   ✓ ${account.provider}`)
            if (account.provider === "credentials") {
                console.log(`     - 已设置密码 ✓`)
            } else if (
                account.provider === "github" ||
                account.provider === "google"
            ) {
                console.log(`     - OAuth 登录`)
            }
        })
    }

    console.log("")
}

main()
    .catch((e) => {
        console.error("❌ 查询失败:", e)
        process.exit(1)
    })
    .finally(async () => {
        await db.$disconnect()
    })
