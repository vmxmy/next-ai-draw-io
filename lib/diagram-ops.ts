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

function escapeXmlAttrValue(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function parseXml(xml: string): Document {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "text/xml")
    const parseError = doc.querySelector("parsererror")
    if (parseError) {
        throw new Error("XML_PARSE_ERROR")
    }
    return doc
}

function serializeXml(doc: Document): string {
    const serializer = new XMLSerializer()
    return serializer.serializeToString(doc)
}

function findMxCell(doc: Document, id: string): Element | null {
    const all = doc.querySelectorAll("mxCell")
    for (const cell of Array.from(all)) {
        if (cell.getAttribute("id") === id) return cell
    }
    return null
}

function ensureChildElement(
    doc: Document,
    parent: Element,
    tagName: string,
    predicate?: (el: Element) => boolean,
): Element {
    const existing = Array.from(parent.children).find(
        (c) => c.tagName === tagName && (!predicate || predicate(c)),
    )
    if (existing) return existing
    const el = doc.createElement(tagName)
    parent.appendChild(el)
    return el
}

function upsertMxPoint(
    doc: Document,
    geometry: Element,
    asValue: "sourcePoint" | "targetPoint",
    point: { x: number; y: number },
): void {
    const existing = Array.from(geometry.children).find(
        (c) => c.tagName === "mxPoint" && c.getAttribute("as") === asValue,
    )
    const el = existing ?? doc.createElement("mxPoint")
    el.setAttribute("x", String(point.x))
    el.setAttribute("y", String(point.y))
    el.setAttribute("as", asValue)
    if (!existing) {
        geometry.appendChild(el)
    }
}

/**
 * Apply structured edit operations to a draw.io XML string.
 *
 * Assumptions (YAGNI/KISS):
 * - Input is a full draw.io fragment that DOMParser can parse (e.g. <mxGraphModel>...).
 * - Only implements the ops needed for high-frequency edits first.
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
                const cell = findMxCell(doc, op.id)
                if (!cell) {
                    return { error: `找不到 mxCell id="${op.id}"` }
                }
                if (cell.getAttribute("edge") !== "1") {
                    return {
                        error: `mxCell id="${op.id}" 不是 edge（缺少 edge="1"）`,
                    }
                }

                const geometry = ensureChildElement(
                    doc,
                    cell,
                    "mxGeometry",
                    (g) => g.getAttribute("as") === "geometry",
                )
                if (!geometry.getAttribute("as")) {
                    geometry.setAttribute("as", "geometry")
                }
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
                const cell = findMxCell(doc, op.id)
                if (!cell) {
                    return { error: `找不到 mxCell id="${op.id}"` }
                }
                const shouldEscape = op.escape !== false
                const nextValue = shouldEscape
                    ? escapeXmlAttrValue(op.value)
                    : op.value
                cell.setAttribute("value", nextValue)
                continue
            }

            return { error: `不支持的操作类型: ${(op as any).type}` }
        }

        return { xml: serializeXml(doc) }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg === "XML_PARSE_ERROR") {
            return {
                error: "当前 diagram XML 无法解析（XML_PARSE_ERROR），请先用 display_diagram 重新生成一份可解析的完整 XML。",
            }
        }
        return { error: `结构化编辑失败: ${msg}` }
    }
}
