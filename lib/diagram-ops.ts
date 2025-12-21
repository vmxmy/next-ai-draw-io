import type { DrawIOComponent } from "./components"
import { componentToCellXml } from "./components"
import {
    ensureChildElement,
    escapeXmlAttrValue,
    findMxCell,
    findMxCellOrThrow,
    findRootElementOrThrow,
    parseXml,
    serializeXml,
    upsertMxPoint,
} from "./diagram-ops-utils"

/**
 * Parse style string to key-value object
 */
function parseStyleString(style: string): Record<string, string> {
    const props: Record<string, string> = {}
    style.split(";").forEach((part) => {
        const eqIndex = part.indexOf("=")
        if (eqIndex > 0) {
            const key = part.substring(0, eqIndex).trim()
            const val = part.substring(eqIndex + 1).trim()
            props[key] = val
        } else if (part.trim()) {
            // Handle style flags like "rounded" without value
            props[part.trim()] = "1"
        }
    })
    return props
}

export type DiagramEditOp =
    | {
          type: "setEdgePoints"
          id: string
          sourcePoint?: { x: number; y: number }
          targetPoint?: { x: number; y: number }
      }
    | {
          type: "setCellValue"
          id: string
          value: string
          escape?: boolean
      }
    | {
          type: "updateCell"
          id: string
          value?: string
          style?: string
          geometry?: { x?: number; y?: number; width?: number; height?: number }
      }
    | {
          type: "addCell"
          id: string
          parent: string
          value?: string
          style?: string
          vertex?: boolean
          edge?: boolean
          source?: string
          target?: string
          geometry?: { x?: number; y?: number; width?: number; height?: number }
      }
    | {
          type: "deleteCell"
          id: string
      }
    | {
          type: "addComponent"
          component: DrawIOComponent
      }
    | {
          type: "updateComponent"
          id: string
          updates: {
              position?: { x?: number; y?: number }
              size?: { width?: number; height?: number }
              label?: string
              text?: string
              title?: string
              fill?: string
              stroke?: string
              strokeWidth?: number
              opacity?: number
              fontSize?: number
              fontColor?: string
              shadow?: boolean
              dashed?: boolean
          }
      }
    | {
          type: "connectComponents"
          id: string
          source: string
          target: string
          label?: string
          style?: {
              lineType?: "straight" | "orthogonal" | "curved"
              startArrow?:
                  | "none"
                  | "classic"
                  | "block"
                  | "open"
                  | "diamond"
                  | "oval"
              endArrow?:
                  | "none"
                  | "classic"
                  | "block"
                  | "open"
                  | "diamond"
                  | "oval"
              dashed?: boolean
              stroke?: string
              strokeWidth?: number
          }
      }

/**
 * Apply structured edit operations to a draw.io XML string.
 * Uses robust DOM manipulation instead of string search-replace.
 */
