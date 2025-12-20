import { type ClassValue, clsx } from "clsx"
import * as pako from "pako"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format XML string with proper indentation and line breaks
 * @param xml - The XML string to format
 * @param indent - The indentation string (default: '  ')
 * @returns Formatted XML string
 */
export function formatXML(xml: string, indent: string = "  "): string {
    let formatted = ""
    let pad = 0

    // Remove existing whitespace between tags
    xml = xml.replace(/>\s*</g, "><").trim()

    // Split on tags
    const tags = xml.split(/(?=<)|(?<=>)/g).filter(Boolean)

    tags.forEach((node) => {
        if (node.match(/^<\/\w/)) {
            // Closing tag - decrease indent
            pad = Math.max(0, pad - 1)
            formatted += indent.repeat(pad) + node + "\n"
        } else if (node.match(/^<\w[^>]*[^/]>.*$/)) {
            // Opening tag
            formatted += indent.repeat(pad) + node
            // Only add newline if next item is a tag
            const nextIndex = tags.indexOf(node) + 1
            if (nextIndex < tags.length && tags[nextIndex].startsWith("<")) {
                formatted += "\n"
                if (!node.match(/^<\w[^>]*\/>$/)) {
                    pad++
                }
            }
        } else if (node.match(/^<\w[^>]*\/>$/)) {
            // Self-closing tag
            formatted += indent.repeat(pad) + node + "\n"
        } else if (node.startsWith("<")) {
            // Other tags (like <?xml)
            formatted += indent.repeat(pad) + node + "\n"
        } else {
            // Text content
            formatted += node
        }
    })

    return formatted.trim()
}

/**
 * Efficiently converts a potentially incomplete XML string to a legal XML string by closing any open tags properly.
 * Additionally, if an <mxCell> tag does not have an mxGeometry child (e.g. <mxCell id="3">),
 * it removes that tag from the output.
 * Also removes orphaned <mxPoint> elements that aren't inside <Array> or don't have proper 'as' attribute.
 * @param xmlString The potentially incomplete XML string
 * @returns A legal XML string with properly closed tags and removed incomplete mxCell elements.
 */
export function convertToLegalXml(xmlString: string): string {
    // Replace &nbsp; with &#160; (non-breaking space) as &nbsp; is not valid in standard XML
    xmlString = xmlString.replace(/&nbsp;/g, "&#160;")

    // This regex will match either self-closing <mxCell .../> or a block element
    // <mxCell ...> ... </mxCell>. Unfinished ones are left out because they don't match.
    const regex = /<mxCell\b[^>]*(?:\/>|>([\s\S]*?)<\/mxCell>)/g
    let match: RegExpExecArray | null
    let result = "<root>\n"

    while ((match = regex.exec(xmlString)) !== null) {
        // match[0] contains the entire matched mxCell block
        let cellContent = match[0]

        // Remove orphaned <mxPoint> elements that are directly inside <mxGeometry>
        // without an 'as' attribute (like as="sourcePoint", as="targetPoint")
        // and not inside <Array as="points">
        // These cause "Could not add object mxPoint" errors in draw.io
        // First check if there's an <Array as="points"> - if so, keep all mxPoints inside it
        const hasArrayPoints = /<Array\s+as="points">/.test(cellContent)
        if (!hasArrayPoints) {
            // Remove mxPoint elements without 'as' attribute
            cellContent = cellContent.replace(
                /<mxPoint\b[^>]*\/>/g,
                (pointMatch) => {
                    // Keep if it has an 'as' attribute
                    if (/\sas=/.test(pointMatch)) {
                        return pointMatch
                    }
                    // Remove orphaned mxPoint
                    return ""
                },
            )
        }

        // Indent each line of the matched block for readability.
        const formatted = cellContent
            .split("\n")
            .map((line) => "    " + line.trim())
            .filter((line) => line.trim()) // Remove empty lines from removed mxPoints
            .join("\n")
        result += formatted + "\n"
    }
    result += "</root>"

    return result
}

/**
 * Wrap XML content with the full mxfile structure required by draw.io.
 * Handles cases where XML is just <root>, <mxGraphModel>, or already has <mxfile>.
 * @param xml - The XML string (may be partial or complete)
 * @returns Full mxfile-wrapped XML string
 */
