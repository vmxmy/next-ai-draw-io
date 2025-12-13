import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
    title: "关于 - Next AI Draw.io",
    description: "项目来源与本项目增强说明。",
}

export default function AboutCN() {
    const originalRepoUrl = "https://github.com/DayuanJiang/next-ai-draw-io"

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-border/50 bg-background">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <Link
                        href="/"
                        className="text-xl font-semibold tracking-tight hover:text-foreground/80"
                    >
                        Next AI Draw.io
                    </Link>
                    <nav className="flex items-center gap-6 text-sm">
                        <Link
                            href="/"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            编辑器
                        </Link>
                        <Link href="/about/cn" className="font-medium">
                            关于
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        关于
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        项目来源与在原项目基础上的增强功能。
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                        <Link
                            href="/about"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            English
                        </Link>
                        <span className="text-muted-foreground/60">|</span>
                        <Link href="/about/cn" className="font-medium">
                            中文
                        </Link>
                        <span className="text-muted-foreground/60">|</span>
                        <Link
                            href="/about/ja"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            日本語
                        </Link>
                    </div>
                </div>

                <section className="rounded-2xl border border-border/50 bg-card p-6 shadow-soft">
                    <h2 className="text-lg font-semibold">1. 原项目介绍</h2>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        原项目 Next AI Draw.io 将聊天与 draw.io
                        结合，通过自然语言生成与编辑图表。
                    </p>
                    <div className="mt-4">
                        <a
                            href={originalRepoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
                        >
                            GitHub: DayuanJiang/next-ai-draw-io
                        </a>
                    </div>
                </section>

                <section className="mt-4 rounded-2xl border border-border/50 bg-card p-6 shadow-soft">
                    <h2 className="text-lg font-semibold">2. 本项目增强功能</h2>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground leading-relaxed">
                        <li>多会话对话管理与本地持久化。</li>
                        <li>GitHub 登录与会话云端同步。</li>
                        <li>AI 修改图表后支持撤销/重做（基于 XML 镜像）。</li>
                        <li>统一语义化主题 token，减少硬编码样式与颜色。</li>
                    </ul>
                </section>

                <div className="mt-10 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-xs hover:brightness-95 transition-colors"
                    >
                        打开编辑器
                    </Link>
                </div>
            </main>
        </div>
    )
}
