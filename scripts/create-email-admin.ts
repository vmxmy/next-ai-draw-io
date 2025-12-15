import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
    const email = "admin@admin.com"
    const password = "admin123"

    console.log(`🔧 创建邮箱密码管理员账号: ${email}\n`)

    // 1. 检查用户是否已存在
    let user = await db.user.findUnique({
        where: { email },
        include: {
            accounts: true,
            roles: {
                include: {
                    role: true,
                },
            },
        },
    })

    if (!user) {
        console.log(`📝 创建新用户...`)
        user = await db.user.create({
            data: {
                email,
                name: "Admin",
                status: "active",
            },
            include: {
                accounts: true,
                roles: {
                    include: {
                        role: true,
                    },
                },
            },
        })
        console.log(`✓ 用户已创建`)
    } else {
        console.log(`✓ 用户已存在: ${user.name || user.email}`)
    }

    // 2. 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 3. 检查是否已有 credentials 账号
    const credentialsAccount = user.accounts.find(
        (acc) => acc.provider === "credentials",
    )

    if (credentialsAccount) {
        // 更新密码（存储在 access_token 字段，这是一个 hack）
        await db.account.update({
            where: { id: credentialsAccount.id },
            data: {
                access_token: hashedPassword,
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
                access_token: hashedPassword, // 使用 access_token 字段存储密码哈希
            },
        })
        console.log(`✓ 创建了 credentials 账号`)
    }

    // 4. 查找或创建 superAdmin 角色
    let superAdminRole = await db.role.findUnique({
        where: { name: "superAdmin" },
    })

    if (!superAdminRole) {
        console.log(`📝 创建 superAdmin 角色...`)

        superAdminRole = await db.role.create({
            data: {
                name: "superAdmin",
                displayName: "超级管理员",
                description: "拥有所有权限，可管理系统的所有方面",
            },
        })

        // 创建通配符权限
        const allPermission = await db.permission.upsert({
            where: { name: "*" },
            update: {},
            create: {
                name: "*",
                resource: "*",
                action: "*",
                description: "所有权限（超级管理员专用）",
            },
        })

        // 将权限分配给角色
        await db.role.update({
            where: { id: superAdminRole.id },
            data: {
                permissions: {
                    connect: { id: allPermission.id },
                },
            },
        })

        console.log(`✓ 创建了 superAdmin 角色`)
    } else {
        console.log(`✓ 找到 superAdmin 角色`)
    }

    // 5. 检查是否已有该角色
    const existingRole = await db.userRole.findUnique({
        where: {
            userId_roleId: {
                userId: user.id,
                roleId: superAdminRole.id,
            },
        },
    })

    if (!existingRole) {
        await db.userRole.create({
            data: {
                userId: user.id,
                roleId: superAdminRole.id,
            },
        })
        console.log(`✓ 分配了 superAdmin 角色`)
    } else {
        console.log(`✓ 用户已有 superAdmin 角色`)
    }

    console.log(`\n✅ 管理员账号创建成功！`)
    console.log(`\n登录信息:`)
    console.log(`   邮箱: ${email}`)
    console.log(`   密码: ${password}`)
    console.log(`   角色: superAdmin`)
    console.log(
        `\n⚠️  注意: 需要在 server/auth.ts 中添加邮箱密码登录支持才能使用此账号`,
    )
}

main()
    .catch((e) => {
        console.error("\n❌ 创建失败:", e)
        process.exit(1)
    })
    .finally(async () => {
        await db.$disconnect()
    })