export function wrapWithMxFile(xml: string): string {
    if (!xml) {
        return `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
    }

    function stripInvalidXmlChars(input: string): string {
        // XML 1.0 disallows most control characters (common invisible LLM artifacts)
        let out = ""
        for (const ch of input) {
            const code = ch.codePointAt(0) ?? 0
            const isAllowed =
                code === 0x9 ||
                code === 0xa ||
                code === 0xd ||
                (code >= 0x20 && code <= 0xd7ff) ||
                (code >= 0xe000 && code <= 0xfffd) ||
                (code >= 0x10000 && code <= 0x10ffff)
            if (isAllowed) out += ch
        }
        return out
    }

    function escapeBareAmpersands(input: string): string {
        // Escape any `&` that isn't the start of a valid entity.
        return input.replace(
            /&(?!#\d+;|#x[0-9A-Fa-f]+;|[A-Za-z][A-Za-z0-9]+;)/g,
            "&amp;",
        )
    }

    // 工程兜底：模型有时会把 XML 包在代码块/引号/JSON 片段里，或在末尾带上 `",` 之类的尾巴。
    // 这些都不是 XML 的一部分，会直接导致 DOMParser 报 parsererror。
    let candidate = xml.trim()
    {
        // 1) 去掉 ```xml ... ``` 围栏
        const fenced = candidate.match(/^```(?:xml)?\s*([\s\S]*?)\s*```$/i)
        if (fenced?.[1]) candidate = fenced[1].trim()

        // 2) 去掉一层首尾引号/反引号（常见于 JSON 字符串或日志拼接）
        if (
            (candidate.startsWith('"') && candidate.endsWith('"')) ||
            (candidate.startsWith("'") && candidate.endsWith("'")) ||
            (candidate.startsWith("`") && candidate.endsWith("`"))
        ) {
            candidate = candidate.slice(1, -1).trim()
        }

        // 3) 常见错误：`</root>",` / `</mxfile>",` —— 去掉尾部 `",` 或 `,`
        candidate = candidate.replace(/"\s*,\s*$/, "").replace(/,\s*$/, "")

        // 4) 如果前后还有解释性文本，尽量截取出最像 XML 的片段
        const firstTagIndex = (() => {
            const lt = candidate.indexOf("<")
            const escapedLt = candidate.indexOf("&lt;")
            if (lt === -1) return escapedLt
            if (escapedLt === -1) return lt
            return Math.min(lt, escapedLt)
        })()
        const lastTagIndex = (() => {
            const gt = candidate.lastIndexOf(">")
            const escapedGt = candidate.lastIndexOf("&gt;")
            if (gt === -1) return escapedGt
            if (escapedGt === -1) return gt
            return Math.max(gt, escapedGt)
        })()
        if (firstTagIndex > 0 && lastTagIndex > firstTagIndex) {
            candidate = candidate.slice(firstTagIndex, lastTagIndex + 1).trim()
        }
    }
    xml = escapeBareAmpersands(stripInvalidXmlChars(candidate))

    // 进一步兜底：仅对 mxCell 的 value 属性做“属性值安全化”
    // - 将 value 中的裸 <、> 转义（XML 里属性值不能直接包含 <）
    // - 将 value 中的裸 & 转为 &amp;（避免偶发的未转义 &）
    // 注意：这里不会把 &quot; 解成真实引号，避免破坏属性边界。
    xml = xml.replace(/value="([^"]*)"/g, (_m, rawValue: string) => {
        const nextValue = escapeBareAmpersands(rawValue)
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
        return `value="${nextValue}"`
    })

    // Some models return HTML-escaped XML (e.g. `&lt;root&gt;...`), which draw.io may
    // misinterpret as base64-encoded diagram content and throw `atob` decoding errors.
    // Detect and unescape it before further wrapping.
    // Fix: Only unescape if it DOES NOT start with `<` (which means it's likely already valid XML)
    // and DOES start with `&lt;` (or contains escaped root tags), to avoid breaking `value="&lt;br&gt;"`.
    if (
        xml.includes("&lt;") &&
        !xml.includes("<mxfile") &&
        !xml.trim().startsWith("<") &&
        (xml.trim().startsWith("&lt;") ||
            xml.includes("&lt;mxGraphModel") ||
            xml.includes("&lt;root"))
    ) {
        // 重要：这里只“解外层”的标签转义（&lt; / &gt;），不要把 &quot; / &#34; 等解成真实引号，
        // 否则会把属性值里的 `&quot;提交信息&quot;` 变成 `"... "提交信息" ..."`，导致 XML 语法直接崩。
        // 同时处理常见的二次转义形式 `&amp;lt;...`。
        const unescaped = xml
            .replaceAll("&amp;lt;", "&lt;")
            .replaceAll("&amp;gt;", "&gt;")
            // 反转义“实体前缀”的二次转义（注意：这里只把 `&amp;xxx;` 还原为 `&xxx;`，不解码成真实字符）
            .replaceAll("&amp;quot;", "&quot;")
            .replaceAll("&amp;apos;", "&apos;")
            .replaceAll("&amp;amp;", "&amp;")
            .replaceAll("&amp;#", "&#")
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">")

        // Only apply if it now looks like actual draw.io XML fragments
        if (unescaped.includes("<mxCell") || unescaped.includes("<root")) {
            xml = unescaped
        }
    }

    // Already has full structure
    if (xml.includes("<mxfile")) {
        return xml
    }

    // Has mxGraphModel but not mxfile
    if (xml.includes("<mxGraphModel")) {
        return `<mxfile><diagram name="Page-1" id="page-1">${xml}</diagram></mxfile>`
    }

    // Just <root> content - extract inner content and wrap fully
    const rootContent = xml.replace(/<\/?root>/g, "").trim()
    return `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root>${rootContent}</root></mxGraphModel></diagram></mxfile>`
}

/**
 * Replace nodes in a Draw.io XML diagram
 * @param currentXML - The original Draw.io XML string
 * @param nodes - The XML string containing new nodes to replace in the diagram
 * @returns The updated XML string with replaced nodes
 */
export function replaceNodes(currentXML: string, nodes: string): string {
    // Check for valid inputs
    if (!currentXML || !nodes) {
        throw new Error("Both currentXML and nodes must be provided")
    }

    try {
        // Parse the XML strings to create DOM objects
        const parser = new DOMParser()
        const currentDoc = parser.parseFromString(currentXML, "text/xml")

        // Handle nodes input - if it doesn't contain <root>, wrap it
        let nodesString = nodes
        if (!nodes.includes("<root>")) {
            nodesString = `<root>${nodes}</root>`
        }

        const nodesDoc = parser.parseFromString(nodesString, "text/xml")

        // Find the root element in the current document
        let currentRoot =
            currentDoc.querySelector("mxGraphModel > root") ||
            currentDoc.querySelector("root")

        if (!currentRoot) {
            // If no <root> exists, create a valid draw.io structure under <diagram>.
            // Important: Do NOT append elements directly to Document when it already has a documentElement,
            // otherwise DOM will throw "Only one element on document allowed".
            const mxGraphModel =
                currentDoc.querySelector("mxGraphModel") ||
                currentDoc.createElement("mxGraphModel")

            if (!currentDoc.contains(mxGraphModel)) {
                // Prefer placing mxGraphModel inside <diagram> if present
                let diagram = currentDoc.querySelector("mxfile > diagram")
                if (!diagram) {
                    diagram =
                        currentDoc.querySelector("diagram") ||
                        currentDoc.createElement("diagram")

                    if (!diagram.getAttribute("name")) {
                        diagram.setAttribute("name", "Page-1")
                    }
                    if (!diagram.getAttribute("id")) {
                        diagram.setAttribute("id", "page-1")
                    }

                    const mxfile =
                        currentDoc.querySelector("mxfile") ||
                        currentDoc.documentElement

                    if (mxfile && mxfile.nodeName === "mxfile") {
                        if (!mxfile.contains(diagram)) {
                            mxfile.appendChild(diagram)
                        }
                    } else if (!currentDoc.documentElement) {
                        // Extremely defensive: document has no root element.
                        currentDoc.appendChild(diagram)
                    }
                }

                // If diagram contains encoded text, replace its content with XML model
                while (diagram.firstChild) {
                    diagram.removeChild(diagram.firstChild)
                }

                diagram.appendChild(mxGraphModel)
            }

            currentRoot = currentDoc.createElement("root")
            mxGraphModel.appendChild(currentRoot)
        }

        // Find the root element in the nodes document
        const nodesRoot = nodesDoc.querySelector("root")
        if (!nodesRoot) {
            throw new Error(
                "Invalid nodes: Could not find or create <root> element",
            )
        }

        // Clear all existing child elements from the current root
        while (currentRoot.firstChild) {
            currentRoot.removeChild(currentRoot.firstChild)
        }

        // Ensure the base cells exist
        const hasCell0 = Array.from(nodesRoot.childNodes).some(
            (node) =>
                node.nodeName === "mxCell" &&
                (node as Element).getAttribute("id") === "0",
        )

        const hasCell1 = Array.from(nodesRoot.childNodes).some(
            (node) =>
                node.nodeName === "mxCell" &&
                (node as Element).getAttribute("id") === "1",
        )

        // Copy all child nodes from the nodes root to the current root
        Array.from(nodesRoot.childNodes).forEach((node) => {
            const importedNode = currentDoc.importNode(node, true)
            currentRoot.appendChild(importedNode)
        })

        // Add default cells if they don't exist
        if (!hasCell0) {
            const cell0 = currentDoc.createElement("mxCell")
            cell0.setAttribute("id", "0")
            currentRoot.insertBefore(cell0, currentRoot.firstChild)
        }

        if (!hasCell1) {
            const cell1 = currentDoc.createElement("mxCell")
            cell1.setAttribute("id", "1")
            cell1.setAttribute("parent", "0")

            // Insert after cell0 if possible
            const cell0 = currentRoot.querySelector('mxCell[id="0"]')
            if (cell0?.nextSibling) {
                currentRoot.insertBefore(cell1, cell0.nextSibling)
            } else {
                currentRoot.appendChild(cell1)
            }
        }

        // Convert the modified DOM back to a string
        const serializer = new XMLSerializer()
        return serializer.serializeToString(currentDoc)
    } catch (error) {
        throw new Error(`Error replacing nodes: ${error}`)
    }
}

