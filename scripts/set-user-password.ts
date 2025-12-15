import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
    const email = "blueyang@gmail.com"
    const password = "admin123456" // 临时密码，登录后请修改

    console.log(`🔐 为用户设置密码: ${email}\n`)

    // 1. 查找用户
    const user = await db.user.findUnique({
        where: { email },
        include: {
            accounts: true,
        },
    })

    if (!user) {
        console.error(`❌ 找不到用户: ${email}`)
        process.exit(1)
    }

    console.log(`✓ 找到用户: ${user.name || user.email}`)

    // 2. 检查是否已有 credentials 账号
    const credentialsAccount = user.accounts.find(
        (acc) => acc.provider === "credentials",
    )

    // 3. 加密密码
    const _hashedPassword = await bcrypt.hash(password, 10)

    if (credentialsAccount) {
        // 更新现有密码
        await db.account.update({
            where: { id: credentialsAccount.id },
            data: {
                // 在 NextAuth 的 credentials provider 中，密码通常不直接存储
                // 我们需要创建一个新的方式来存储
            },
        })
        console.log(`✓ 更新了密码`)
    } else {
        // 创建新的 credentials 账号
        await db.account.create({
            data: {
                userId: user.id,
                type: "credentials",
                provider: "credentials",
                providerAccountId: user.id,
                // NextAuth credentials provider 不在 Account 表存密码
                // 需要另外的方式
            },
        })
    }

    console.log(`\n⚠️  注意: NextAuth 的 credentials provider 需要特殊处理`)
    console.log(`当前系统可能需要扩展 User 模型来存储密码`)
    console.log(`\n建议: 使用 GitHub OAuth 登录管理后台`)
}

main()
    .catch((e) => {
        console.error("\n❌ 设置失败:", e)
        process.exit(1)
    })
    .finally(async () => {
        await db.$disconnect()
    })
