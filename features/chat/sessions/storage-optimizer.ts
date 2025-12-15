import LZString from "lz-string"
import type { ConversationPayload } from "@/features/chat/sessions/storage"

// 配置参数
const MAX_MESSAGES = 100 // 最多保留 100 条消息
const MAX_SNAPSHOTS = 20 // 最多保留 20 个快照
const MAX_DIAGRAM_VERSIONS = 50 // 最多保留 50 个图表版本
const MAX_TOOL_RESULT_LENGTH = 5000 // 工具调用结果最大长度

/**
 * 压缩 XML 数据
 */
export function compressXML(xml: string): string {
    if (!xml) return xml
    try {
        return LZString.compressToUTF16(xml)
    } catch {
        return xml // 压缩失败返回原始数据
    }
}

/**
 * 解压 XML 数据
 */
export function decompressXML(compressed: string): string {
    if (!compressed) return compressed
    try {
        const decompressed = LZString.decompressFromUTF16(compressed)
        return decompressed || compressed // 如果解压失败，返回原始数据
    } catch {
        return compressed
    }
}

/**
 * 智能解压：尝试解压，如果失败或结果无效则返回原值
 *
 * 逻辑：
 * 1. 如果字符串以 '<' 开头（明显是 XML），直接返回（未压缩）
 * 2. 尝试解压，如果成功且结果有效，返回解压结果
 * 3. 否则返回原值
 */
export function smartDecompress(str: string): string {
    if (!str) return str

    // 快速检测：如果以 '<' 开头，很可能是未压缩的 XML
    if (str.trimStart().startsWith("<")) {
        return str
    }

    // 尝试解压
    try {
        const decompressed = LZString.decompressFromUTF16(str)
        // 如果解压成功且结果非空且不同于原值，说明确实是压缩数据
        if (decompressed && decompressed.length > 0 && decompressed !== str) {
            return decompressed
        }
    } catch {
        // 解压失败，返回原值
    }

    // 解压失败或结果无效，返回原值
    return str
}

/**
 * 截断大型工具调用结果
 */
function truncateToolResults(messages: any[]): any[] {
    return messages.map((msg) => {
        if (msg.role === "assistant" && Array.isArray(msg.toolInvocations)) {
            return {
                ...msg,
                toolInvocations: msg.toolInvocations.map((inv: any) => {
                    if (
                        inv.state === "result" &&
                        typeof inv.result === "string" &&
                        inv.result.length > MAX_TOOL_RESULT_LENGTH
                    ) {
                        return {
                            ...inv,
                            result: `${inv.result.slice(0, MAX_TOOL_RESULT_LENGTH)}...\n[输出过大已截断，原长度: ${inv.result.length} 字符]`,
                        }
                    }
                    return inv
                }),
            }
        }
        return msg
    })
}

/**
 * 优化会话数据以减少存储空间
 */
export function optimizePayload(
    payload: ConversationPayload,
): ConversationPayload {
    const optimized = { ...payload }

    // 1. 限制消息数量（保留最近的）
    if (
        Array.isArray(optimized.messages) &&
        optimized.messages.length > MAX_MESSAGES
    ) {
        optimized.messages = optimized.messages.slice(-MAX_MESSAGES)
    }

    // 2. 截断大型工具调用结果
    if (Array.isArray(optimized.messages)) {
        optimized.messages = truncateToolResults(optimized.messages)
    }

    // 3. 限制快照数量
    if (
        Array.isArray(optimized.snapshots) &&
        optimized.snapshots.length > MAX_SNAPSHOTS
    ) {
        optimized.snapshots = optimized.snapshots.slice(-MAX_SNAPSHOTS)
    }

    // 4. 限制图表版本数量
    if (
        Array.isArray(optimized.diagramVersions) &&
        optimized.diagramVersions.length > MAX_DIAGRAM_VERSIONS
    ) {
        optimized.diagramVersions = optimized.diagramVersions.slice(
            -MAX_DIAGRAM_VERSIONS,
        )
    }

    // 5. 压缩主 XML
    if (optimized.xml) {
        optimized.xml = compressXML(optimized.xml)
    }

    // 6. 压缩快照中的 XML
    if (Array.isArray(optimized.snapshots)) {
        optimized.snapshots = optimized.snapshots.map(([index, xml]) => [
            index,
            compressXML(xml),
        ])
    }

    // 7. 压缩图表版本中的 XML
    if (Array.isArray(optimized.diagramVersions)) {
        optimized.diagramVersions = optimized.diagramVersions.map((ver) => ({
            ...ver,
            xml: compressXML(ver.xml),
        }))
    }

    return optimized
}

/**
 * 解压会话数据
 */
export function deoptimizePayload(
    payload: ConversationPayload,
): ConversationPayload {
    const deoptimized = { ...payload }

    // 解压主 XML
    if (deoptimized.xml) {
        deoptimized.xml = smartDecompress(deoptimized.xml)
    }

    // 解压快照中的 XML
    if (Array.isArray(deoptimized.snapshots)) {
        deoptimized.snapshots = deoptimized.snapshots.map(([index, xml]) => [
            index,
            smartDecompress(xml),
        ])
    }

    // 解压图表版本中的 XML
    if (Array.isArray(deoptimized.diagramVersions)) {
        deoptimized.diagramVersions = deoptimized.diagramVersions.map(
            (ver) => ({
                ...ver,
                xml: smartDecompress(ver.xml),
            }),
        )
    }

    return deoptimized
}

/**
 * 估算对象的存储大小（字节）
 */
export function estimateStorageSize(obj: any): number {
    try {
        const json = JSON.stringify(obj)
        // UTF-16 编码，每个字符 2 字节
        return json.length * 2
    } catch {
        return 0
    }
}

/**
 * 格式化存储大小为人类可读格式
 */
export function formatStorageSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
