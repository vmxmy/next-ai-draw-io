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

interface XmlDiff {
    added: MxCellInfo[]
    removed: MxCellInfo[]
    modified: Array<{ id: string; changes: string[] }>
}

const MAX_CELLS_ANALYZED = 10000

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

function extractCells(doc: any): Map<string, MxCellInfo> {
    const cellEls = Array.from(doc.getElementsByTagName("mxCell")) as Element[]
    const cells = new Map<string, MxCellInfo>()

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

        cells.set(id, info)
    }

    return cells
}

function cellsAreEqual(a: MxCellInfo, b: MxCellInfo): boolean {
    return (
        a.value === b.value &&
        a.parent === b.parent &&
        a.style === b.style &&
        a.vertex === b.vertex &&
        a.edge === b.edge &&
        a.source === b.source &&
        a.target === b.target &&
        a.geometry?.x === b.geometry?.x &&
        a.geometry?.y === b.geometry?.y &&
        a.geometry?.width === b.geometry?.width &&
        a.geometry?.height === b.geometry?.height
    )
}

function describeChanges(prev: MxCellInfo, curr: MxCellInfo): string[] {
    const changes: string[] = []

    if (prev.value !== curr.value) {
        changes.push(`label: "${prev.value}" → "${curr.value}"`)
    }
    if (prev.style !== curr.style) {
        changes.push("style changed")
    }
    if (prev.parent !== curr.parent) {
        changes.push(`parent: ${prev.parent} → ${curr.parent}`)
    }
    if (prev.source !== curr.source || prev.target !== curr.target) {
        changes.push(
            `connection: ${prev.source}→${prev.target} to ${curr.source}→${curr.target}`,
        )
    }
    if (
        prev.geometry?.x !== curr.geometry?.x ||
        prev.geometry?.y !== curr.geometry?.y
    ) {
        changes.push("position changed")
    }
    if (
        prev.geometry?.width !== curr.geometry?.width ||
        prev.geometry?.height !== curr.geometry?.height
    ) {
        changes.push("size changed")
    }

    return changes
}

function computeDiff(
    prevCells: Map<string, MxCellInfo>,
    currCells: Map<string, MxCellInfo>,
): XmlDiff {
    const added: MxCellInfo[] = []
    const removed: MxCellInfo[] = []
    const modified: Array<{ id: string; changes: string[] }> = []

    // Skip root cells (id="0" and id="1")
    const skipIds = new Set(["0", "1"])

    // Find added and modified cells
    for (const [id, curr] of currCells) {
        if (skipIds.has(id)) continue

        const prev = prevCells.get(id)
        if (!prev) {
            added.push(curr)
        } else if (!cellsAreEqual(prev, curr)) {
            const changes = describeChanges(prev, curr)
            if (changes.length > 0) {
                modified.push({ id, changes })
            }
        }
    }

    // Find removed cells
    for (const [id, prev] of prevCells) {
        if (skipIds.has(id)) continue
        if (!currCells.has(id)) {
            removed.push(prev)
        }
    }

    return { added, removed, modified }
}

function formatCell(cell: MxCellInfo): string {
    const type = cell.vertex ? "node" : cell.edge ? "edge" : "cell"
    const label = cell.value ? ` "${cell.value}"` : ""
    return `${type} ${cell.id}${label}`
}

/**
 * Generate a concise text summary of changes between two XML diagrams.
 * This replaces sending the full previousXml to save tokens (~95% reduction).
 */
export function generateXmlDiff(
    previousXml: string,
    currentXml: string,
): string {
    // Parse both XMLs
    const prevDoc = parseXmlSafe(previousXml)
    const currDoc = parseXmlSafe(currentXml)

    if (!prevDoc || !currDoc) {
        return "Unable to compare XML (parsing failed)"
    }

    // Extract cells
    const prevCells = extractCells(prevDoc)
    const currCells = extractCells(currDoc)

    // Compute diff
    const diff = computeDiff(prevCells, currCells)

    // Generate summary
    const lines: string[] = []

    // Only include diff if there are actual changes
    if (
        diff.added.length === 0 &&
        diff.removed.length === 0 &&
        diff.modified.length === 0
    ) {
        return "No changes detected since last AI edit (user may have only viewed the diagram)"
    }

    lines.push("Changes since last AI edit:")
    lines.push("")

    // Added cells
    if (diff.added.length > 0) {
        lines.push(`Added ${diff.added.length} elements:`)
        diff.added.slice(0, 10).forEach((cell) => {
            lines.push(`- ${formatCell(cell)}`)
        })
        if (diff.added.length > 10) {
            lines.push(`- ...and ${diff.added.length - 10} more`)
        }
        lines.push("")
    }

    // Removed cells
    if (diff.removed.length > 0) {
        lines.push(`Removed ${diff.removed.length} elements:`)
        diff.removed.slice(0, 10).forEach((cell) => {
            lines.push(`- ${formatCell(cell)}`)
        })
        if (diff.removed.length > 10) {
            lines.push(`- ...and ${diff.removed.length - 10} more`)
        }
        lines.push("")
    }

    // Modified cells
    if (diff.modified.length > 0) {
        lines.push(`Modified ${diff.modified.length} elements:`)
        diff.modified.slice(0, 10).forEach(({ id, changes }) => {
            const cell = currCells.get(id)
            lines.push(
                `- ${cell ? formatCell(cell) : id}: ${changes.join(", ")}`,
            )
        })
        if (diff.modified.length > 10) {
            lines.push(`- ...and ${diff.modified.length - 10} more`)
        }
        lines.push("")
    }

    return lines.join("\n").trim()
}
