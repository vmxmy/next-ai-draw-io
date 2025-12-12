export interface MessagePart {
    type: string
    state?: string
    toolName?: string
    [key: string]: unknown
}

export interface ChatMessage {
    role: string
    parts?: MessagePart[]
    [key: string]: unknown
}
