export interface MessagePart {
    type: string
    state?: string
    toolName?: string

    // File reference (new format - saves storage and tokens)
    fileId?: string
    fileName?: string
    fileType?: "image" | "pdf" | "text"
    summary?: string

    // Legacy file fields (backward compatibility)
    url?: string // data URL (deprecated, but still supported)
    mediaType?: string
    text?: string

    [key: string]: unknown
}

export interface ChatMessage {
    role: "user" | "assistant" | "system" | "tool" | string
    parts?: MessagePart[]
    [key: string]: unknown
}