export function applyDiagramOps(
    xml: string,
    ops: DiagramEditOp[],
): { xml: string } | { error: string } {
    try {
        const doc = parseXml(xml)

        const hasHtmlTag = (value: string): boolean => {
            // 非严格 HTML 检测：用于判断“用户意图是 HTML 文本”
            // draw.io 常见：<b> <br> <div> <span ...>
            return /<\/?[a-zA-Z][\w:-]*(\s+[^>]+)?>/.test(value)
        }

        const decodeCommonEntitiesOnce = (value: string): string => {
            // 防止模型输出 &lt;b&gt; 这类“已转义 HTML”，再被 escapeXmlAttrValue 二次转义成 &amp;lt;...
            // 这里做一次保守反转义，仅处理最常见的 4 个实体。
            return value
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("&quot;", '"')
                .replaceAll("&amp;", "&")
        }

        const ensureHtmlEnabledStyle = (cell: Element): void => {
            const style = cell.getAttribute("style") || ""
            if (/(\b|;)html=1\b/.test(style)) return
            const next =
                style.endsWith(";") || style.length === 0
                    ? `${style}html=1;`
                    : `${style};html=1;`
            cell.setAttribute("style", next)
        }

        for (const op of ops) {
            if (!op || typeof op !== "object") continue

            if (op.type === "setEdgePoints") {
                const cell = findMxCellOrThrow(doc, op.id)
                if (cell.getAttribute("edge") !== "1") {
                    throw new Error(`mxCell id="${op.id}" is not an edge`)
                }

                const geometry = ensureChildElement(
                    doc,
                    cell,
                    "mxGeometry",
                    (g) => g.getAttribute("as") === "geometry",
                )
                if (!geometry.getAttribute("relative")) {
                    geometry.setAttribute("relative", "1")
                }

                if (op.sourcePoint) {
                    upsertMxPoint(doc, geometry, "sourcePoint", op.sourcePoint)
                }
                if (op.targetPoint) {
                    upsertMxPoint(doc, geometry, "targetPoint", op.targetPoint)
                }
                continue
            }

            if (op.type === "setCellValue") {
                const cell = findMxCellOrThrow(doc, op.id)
                const shouldEscape = op.escape !== false
                const rawValue = String(op.value ?? "")

                const style = cell.getAttribute("style") || ""
                const htmlEnabled = /(\b|;)html=1\b/.test(style)
                const htmlIntent =
                    htmlEnabled ||
                    hasHtmlTag(rawValue) ||
                    rawValue.includes("&lt;")

                if (htmlIntent) {
                    // 确保可渲染 HTML（否则标签会作为字符串显示）
                    ensureHtmlEnabledStyle(cell)
                }

                // 统一换行：HTML 模式用 <br>
                const normalizedValue = htmlIntent
                    ? rawValue.replaceAll("\r\n", "\n").replaceAll("\n", "<br>")
                    : rawValue

                // 如果用户/模型给的是“已转义 HTML”，先反转义一次再按 XML attribute 规则转义，
                // 避免出现 &amp;lt;b&amp;gt; 导致最终显示为字面量。
                const valueForEscape = htmlIntent
                    ? decodeCommonEntitiesOnce(normalizedValue)
                    : normalizedValue

                const nextValue = shouldEscape
                    ? escapeXmlAttrValue(valueForEscape)
                    : valueForEscape
                cell.setAttribute("value", nextValue)
                continue
            }

            if (op.type === "updateCell") {
                const cell = findMxCellOrThrow(doc, op.id)
                if (op.value !== undefined) {
                    const rawValue = String(op.value)
                    const style = cell.getAttribute("style") || ""
                    const htmlEnabled = /(\b|;)html=1\b/.test(style)
                    const htmlIntent =
                        htmlEnabled ||
                        hasHtmlTag(rawValue) ||
                        rawValue.includes("&lt;")

                    if (htmlIntent) {
                        ensureHtmlEnabledStyle(cell)
                    }

                    // 统一换行：HTML 模式用 <br>
                    const normalizedValue = htmlIntent
                        ? rawValue
                              .replaceAll("\r\n", "\n")
                              .replaceAll("\n", "<br>")
                        : rawValue

                    // 如果是已转义 HTML，先反转义再转义
                    const valueForEscape = htmlIntent
                        ? decodeCommonEntitiesOnce(normalizedValue)
                        : normalizedValue

                    cell.setAttribute(
                        "value",
                        escapeXmlAttrValue(valueForEscape),
                    )
                }
                if (op.style !== undefined) {
                    cell.setAttribute("style", op.style)
                }
                if (op.geometry) {
                    const geometry = ensureChildElement(
                        doc,
                        cell,
                        "mxGeometry",
                        (g) => g.getAttribute("as") === "geometry",
                    )
                    if (op.geometry.x !== undefined)
                        geometry.setAttribute("x", String(op.geometry.x))
                    if (op.geometry.y !== undefined)
                        geometry.setAttribute("y", String(op.geometry.y))
                    if (op.geometry.width !== undefined)
                        geometry.setAttribute(
                            "width",
                            String(op.geometry.width),
                        )
                    if (op.geometry.height !== undefined)
                        geometry.setAttribute(
                            "height",
                            String(op.geometry.height),
                        )
                }
                continue
            }

            if (op.type === "addCell") {
                if (findMxCell(doc, op.id)) {
                    throw new Error(`Cell id="${op.id}" already exists`)
                }
                const _parent = findMxCellOrThrow(doc, op.parent)

                // Locate root (to append cell to correct location in DOM if needed, usually children of root)
                // In flat draw.io model, all cells are children of <root>
                // We typically insert new cell at the end of <root>
                const root = findRootElementOrThrow(doc)

                const newCell = doc.createElement("mxCell")
                newCell.setAttribute("id", op.id)
                newCell.setAttribute("parent", op.parent)
                if (op.value) {
                    const rawValue = String(op.value)
                    const htmlIntent =
                        hasHtmlTag(rawValue) || rawValue.includes("&lt;")

                    // 统一换行：HTML 模式用 <br>
                    const normalizedValue = htmlIntent
                        ? rawValue
                              .replaceAll("\r\n", "\n")
                              .replaceAll("\n", "<br>")
                        : rawValue

                    // 如果是已转义 HTML，先反转义再转义
                    const valueForEscape = htmlIntent
                        ? decodeCommonEntitiesOnce(normalizedValue)
                        : normalizedValue

                    newCell.setAttribute(
                        "value",
                        escapeXmlAttrValue(valueForEscape),
                    )

                    // 如果有 HTML 意图，确保 style 包含 html=1
                    if (htmlIntent && op.style) {
                        const style = op.style
                        if (!/(\b|;)html=1\b/.test(style)) {
                            op.style = style.endsWith(";")
                                ? `${style}html=1;`
                                : `${style};html=1;`
                        }
                    } else if (htmlIntent && !op.style) {
                        op.style = "html=1;"
                    }
                }
                if (op.style) newCell.setAttribute("style", op.style)
                if (op.vertex) newCell.setAttribute("vertex", "1")
                if (op.edge) {
                    newCell.setAttribute("edge", "1")
                    if (op.source) newCell.setAttribute("source", op.source)
                    if (op.target) newCell.setAttribute("target", op.target)
                }

                if (op.geometry) {
                    const geo = doc.createElement("mxGeometry")
                    geo.setAttribute("as", "geometry")
                    if (op.geometry.x !== undefined)
                        geo.setAttribute("x", String(op.geometry.x))
                    if (op.geometry.y !== undefined)
                        geo.setAttribute("y", String(op.geometry.y))
                    if (op.geometry.width !== undefined)
                        geo.setAttribute("width", String(op.geometry.width))
                    if (op.geometry.height !== undefined)
                        geo.setAttribute("height", String(op.geometry.height))
                    if (op.edge) geo.setAttribute("relative", "1")

                    newCell.appendChild(geo)
                }

                root.appendChild(newCell)
                continue
            }

            if (op.type === "deleteCell") {
                const cell = findMxCell(doc, op.id)
                if (cell?.parentNode) {
                    cell.parentNode.removeChild(cell)
                }
                continue
            }

            if (op.type === "addComponent") {
                const component = op.component
                if (findMxCell(doc, component.id)) {
                    throw new Error(`Cell id="${component.id}" already exists`)
                }

                const root = findRootElementOrThrow(doc)

                // Convert component to mxCell XML string
                const cellXml = componentToCellXml(component)

                // Parse the generated XML and append to root
                const tempDoc = parseXml(
                    `<mxGraphModel><root>${cellXml}</root></mxGraphModel>`,
                )
                // Use getElementsByTagName for Node.js compatibility (xmldom doesn't support querySelector)
                const cells = tempDoc.getElementsByTagName("mxCell")
                if (cells.length > 0) {
                    // Import and append the new cell
                    const importedCell = doc.importNode(cells[0], true)
                    root.appendChild(importedCell)
                }
                continue
            }

            if (op.type === "updateComponent") {
                const cell = findMxCellOrThrow(doc, op.id)
                const updates = op.updates

                // Update position
                if (updates.position) {
                    const geometry = ensureChildElement(
                        doc,
                        cell,
                        "mxGeometry",
                        (g) => g.getAttribute("as") === "geometry",
                    )
                    if (updates.position.x !== undefined)
                        geometry.setAttribute("x", String(updates.position.x))
                    if (updates.position.y !== undefined)
                        geometry.setAttribute("y", String(updates.position.y))
                }

                // Update size
                if (updates.size) {
                    const geometry = ensureChildElement(
                        doc,
                        cell,
                        "mxGeometry",
                        (g) => g.getAttribute("as") === "geometry",
                    )
                    if (updates.size.width !== undefined)
                        geometry.setAttribute(
                            "width",
                            String(updates.size.width),
                        )
                    if (updates.size.height !== undefined)
                        geometry.setAttribute(
                            "height",
                            String(updates.size.height),
                        )
                }

                // Update label (for shapes with label property)
                if ("label" in updates && updates.label !== undefined) {
                    cell.setAttribute(
                        "value",
                        escapeXmlAttrValue(String(updates.label)),
                    )
                }

                // Update text (for Text components)
                if ("text" in updates && updates.text !== undefined) {
                    cell.setAttribute(
                        "value",
                        escapeXmlAttrValue(String(updates.text)),
                    )
                }

                // Update title (for Swimlane/Card components)
                if ("title" in updates && updates.title !== undefined) {
                    cell.setAttribute(
                        "value",
                        escapeXmlAttrValue(String(updates.title)),
                    )
                }

                // Update style properties
                const style = cell.getAttribute("style") || ""
                const styleProps = parseStyleString(style)

                if ("fill" in updates && updates.fill !== undefined) {
                    styleProps.fillColor = updates.fill
                }
                if ("stroke" in updates && updates.stroke !== undefined) {
                    styleProps.strokeColor = updates.stroke
                }
                if (
                    "strokeWidth" in updates &&
                    updates.strokeWidth !== undefined
                ) {
                    styleProps.strokeWidth = String(updates.strokeWidth)
                }
                if ("opacity" in updates && updates.opacity !== undefined) {
                    styleProps.opacity = String(updates.opacity)
                }
                if ("fontSize" in updates && updates.fontSize !== undefined) {
                    styleProps.fontSize = String(updates.fontSize)
                }
                if ("fontColor" in updates && updates.fontColor !== undefined) {
                    styleProps.fontColor = updates.fontColor
                }
                if ("shadow" in updates && updates.shadow !== undefined) {
                    styleProps.shadow = updates.shadow ? "1" : "0"
                }
                if ("dashed" in updates && updates.dashed !== undefined) {
                    styleProps.dashed = updates.dashed ? "1" : "0"
                }

                // Rebuild style string
                const newStyle = Object.entries(styleProps)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(";")
                cell.setAttribute("style", newStyle + ";")
                continue
            }

            if (op.type === "connectComponents") {
                // Verify source and target exist
                const sourceCell = findMxCell(doc, op.source)
                const targetCell = findMxCell(doc, op.target)
                if (!sourceCell) {
                    throw new Error(`Source component "${op.source}" not found`)
                }
                if (!targetCell) {
                    throw new Error(`Target component "${op.target}" not found`)
                }
                if (findMxCell(doc, op.id)) {
                    throw new Error(`Connector id="${op.id}" already exists`)
                }

                const root = findRootElementOrThrow(doc)

                // Build edge style
                const styleParts: string[] = ["html=1"]

                // Line type
                const lineType = op.style?.lineType || "orthogonal"
                if (lineType === "orthogonal") {
                    styleParts.push("edgeStyle=orthogonalEdgeStyle")
                } else if (lineType === "curved") {
                    styleParts.push("curved=1")
                }
                // straight is default, no special style needed

                // Arrows
                const endArrow = op.style?.endArrow || "classic"
                styleParts.push(`endArrow=${endArrow}`)
                if (op.style?.startArrow && op.style.startArrow !== "none") {
                    styleParts.push(`startArrow=${op.style.startArrow}`)
                }

                // Other styles
                if (op.style?.dashed) {
                    styleParts.push("dashed=1")
                }
                if (op.style?.stroke) {
                    styleParts.push(`strokeColor=${op.style.stroke}`)
                }
                if (op.style?.strokeWidth) {
                    styleParts.push(`strokeWidth=${op.style.strokeWidth}`)
                }

                const edgeStyle = styleParts.join(";") + ";"

                // Create edge element
                const newEdge = doc.createElement("mxCell")
                newEdge.setAttribute("id", op.id)
                newEdge.setAttribute("parent", "1")
                newEdge.setAttribute("edge", "1")
                newEdge.setAttribute("source", op.source)
                newEdge.setAttribute("target", op.target)
                newEdge.setAttribute("style", edgeStyle)
                if (op.label) {
                    newEdge.setAttribute("value", escapeXmlAttrValue(op.label))
                }

                // Add geometry
                const geo = doc.createElement("mxGeometry")
                geo.setAttribute("relative", "1")
                geo.setAttribute("as", "geometry")
                newEdge.appendChild(geo)

                root.appendChild(newEdge)
                continue
            }

            return { error: `Unsupported op type: ${(op as any).type}` }
        }

        return { xml: serializeXml(doc) }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg === "XML_PARSE_ERROR") {
            return {
                error: "Current diagram XML is invalid (XML_PARSE_ERROR). Use display_diagram to regenerate.",
            }
        }
        return { error: `Structured edit failed: ${msg}` }
    }
}