/**
 * Create a character count dictionary from a string
 * Used for attribute-order agnostic comparison
 */
function charCountDict(str: string): Map<string, number> {
    const dict = new Map<string, number>()
    for (const char of str) {
        dict.set(char, (dict.get(char) || 0) + 1)
    }
    return dict
}

/**
 * Compare two strings by character frequency (order-agnostic)
 */
function sameCharFrequency(a: string, b: string): boolean {
    const trimmedA = a.trim()
    const trimmedB = b.trim()
    if (trimmedA.length !== trimmedB.length) return false

    const dictA = charCountDict(trimmedA)
    const dictB = charCountDict(trimmedB)

    if (dictA.size !== dictB.size) return false

    for (const [char, count] of dictA) {
        if (dictB.get(char) !== count) return false
    }
    return true
}

/**
 * Replace specific parts of XML content using search and replace pairs
 * @param xmlContent - The original XML string
 * @param searchReplacePairs - Array of {search: string, replace: string} objects
 * @returns The updated XML string with replacements applied
 */
export function replaceXMLParts(
    xmlContent: string,
    searchReplacePairs: Array<{ search: string; replace: string }>,
): string {
    // Format the XML first to ensure consistent line breaks
    let result = formatXML(xmlContent)

    for (const { search, replace } of searchReplacePairs) {
        // Also format the search content for consistency
        const formattedSearch = formatXML(search)
        const searchLines = formattedSearch.split("\n")

        // Split into lines for exact line matching
        const resultLines = result.split("\n")

        // Remove trailing empty line if exists (from the trailing \n in search content)
        if (searchLines[searchLines.length - 1] === "") {
            searchLines.pop()
        }

        // Always search from the beginning - pairs may not be in document order
        const startLineNum = 0

        // Try to find match using multiple strategies
        let matchFound = false
        let matchStartLine = -1
        let matchEndLine = -1

        // First try: exact match
        for (
            let i = startLineNum;
            i <= resultLines.length - searchLines.length;
            i++
        ) {
            let matches = true

            for (let j = 0; j < searchLines.length; j++) {
                if (resultLines[i + j] !== searchLines[j]) {
                    matches = false
                    break
                }
            }

            if (matches) {
                matchStartLine = i
                matchEndLine = i + searchLines.length
                matchFound = true
                break
            }
        }

        // Second try: line-trimmed match (fallback)
        if (!matchFound) {
            for (
                let i = startLineNum;
                i <= resultLines.length - searchLines.length;
                i++
            ) {
                let matches = true

                for (let j = 0; j < searchLines.length; j++) {
                    const originalTrimmed = resultLines[i + j].trim()
                    const searchTrimmed = searchLines[j].trim()

                    if (originalTrimmed !== searchTrimmed) {
                        matches = false
                        break
                    }
                }

                if (matches) {
                    matchStartLine = i
                    matchEndLine = i + searchLines.length
                    matchFound = true
                    break
                }
            }
        }

        // Third try: substring match as last resort (for single-line XML)
        if (!matchFound) {
            // Try to find as a substring in the entire content
            const searchStr = search.trim()
            const resultStr = result
            const index = resultStr.indexOf(searchStr)

            if (index !== -1) {
                // Found as substring - replace it
                result =
                    resultStr.substring(0, index) +
                    replace.trim() +
                    resultStr.substring(index + searchStr.length)
                // Re-format after substring replacement
                result = formatXML(result)
                continue // Skip the line-based replacement below
            }
        }

        // Fourth try: character frequency match (attribute-order agnostic)
        // This handles cases where the model generates XML with different attribute order
        if (!matchFound) {
            for (
                let i = startLineNum;
                i <= resultLines.length - searchLines.length;
                i++
            ) {
                let matches = true

                for (let j = 0; j < searchLines.length; j++) {
                    if (
                        !sameCharFrequency(resultLines[i + j], searchLines[j])
                    ) {
                        matches = false
                        break
                    }
                }

                if (matches) {
                    matchStartLine = i
                    matchEndLine = i + searchLines.length
                    matchFound = true
                    break
                }
            }
        }

        // Fifth try: Match by mxCell id attribute
        // Extract id from search pattern and find the element with that id
        if (!matchFound) {
            const idMatch = search.match(/id\s*=\s*["']([^"']+)["']/)
            if (idMatch) {
                const searchId = idMatch[1]
                // Find lines that contain this id
                for (let i = startLineNum; i < resultLines.length; i++) {
                    if (
                        resultLines[i].match(
                            new RegExp(`id\\s*=\\s*["']${searchId}["']`),
                        )
                    ) {
                        // Found the element with matching id
                        // Now find the extent of this element (it might span multiple lines)
                        let endLine = i + 1
                        const line = resultLines[i].trim()

                        // Check if it's a self-closing tag or has children
                        if (!line.endsWith("/>")) {
                            // Find the closing tag or the end of the mxCell block
                            let depth = 1
                            while (endLine < resultLines.length && depth > 0) {
                                const currentLine = resultLines[endLine].trim()
                                if (
                                    currentLine.startsWith("<") &&
                                    !currentLine.startsWith("</") &&
                                    !currentLine.endsWith("/>")
                                ) {
                                    depth++
                                } else if (currentLine.startsWith("</")) {
                                    depth--
                                }
                                endLine++
                            }
                        }

                        matchStartLine = i
                        matchEndLine = endLine
                        matchFound = true
                        break
                    }
                }
            }
        }

        // Sixth try: Match by value attribute (label text)
        // Extract value from search pattern and find elements with that value
        if (!matchFound) {
            const valueMatch = search.match(/value\s*=\s*["']([^"']*)["']/)
            if (valueMatch) {
                const searchValue = valueMatch[1] // Use captured group
                // Helper to unescape basic entities for loose comparison
                const unescapeEntities = (str: string) =>
                    str
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&amp;/g, "&")
                        .replace(/&quot;/g, '"')
                        .replace(/&apos;/g, "'")

                const unescapedSearchValue = unescapeEntities(searchValue)

                for (let i = startLineNum; i < resultLines.length; i++) {
                    const line = resultLines[i]
                    // Extract value from current line
                    const lineValueMatch = line.match(
                        /value\s*=\s*["']([^"']*)["']/,
                    )

                    let matches = false
                    if (lineValueMatch) {
                        const lineValue = lineValueMatch[1]
                        // Compare exact or unescaped
                        if (
                            lineValue === searchValue ||
                            unescapeEntities(lineValue) === unescapedSearchValue
                        ) {
                            matches = true
                        }
                    } else if (line.includes(searchValue)) {
                        // Fallback to simple inclusion if regex fails (e.g. complexity)
                        matches = true
                    }

                    if (matches) {
                        // Found element with matching value
                        let endLine = i + 1
                        const trimmedLine = line.trim()

                        if (!trimmedLine.endsWith("/>")) {
                            let depth = 1
                            while (endLine < resultLines.length && depth > 0) {
                                const currentLine = resultLines[endLine].trim()
                                if (
                                    currentLine.startsWith("<") &&
                                    !currentLine.startsWith("</") &&
                                    !currentLine.endsWith("/>")
                                ) {
                                    depth++
                                } else if (currentLine.startsWith("</")) {
                                    depth--
                                }
                                endLine++
                            }
                        }

                        matchStartLine = i
                        matchEndLine = endLine
                        matchFound = true
                        break
                    }
                }
            }
        }

        // Seventh try: Normalized whitespace match
        // Collapse all whitespace and compare
        if (!matchFound) {
            const normalizeWs = (s: string) => s.replace(/\s+/g, " ").trim()
            const normalizedSearch = normalizeWs(search)

            for (
                let i = startLineNum;
                i <= resultLines.length - searchLines.length;
                i++
            ) {
                // Build a normalized version of the candidate lines
                const candidateLines = resultLines.slice(
                    i,
                    i + searchLines.length,
                )
                const normalizedCandidate = normalizeWs(
                    candidateLines.join(" "),
                )

                if (normalizedCandidate === normalizedSearch) {
                    matchStartLine = i
                    matchEndLine = i + searchLines.length
                    matchFound = true
                    break
                }
            }
        }

        if (!matchFound) {
            throw new Error(
                `Search pattern not found in the diagram. The pattern may not exist in the current structure.`,
            )
        }

        // Replace the matched lines
        const replaceLines = replace.split("\n")

        // Remove trailing empty line if exists
        if (replaceLines[replaceLines.length - 1] === "") {
            replaceLines.pop()
        }

        // Perform the replacement
        const newResultLines = [
            ...resultLines.slice(0, matchStartLine),
            ...replaceLines,
            ...resultLines.slice(matchEndLine),
        ]

        result = newResultLines.join("\n")
    }

    return result
}

