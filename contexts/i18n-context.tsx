"use client"

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"

export type Locale = "en" | "zh-CN"

const STORAGE_LOCALE_KEY = "next-ai-draw-io-locale"

type I18nKey =
    | "tool.generate"
    | "tool.edit"
    | "tool.analyze"
    | "status.complete"
    | "status.error"
    | "toast.startedFreshChat"
    | "toast.networkError"
    | "toast.autoRetryLimitReached"
    | "toast.editFallbackStopRetry"
    | "toast.copyFailed"
    | "toast.feedbackFailed"
    | "toast.diagramInvalid"
    | "toast.diagramValidationFailed"
    | "toast.diagramProcessFailed"
    | "dialog.history.title"
    | "dialog.history.empty"
    | "dialog.history.restorePrompt"
    | "dialog.history.cancel"
    | "dialog.history.confirm"
    | "dialog.history.close"
    | "dialog.save.title"
    | "dialog.save.format"
    | "dialog.save.filename"
    | "dialog.save.save"
    | "dialog.save.cancel"
    | "files.rejectedOne"
    | "files.rejectedMany"
    | "files.more"
    | "files.maxFiles"
    | "files.onlyMoreAllowed"
    | "files.unsupportedType"
    | "files.exceedsLimit"
    | "dialog.settings.title"
    | "dialog.settings.description"
    | "settings.accessCode.label"
    | "settings.accessCode.placeholder"
    | "settings.accessCode.save"
    | "settings.accessCode.requiredNote"
    | "settings.accessCode.invalid"
    | "settings.accessCode.verifyFailed"
    | "settings.aiProvider.title"
    | "settings.aiProvider.note"
    | "settings.aiProvider.providerLabel"
    | "settings.aiProvider.useServerDefault"
    | "settings.aiProvider.modelIdLabel"
    | "settings.aiProvider.apiKeyLabel"
    | "settings.aiProvider.apiKeyPlaceholder"
    | "settings.aiProvider.overrides"
    | "settings.aiProvider.baseUrlLabel"
    | "settings.aiProvider.baseUrlPlaceholder"
    | "settings.aiProvider.clear"
    | "settings.theme.label"
    | "settings.theme.note"
    | "settings.drawioStyle.label"
    | "settings.drawioStyle.note"
    | "settings.drawioStyle.minimal"
    | "settings.drawioStyle.sketch"
    | "settings.drawioStyle.switchTo"
    | "settings.closeProtection.label"
    | "settings.closeProtection.note"
    | "settings.language.label"
    | "settings.language.note"
    | "settings.language.en"
    | "settings.language.zhCN"
    | "chat.placeholder"
    | "chat.tooltip.clear"
    | "chat.tooltip.history"
    | "chat.tooltip.save"
    | "chat.tooltip.upload"
    | "chat.send"
    | "chat.sending"
    | "examples.title"
    | "examples.subtitle"
    | "examples.quick"
    | "examples.cachedNote"
    | "examples.new"
    | "examples.paper.title"
    | "examples.paper.desc"
    | "examples.paper.prompt"
    | "examples.animated.title"
    | "examples.animated.desc"
    | "examples.animated.prompt"
    | "examples.aws.title"
    | "examples.aws.desc"
    | "examples.aws.prompt"
    | "examples.flowchart.title"
    | "examples.flowchart.desc"
    | "examples.flowchart.prompt"
    | "examples.creative.title"
    | "examples.creative.desc"
    | "examples.creative.prompt"
    | "toast.drawioSaved"
    | "canvas.export"
    | "canvas.exportTooltip"
    | "save.filenamePlaceholder"
    | "reset.title"
    | "reset.description"
    | "reset.cancel"
    | "reset.clear"
    | "quota.dismiss"
    | "quota.title.request"
    | "quota.title.token"
    | "quota.tip"
    | "quota.body1"
    | "quota.body2"
    | "quota.body3"
    | "quota.learnMore"
    | "quota.selfHost"
    | "quota.sponsor"
    | "chat.header.about"
    | "chat.header.noticeTooltip"
    | "chat.header.newChatTooltip"
    | "chat.header.settingsTooltip"
    | "chat.header.hideTooltip"
    | "chat.header.showTooltip"
    | "chat.header.aiChatLabel"
    | "toast.storageUpdateFailed"
    | "toast.imageNotSupported"

