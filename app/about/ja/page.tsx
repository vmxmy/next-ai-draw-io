import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
    title: "概要 - Next AI Draw.io",
    description: "元プロジェクトと本フォークの拡張点。",
}

export default function AboutJA() {
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
                            エディタ
                        </Link>
                        <Link href="/about/ja" className="font-medium">
                            概要
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        概要
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        元プロジェクトと、このフォークで追加した機能。
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                        <Link
                            href="/about"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            English
                        </Link>
                        <span className="text-muted-foreground/60">|</span>
                        <Link
                            href="/about/cn"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            中文
                        </Link>
                        <span className="text-muted-foreground/60">|</span>
                        <Link href="/about/ja" className="font-medium">
                            日本語
                        </Link>
                    </div>
                </div>

                <section className="rounded-2xl border border-border/50 bg-card p-6 shadow-soft">
                    <h2 className="text-lg font-semibold">1. 元プロジェクト</h2>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        元の Next AI Draw.io は、チャットと draw.io
                        を統合し、自然言語でダイアグラムの生成・編集を行うツールです。
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
                    <h2 className="text-lg font-semibold">
                        2. このプロジェクトの拡張
                    </h2>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground leading-relaxed">
                        <li>マルチセッションの会話管理とローカル永続化。</li>
                        <li>GitHub ログインと会話のクラウド同期。</li>
                        <li>
                            会話に紐づく図の線形タイムライン（Undo/Redo
                            と復元）。
                        </li>
                        <li>
                            構造化 <code className="px-1">edit_diagram</code>{" "}
                            ops による編集の安定化。
                        </li>
                        <li>
                            チャット体験の改善：ストリーミング中の停止ボタンに
                            loading、ツール詳細は既定で折りたたみ。
                        </li>
                        <li>
                            セマンティックなテーマ token による一貫した UI。
                        </li>
                    </ul>
                </section>

                <div className="mt-10 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-xs hover:brightness-95 transition-colors"
                    >
                        エディタを開く
                    </Link>
                </div>
            </main>
        </div>
    )
}
