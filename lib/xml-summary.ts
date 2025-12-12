import { DOMParser } from "@xmldom/xmldom"

interface SummaryNode {
    id: string
    value: string
    parent?: string
    x?: string
    y?: string
    w?: string
    h?: string
    isContainer?: boolean
}

interface SummaryEdge {
    id: string
    value: string
    source?: string
    target?: string
}

const MAX_CELLS_PARSED = 20000
const MAX_NODES_LISTED = 40
const MAX_EDGES_LISTED = 40
const MAX_CONTAINERS_LISTED = 20

function parseXmlSafe(xml: string): any | null {
    try {
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

function normalizeLabel(value?: string): string {
    if (!value) return ""
    return value.replace(/\s+/g, " ").trim().slice(0, 50)
}

function isContainerStyle(style?: string): boolean {
    if (!style) return false
    return style.includes("swimlane") || style.includes("container=1")
}

export function buildDiagramSummary(xml: string): string | null {
    if (!xml || xml.trim() === "") return null

    const doc = parseXmlSafe(xml)
    if (!doc) return null

    const cellEls = Array.from(doc.getElementsByTagName("mxCell")) as Element[]
    const idSet = new Set<string>()
    const nodes: SummaryNode[] = []
    const edges: SummaryEdge[] = []
    const containers: SummaryNode[] = []

    for (let i = 0; i < cellEls.length && i < MAX_CELLS_PARSED; i++) {
        const el = cellEls[i]
        const id = getAttr(el, "id")
        if (!id) continue
        idSet.add(id)

        const vertex = getAttr(el, "vertex") === "1"
        const edge = getAttr(el, "edge") === "1"
        const value = normalizeLabel(getAttr(el, "value"))
        const parent = getAttr(el, "parent")
        const style = getAttr(el, "style")

        const geomEl = el.getElementsByTagName("mxGeometry")[0]
        const x = geomEl ? getAttr(geomEl, "x") : undefined
        const y = geomEl ? getAttr(geomEl, "y") : undefined
        const w = geomEl ? getAttr(geomEl, "width") : undefined
        const h = geomEl ? getAttr(geomEl, "height") : undefined

        if (vertex && !edge && id !== "0" && id !== "1") {
            const n: SummaryNode = { id, value, parent, x, y, w, h }
            if (isContainerStyle(style)) {
                n.isContainer = true
                containers.push(n)
            }
            nodes.push(n)
        } else if (edge) {
            edges.push({
                id,
                value,
                source: getAttr(el, "source"),
                target: getAttr(el, "target"),
            })
        }
    }

    const lines: string[] = []
    lines.push(`Summary Nodes: ${nodes.length}`)
    nodes.slice(0, MAX_NODES_LISTED).forEach((n) => {
        const label = n.value ? ` "${n.value}"` : ""
        const parentPart = n.parent ? ` parent=${n.parent}` : ""
        const bbox =
            n.x || n.y || n.w || n.h
                ? ` (${[
                      n.x && `x=${n.x}`,
                      n.y && `y=${n.y}`,
                      n.w && `w=${n.w}`,
                      n.h && `h=${n.h}`,
                  ]
                      .filter(Boolean)
                      .join(", ")})`
                : ""
        lines.push(`- ${n.id}${label}${parentPart}${bbox}`)
    })
    if (nodes.length > MAX_NODES_LISTED) {
        lines.push(`- ...(省略 ${nodes.length - MAX_NODES_LISTED} 个节点)`)
    }

    lines.push("")
    lines.push(`Summary Edges: ${edges.length}`)
    edges.slice(0, MAX_EDGES_LISTED).forEach((e) => {
        const label = e.value ? ` "${e.value}"` : ""
        lines.push(`- ${e.id}${label} ${e.source || "?"} -> ${e.target || "?"}`)
    })
    if (edges.length > MAX_EDGES_LISTED) {
        lines.push(`- ...(省略 ${edges.length - MAX_EDGES_LISTED} 条连线)`)
    }

    if (containers.length > 0) {
        lines.push("")
        lines.push(`Summary Containers: ${containers.length}`)
        containers.slice(0, MAX_CONTAINERS_LISTED).forEach((c) => {
            const label = c.value ? ` "${c.value}"` : ""
            lines.push(`- ${c.id}${label}`)
        })
        if (containers.length > MAX_CONTAINERS_LISTED) {
            lines.push(
                `- ...(省略 ${containers.length - MAX_CONTAINERS_LISTED} 个容器)`,
            )
        }
    }

    if (cellEls.length >= MAX_CELLS_PARSED) {
        lines.push("")
        lines.push(
            `Warnings: cell 数量过大，仅解析前 ${MAX_CELLS_PARSED} 个 mxCell。`,
        )
    }

    return lines.join("\n")
}
