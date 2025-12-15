/**
 * 测试文件持久化控制功能
 *
 * 使用方法：
 * 1. 先在浏览器中上传图片并发送一条消息
 * 2. 记录会话 ID 和用户 ID
 * 3. 运行此脚本：npx tsx scripts/test-file-persistence.ts <userId> <conversationId>
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const args = process.argv.slice(2)

    if (args.length < 2) {
        console.log(
            "用法：npx tsx scripts/test-file-persistence.ts <userId> <conversationId>",
        )
        console.log(
            "示例：npx tsx scripts/test-file-persistence.ts cmj3apkc800005qadw48qx879 conv-1765788470729-ofqox0",
        )
        process.exit(1)
    }

    const userId = args[0]
    const conversationId = args[1]

    console.log("\n=== 文件持久化测试 ===\n")

    // 1. 检查系统配置
    const config = await prisma.systemConfig.findUnique({
        where: { key: "chat.persistUploadedFiles" },
    })

    console.log("1️⃣ 系统配置")
    console.log(
        `   persistUploadedFiles: ${(config?.value as any)?.enabled ?? false}`,
    )

    // 2. 查询会话数据
    const conversation = await prisma.conversation.findUnique({
        where: {
            userId_id: {
                userId,
                id: conversationId,
            },
        },
        select: {
            id: true,
            userId: true,
            title: true,
            data: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    if (!conversation) {
        console.log(`\n❌ 找不到会话：${conversationId}`)
        return
    }

    console.log(`\n2️⃣ 会话信息`)
    console.log(`   ID: ${conversation.id}`)
    console.log(`   用户ID: ${conversation.userId}`)
    console.log(`   标题: ${conversation.title || "(无标题)"}`)

    // 3. 分析消息内容
    const data = conversation.data as any
    const messages = data?.messages || []

    console.log(`\n3️⃣ 消息分析`)
    console.log(`   消息总数: ${messages.length}`)

    let totalParts = 0
    let fileParts = 0
    let textParts = 0
    let otherParts = 0
    let totalFileSize = 0

    for (const msg of messages) {
        const parts = msg?.parts || []
        totalParts += parts.length

        for (const part of parts) {
            if (part?.type === "file") {
                fileParts++
                const fileSize = part.url?.length || 0
                totalFileSize += fileSize
            } else if (part?.type === "text") {
                textParts++
            } else {
                otherParts++
            }
        }
    }

    console.log(`   Parts 总数: ${totalParts}`)
    console.log(`   - text parts: ${textParts}`)
    console.log(`   - file parts: ${fileParts}`)
    console.log(`   - 其他 parts: ${otherParts}`)

    if (fileParts > 0) {
        console.log(`   文件总大小: ${(totalFileSize / 1024).toFixed(2)} KB`)
    }

    // 4. 数据大小统计
    const dataSize = JSON.stringify(data).length
    const messagesSize = JSON.stringify(messages).length
    const xmlSize = data?.xml?.length || 0

    console.log(`\n4️⃣ 存储空间`)
    console.log(`   总数据大小: ${(dataSize / 1024).toFixed(2)} KB`)
    console.log(
        `   消息大小: ${(messagesSize / 1024).toFixed(2)} KB (${((messagesSize / dataSize) * 100).toFixed(1)}%)`,
    )
    console.log(
        `   XML 大小: ${(xmlSize / 1024).toFixed(2)} KB (${((xmlSize / dataSize) * 100).toFixed(1)}%)`,
    )

    if (fileParts > 0) {
        console.log(
            `   文件占比: ${((totalFileSize / dataSize) * 100).toFixed(1)}%`,
        )
    }

    // 5. 测试结果判断
    console.log(`\n5️⃣ 测试结果`)

    const configEnabled = (config?.value as any)?.enabled ?? false

    if (!configEnabled && fileParts > 0) {
        console.log("   ❌ 失败：配置为不保存文件，但数据库中仍有 file parts")
        console.log("   原因可能是：")
        console.log("      1. 此会话在功能实施前创建（历史数据不受影响）")
        console.log("      2. 代码尚未生效（需要重启服务）")
        console.log("      3. 前端代码有问题")
    } else if (!configEnabled && fileParts === 0) {
        console.log("   ✅ 通过：配置为不保存文件，数据库中无 file parts")
        console.log("   节省空间：符合预期")
    } else if (configEnabled && fileParts > 0) {
        console.log("   ✅ 通过：配置为保存文件，数据库中有 file parts")
        console.log("   文件已保存：符合预期")
    } else {
        console.log("   ⚠️  无法判断：配置为保存文件，但数据库中无 file parts")
        console.log("   可能原因：此会话没有上传文件")
    }

    // 6. 详细消息内容（可选）
    if (process.argv.includes("--verbose")) {
        console.log(`\n6️⃣ 详细消息内容`)
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]
            console.log(`\n   消息 ${i + 1}:`)
            console.log(`      角色: ${msg.role}`)
            console.log(`      Parts 数量: ${msg.parts?.length || 0}`)

            if (msg.parts) {
                for (let j = 0; j < msg.parts.length; j++) {
                    const part = msg.parts[j]
                    console.log(`         Part ${j + 1}:`)
                    console.log(`            类型: ${part.type}`)

                    if (part.type === "file") {
                        console.log(
                            `            URL 长度: ${part.url?.length || 0}`,
                        )
                        console.log(
                            `            媒体类型: ${part.mediaType || "未知"}`,
                        )
                    } else if (part.type === "text") {
                        const preview = (part.text || "").substring(0, 50)
                        console.log(
                            `            文本预览: ${preview}${part.text?.length > 50 ? "..." : ""}`,
                        )
                    }
                }
            }
        }
    }

    console.log("\n=== 测试完成 ===\n")
}

main()
    .catch((e) => {
        console.error("❌ 测试失败：", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
