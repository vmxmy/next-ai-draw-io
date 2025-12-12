export function extractIdFromSearch(search: string): string | null {
    const match = search.match(/id="([^"]+)"/)
    return match?.[1] ?? null
}

export function findMxCellLineById(xml: string, id: string): string | null {
    const lineMatch = xml.match(
        new RegExp(`<mxCell[^\\n>]*\\bid="${id}"[^\\n>]*>.*`, "i"),
    )
    if (lineMatch?.[0]) return lineMatch[0]
    const selfClosingMatch = xml.match(
        new RegExp(`<mxCell[^\\n>]*\\bid="${id}"[^\\n>]*/>`, "i"),
    )
    return selfClosingMatch?.[0] ?? null
}
