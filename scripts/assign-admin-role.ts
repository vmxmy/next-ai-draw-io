import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
    // 要分配管理员角色的邮箱
    const adminEmail = "blueyang@gmail.com"

    console.log(`🔧 为用户分配超级管理员角色...\n`)

    // 1. 查找用户
    const user = await db.user.findUnique({
        where: { email: adminEmail },
    })

    if (!user) {
        console.error(`❌ 找不到用户: ${adminEmail}`)
        process.exit(1)
    }

    console.log(`✓ 找到用户: ${user.name || user.email} (${user.id})`)

    // 2. 查找或创建 superAdmin 角色
    let superAdminRole = await db.role.findUnique({
        where: { name: "superAdmin" },
    })

    if (!superAdminRole) {
        console.log(`📝 创建 superAdmin 角色...`)

        // 创建超级管理员角色
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

    // 3. 检查是否已有该角色
    const existingRole = await db.userRole.findUnique({
        where: {
            userId_roleId: {
                userId: user.id,
                roleId: superAdminRole.id,
            },
        },
    })

    if (existingRole) {
        console.log(`\n⚠️  该用户已经拥有 superAdmin 角色`)
        return
    }

    // 4. 分配角色
    await db.userRole.create({
        data: {
            userId: user.id,
            roleId: superAdminRole.id,
        },
    })

    console.log(`\n✅ 成功为 ${adminEmail} 分配了超级管理员角色！`)
    console.log(
        `\n现在可以使用此账号登录管理后台: http://localhost:6002/admin/login`,
    )
}

main()
    .catch((e) => {
        console.error("\n❌ 分配失败:", e)
        process.exit(1)
    })
    .finally(async () => {
        await db.$disconnect()
    })