const MESSAGES: Record<Locale, Record<I18nKey, string>> = {
    en: {
        "tool.generate": "Generate Diagram",
        "tool.edit": "Edit Diagram",
        "tool.analyze": "Analyze Diagram",
        "status.complete": "Complete",
        "status.error": "Error",
        "toast.startedFreshChat": "Started a fresh chat",
        "toast.networkError": "Network error. Please check your connection.",
        "toast.autoRetryLimitReached":
            "Auto-retry limit reached. Please try again manually.",
        "toast.editFallbackStopRetry":
            "Precise edits failed repeatedly. Auto-retry stopped; next attempt will regenerate the diagram.",
        "toast.copyFailed":
            "Failed to copy message. Please copy manually or check clipboard permissions.",
        "toast.feedbackFailed":
            "Failed to record your feedback. Please try again.",
        "toast.diagramInvalid":
            "AI generated invalid diagram XML. Please try regenerating.",
        "toast.diagramValidationFailed":
            "Diagram validation failed. Please try regenerating.",
        "toast.diagramProcessFailed":
            "Failed to process diagram. Please try regenerating.",
        "dialog.history.title": "Diagram History",
        "dialog.history.empty": "No history available yet.",
        "dialog.history.restorePrompt": "Restore to Version {version}?",
        "dialog.history.cancel": "Cancel",
        "dialog.history.confirm": "Confirm",
        "dialog.history.close": "Close",
        "dialog.save.title": "Save Diagram",
        "dialog.save.format": "Format",
        "dialog.save.filename": "Filename",
        "dialog.save.save": "Save",
        "dialog.save.cancel": "Cancel",
        "files.rejectedOne": "{count} file rejected:",
        "files.rejectedMany": "{count} files rejected:",
        "files.more": "...and {count} more",
        "files.maxFiles": "Maximum {count} files allowed",
        "files.onlyMoreAllowed": "Only {count} more file(s) allowed",
        "files.unsupportedType": '"{name}" is not a supported file type',
        "files.exceedsLimit": '"{name}" is {size} (exceeds {limit}MB)',
        "dialog.settings.title": "Settings",
        "dialog.settings.description": "Configure your application settings.",
        "settings.accessCode.label": "Access Code",
        "settings.accessCode.placeholder": "Enter access code",
        "settings.accessCode.save": "Save",
        "settings.accessCode.requiredNote": "Required to use this application.",
        "settings.accessCode.invalid": "Invalid access code",
        "settings.accessCode.verifyFailed": "Failed to verify access code",
        "settings.aiProvider.title": "AI Provider Settings",
        "settings.aiProvider.note":
            "Use your own API key to bypass usage limits. Your key is stored locally in your browser and is never stored on the server.",
        "settings.aiProvider.providerLabel": "Provider",
        "settings.aiProvider.useServerDefault": "Use Server Default",
        "settings.aiProvider.modelIdLabel": "Model ID",
        "settings.aiProvider.apiKeyLabel": "API Key",
        "settings.aiProvider.apiKeyPlaceholder": "Your API key",
        "settings.aiProvider.overrides": "Overrides {env}",
        "settings.aiProvider.baseUrlLabel": "Base URL (optional)",
        "settings.aiProvider.baseUrlPlaceholder":
            "e.g., https://api.example.com/v1",
        "settings.aiProvider.clear": "Clear Settings",
        "settings.theme.label": "Theme",
        "settings.theme.note":
            "Dark/Light mode for interface and DrawIO canvas.",
        "settings.drawioStyle.label": "DrawIO Style",
        "settings.drawioStyle.note": "Canvas style: {style}",
        "settings.drawioStyle.minimal": "Minimal",
        "settings.drawioStyle.sketch": "Sketch",
        "settings.drawioStyle.switchTo": "Switch to {style}",
        "settings.closeProtection.label": "Close Protection",
        "settings.closeProtection.note":
            "Show confirmation when leaving the page.",
        "settings.language.label": "Language",
        "settings.language.note": "Choose interface language.",
        "settings.language.en": "English",
        "settings.language.zhCN": "简体中文",
        "chat.placeholder": "Describe your diagram or upload a file...",
        "chat.tooltip.clear": "Clear conversation",
        "chat.tooltip.history": "Diagram history",
        "chat.tooltip.save": "Save diagram",
        "chat.tooltip.upload": "Upload file (image, PDF, text)",
        "chat.send": "Send",
        "chat.sending": "Sending...",
        "examples.title": "Create diagrams with AI",
        "examples.subtitle":
            "Describe what you want to create or upload an image to replicate",
        "examples.quick": "Quick Examples",
        "examples.cachedNote": "Examples are cached for instant response",
        "examples.new": "NEW",
        "examples.paper.title": "Paper to Diagram",
        "examples.paper.desc":
            "Upload .pdf, .txt, .md, .json, .csv, .py, .js, .ts and more",
        "examples.paper.prompt": "Summarize this paper as a diagram",
        "examples.animated.title": "Animated Diagram",
        "examples.animated.desc":
            "Draw a transformer architecture with animated connectors",
        "examples.animated.prompt":
            "Give me a **animated connector** diagram of transformer's architecture",
        "examples.aws.title": "AWS Architecture",
        "examples.aws.desc":
            "Create a cloud architecture diagram with AWS icons",
        "examples.aws.prompt": "Replicate this in aws style",
        "examples.flowchart.title": "Replicate Flowchart",
        "examples.flowchart.desc": "Upload and replicate an existing flowchart",
        "examples.flowchart.prompt": "Replicate this flowchart.",
        "examples.creative.title": "Creative Drawing",
        "examples.creative.desc": "Draw something fun and creative",
        "examples.creative.prompt": "Draw a cat for me",
        "toast.drawioSaved": "Diagram saved",
        "canvas.export": "Export",
        "canvas.exportTooltip": "Export diagram",
        "save.filenamePlaceholder": "Enter filename",
        "reset.title": "Clear Everything?",
        "reset.description":
            "This will clear the current conversation and reset the diagram. This action cannot be undone.",
        "reset.cancel": "Cancel",
        "reset.clear": "Clear Everything",
        "quota.dismiss": "Dismiss",
        "quota.title.request": "Daily Quota Reached",
        "quota.title.token": "Daily Token Limit Reached",
        "quota.tip": "Tip:",
        "quota.body1":
            "Oops — you've reached the daily {type} limit for this demo! As an indie developer covering all the API costs myself, I have to set these limits to keep things sustainable.",
        "quota.body2":
            "You can use your own API key (click the Settings icon) or self-host the project to bypass these limits.",
        "quota.body3": "Your limit resets tomorrow. Thanks for understanding!",
        "quota.learnMore": "Learn more →",
        "quota.selfHost": "Self-host",
        "quota.sponsor": "Sponsor",
        "chat.header.about": "About",
        "chat.header.noticeTooltip":
            "Due to high usage, I have changed the model to minimax-m2 and added some usage limits. See About page for details.",
        "chat.header.newChatTooltip": "Start fresh chat",
        "chat.header.settingsTooltip": "Settings",
        "chat.header.hideTooltip": "Hide chat panel (Ctrl+B)",
        "chat.header.showTooltip": "Show chat panel (Ctrl+B)",
        "chat.header.aiChatLabel": "AI Chat",
        "toast.storageUpdateFailed":
            "Chat cleared but browser storage could not be updated",
        "toast.imageNotSupported": "This model doesn't support image input.",
    },
    "zh-CN": {
        "tool.generate": "生成图表",
        "tool.edit": "编辑图表",
        "tool.analyze": "分析图表",
        "status.complete": "完成",
        "status.error": "错误",
        "toast.startedFreshChat": "已开始新的对话",
        "toast.networkError": "网络错误，请检查连接。",
        "toast.autoRetryLimitReached": "自动重试次数已达上限，请手动重试。",
        "toast.editFallbackStopRetry":
            "精确编辑多次失败，已停止自动重试；下次将改为重绘整个图表。",
        "toast.copyFailed": "复制失败，请手动复制或检查剪贴板权限。",
        "toast.feedbackFailed": "反馈提交失败，请稍后重试。",
        "toast.diagramInvalid": "AI 生成的 XML 无效，请尝试重新生成。",
        "toast.diagramValidationFailed": "图表校验失败，请尝试重新生成。",
        "toast.diagramProcessFailed": "图表处理失败，请尝试重新生成。",
        "dialog.history.title": "图表历史",
        "dialog.history.empty": "暂无历史版本。",
        "dialog.history.restorePrompt": "恢复到版本 {version}？",
        "dialog.history.cancel": "取消",
        "dialog.history.confirm": "确认",
        "dialog.history.close": "关闭",
        "dialog.save.title": "保存图表",
        "dialog.save.format": "格式",
        "dialog.save.filename": "文件名",
        "dialog.save.save": "保存",
        "dialog.save.cancel": "取消",
        "files.rejectedOne": "已拒绝 {count} 个文件：",
        "files.rejectedMany": "已拒绝 {count} 个文件：",
        "files.more": "……还有 {count} 个",
        "files.maxFiles": "最多只能上传 {count} 个文件",
        "files.onlyMoreAllowed": "还可再上传 {count} 个文件",
        "files.unsupportedType": "“{name}”不是支持的文件类型",
        "files.exceedsLimit": "“{name}”大小为 {size}（超过 {limit}MB 限制）",
        "dialog.settings.title": "设置",
        "dialog.settings.description": "配置应用相关设置。",
        "settings.accessCode.label": "访问码",
        "settings.accessCode.placeholder": "请输入访问码",
        "settings.accessCode.save": "保存",
        "settings.accessCode.requiredNote": "使用本应用需要访问码。",
        "settings.accessCode.invalid": "访问码无效",
        "settings.accessCode.verifyFailed": "访问码验证失败",
        "settings.aiProvider.title": "AI 提供商设置",
        "settings.aiProvider.note":
            "填写你自己的 API Key 以绕过使用限制。你的 Key 仅保存在浏览器本地，不会上传到服务器。",
        "settings.aiProvider.providerLabel": "提供商",
        "settings.aiProvider.useServerDefault": "使用服务器默认值",
        "settings.aiProvider.modelIdLabel": "模型 ID",
        "settings.aiProvider.apiKeyLabel": "API Key",
        "settings.aiProvider.apiKeyPlaceholder": "你的 API Key",
        "settings.aiProvider.overrides": "将覆盖 {env}",
        "settings.aiProvider.baseUrlLabel": "Base URL（可选）",
        "settings.aiProvider.baseUrlPlaceholder":
            "例如：https://api.example.com/v1",
        "settings.aiProvider.clear": "清除设置",
        "settings.theme.label": "主题",
        "settings.theme.note": "切换界面与 DrawIO 画布的明暗模式。",
        "settings.drawioStyle.label": "DrawIO 样式",
        "settings.drawioStyle.note": "画布风格：{style}",
        "settings.drawioStyle.minimal": "简洁",
        "settings.drawioStyle.sketch": "手绘",
        "settings.drawioStyle.switchTo": "切换为 {style}",
        "settings.closeProtection.label": "关闭保护",
        "settings.closeProtection.note": "离开页面时弹出确认提示。",
        "settings.language.label": "语言",
        "settings.language.note": "选择界面语言。",
        "settings.language.en": "English",
        "settings.language.zhCN": "简体中文",
        "chat.placeholder": "描述你想要的图表，或上传文件…",
        "chat.tooltip.clear": "清空对话",
        "chat.tooltip.history": "图表历史",
        "chat.tooltip.save": "保存图表",
        "chat.tooltip.upload": "上传文件（图片 / PDF / 文本）",
        "chat.send": "发送",
        "chat.sending": "发送中…",
        "examples.title": "用 AI 创建图表",
        "examples.subtitle": "描述你想创建的内容，或上传图片进行复刻",
        "examples.quick": "快速示例",
        "examples.cachedNote": "示例已缓存，可快速响应",
        "examples.new": "新",
        "examples.paper.title": "论文转图表",
        "examples.paper.desc":
            "支持上传 .pdf、.txt、.md、.json、.csv、.py、.js、.ts 等",
        "examples.paper.prompt": "请把这篇论文总结成一张图表",
        "examples.animated.title": "动画连线示例",
        "examples.animated.desc": "绘制带动画连线的 Transformer 架构图",
        "examples.animated.prompt":
            "请生成一张 Transformer 架构图，连线带动画效果",
        "examples.aws.title": "AWS 架构图",
        "examples.aws.desc": "用 AWS 图标生成云架构图",
        "examples.aws.prompt": "请用 AWS 风格复刻这张架构图",
        "examples.flowchart.title": "复刻流程图",
        "examples.flowchart.desc": "上传并复刻已有流程图",
        "examples.flowchart.prompt": "请复刻这张流程图。",
        "examples.creative.title": "创意绘画",
        "examples.creative.desc": "画点有趣的创意图",
        "examples.creative.prompt": "给我画一只猫",
        "toast.drawioSaved": "图表已保存",
        "canvas.export": "导出",
        "canvas.exportTooltip": "导出图表",
        "save.filenamePlaceholder": "请输入文件名",
        "reset.title": "确定清空所有内容？",
        "reset.description": "这会清空当前对话并重置图表，且无法撤销。",
        "reset.cancel": "取消",
        "reset.clear": "清空所有内容",
        "quota.dismiss": "关闭",
        "quota.title.request": "已达到每日配额上限",
        "quota.title.token": "已达到每日 Token 上限",
        "quota.tip": "提示：",
        "quota.body1":
            "你已达到本演示的每日 {type} 限制。作为独立开发者我需要控制成本以保证服务可持续。",
        "quota.body2":
            "你可以在设置中填写自有 API Key，或自行部署项目以绕过限制。",
        "quota.body3": "配额将于明天重置，感谢理解！",
        "quota.learnMore": "了解更多 →",
        "quota.selfHost": "自行部署",
        "quota.sponsor": "赞助",
        "chat.header.about": "关于",
        "chat.header.noticeTooltip":
            "由于使用量较高，我将默认模型切换为 minimax-m2 并加入使用限制，详见 About 页面。",
        "chat.header.newChatTooltip": "新建对话",
        "chat.header.settingsTooltip": "设置",
        "chat.header.hideTooltip": "隐藏聊天面板（Ctrl+B）",
        "chat.header.showTooltip": "显示聊天面板（Ctrl+B）",
        "chat.header.aiChatLabel": "AI 聊天",
        "toast.storageUpdateFailed": "对话已清空，但浏览器存储未能更新",
        "toast.imageNotSupported": "当前模型不支持图片输入。",
    },
}

