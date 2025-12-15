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
    toolInvocations?: any[]
    [key: string]: unknown
}

/**
 * Merge consecutive failed tool invocations to reduce token usage.
 * When the same tool fails multiple times in a row, keep only the last failure.
 */
function mergeConsecutiveFailures(
    messages: RoleMessageLike[],
): RoleMessageLike[] {
    const result: RoleMessageLike[] = []
    let i = 0

    while (i < messages.length) {
        const msg = messages[i]

        // Only process assistant messages with tool invocations
        if (
            msg.role !== "assistant" ||
            !Array.isArray(msg.toolInvocations) ||
            msg.toolInvocations.length === 0
        ) {
            result.push(msg)
            i++
            continue
        }

        // Check if this message has failed tool invocations
        const failedTools = msg.toolInvocations.filter(
            (inv: any) =>
                inv.state === "result" &&
                typeof inv.result === "string" &&
                (inv.result.includes("Error") || inv.result.includes("Failed")),
        )

        if (failedTools.length === 0) {
            result.push(msg)
            i++
            continue
        }

        // Look ahead to find consecutive failures of the same tool
        const toolName = failedTools[0]?.toolName || "unknown"
        const consecutiveFailures: RoleMessageLike[] = [msg]
        let j = i + 1

        while (j < messages.length) {
            const nextMsg = messages[j]
            if (
                nextMsg.role === "assistant" &&
                Array.isArray(nextMsg.toolInvocations)
            ) {
                const nextFailed = nextMsg.toolInvocations.filter(
                    (inv: any) =>
                        inv.toolName === toolName &&
                        inv.state === "result" &&
                        typeof inv.result === "string" &&
                        (inv.result.includes("Error") ||
                            inv.result.includes("Failed")),
                )

                if (nextFailed.length > 0) {
                    consecutiveFailures.push(nextMsg)
                    j++
                    continue
                }
            }
            break
        }

        // If we found consecutive failures (2+), merge them
        if (consecutiveFailures.length > 1) {
            // Keep only the last failure with a summary
            const lastFailure =
                consecutiveFailures[consecutiveFailures.length - 1]
            const mergedMessage = {
                ...lastFailure,
                // Prepend a summary note
                content: Array.isArray(lastFailure.content)
                    ? [
                          {
                              type: "text",
                              text: `[Merged ${consecutiveFailures.length} consecutive failed attempts of ${toolName}]`,
                          },
                          ...lastFailure.content,
                      ]
                    : `[Merged ${consecutiveFailures.length} consecutive failed attempts of ${toolName}]\n${lastFailure.content || ""}`,
            }

            result.push(mergedMessage)
            i = j
        } else {
            // No consecutive failures, keep as is
            result.push(msg)
            i++
        }
    }

    return result
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

    if (nonSystemMessages.length <= maxNonSystemMessages) {
        // Even if we don't need to truncate, still merge consecutive failures
        const merged = mergeConsecutiveFailures(messages)
        return merged
    }

    const keptNonSystem = nonSystemMessages.slice(-maxNonSystemMessages)
    const windowed = [...systemMessages, ...keptNonSystem]

    // Merge consecutive failures after windowing
    return mergeConsecutiveFailures(windowed)
}
