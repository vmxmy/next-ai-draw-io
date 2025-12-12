"use client"

import { Cloud, FileText, GitBranch, Palette, Zap } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"

interface ExampleCardProps {
    icon: React.ReactNode
    title: string
    description: string
    onClick: () => void
    isNew?: boolean
}

function ExampleCard({
    icon,
    title,
    description,
    onClick,
    isNew,
}: ExampleCardProps) {
    const { t } = useI18n()
    return (
        <button
            onClick={onClick}
            className={`group w-full text-left p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-200 hover:shadow-sm ${
                isNew
                    ? "border-primary/40 ring-1 ring-primary/20"
                    : "border-border/60"
            }`}
        >
            <div className="flex items-start gap-3">
                <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isNew
                            ? "bg-primary/20 group-hover:bg-primary/25"
                            : "bg-primary/10 group-hover:bg-primary/15"
                    }`}
                >
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                            {title}
                        </h3>
                        {isNew && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary text-primary-foreground rounded">
                                {t("examples.new")}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {description}
                    </p>
                </div>
            </div>
        </button>
    )
}

export default function ExamplePanel({
    setInput,
    setFiles,
}: {
    setInput: (input: string) => void
    setFiles: (files: File[]) => void
}) {
    const { t } = useI18n()
    const handleReplicateFlowchart = async () => {
        setInput(t("examples.flowchart.prompt"))

        try {
            const response = await fetch("/example.png")
            const blob = await response.blob()
            const file = new File([blob], "example.png", { type: "image/png" })
            setFiles([file])
        } catch (error) {
            console.error("Error loading example image:", error)
        }
    }

    const handleReplicateArchitecture = async () => {
        setInput(t("examples.aws.prompt"))

        try {
            const response = await fetch("/architecture.png")
            const blob = await response.blob()
            const file = new File([blob], "architecture.png", {
                type: "image/png",
            })
            setFiles([file])
        } catch (error) {
            console.error("Error loading architecture image:", error)
        }
    }

    const handlePdfExample = async () => {
        setInput(t("examples.paper.prompt"))

        try {
            const response = await fetch("/chain-of-thought.txt")
            const blob = await response.blob()
            const file = new File([blob], "chain-of-thought.txt", {
                type: "text/plain",
            })
            setFiles([file])
        } catch (error) {
            console.error("Error loading text file:", error)
        }
    }

    return (
        <div className="py-6 px-2 animate-fade-in">
            {/* Welcome section */}
            <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                    {t("examples.title")}
                </h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    {t("examples.subtitle")}
                </p>
            </div>

            {/* Examples grid */}
            <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                    {t("examples.quick")}
                </p>

                <div className="grid gap-2">
                    <ExampleCard
                        icon={<FileText className="w-4 h-4 text-primary" />}
                        title={t("examples.paper.title")}
                        description={t("examples.paper.desc")}
                        onClick={handlePdfExample}
                        isNew
                    />

                    <ExampleCard
                        icon={<Zap className="w-4 h-4 text-primary" />}
                        title={t("examples.animated.title")}
                        description={t("examples.animated.desc")}
                        onClick={() => {
                            setInput(t("examples.animated.prompt"))
                            setFiles([])
                        }}
                    />

                    <ExampleCard
                        icon={<Cloud className="w-4 h-4 text-primary" />}
                        title={t("examples.aws.title")}
                        description={t("examples.aws.desc")}
                        onClick={handleReplicateArchitecture}
                    />

                    <ExampleCard
                        icon={<GitBranch className="w-4 h-4 text-primary" />}
                        title={t("examples.flowchart.title")}
                        description={t("examples.flowchart.desc")}
                        onClick={handleReplicateFlowchart}
                    />

                    <ExampleCard
                        icon={<Palette className="w-4 h-4 text-primary" />}
                        title={t("examples.creative.title")}
                        description={t("examples.creative.desc")}
                        onClick={() => {
                            setInput(t("examples.creative.prompt"))
                            setFiles([])
                        }}
                    />
                </div>

                <p className="text-[11px] text-muted-foreground/60 text-center mt-4">
                    {t("examples.cachedNote")}
                </p>
            </div>
        </div>
    )
}
