import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import type { DiagramVersion } from "@/features/chat/sessions/storage"

// 配置常量
export const DIAGRAM_VERSION_CONFIG = {
    MAX_VERSIONS: 50,
    MAX_XML_SIZE: 5_000_000, // 5MB
} as const

/**
 * 规范化游标值，确保在有效范围内
 */
export function normalizeCursor(cursor: number, length: number): number {
    return Math.min(Math.max(cursor, -1), length - 1)
}

/**
 * 生成版本 ID
 */
function generateVersionId(): string {
    return `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface DiagramVersionState {
    versions: DiagramVersion[]
    cursor: number
    marks: Record<number, number>
}

export interface UseDiagramVersionHistoryOptions {
    onDisplayChart: (xml: string, skipValidation?: boolean) => string | null
    chartXMLRef: React.MutableRefObject<string>
    onVersionsChange?: (state: DiagramVersionState) => void
}

/**
 * 图表版本历史管理 Hook
 * 提供 undo/redo、版本标记、版本恢复等功能
 */
export function useDiagramVersionHistory({
    onDisplayChart,
    chartXMLRef,
    onVersionsChange,
}: UseDiagramVersionHistoryOptions) {
    // Refs 用于存储实际数据，避免 useCallback 依赖问题
    const versionsRef = useRef<DiagramVersion[]>([])
    const cursorRef = useRef<number>(-1)
    const marksRef = useRef<Record<number, number>>({})

    // State 用于触发重渲染
    const [versions, setVersions] = useState<DiagramVersion[]>([])
    const [cursor, setCursor] = useState<number>(-1)

    // 同步更新 refs 和 state
    const updateState = useCallback(
        (
            newVersions: DiagramVersion[],
            newCursor: number,
            newMarks?: Record<number, number>,
        ) => {
            versionsRef.current = newVersions
            cursorRef.current = newCursor
            if (newMarks !== undefined) {
                marksRef.current = newMarks
            }
            setVersions(newVersions)
            setCursor(newCursor)
            onVersionsChange?.({
                versions: newVersions,
                cursor: newCursor,
                marks: marksRef.current,
            })
        },
        [onVersionsChange],
    )

    /**
     * 恢复版本状态（用于加载会话时）
     */
    const restoreState = useCallback((state: DiagramVersionState) => {
        const normalizedCursor = normalizeCursor(
            state.cursor,
            state.versions.length,
        )
        versionsRef.current = state.versions
        cursorRef.current = normalizedCursor
        marksRef.current = state.marks
        setVersions(state.versions)
        setCursor(normalizedCursor)
    }, [])

    /**
     * 清空版本历史
     */
    const clearHistory = useCallback(() => {
        updateState([], -1, {})
    }, [updateState])

    /**
     * 获取当前状态快照（用于持久化）
     */
    const getStateSnapshot = useCallback((): DiagramVersionState => {
        return {
            versions: versionsRef.current,
            cursor: cursorRef.current,
            marks: marksRef.current,
        }
    }, [])

    /**
     * 为消息添加图表版本
     * 如果 XML 与当前版本不同，创建新版本并关联到消息
     */
    const ensureDiagramVersionForMessage = useCallback(
        (messageIndex: number, xml: string, note?: string): string => {
            const nextXml = String(xml ?? "")

            // 检查 XML 大小
            if (nextXml.length > DIAGRAM_VERSION_CONFIG.MAX_XML_SIZE) {
                console.error(
                    `[diagram] XML too large: ${nextXml.length} bytes (max ${DIAGRAM_VERSION_CONFIG.MAX_XML_SIZE})`,
                )
                toast.error("图表过大，无法保存历史版本")
                return nextXml
            }

            const currentVersions = versionsRef.current
            const currentCursor = cursorRef.current

            const currentXml =
                currentCursor >= 0 && currentCursor < currentVersions.length
                    ? currentVersions[currentCursor]?.xml
                    : ""

            let nextIndex = currentCursor

            if (nextXml && nextXml !== currentXml) {
                // 截断游标之后的版本（如果在历史中间）
                let truncated =
                    currentCursor >= 0 &&
                    currentCursor < currentVersions.length - 1
                        ? currentVersions.slice(0, currentCursor + 1)
                        : currentVersions.slice()

                // 限制版本数量（FIFO）
                if (truncated.length >= DIAGRAM_VERSION_CONFIG.MAX_VERSIONS) {
                    const removeCount =
                        truncated.length -
                        DIAGRAM_VERSION_CONFIG.MAX_VERSIONS +
                        1
                    truncated = truncated.slice(removeCount)

                    // 调整 marks 中的索引
                    const newMarks: Record<number, number> = {}
                    for (const [k, v] of Object.entries(marksRef.current)) {
                        const mi = Number(k)
                        if (typeof v === "number" && v >= removeCount) {
                            newMarks[mi] = v - removeCount
                        }
                    }
                    marksRef.current = newMarks
                }

                // 创建新版本
                const entry: DiagramVersion = {
                    id: generateVersionId(),
                    createdAt: Date.now(),
                    xml: nextXml,
                    note,
                }
                truncated.push(entry)
                nextIndex = truncated.length - 1

                updateState(truncated, nextIndex)
            }

            // 更新消息与版本的关联
            marksRef.current = {
                ...marksRef.current,
                [messageIndex]: nextIndex,
            }

            onVersionsChange?.({
                versions: versionsRef.current,
                cursor: cursorRef.current,
                marks: marksRef.current,
            })

            return nextXml
        },
        [updateState, onVersionsChange],
    )

    /**
     * 追加图表版本（不关联消息）
     */
    const appendDiagramVersion = useCallback(
        (xml: string, note?: string) => {
            const nextXml = String(xml ?? "")
            if (!nextXml) return

            if (nextXml.length > DIAGRAM_VERSION_CONFIG.MAX_XML_SIZE) {
                console.error(
                    `[diagram] XML too large: ${nextXml.length} bytes (max ${DIAGRAM_VERSION_CONFIG.MAX_XML_SIZE})`,
                )
                toast.error("图表过大，无法保存历史版本")
                return
            }

            const currentVersions = versionsRef.current
            const currentCursor = cursorRef.current

            const currentXml =
                currentCursor >= 0 && currentCursor < currentVersions.length
                    ? currentVersions[currentCursor]?.xml
                    : ""

            if (nextXml === currentXml) return

            let truncated =
                currentCursor >= 0 && currentCursor < currentVersions.length - 1
                    ? currentVersions.slice(0, currentCursor + 1)
                    : currentVersions.slice()

            if (truncated.length >= DIAGRAM_VERSION_CONFIG.MAX_VERSIONS) {
                truncated = truncated.slice(
                    truncated.length - DIAGRAM_VERSION_CONFIG.MAX_VERSIONS + 1,
                )
            }

            const entry: DiagramVersion = {
                id: generateVersionId(),
                createdAt: Date.now(),
                xml: nextXml,
                note,
            }
            truncated.push(entry)

            updateState(truncated, truncated.length - 1)
        },
        [updateState],
    )

    /**
     * 获取消息关联的图表 XML
     */
    const getDiagramXmlForMessage = useCallback((messageIndex: number) => {
        const idx = marksRef.current[messageIndex]
        const currentVersions = versionsRef.current
        if (typeof idx !== "number") return ""
        return idx >= 0 && idx < currentVersions.length
            ? currentVersions[idx]?.xml || ""
            : ""
    }, [])

    /**
     * 获取消息关联的版本索引
     */
    const getDiagramVersionIndexForMessage = useCallback(
        (messageIndex: number) => {
            const idx = marksRef.current[messageIndex]
            return typeof idx === "number" ? idx : -1
        },
        [],
    )

    /**
     * 获取指定消息之前最近的图表 XML
     */
    const getPreviousDiagramXmlBeforeMessage = useCallback(
        (beforeIndex: number) => {
            const marks = marksRef.current
            const keys = Object.keys(marks)
                .map((k) => Number(k))
                .filter((k) => Number.isFinite(k) && k < beforeIndex)
                .sort((a, b) => b - a)
            if (keys.length === 0) return ""
            const idx = marks[keys[0]]
            const currentVersions = versionsRef.current
            return idx >= 0 && idx < currentVersions.length
                ? currentVersions[idx]?.xml || ""
                : ""
        },
        [],
    )

    /**
     * 恢复到指定版本索引
     */
    const restoreDiagramVersionIndex = useCallback(
        (index: number) => {
            const currentVersions = versionsRef.current
            const nextIndex = normalizeCursor(index, currentVersions.length)
            const entry = currentVersions[nextIndex]
            if (!entry) return

            onDisplayChart(entry.xml, true)
            chartXMLRef.current = entry.xml
            cursorRef.current = nextIndex
            setCursor(nextIndex)

            onVersionsChange?.({
                versions: versionsRef.current,
                cursor: nextIndex,
                marks: marksRef.current,
            })
        },
        [onDisplayChart, chartXMLRef, onVersionsChange],
    )

    /**
     * 截断指定消息之后的版本
     */
    const truncateDiagramVersionsAfterMessage = useCallback(
        (messageIndex: number) => {
            const markIdx = marksRef.current[messageIndex]
            if (typeof markIdx !== "number") return

            const currentVersions = versionsRef.current
            const nextVersions =
                markIdx >= 0 && markIdx < currentVersions.length
                    ? currentVersions.slice(0, markIdx + 1)
                    : currentVersions.slice()

            // 清理超出范围的 marks
            const nextMarks: Record<number, number> = {}
            for (const [k, v] of Object.entries(marksRef.current)) {
                const mi = Number(k)
                if (!Number.isFinite(mi)) continue
                if (
                    mi <= messageIndex &&
                    typeof v === "number" &&
                    v <= markIdx
                ) {
                    nextMarks[mi] = v
                }
            }

            const nextCursor = normalizeCursor(
                Math.min(cursorRef.current, markIdx),
                nextVersions.length,
            )

            updateState(nextVersions, nextCursor, nextMarks)
        },
        [updateState],
    )

    // 计算 undo/redo 可用性
    const canUndo = cursor > 0
    const canRedo = cursor >= 0 && cursor < versions.length - 1

    /**
     * 撤销到上一个版本
     */
    const undoDiagram = useCallback(() => {
        if (!canUndo) return
        restoreDiagramVersionIndex(cursor - 1)
    }, [canUndo, cursor, restoreDiagramVersionIndex])

    /**
     * 重做到下一个版本
     */
    const redoDiagram = useCallback(() => {
        if (!canRedo) return
        restoreDiagramVersionIndex(cursor + 1)
    }, [canRedo, cursor, restoreDiagramVersionIndex])

    return {
        // State
        versions,
        cursor,
        canUndo,
        canRedo,

        // Refs (for direct access)
        versionsRef,
        cursorRef,
        marksRef,

        // Actions
        restoreState,
        clearHistory,
        getStateSnapshot,
        ensureDiagramVersionForMessage,
        appendDiagramVersion,
        getDiagramXmlForMessage,
        getDiagramVersionIndexForMessage,
        getPreviousDiagramXmlBeforeMessage,
        restoreDiagramVersionIndex,
        truncateDiagramVersionsAfterMessage,
        undoDiagram,
        redoDiagram,
    }
}
