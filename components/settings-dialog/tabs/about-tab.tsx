"use client"

import { BookOpen, ExternalLink, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/contexts/i18n-context"

const THIRD_PARTY_COMPONENTS = [
    { key: "tweakcn" },
    { key: "radixUI" },
    { key: "shadcnUI" },
    { key: "aiSDK" },
    { key: "drawio" },
    { key: "nextjs" },
] as const

const EXTERNAL_LINKS = {
    license: "https://github.com/vmxmy/next-ai-draw-io/blob/main/LICENSE",
    notice: "https://github.com/vmxmy/next-ai-draw-io/blob/main/NOTICE",
    compliance:
        "https://github.com/vmxmy/next-ai-draw-io/blob/main/docs/LICENSE_COMPLIANCE_AUDIT.md",
    repository: "https://github.com/vmxmy/next-ai-draw-io",
    documentation: "https://github.com/vmxmy/next-ai-draw-io#readme",
    originalProject: "https://github.com/DayuanJiang/next-ai-draw-io",
}

export function AboutTab() {
    const { t } = useI18n()

    return (
        <div className="space-y-6 py-2 overflow-y-auto flex-1">
            {/* Project Info */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold">
                        {t("about.title")}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t("about.version")} 0.4.0
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        {t("about.basedOn")}{" "}
                        <a
                            href={EXTERNAL_LINKS.originalProject}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-foreground"
                        >
                            {t("about.originalProject")}
                        </a>
                    </p>
                </div>
            </div>

            {/* License Section */}
            <div className="space-y-3">
                <div className="flex items-start gap-2">
                    <Scale className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                        <h4 className="font-medium">{t("about.license")}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t("about.licenseDescription")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            {t("about.copyright")}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild className="h-8">
                        <a
                            href={EXTERNAL_LINKS.license}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t("about.viewLicense")}
                        </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="h-8">
                        <a
                            href={EXTERNAL_LINKS.notice}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t("about.viewNotice")}
                        </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="h-8">
                        <a
                            href={EXTERNAL_LINKS.compliance}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t("about.viewCompliance")}
                        </a>
                    </Button>
                </div>
            </div>

            {/* Third-Party Components */}
            <div className="space-y-3">
                <div className="flex items-start gap-2">
                    <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                        <h4 className="font-medium">{t("about.thirdParty")}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t("about.thirdPartyDescription")}
                        </p>
                    </div>
                </div>

                <div className="space-y-2 pl-7">
                    {THIRD_PARTY_COMPONENTS.map((component) => (
                        <div key={component.key} className="text-sm">
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <span>{t(`about.${component.key}`)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Links */}
            <div className="space-y-2">
                <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full justify-start"
                >
                    <a
                        href={EXTERNAL_LINKS.repository}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2"
                    >
                        <ExternalLink className="h-4 w-4" />
                        {t("about.repository")}
                    </a>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full justify-start"
                >
                    <a
                        href={EXTERNAL_LINKS.documentation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2"
                    >
                        <BookOpen className="h-4 w-4" />
                        {t("about.documentation")}
                    </a>
                </Button>
            </div>
        </div>
    )
}
