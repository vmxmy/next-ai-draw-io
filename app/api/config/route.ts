import { NextResponse } from "next/server"
import { db } from "@/server/db"

export async function GET() {
    // 从数据库读取 anonymous 等级配置
    const anonymousConfig = await db.tierConfig.findUnique({
        where: { tier: "anonymous" },
    })

    if (!anonymousConfig) {
        return NextResponse.json(
            { error: "Anonymous tier configuration not found" },
            { status: 500 },
        )
    }

    // 读取文件持久化配置
    const persistFilesConfig = await db.systemConfig.findUnique({
        where: { key: "chat.persistUploadedFiles" },
    })

    const persistUploadedFiles =
        (persistFilesConfig?.value as { enabled?: boolean })?.enabled ?? false

    return NextResponse.json({
        accessCodeRequired: !!process.env.ACCESS_CODE_LIST,
        dailyRequestLimit: anonymousConfig.dailyRequestLimit,
        dailyTokenLimit: Number(anonymousConfig.dailyTokenLimit),
        tpmLimit: anonymousConfig.tpmLimit,
        persistUploadedFiles,
    })
}
