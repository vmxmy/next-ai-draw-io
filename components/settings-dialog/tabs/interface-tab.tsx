"use client"

import { Moon, Palette, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/contexts/i18n-context"
import { useTheme } from "@/contexts/theme-context"
import { tweakcnThemes } from "@/lib/tweakcn-themes"

interface InterfaceTabProps {
    darkMode: boolean
    onToggleDarkMode: () => void
    drawioUi: "kennedy" | "atlas"
    onToggleDrawioUi: () => void
    closeProtection: boolean
    onCloseProtectionChange: (checked: boolean) => void
}

export function InterfaceTab({
    darkMode,
    onToggleDarkMode,
    drawioUi,
    onToggleDrawioUi,
    closeProtection,
    onCloseProtectionChange,
}: InterfaceTabProps) {
    const { t, locale, setLocale } = useI18n()
    const { palette, setPalette } = useTheme()

    return (
        <div className="space-y-4 py-2 overflow-y-auto flex-1">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label htmlFor="theme-toggle">
                        {t("settings.theme.label")}
                    </Label>
                    <p className="text-[0.8rem] text-muted-foreground">
                        {t("settings.theme.note")}
                    </p>
                </div>
                <Button
                    id="theme-toggle"
                    variant="outline"
                    size="icon"
                    onClick={onToggleDarkMode}
                >
                    {darkMode ? (
                        <Sun className="h-4 w-4" />
                    ) : (
                        <Moon className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Theme Color Select */}
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label htmlFor="theme-color-select">
                        {t("settings.themeColor.label")}
                    </Label>
                    <p className="text-[0.8rem] text-muted-foreground">
                        {t("settings.themeColor.note")}
                    </p>
                </div>
                <Select
                    value={palette || "amber-minimal"}
                    onValueChange={(value) => setPalette(value as any)}
                >
                    <SelectTrigger
                        id="theme-color-select"
                        className="w-[180px]"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        {tweakcnThemes.map((theme) => (
                            <SelectItem key={theme.name} value={theme.name}>
                                <div className="flex items-center gap-2">
                                    <Palette className="h-3.5 w-3.5" />
                                    {theme.title}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Language Select */}
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label htmlFor="language-select">
                        {t("settings.language.label")}
                    </Label>
                    <p className="text-[0.8rem] text-muted-foreground">
                        {t("settings.language.note")}
                    </p>
                </div>
                <Select
                    value={locale}
                    onValueChange={(value) => setLocale(value as any)}
                >
                    <SelectTrigger id="language-select" className="w-[140px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="en">
                            {t("settings.language.en")}
                        </SelectItem>
                        <SelectItem value="zh-CN">
                            {t("settings.language.zhCN")}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* DrawIO Style Toggle */}
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label htmlFor="drawio-ui">
                        {t("settings.drawioStyle.label")}
                    </Label>
                    <p className="text-[0.8rem] text-muted-foreground">
                        {t("settings.drawioStyle.note", {
                            style:
                                drawioUi === "kennedy"
                                    ? t("settings.drawioStyle.kennedy")
                                    : t("settings.drawioStyle.atlas"),
                        })}
                    </p>
                </div>
                <Button
                    id="drawio-ui"
                    variant="outline"
                    size="sm"
                    onClick={onToggleDrawioUi}
                >
                    {t("settings.drawioStyle.switchTo", {
                        style:
                            drawioUi === "kennedy"
                                ? t("settings.drawioStyle.atlas")
                                : t("settings.drawioStyle.kennedy"),
                    })}
                </Button>
            </div>

            {/* Close Protection Switch */}
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label htmlFor="close-protection">
                        {t("settings.closeProtection.label")}
                    </Label>
                    <p className="text-[0.8rem] text-muted-foreground">
                        {t("settings.closeProtection.note")}
                    </p>
                </div>
                <Switch
                    id="close-protection"
                    checked={closeProtection}
                    onCheckedChange={onCloseProtectionChange}
                />
            </div>
        </div>
    )
}
