/**
 * 历史消息滑窗裁剪策略。
 * 目标：控制上下文长度，同时保留最近对话与关键系统/工具信息。
 *
 * 规则（保守）：
 * - 永远保留所有 system messages。
 * - 从尾部保留最近 N 条 user/assistant 消息。
 * - 如果裁剪发生，优先丢弃更早的 user/assistant 历史。
 */

export interface RoleMessageLike {
    role: string
    content?: unknown
    [key: string]: unknown
}

export function applyMessageWindow(
    messages: RoleMessageLike[],
    opts?: { maxNonSystemMessages?: number },
): RoleMessageLike[] {
    const maxNonSystemMessages = opts?.maxNonSystemMessages ?? 12
    if (maxNonSystemMessages <= 0) return messages

    const systemMessages: RoleMessageLike[] = []
    const nonSystemMessages: RoleMessageLike[] = []

    for (const m of messages) {
        if (m.role === "system") systemMessages.push(m)
        else nonSystemMessages.push(m)
    }

    if (nonSystemMessages.length <= maxNonSystemMessages) return messages

    const keptNonSystem = nonSystemMessages.slice(-maxNonSystemMessages)
    return [...systemMessages, ...keptNonSystem]
}
