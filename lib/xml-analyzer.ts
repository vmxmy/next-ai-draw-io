import { DOMParser } from "@xmldom/xmldom"

interface MxCellInfo {
    id: string
    value?: string
    parent?: string
    style?: string
    vertex?: boolean
    edge?: boolean
    source?: string
    target?: string
    geometry?: {
        x?: string
        y?: string
        width?: string
        height?: string
    }
}

const MAX_CELLS_ANALYZED = 20000
const MAX_LISTED_NODES = 80
const MAX_LISTED_EDGES = 80

// 避免与 lib.dom 的 Document 类型冲突，返回 xmldom 的文档对象
function parseXmlSafe(xml: string): any | null {
    try {
        // xmldom 的 errorHandler 类型在不同版本上不一致，这里保持最小配置
        const parser = new DOMParser()
        return parser.parseFromString(xml, "text/xml") as any
    } catch {
        return null
    }
}

function getAttr(el: Element, name: string): string | undefined {
    const v = el.getAttribute(name)
    return v === null ? undefined : v
}

function extractCells(doc: any): MxCellInfo[] {
    const cellEls = Array.from(doc.getElementsByTagName("mxCell")) as Element[]
    const cells: MxCellInfo[] = []

    for (let i = 0; i < cellEls.length && i < MAX_CELLS_ANALYZED; i++) {
        const el = cellEls[i]
        const id = getAttr(el, "id")
        if (!id) continue

        const info: MxCellInfo = {
            id,
            value: getAttr(el, "value"),
            parent: getAttr(el, "parent"),
            style: getAttr(el, "style"),
            vertex: getAttr(el, "vertex") === "1",
            edge: getAttr(el, "edge") === "1",
            source: getAttr(el, "source"),
            target: getAttr(el, "target"),
        }

        const geomEl = el.getElementsByTagName("mxGeometry")[0]
        if (geomEl) {
            info.geometry = {
                x: getAttr(geomEl, "x"),
                y: getAttr(geomEl, "y"),
                width: getAttr(geomEl, "width"),
                height: getAttr(geomEl, "height"),
            }
        }

        cells.push(info)
    }

    return cells
}

function isContainer(cell: MxCellInfo): boolean {
    const style = cell.style || ""
    return (
        cell.vertex === true &&
        (style.includes("swimlane") || style.includes("container=1"))
    )
}

function formatBBox(cell: MxCellInfo): string {
    const g = cell.geometry
    if (!g) return ""
    const parts = [
        g.x && `x=${g.x}`,
        g.y && `y=${g.y}`,
        g.width && `w=${g.width}`,
        g.height && `h=${g.height}`,
    ]
        .filter(Boolean)
        .join(", ")
    return parts ? ` (${parts})` : ""
}

export function analyzeDiagramXml(xml: string): string {
    const doc = parseXmlSafe(xml)
    if (!doc) {
        return [
            "Warnings:",
            "- 无法解析 XML（可能是不完整片段）。",
            "请基于当前 XML 再次调用 analyze_diagram 或使用 display_diagram 重新生成。",
        ].join("\n")
    }

    const cells = extractCells(doc)
    const idSet = new Set<string>()
    const duplicates: string[] = []
    for (const c of cells) {
        if (idSet.has(c.id)) duplicates.push(c.id)
        else idSet.add(c.id)
    }

    const vertices = cells.filter(
        (c) => c.vertex && !c.edge && c.id !== "0" && c.id !== "1",
    )
    const edges = cells.filter((c) => c.edge)
    const containers = vertices.filter(isContainer)

    const missingParent = vertices.filter((c) => !c.parent)
    const invalidParent = vertices.filter(
        (c) => c.parent && !idSet.has(c.parent),
    )

    const edgeMissingRefs = edges.filter((e) => !e.source || !e.target)
    const edgeInvalidRefs = edges.filter(
        (e) =>
            (e.source && !idSet.has(e.source)) ||
            (e.target && !idSet.has(e.target)),
    )

    const lines: string[] = []
    lines.push(`Nodes: ${vertices.length}`)
    vertices.slice(0, MAX_LISTED_NODES).forEach((n) => {
        const label = n.value ? n.value.replace(/\s+/g, " ").slice(0, 60) : ""
        const parent = n.parent ? ` parent=${n.parent}` : ""
        lines.push(
            `- ${n.id}${label ? ` "${label}"` : ""}${parent}${formatBBox(n)}`,
        )
    })
    if (vertices.length > MAX_LISTED_NODES) {
        lines.push(
            `- ...(还有 ${vertices.length - MAX_LISTED_NODES} 个节点省略)`,
        )
    }

    lines.push("")
    lines.push(`Edges: ${edges.length}`)
    edges.slice(0, MAX_LISTED_EDGES).forEach((e) => {
        const label = e.value ? e.value.replace(/\s+/g, " ").slice(0, 60) : ""
        lines.push(
            `- ${e.id}${label ? ` "${label}"` : ""} ${e.source || "?"} -> ${e.target || "?"}`,
        )
    })
    if (edges.length > MAX_LISTED_EDGES) {
        lines.push(`- ...(还有 ${edges.length - MAX_LISTED_EDGES} 条连线省略)`)
    }

    if (containers.length > 0) {
        lines.push("")
        lines.push(`Containers/Swimlanes: ${containers.length}`)
        containers.slice(0, MAX_LISTED_NODES).forEach((c) => {
            const label = c.value
                ? c.value.replace(/\s+/g, " ").slice(0, 60)
                : ""
            lines.push(`- ${c.id}${label ? ` "${label}"` : ""}${formatBBox(c)}`)
        })
        if (containers.length > MAX_LISTED_NODES) {
            lines.push(
                `- ...(还有 ${containers.length - MAX_LISTED_NODES} 个容器省略)`,
            )
        }
    }

    const warnings: string[] = []
    if (duplicates.length > 0) {
        warnings.push(
            `- 发现重复 id: ${Array.from(new Set(duplicates)).slice(0, 20).join(", ")}${duplicates.length > 20 ? " ..." : ""}`,
        )
    }
    if (missingParent.length > 0) {
        warnings.push(
            `- 缺失 parent 的节点: ${missingParent
                .slice(0, 20)
                .map((c) => c.id)
                .join(", ")}${missingParent.length > 20 ? " ..." : ""}`,
        )
    }
    if (invalidParent.length > 0) {
        warnings.push(
            `- parent 引用不存在的节点: ${invalidParent
                .slice(0, 20)
                .map((c) => `${c.id}->${c.parent}`)
                .join(", ")}${invalidParent.length > 20 ? " ..." : ""}`,
        )
    }
    if (edgeMissingRefs.length > 0) {
        warnings.push(
            `- 连线缺失 source/target: ${edgeMissingRefs
                .slice(0, 20)
                .map((e) => e.id)
                .join(", ")}${edgeMissingRefs.length > 20 ? " ..." : ""}`,
        )
    }
    if (edgeInvalidRefs.length > 0) {
        warnings.push(
            `- 连线引用不存在的节点: ${edgeInvalidRefs
                .slice(0, 20)
                .map((e) => `${e.id}(${e.source || "?"}->${e.target || "?"})`)
                .join(", ")}${edgeInvalidRefs.length > 20 ? " ..." : ""}`,
        )
    }
    if (cells.length >= MAX_CELLS_ANALYZED) {
        warnings.push(
            `- 仅分析前 ${MAX_CELLS_ANALYZED} 个 mxCell，剩余已省略。`,
        )
    }

    if (warnings.length > 0) {
        lines.push("")
        lines.push("Warnings:")
        lines.push(...warnings)
    }

    return lines.join("\n")
}
