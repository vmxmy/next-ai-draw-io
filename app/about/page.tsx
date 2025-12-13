import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
    title: "About - Next AI Draw.io",
    description: "Project information and enhancements of this fork.",
}

export default function About() {
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
                            Editor
                        </Link>
                        <Link href="/about" className="font-medium">
                            About
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        About
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Background and enhancements built on top of the original
                        project.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                        <Link href="/about" className="font-medium">
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
                        <Link
                            href="/about/ja"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            日本語
                        </Link>
                    </div>
                </div>

                <section className="rounded-2xl border border-border/50 bg-card p-6 shadow-soft">
                    <h2 className="text-lg font-semibold">
                        1. Original project
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        The original Next AI Draw.io integrates chat with
                        draw.io to generate and edit diagrams using natural
                        language.
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
                        2. Enhancements in this project
                    </h2>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground leading-relaxed">
                        <li>Multi-session chat persistence and management.</li>
                        <li>
                            GitHub sign-in and cloud sync for conversations.
                        </li>
                        <li>
                            Conversation-driven diagram timeline with undo/redo
                            and version restore.
                        </li>
                        <li>
                            More reliable diagram edits via structured
                            <code className="px-1">edit_diagram</code> ops.
                        </li>
                        <li>
                            Better chat UX: stop button shows loading while
                            streaming; tool details are collapsible by default.
                        </li>
                        <li>
                            Semantic theme tokens to reduce hard-coded colors
                            and keep UI consistent.
                        </li>
                    </ul>
                </section>

                <div className="mt-10 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-xs hover:brightness-95 transition-colors"
                    >
                        Open Editor
                    </Link>
                </div>
            </main>
        </div>
    )
}
