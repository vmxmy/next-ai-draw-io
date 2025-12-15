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

    return NextResponse.json({
        accessCodeRequired: !!process.env.ACCESS_CODE_LIST,
        dailyRequestLimit: anonymousConfig.dailyRequestLimit,
        dailyTokenLimit: Number(anonymousConfig.dailyTokenLimit),
        tpmLimit: anonymousConfig.tpmLimit,
    })
}
