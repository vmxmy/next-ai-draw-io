import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
    console.log("Starting RBAC initialization...")

    // 1. 创建权限
    console.log("Creating permissions...")
    const permissions = [
        // 用户管理
        {
            name: "users:read",
            resource: "users",
            action: "read",
            description: "查看用户列表和详情",
        },
        {
            name: "users:write",
            resource: "users",
            action: "write",
            description: "编辑用户信息、调整等级、禁用用户",
        },
        {
            name: "users:delete",
            resource: "users",
            action: "delete",
            description: "删除用户",
        },

        // 等级配置
        {
            name: "tiers:read",
            resource: "tiers",
            action: "read",
            description: "查看等级配置",
        },
        {
            name: "tiers:write",
            resource: "tiers",
            action: "write",
            description: "修改等级配置",
        },

        // 配额管理
        {
            name: "quotas:read",
            resource: "quotas",
            action: "read",
            description: "查看配额使用情况",
        },
        {
            name: "quotas:write",
            resource: "quotas",
            action: "write",
            description: "修改配额限制",
        },
        {
            name: "quotas:reset",
            resource: "quotas",
            action: "reset",
            description: "重置用户配额",
        },

        // 审计日志
        {
            name: "logs:read",
            resource: "logs",
            action: "read",
            description: "查看审计日志",
        },

        // 系统配置
        {
            name: "system:read",
            resource: "system",
            action: "read",
            description: "查看系统配置",
        },
        {
            name: "system:write",
            resource: "system",
            action: "write",
            description: "修改系统配置",
        },

        // 超级权限
        {
            name: "*",
            resource: "*",
            action: "*",
            description: "所有权限（超级管理员专用）",
        },
    ]

    const createdPermissions = []
    for (const perm of permissions) {
        const created = await db.permission.upsert({
            where: { name: perm.name },
            update: perm,
            create: perm,
        })
        createdPermissions.push(created)
        console.log(`  ✓ Permission created: ${perm.name}`)
    }

    // 2. 创建角色
    console.log("\nCreating roles...")
    const roles = [
        {
            name: "superAdmin",
            displayName: "超级管理员",
            description: "拥有所有权限，可管理系统的所有方面",
        },
        {
            name: "admin",
            displayName: "管理员",
            description: "可管理用户、配额和等级配置",
        },
        {
            name: "moderator",
            displayName: "运维人员",
            description: "可查看数据并执行部分操作",
        },
        {
            name: "viewer",
            displayName: "只读用户",
            description: "仅可查看数据，无修改权限",
        },
    ]

    const createdRoles: Record<string, any> = {}
    for (const role of roles) {
        const created = await db.role.upsert({
            where: { name: role.name },
            update: role,
            create: role,
        })
        createdRoles[role.name] = created
        console.log(`  ✓ Role created: ${role.displayName} (${role.name})`)
    }

    // 3. 分配权限给角色
    console.log("\nAssigning permissions to roles...")

    // 角色-权限映射
    const rolePermissions: Record<string, string[]> = {
        superAdmin: ["*"], // 所有权限
        admin: [
            "users:read",
            "users:write",
            "tiers:read",
            "tiers:write",
            "quotas:read",
            "quotas:write",
            "quotas:reset",
            "logs:read",
            "system:read",
        ],
        moderator: [
            "users:read",
            "quotas:read",
            "quotas:reset",
            "logs:read",
            "tiers:read",
        ],
        viewer: ["users:read", "quotas:read", "logs:read", "tiers:read"],
    }

    for (const [roleName, permNames] of Object.entries(rolePermissions)) {
        const role = createdRoles[roleName]
        if (!role) continue

        const perms = createdPermissions.filter((p) =>
            permNames.includes(p.name),
        )

        await db.role.update({
            where: { id: role.id },
            data: {
                permissions: {
                    set: [], // 先清空
                    connect: perms.map((p) => ({ id: p.id })),
                },
            },
        })

        console.log(
            `  ✓ ${role.displayName}: ${permNames.length} permissions assigned`,
        )
    }

    // 4. 分配初始管理员角色（基于 ADMIN_EMAILS）
    console.log("\nAssigning superAdmin role to initial admins...")

    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)

    if (adminEmails.length === 0) {
        console.log(
            "  ⚠ No ADMIN_EMAILS configured. Skipping initial admin assignment.",
        )
    } else {
        const superAdminRole = createdRoles.superAdmin
        for (const email of adminEmails) {
            const user = await db.user.findUnique({ where: { email } })
            if (!user) {
                console.log(`  ⚠ User not found: ${email}`)
                continue
            }

            // 检查是否已有该角色
            const existingRole = await db.userRole.findUnique({
                where: {
                    userId_roleId: {
                        userId: user.id,
                        roleId: superAdminRole.id,
                    },
                },
            })

            if (existingRole) {
                console.log(`  → ${email} already has superAdmin role`)
            } else {
                await db.userRole.create({
                    data: {
                        userId: user.id,
                        roleId: superAdminRole.id,
                    },
                })
                console.log(`  ✓ Assigned superAdmin to: ${email}`)
            }
        }
    }

    console.log("\n✅ RBAC initialization completed!")
}

main()
    .catch((e) => {
        console.error("Error during RBAC initialization:", e)
        process.exit(1)
    })
    .finally(async () => {
        await db.$disconnect()
    })
