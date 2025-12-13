export function escapeXmlAttrValue(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

export function parseXml(xml: string): Document {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "text/xml")
    const parseError = doc.querySelector("parsererror")
    if (parseError) {
        throw new Error("XML_PARSE_ERROR")
    }
    return doc
}

export function serializeXml(doc: Document): string {
    const serializer = new XMLSerializer()
    return serializer.serializeToString(doc)
}

export function findMxCell(doc: Document, id: string): Element | null {
    const all = doc.querySelectorAll("mxCell")
    for (const cell of Array.from(all)) {
        if (cell.getAttribute("id") === id) return cell
    }
    return null
}

export function findMxCellOrThrow(doc: Document, id: string): Element {
    const cell = findMxCell(doc, id)
    if (!cell) throw new Error(`Cell id="${id}" not found`)
    return cell
}

export function ensureChildElement(
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

export function upsertMxPoint(
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
