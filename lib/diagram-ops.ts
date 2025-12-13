import {
    ensureChildElement,
    escapeXmlAttrValue,
    findMxCell,
    findMxCellOrThrow,
    parseXml,
    serializeXml,
    upsertMxPoint,
} from "./diagram-ops-utils"

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
                const nextValue = shouldEscape
                    ? escapeXmlAttrValue(op.value)
                    : op.value
                cell.setAttribute("value", nextValue)
                continue
            }

            if (op.type === "updateCell") {
                const cell = findMxCellOrThrow(doc, op.id)
                if (op.value !== undefined) {
                    cell.setAttribute("value", escapeXmlAttrValue(op.value))
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
                const root = doc.querySelector("root")
                if (!root) throw new Error("Invalid XML: missing <root>")

                const newCell = doc.createElement("mxCell")
                newCell.setAttribute("id", op.id)
                newCell.setAttribute("parent", op.parent)
                if (op.value)
                    newCell.setAttribute("value", escapeXmlAttrValue(op.value))
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
