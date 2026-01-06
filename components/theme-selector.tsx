"use client"

import { Palette } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select"
import { useTheme } from "@/contexts/theme-context"
import { tweakcnThemes } from "@/lib/tweakcn-themes"

interface ThemeSelectorProps {
    onValueChange: (themeName: string) => void
    disabled?: boolean
}

/**
 * Theme color preview swatches
 * Applies the theme class to show actual colors from CSS variables
 */
function ThemeColorSwatches({
    themeName,
    mode,
}: {
    themeName: string
    mode: "light" | "dark"
}) {
    const colorVars = ["--ds-primary", "--ds-secondary", "--ds-accent"]

    return (
        <div
            className={`theme-${themeName} ${mode} flex items-center gap-0.5`}
            style={{ isolation: "isolate" }}
        >
            {colorVars.map((varName) => (
                <div
                    key={varName}
                    className="w-2.5 h-2.5 rounded-sm border border-border/50"
                    style={{ backgroundColor: `var(${varName})` }}
                />
            ))}
        </div>
    )
}

/**
 * Theme selector dropdown for applying theme styles to diagrams
 */
export function ThemeSelector({ onValueChange, disabled }: ThemeSelectorProps) {
    const { resolvedAppearance, palette } = useTheme()
    const currentPalette = palette || "amber-minimal"

    return (
        <Select onValueChange={onValueChange} disabled={disabled}>
            <SelectTrigger className="h-8 w-8 p-0 border-0 bg-transparent hover:bg-accent shrink-0 text-muted-foreground hover:text-foreground [&>svg:last-child]:hidden">
                <Palette className="h-4 w-4" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
                {tweakcnThemes.map((theme) => {
                    const isCurrentTheme = theme.name === currentPalette
                    return (
                        <SelectItem key={theme.name} value={theme.name}>
                            <div className="flex items-center gap-2">
                                <ThemeColorSwatches
                                    themeName={theme.name}
                                    mode={resolvedAppearance}
                                />
                                <span
                                    className={`text-xs ${isCurrentTheme ? "font-semibold text-primary" : ""}`}
                                >
                                    {theme.title}
                                    {isCurrentTheme && " ✓"}
                                </span>
                            </div>
                        </SelectItem>
                    )
                })}
            </SelectContent>
        </Select>
    )
}
