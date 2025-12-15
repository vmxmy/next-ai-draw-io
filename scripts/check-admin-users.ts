import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
    console.log("🔍 检查管理员用户...\n")

    const admins = await db.user.findMany({
        where: {
            roles: {
                some: {
                    role: {
                        name: {
                            in: ["superAdmin", "admin"],
                        },
                    },
                },
            },
        },
        include: {
            roles: {
                include: {
                    role: {
                        include: {
                            permissions: true,
                        },
                    },
                },
            },
        },
    })

    if (admins.length === 0) {
        console.log("❌ 没有找到管理员用户")
        return
    }

    console.log(`找到 ${admins.length} 个管理员:\n`)

    admins.forEach((user, index) => {
        console.log(`${index + 1}. 👤 ${user.name || "未设置"}`)
        console.log(`   📧 ${user.email || "未设置邮箱"}`)
        console.log(`   🎭 角色:`)

        user.roles.forEach((ur) => {
            console.log(`      - ${ur.role.displayName} (${ur.role.name})`)
            console.log(
                `        权限: ${ur.role.permissions.map((p) => p.name).join(", ")}`,
            )
        })

        console.log(`   🆔 ID: ${user.id}`)
        console.log("")
    })

    console.log("✅ 管理员列表检查完成")
}

main()
    .catch((e) => {
        console.error("❌ 查询失败:", e)
        process.exit(1)
    })
    .finally(async () => {
        await db.$disconnect()
    })