/**
 * Validates draw.io XML structure for common issues
 * @param xml - The XML string to validate
 * @returns null if valid, error message string if invalid
 */
export type MxCellValidationErrorCode =
    | "HTML_ESCAPED_XML"
    | "PARSE_ERROR"
    | "NESTED_CELL"
    | "DUPLICATE_ID"
    | "MISSING_PARENT"
    | "INVALID_PARENT"
    | "INVALID_EDGE_REF"
    | "ORPHANED_MXPOINT"

export interface MxCellValidationError {
    code: MxCellValidationErrorCode
    message: string
    cellIds?: string[]
    hint?: string
}

/**
 * 结构化校验：返回可定位的错误信息，便于模型自修复。
 * 不改变现有 validateMxCellStructure 的外部行为。
 */
export function validateMxCellStructureDetailed(
    xml: string,
): MxCellValidationError | null {
    // Some LLMs return HTML-escaped XML inside the diagram, e.g. `&lt;mxCell ...&gt;`.
    // draw.io may later treat such content as encoded diagram data and throw `atob` errors.
    if (
        xml.includes("&lt;") &&
        (xml.includes("&lt;mxCell") || xml.includes("&lt;root"))
    ) {
        return {
            code: "HTML_ESCAPED_XML",
            message: "检测到 HTML 转义的 XML（例如 &lt;mxCell&gt;）。",
            hint: "请将 &lt; / &gt; / &amp; 等实体反转义为真实 XML 标签后再加载/编辑。",
        }
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "text/xml")

    const parseError = doc.querySelector("parsererror")
    if (parseError) {
        const detail = (parseError.textContent || "")
            .trim()
            .replace(/\s+/g, " ")
        const hasBareAmp =
            /&(?!#\d+;|#x[0-9A-Fa-f]+;|[A-Za-z][A-Za-z0-9]+;)/.test(xml)
        const hasLtInAttr = /\b[a-zA-Z_:][\w:.-]*="[^"]*<[^"]*"/.test(xml)
        const hasCtrlChar = (() => {
            for (const ch of xml) {
                const code = ch.codePointAt(0) ?? 0
                if (
                    code < 0x20 &&
                    code !== 0x9 &&
                    code !== 0xa &&
                    code !== 0xd
                ) {
                    return true
                }
            }
            return false
        })()
        return {
            code: "PARSE_ERROR",
            message: 'XML 语法错误（常见原因：属性值中未转义的 <、>、&、"）。',
            hint: [
                '请转义特殊字符：< 用 &lt;，> 用 &gt;，& 用 &amp;，" 用 &quot;，然后重新生成/编辑。',
                hasBareAmp
                    ? "检测到未转义的 &（请改为 &amp; 或使用合法实体）。"
                    : null,
                hasLtInAttr
                    ? "检测到属性值中出现裸 <（XML 属性值不能直接包含 <）。"
                    : null,
                hasCtrlChar
                    ? "检测到不可见控制字符（建议移除/重新生成该段文本）。"
                    : null,
                detail ? `解析器信息: ${detail.slice(0, 160)}` : null,
            ]
                .filter(Boolean)
                .join(" "),
        }
    }

    const allCells = doc.querySelectorAll("mxCell")

    const cellIds = new Set<string>()
    const duplicateIds: string[] = []
    const nestedCells: string[] = []
    const orphanCells: string[] = []
    const invalidParents: { id: string; parent: string }[] = []
    const edgesToValidate: {
        id: string
        source: string | null
        target: string | null
    }[] = []

    allCells.forEach((cell) => {
        const id = cell.getAttribute("id")
        const parent = cell.getAttribute("parent")
        const isEdge = cell.getAttribute("edge") === "1"

        if (id) {
            if (cellIds.has(id)) duplicateIds.push(id)
            else cellIds.add(id)
        }

        if (cell.parentElement?.tagName === "mxCell") {
            nestedCells.push(id || "unknown")
        }

        if (id !== "0") {
            if (!parent) {
                if (id) orphanCells.push(id)
            } else {
                invalidParents.push({ id: id || "unknown", parent })
            }
        }

        if (isEdge) {
            edgesToValidate.push({
                id: id || "unknown",
                source: cell.getAttribute("source"),
                target: cell.getAttribute("target"),
            })
        }
    })

    if (nestedCells.length > 0) {
        return {
            code: "NESTED_CELL",
            message: "发现嵌套的 mxCell（mxCell 不能嵌套在另一个 mxCell 内）。",
            cellIds: nestedCells.slice(0, 5),
            hint: "请确保所有 mxCell 都是 <root> 的直接子节点。",
        }
    }

    if (duplicateIds.length > 0) {
        return {
            code: "DUPLICATE_ID",
            message: "发现重复的 mxCell id（每个 mxCell 必须唯一）。",
            cellIds: duplicateIds.slice(0, 5),
            hint: "请为所有新建节点/连线生成不重复的 id。",
        }
    }

    if (orphanCells.length > 0) {
        return {
            code: "MISSING_PARENT",
            message: "发现缺失 parent 的 mxCell（除 id=0 外都需要 parent）。",
            cellIds: orphanCells.slice(0, 5),
            hint: '请给该 mxCell 添加 parent="1" 或有效父节点 id。',
        }
    }

    const badParents = invalidParents.filter((p) => !cellIds.has(p.parent))
    if (badParents.length > 0) {
        return {
            code: "INVALID_PARENT",
            message: "发现 parent 引用不存在的节点。",
            cellIds: badParents.slice(0, 5).map((p) => p.id),
            hint: 'parent 必须引用已有 mxCell id；常见为 parent="1" 或容器/泳道 id。',
        }
    }

    const invalidConnections: string[] = []
    edgesToValidate.forEach((edge) => {
        if (edge.source && !cellIds.has(edge.source)) {
            invalidConnections.push(`${edge.id} (source:${edge.source})`)
        }
        if (edge.target && !cellIds.has(edge.target)) {
            invalidConnections.push(`${edge.id} (target:${edge.target})`)
        }
    })

    if (invalidConnections.length > 0) {
        return {
            code: "INVALID_EDGE_REF",
            message: "发现连线 source/target 引用不存在的节点。",
            cellIds: invalidConnections.slice(0, 5),
            hint: "edge 的 source/target 必须引用当前 XML 中存在的节点 id。",
        }
    }

    const allMxPoints = doc.querySelectorAll("mxPoint")
    const orphanedMxPoints: string[] = []
    allMxPoints.forEach((point) => {
        const hasAsAttr = point.hasAttribute("as")
        const parentIsArray =
            point.parentElement?.tagName === "Array" &&
            point.parentElement?.getAttribute("as") === "points"

        if (!hasAsAttr && !parentIsArray) {
            let parent = point.parentElement
            while (parent && parent.tagName !== "mxCell") {
                parent = parent.parentElement
            }
            const cellId = parent?.getAttribute("id") || "unknown"
            if (!orphanedMxPoints.includes(cellId)) {
                orphanedMxPoints.push(cellId)
            }
        }
    })

    if (orphanedMxPoints.length > 0) {
        return {
            code: "ORPHANED_MXPOINT",
            message:
                '发现不合法的 mxPoint（不在 <Array as="points"> 内且无 as 属性）。',
            cellIds: orphanedMxPoints.slice(0, 5),
            hint: '为 mxPoint 添加 as="sourcePoint/targetPoint"，或放入 <Array as="points"> 中作为折线路径点。',
        }
    }

    return null
}

export function validateMxCellStructure(xml: string): string | null {
    const detailed = validateMxCellStructureDetailed(xml)
    if (!detailed) return null

    const ids = detailed.cellIds?.length
        ? ` IDs: ${detailed.cellIds.join(", ")}.`
        : ""
    const hint = detailed.hint ? ` Hint: ${detailed.hint}` : ""

    return `Invalid XML [${detailed.code}]: ${detailed.message}${ids}${hint}`
}

// ============================================================================
// XML Auto-Fix Engine (from upstream DayuanJiang/next-ai-draw-io)
// 99% fix rate for common LLM output issues
// ============================================================================

const STRUCTURAL_ATTRS = [
    "edge",
    "parent",
    "source",
    "target",
    "vertex",
    "connectable",
]
const MAX_DROP_ITERATIONS = 10

interface ParsedTag {
    tagName: string
    isClosing: boolean
    isSelfClosing: boolean
}

function parseXmlTags(xml: string): ParsedTag[] {
    const tags: ParsedTag[] = []
    const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g
    let match
    while ((match = tagPattern.exec(xml)) !== null) {
        const fullMatch = match[0]
        const tagName = match[1]
        const isClosing = fullMatch.startsWith("</")
        const isSelfClosing = fullMatch.endsWith("/>")
        tags.push({ tagName, isClosing, isSelfClosing })
    }
    return tags
}

/**
 * Comprehensive XML auto-fix engine with 23+ repair strategies.
 * Achieves ~99% fix rate for common LLM output issues.
 */
export function autoFixXml(xml: string): { fixed: string; fixes: string[] } {
    let fixed = xml
    const fixes: string[] = []

    // 0. Fix JSON-escaped XML
    if (/=\\"/.test(fixed)) {
        fixed = fixed.replace(/\\"/g, '"')
        fixed = fixed.replace(/\\n/g, "\n")
        fixes.push("Fixed JSON-escaped XML")
    }

    // 1. Remove CDATA wrapper
    if (/^\s*<!\[CDATA\[/.test(fixed)) {
        fixed = fixed.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "")
        fixes.push("Removed CDATA wrapper")
    }

    // 2. Remove text before XML declaration
    const xmlStart = fixed.search(/<(\?xml|mxGraphModel|mxfile)/i)
    if (xmlStart > 0 && !/^<[a-zA-Z]/.test(fixed.trim())) {
        fixed = fixed.substring(xmlStart)
        fixes.push("Removed text before XML root")
    }

    // 3. Fix duplicate attributes
    let dupAttrFixed = false
    fixed = fixed.replace(/<[^>]+>/g, (tag) => {
        let newTag = tag
        for (const attr of STRUCTURAL_ATTRS) {
            const attrRegex = new RegExp(
                `\\s${attr}\\s*=\\s*["'][^"']*["']`,
                "gi",
            )
            const matches = tag.match(attrRegex)
            if (matches && matches.length > 1) {
                let firstKept = false
                newTag = newTag.replace(attrRegex, (m) => {
                    if (!firstKept) {
                        firstKept = true
                        return m
                    }
                    dupAttrFixed = true
                    return ""
                })
            }
        }
        return newTag
    })
    if (dupAttrFixed) {
        fixes.push("Removed duplicate structural attributes")
    }

    // 4. Escape unescaped ampersands
    const ampersandPattern =
        /&(?!(?:lt|gt|amp|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/g
    if (ampersandPattern.test(fixed)) {
        fixed = fixed.replace(
            /&(?!(?:lt|gt|amp|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/g,
            "&amp;",
        )
        fixes.push("Escaped unescaped & characters")
    }

    // 5. Fix invalid entity names (double-escaped)
    const invalidEntities = [
        { pattern: /&ampquot;/g, replacement: "&quot;", name: "&ampquot;" },
        { pattern: /&amplt;/g, replacement: "&lt;", name: "&amplt;" },
        { pattern: /&ampgt;/g, replacement: "&gt;", name: "&ampgt;" },
        { pattern: /&ampapos;/g, replacement: "&apos;", name: "&ampapos;" },
        { pattern: /&ampamp;/g, replacement: "&amp;", name: "&ampamp;" },
    ]
    for (const { pattern, replacement, name } of invalidEntities) {
        if (pattern.test(fixed)) {
            fixed = fixed.replace(pattern, replacement)
            fixes.push(`Fixed double-escaped entity ${name}`)
        }
    }

    // 6. Fix malformed attribute quotes
    const malformedQuotePattern = /(\s[a-zA-Z][a-zA-Z0-9_:-]*)=&quot;/
    if (malformedQuotePattern.test(fixed)) {
        fixed = fixed.replace(
            /(\s[a-zA-Z][a-zA-Z0-9_:-]*)=&quot;([^&]*?)&quot;/g,
            '$1="$2"',
        )
        fixes.push(
            'Fixed malformed attribute quotes (=&quot;...&quot; to ="...")',
        )
    }

    // 7. Fix malformed closing tags
    if (/<\/([a-zA-Z][a-zA-Z0-9]*)\s*\/>/.test(fixed)) {
        fixed = fixed.replace(/<\/([a-zA-Z][a-zA-Z0-9]*)\s*\/>/g, "</$1>")
        fixes.push("Fixed malformed closing tags (</tag/> to </tag>)")
    }

    // 8. Fix missing space between attributes
    if (/("[^"]*")([a-zA-Z][a-zA-Z0-9_:-]*=)/.test(fixed)) {
        fixed = fixed.replace(/("[^"]*")([a-zA-Z][a-zA-Z0-9_:-]*=)/g, "$1 $2")
        fixes.push("Added missing space between attributes")
    }

    // 9. Fix unescaped quotes in style color values
    if (/;([a-zA-Z]*[Cc]olor)="#/.test(fixed)) {
        fixed = fixed.replace(/;([a-zA-Z]*[Cc]olor)="#/g, ";$1=#")
        fixes.push("Removed quotes around color values in style")
    }

    // 10. Fix unescaped < in attribute values
    const attrLtPattern = /(=\s*")([^"]*?)(<)([^"]*?)(")/
    if (attrLtPattern.test(fixed)) {
        fixed = fixed.replace(/=\s*"([^"]*)"/g, (_match, value) => {
            const escaped = value.replace(/</g, "&lt;")
            return `="${escaped}"`
        })
        fixes.push("Escaped < characters in attribute values")
    }

    // 11. Fix invalid hex character references
    const invalidHexRefs: string[] = []
    fixed = fixed.replace(/&#x([^;]*);/g, (match, hex) => {
        if (/^[0-9a-fA-F]+$/.test(hex) && hex.length > 0) {
            return match
        }
        invalidHexRefs.push(match)
        return ""
    })
    if (invalidHexRefs.length > 0) {
        fixes.push(
            `Removed ${invalidHexRefs.length} invalid hex character reference(s)`,
        )
    }

    // 12. Fix invalid decimal character references
    const invalidDecRefs: string[] = []
    fixed = fixed.replace(/&#([^x][^;]*);/g, (match, dec) => {
        if (/^[0-9]+$/.test(dec) && dec.length > 0) {
            return match
        }
        invalidDecRefs.push(match)
        return ""
    })
    if (invalidDecRefs.length > 0) {
        fixes.push(
            `Removed ${invalidDecRefs.length} invalid decimal character reference(s)`,
        )
    }

    // 13. Fix invalid comment syntax
    fixed = fixed.replace(/<!--([\s\S]*?)-->/g, (match, content) => {
        if (/--/.test(content)) {
            let fixedContent = content
            while (/--/.test(fixedContent)) {
                fixedContent = fixedContent.replace(/--/g, "-")
            }
            fixes.push("Fixed invalid comment syntax (removed double hyphens)")
            return `<!--${fixedContent}-->`
        }
        return match
    })

    // 14. Fix <Cell> tags to <mxCell>
    if (/<\/?Cell[\s>]/i.test(fixed)) {
        fixed = fixed.replace(/<Cell(\s)/gi, "<mxCell$1")
        fixed = fixed.replace(/<Cell>/gi, "<mxCell>")
        fixed = fixed.replace(/<\/Cell>/gi, "</mxCell>")
        fixes.push("Fixed <Cell> tags to <mxCell>")
    }

    // 15. Remove non-draw.io tags
    const validDrawioTags = new Set([
        "mxfile",
        "diagram",
        "mxGraphModel",
        "root",
        "mxCell",
        "mxGeometry",
        "mxPoint",
        "Array",
        "Object",
        "mxRectangle",
    ])
    const foreignTagPattern = /<\/?([a-zA-Z][a-zA-Z0-9_]*)[^>]*>/g
    const foreignTags = new Set<string>()
    let foreignMatch
    while ((foreignMatch = foreignTagPattern.exec(fixed)) !== null) {
        const tagName = foreignMatch[1]
        if (!validDrawioTags.has(tagName)) {
            foreignTags.add(tagName)
        }
    }
    if (foreignTags.size > 0) {
        for (const tag of foreignTags) {
            fixed = fixed.replace(new RegExp(`<${tag}[^>]*>`, "gi"), "")
            fixed = fixed.replace(new RegExp(`</${tag}>`, "gi"), "")
        }
        fixes.push(
            `Removed foreign tags: ${Array.from(foreignTags).join(", ")}`,
        )
    }

    // 16. Fix closing tag typos
    const tagTypos = [
        { wrong: /<\/mxElement>/gi, right: "</mxCell>", name: "</mxElement>" },
        { wrong: /<\/mxcell>/g, right: "</mxCell>", name: "</mxcell>" },
        {
            wrong: /<\/mxgeometry>/g,
            right: "</mxGeometry>",
            name: "</mxgeometry>",
        },
        { wrong: /<\/mxpoint>/g, right: "</mxPoint>", name: "</mxpoint>" },
        {
            wrong: /<\/mxgraphmodel>/gi,
            right: "</mxGraphModel>",
            name: "</mxgraphmodel>",
        },
    ]
    for (const { wrong, right, name } of tagTypos) {
        if (wrong.test(fixed)) {
            fixed = fixed.replace(wrong, right)
            fixes.push(`Fixed typo ${name} to ${right}`)
        }
    }

    // 17. Fix unclosed tags
    const tagStack: string[] = []
    const parsedTags = parseXmlTags(fixed)
    for (const { tagName, isClosing, isSelfClosing } of parsedTags) {
        if (isClosing) {
            const lastIdx = tagStack.lastIndexOf(tagName)
            if (lastIdx !== -1) {
                tagStack.splice(lastIdx, 1)
            }
        } else if (!isSelfClosing) {
            tagStack.push(tagName)
        }
    }

    if (tagStack.length > 0) {
        const tagsToClose: string[] = []
        for (const tagName of tagStack.reverse()) {
            const openCount = (
                fixed.match(new RegExp(`<${tagName}[\\s>]`, "gi")) || []
            ).length
            const closeCount = (
                fixed.match(new RegExp(`</${tagName}>`, "gi")) || []
            ).length
            if (openCount > closeCount) {
                tagsToClose.push(tagName)
            }
        }
        if (tagsToClose.length > 0) {
            const closingTags = tagsToClose.map((t) => `</${t}>`).join("\n")
            fixed = fixed.trimEnd() + "\n" + closingTags
            fixes.push(
                `Closed ${tagsToClose.length} unclosed tag(s): ${tagsToClose.join(", ")}`,
            )
        }
    }

    // 18. Remove extra closing tags
    const tagCounts = new Map<
        string,
        { opens: number; closes: number; selfClosing: number }
    >()
    const fullTagPattern = /<(\/?[a-zA-Z][a-zA-Z0-9]*)[^>]*>/g
    let tagCountMatch
    while ((tagCountMatch = fullTagPattern.exec(fixed)) !== null) {
        const fullMatch = tagCountMatch[0]
        const tagPart = tagCountMatch[1]
        const isClosing = tagPart.startsWith("/")
        const isSelfClosing = fullMatch.endsWith("/>")
        const tagName = isClosing ? tagPart.slice(1) : tagPart

        let counts = tagCounts.get(tagName)
        if (!counts) {
            counts = { opens: 0, closes: 0, selfClosing: 0 }
            tagCounts.set(tagName, counts)
        }
        if (isClosing) {
            counts.closes++
        } else if (isSelfClosing) {
            counts.selfClosing++
        } else {
            counts.opens++
        }
    }

    for (const [tagName, counts] of tagCounts) {
        const extraCloses = counts.closes - counts.opens
        if (extraCloses > 0) {
            let removed = 0
            const closeTagPattern = new RegExp(`</${tagName}>`, "g")
            const matches = [...fixed.matchAll(closeTagPattern)]
            for (
                let i = matches.length - 1;
                i >= 0 && removed < extraCloses;
                i--
            ) {
                const match = matches[i]
                const idx = match.index ?? 0
                fixed = fixed.slice(0, idx) + fixed.slice(idx + match[0].length)
                removed++
            }
            if (removed > 0) {
                fixes.push(
                    `Removed ${removed} extra </${tagName}> closing tag(s)`,
                )
            }
        }
    }

    // 19. Remove trailing garbage
    const closingTagPattern = /<\/[a-zA-Z][a-zA-Z0-9]*>|\/>/g
    let lastValidTagEnd = -1
    let closingMatch
    while ((closingMatch = closingTagPattern.exec(fixed)) !== null) {
        lastValidTagEnd = closingMatch.index + closingMatch[0].length
    }
    if (lastValidTagEnd > 0 && lastValidTagEnd < fixed.length) {
        const trailing = fixed.slice(lastValidTagEnd).trim()
        if (trailing) {
            fixed = fixed.slice(0, lastValidTagEnd)
            fixes.push("Removed trailing garbage after last XML tag")
        }
    }

    // 20. Fix nested mxCell with duplicate IDs
    let lines = fixed.split("\n")
    let newLines: string[] = []
    let nestedFixed = 0
    let extraClosingToRemove = 0

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const nextLine = lines[i + 1]

        if (
            nextLine &&
            /<mxCell\s/.test(line) &&
            /<mxCell\s/.test(nextLine) &&
            !line.includes("/>") &&
            !nextLine.includes("/>")
        ) {
            const id1 = line.match(/\bid\s*=\s*["']([^"']+)["']/)?.[1]
            const id2 = nextLine.match(/\bid\s*=\s*["']([^"']+)["']/)?.[1]

            if (id1 && id1 === id2) {
                nestedFixed++
                extraClosingToRemove++
                continue
            }
        }

        if (extraClosingToRemove > 0 && /^\s*<\/mxCell>\s*$/.test(line)) {
            extraClosingToRemove--
            continue
        }

        newLines.push(line)
    }

    if (nestedFixed > 0) {
        fixed = newLines.join("\n")
        fixes.push(`Flattened ${nestedFixed} duplicate-ID nested mxCell(s)`)
    }

    // 21. Fix true nesting (different IDs)
    const lines2 = fixed.split("\n")
    newLines = []
    let trueNestedFixed = 0
    let cellDepth = 0
    let pendingCloseRemoval = 0

    for (let i = 0; i < lines2.length; i++) {
        const line = lines2[i]
        const trimmed = line.trim()

        const isOpenCell = /<mxCell\s/.test(trimmed) && !trimmed.endsWith("/>")
        const isCloseCell = trimmed === "</mxCell>"

        if (isOpenCell) {
            if (cellDepth > 0) {
                const indent = line.match(/^(\s*)/)?.[1] || ""
                newLines.push(indent + "</mxCell>")
                trueNestedFixed++
                pendingCloseRemoval++
            }
            cellDepth = 1
            newLines.push(line)
        } else if (isCloseCell) {
            if (pendingCloseRemoval > 0) {
                pendingCloseRemoval--
            } else {
                cellDepth = Math.max(0, cellDepth - 1)
                newLines.push(line)
            }
        } else {
            newLines.push(line)
        }
    }

    if (trueNestedFixed > 0) {
        fixed = newLines.join("\n")
        fixes.push(`Fixed ${trueNestedFixed} true nested mxCell(s)`)
    }

    // 22. Fix duplicate IDs by appending suffix
    const seenIds = new Map<string, number>()
    const duplicateIds: string[] = []

    const idPattern = /\bid\s*=\s*["']([^"']+)["']/gi
    let idMatch
    while ((idMatch = idPattern.exec(fixed)) !== null) {
        const id = idMatch[1]
        seenIds.set(id, (seenIds.get(id) || 0) + 1)
    }

    for (const [id, count] of seenIds) {
        if (count > 1) duplicateIds.push(id)
    }

    if (duplicateIds.length > 0) {
        const idCounters = new Map<string, number>()
        fixed = fixed.replace(/\bid\s*=\s*["']([^"']+)["']/gi, (match, id) => {
            if (!duplicateIds.includes(id)) return match

            const count = idCounters.get(id) || 0
            idCounters.set(id, count + 1)

            if (count === 0) return match

            const newId = `${id}_dup${count}`
            return match.replace(id, newId)
        })
        fixes.push(`Renamed ${duplicateIds.length} duplicate ID(s)`)
    }

    // 23. Fix empty id attributes
    let emptyIdCount = 0
    fixed = fixed.replace(
        /<mxCell([^>]*)\sid\s*=\s*["']\s*["']([^>]*)>/g,
        (_match, before, after) => {
            emptyIdCount++
            const newId = `cell_${Date.now()}_${emptyIdCount}`
            return `<mxCell${before} id="${newId}"${after}>`
        },
    )
    if (emptyIdCount > 0) {
        fixes.push(`Generated ${emptyIdCount} missing ID(s)`)
    }

    // 24. Aggressive: drop broken mxCell elements
    if (typeof DOMParser !== "undefined") {
        let droppedCells = 0
        let maxIterations = MAX_DROP_ITERATIONS
        while (maxIterations-- > 0) {
            const parser = new DOMParser()
            const doc = parser.parseFromString(fixed, "text/xml")
            const parseError = doc.querySelector("parsererror")
            if (!parseError) break

            const errText = parseError.textContent || ""
            const match = errText.match(/(\d+):\d+:/)
            if (!match) break

            const errLine = parseInt(match[1], 10) - 1
            lines = fixed.split("\n")

            let cellStart = errLine
            let cellEnd = errLine

            while (cellStart > 0 && !lines[cellStart].includes("<mxCell")) {
                cellStart--
            }

            while (cellEnd < lines.length - 1) {
                if (
                    lines[cellEnd].includes("</mxCell>") ||
                    lines[cellEnd].trim().endsWith("/>")
                ) {
                    break
                }
                cellEnd++
            }

            lines.splice(cellStart, cellEnd - cellStart + 1)
            fixed = lines.join("\n")
            droppedCells++
        }
        if (droppedCells > 0) {
            fixes.push(`Dropped ${droppedCells} unfixable mxCell element(s)`)
        }
    }

    return { fixed, fixes }
}

/**
 * Validate XML and attempt auto-fix if invalid.
 * Returns validation result with applied fixes.
 */
export function validateAndFixXml(xml: string): {
    valid: boolean
    error: string | null
    fixed: string | null
    fixes: string[]
} {
    let error = validateMxCellStructure(xml)

    if (!error) {
        return { valid: true, error: null, fixed: null, fixes: [] }
    }

    const { fixed, fixes } = autoFixXml(xml)

    error = validateMxCellStructure(fixed)

    if (!error) {
        return { valid: true, error: null, fixed, fixes }
    }

    return {
        valid: false,
        error,
        fixed: fixes.length > 0 ? fixed : null,
        fixes,
    }
}

export function extractDiagramXML(xml_svg_string: string): string {
    try {
        // 1. Parse the SVG string (using built-in DOMParser in a browser-like environment)
        const svgString = atob(xml_svg_string.slice(26))
        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml")
        const svgElement = svgDoc.querySelector("svg")

        if (!svgElement) {
            throw new Error("No SVG element found in the input string.")
        }
        // 2. Extract the 'content' attribute
        const encodedContent = svgElement.getAttribute("content")

        if (!encodedContent) {
            throw new Error("SVG element does not have a 'content' attribute.")
        }

        // 3. Decode HTML entities (using a minimal function)
        function decodeHtmlEntities(str: string) {
            const textarea = document.createElement("textarea") // Use built-in element
            textarea.innerHTML = str
            return textarea.value
        }
        const xmlContent = decodeHtmlEntities(encodedContent)

        // 4. Parse the XML content
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml")
        const diagramElement = xmlDoc.querySelector("diagram")

        if (!diagramElement) {
            throw new Error("No diagram element found")
        }
        // 5. Extract base64 encoded data
        const base64EncodedData = diagramElement.textContent

        if (!base64EncodedData) {
            throw new Error("No encoded data found in the diagram element")
        }

        // 6. Decode base64 data
        const binaryString = atob(base64EncodedData)

        // 7. Convert binary string to Uint8Array
        const len = binaryString.length
        const bytes = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }

        // 8. Decompress data using pako (equivalent to zlib.decompress with wbits=-15)
        const decompressedData = pako.inflate(bytes, { windowBits: -15 })

        // 9. Convert the decompressed data to a string
        const decoder = new TextDecoder("utf-8")
        const decodedString = decoder.decode(decompressedData)

        // Decode URL-encoded content (equivalent to Python's urllib.parse.unquote)
        const urlDecodedString = decodeURIComponent(decodedString)

        return urlDecodedString
    } catch (error) {
        console.error("Error extracting diagram XML:", error)
        throw error // Re-throw for caller handling
    }
}