function detectLocale(): Locale {
    if (typeof window === "undefined") return "en"
    const stored = localStorage.getItem(STORAGE_LOCALE_KEY)
    if (stored === "en" || stored === "zh-CN") return stored
    const lang = navigator.language.toLowerCase()
    if (lang.startsWith("zh")) return "zh-CN"
    return "en"
}

function formatMessage(
    template: string,
    vars?: Record<string, string | number>,
) {
    if (!vars) return template
    return template.replace(/\{(\w+)\}/g, (_, k) =>
        vars[k] === undefined ? `{${k}}` : String(vars[k]),
    )
}

interface I18nContextValue {
    locale: Locale
    setLocale: (l: Locale) => void
    t: (key: I18nKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>("en")

    useEffect(() => {
        setLocaleState(detectLocale())
    }, [])

    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : "en"
        }
    }, [locale])

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l)
        try {
            localStorage.setItem(STORAGE_LOCALE_KEY, l)
        } catch {
            // ignore
        }
    }, [])

    const t = useCallback(
        (key: I18nKey, vars?: Record<string, string | number>) => {
            const template = MESSAGES[locale][key] || MESSAGES.en[key] || key
            return formatMessage(template, vars)
        },
        [locale],
    )

    const value = useMemo(
        () => ({ locale, setLocale, t }),
        [locale, setLocale, t],
    )

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
    const ctx = useContext(I18nContext)
    if (!ctx) throw new Error("useI18n must be used within I18nProvider")
    return ctx
}
