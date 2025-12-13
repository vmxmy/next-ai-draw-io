export function sanitizeFilenameSegment(
    input: string,
    { maxLength = 48 }: { maxLength?: number } = {},
): string {
    // Windows 禁止字符: \ / : * ? " < > |
    // 同时移除控制字符，避免不同平台的文件系统问题
    let withoutControlChars = ""
    for (const ch of String(input)) {
        const code = ch.codePointAt(0) ?? 0
        if (code < 32 || code === 127) continue
        withoutControlChars += ch
    }

    const normalized = withoutControlChars
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[. ]+$/g, "")

    if (!normalized) return ""
    if (normalized.length <= maxLength) return normalized
    return normalized
        .slice(0, maxLength)
        .trim()
        .replace(/[. ]+$/g, "")
}

export function buildDefaultDiagramFilename(opts?: {
    date?: Date
    title?: string | null
    prefix?: string
}): string {
    const date = opts?.date ?? new Date()
    const datePart = date.toISOString().slice(0, 10)
    const prefix = opts?.prefix ?? "diagram"
    const safeTitle = sanitizeFilenameSegment(opts?.title ?? "")

    return safeTitle
        ? `${prefix}-${datePart}-${safeTitle}`
        : `${prefix}-${datePart}`
}
