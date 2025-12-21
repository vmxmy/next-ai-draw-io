export function escapeXmlAttrValue(value: string): string {
    // Step 1: Temporarily protect valid XML/HTML entities and numeric character references
    // Pattern: &(#x?[0-9a-fA-F]+|[a-zA-Z]+);
    // Examples: &#xa; &#10; &#160; &lt; &gt; &amp; &quot; &apos;
    const entityPlaceholders: string[] = []
    const protectedValue = value.replace(
        /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
        (match) => {
            const index = entityPlaceholders.length
            entityPlaceholders.push(match)
            return `__ENTITY_${index}__`
        },
    )

    // Step 2: Escape special XML characters (& < > ")
    const escaped = protectedValue
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")

    // Step 3: Restore protected entities
    return escaped.replace(/__ENTITY_(\d+)__/g, (_match, index) => {
        return entityPlaceholders[Number.parseInt(index, 10)]
    })
}

export function parseXml(xml: string): Document {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "text/xml")
    // Use getElementsByTagName for Node.js compatibility (xmldom doesn't support querySelector)
    const parseErrors = doc.getElementsByTagName("parsererror")
    if (parseErrors.length > 0) {
        throw new Error("XML_PARSE_ERROR")
    }
    return doc
}

export function serializeXml(doc: Document): string {
    const serializer = new XMLSerializer()
    return serializer.serializeToString(doc)
}

export function findMxCell(doc: Document, id: string): Element | null {
    // Use getElementsByTagName for Node.js compatibility (xmldom doesn't support querySelectorAll)
    const all = doc.getElementsByTagName("mxCell")
    for (let i = 0; i < all.length; i++) {
        const cell = all[i]
        if (cell.getAttribute("id") === id) return cell
    }
    return null
}

export function findMxCellOrThrow(doc: Document, id: string): Element {
    const cell = findMxCell(doc, id)
    if (!cell) throw new Error(`Cell id="${id}" not found`)
    return cell
}

export function findRootElement(doc: Document): Element | null {
    // Use getElementsByTagName for Node.js compatibility (xmldom doesn't support querySelector)
    const roots = doc.getElementsByTagName("root")
    return roots.length > 0 ? roots[0] : null
}

export function findRootElementOrThrow(doc: Document): Element {
    const root = findRootElement(doc)
    if (!root) throw new Error("Invalid XML: missing <root>")
    return root
}

export function ensureChildElement(
    doc: Document,
    parent: Element,
    tagName: string,
    predicate?: (el: Element) => boolean,
): Element {
    // Use childNodes for Node.js compatibility (xmldom may not support children property)
    const childNodes = parent.childNodes
    for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i]
        if (
            child.nodeType === 1 && // Element node
            (child as Element).tagName === tagName &&
            (!predicate || predicate(child as Element))
        ) {
            return child as Element
        }
    }
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
    // Use childNodes for Node.js compatibility (xmldom may not support children property)
    let existing: Element | null = null
    const childNodes = geometry.childNodes
    for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i]
        if (
            child.nodeType === 1 &&
            (child as Element).tagName === "mxPoint" &&
            (child as Element).getAttribute("as") === asValue
        ) {
            existing = child as Element
            break
        }
    }
    const el = existing ?? doc.createElement("mxPoint")
    el.setAttribute("x", String(point.x))
    el.setAttribute("y", String(point.y))
    el.setAttribute("as", asValue)
    if (!existing) {
        geometry.appendChild(el)
    }
}
