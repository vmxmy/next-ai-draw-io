/**
 * mxCell XML to Component Parser
 *
 * Parses draw.io mxCell XML format back to A2UI-style component definitions.
 * Useful for analyzing existing diagrams and enabling component-level editing.
 */

import type {
    ActorComponent,
    AWSIconComponent,
    AzureIconComponent,
    CalloutComponent,
    CloudComponent,
    ComponentType,
    ConnectorComponent,
    ConnectorStyle,
    CylinderComponent,
    DiamondComponent,
    DocumentComponent,
    DrawIOComponent,
    EllipseComponent,
    GCPIconComponent,
    GroupComponent,
    HexagonComponent,
    Position,
    RectangleComponent,
    RoundedRectComponent,
    Size,
    SwimlaneComponent,
    TextComponent,
} from "./types"

/**
 * Parse mxCell XML to component array
 */
export function xmlToComponents(xml: string): DrawIOComponent[] {
    // Use browser DOMParser or Node.js alternative
    const parser =
        typeof DOMParser !== "undefined"
            ? new DOMParser()
            : // For Node.js environments, we'd need xmldom or similar
              null

    if (!parser) {
        throw new Error("DOMParser not available in this environment")
    }

    const doc = parser.parseFromString(xml, "text/xml")

    // Check for parse errors
    const parseError = doc.querySelector("parsererror")
    if (parseError) {
        throw new Error(`XML parse error: ${parseError.textContent}`)
    }

    const cells = doc.querySelectorAll("mxCell")
    const components: DrawIOComponent[] = []

    cells.forEach((cell) => {
        const id = cell.getAttribute("id")
        // Skip root cells (id="0" and id="1")
        if (!id || id === "0" || id === "1") return

        const component = cellToComponent(cell)
        if (component) {
            components.push(component)
        }
    })

    return components
}

/**
 * Convert a single mxCell element to a component
 */
export function cellToComponent(cell: Element): DrawIOComponent | null {
    const id = cell.getAttribute("id")
    if (!id) return null

    const style = cell.getAttribute("style") || ""
    const value = cell.getAttribute("value") || ""
    const isEdge = cell.getAttribute("edge") === "1"
    const parent = cell.getAttribute("parent") || "1"

    // Parse geometry
    const geometry = parseGeometry(cell)

    // Handle edge/connector
    if (isEdge) {
        return parseConnector(cell, id, style, value, parent)
    }

    // Determine component type from style
    const componentType = inferComponentType(style)

    // Parse style properties
    const styleProps = parseStyle(style)

    // Build base component
    const baseProps = {
        id,
        parent: parent !== "1" ? parent : undefined,
        position: geometry.position,
        size: geometry.size,
    }

    // Build component based on type
    switch (componentType) {
        case "Ellipse":
            return {
                ...baseProps,
                component: "Ellipse",
                label: unescapeXmlValue(value),
                ...extractShapeStyle(styleProps),
            } as EllipseComponent

        case "Diamond":
            return {
                ...baseProps,
                component: "Diamond",
                label: unescapeXmlValue(value),
                ...extractShapeStyle(styleProps),
            } as DiamondComponent

        case "Swimlane":
            return {
                ...baseProps,
                component: "Swimlane",
                title: unescapeXmlValue(value),
                titleHeight: styleProps.startSize
                    ? parseInt(styleProps.startSize, 10)
                    : undefined,
                horizontal: styleProps.horizontal === "1",
                ...extractShapeStyle(styleProps),
            } as SwimlaneComponent

        case "RoundedRect":
            return {
                ...baseProps,
                component: "RoundedRect",
                label: unescapeXmlValue(value),
                cornerRadius: styleProps.arcSize
                    ? parseInt(styleProps.arcSize, 10)
                    : undefined,
                ...extractShapeStyle(styleProps),
            } as RoundedRectComponent

        case "Text":
            return {
                ...baseProps,
                component: "Text",
                text: unescapeXmlValue(value),
                ...extractTextStyle(styleProps),
            } as TextComponent

        case "Cylinder":
            return {
                ...baseProps,
                component: "Cylinder",
                label: unescapeXmlValue(value),
                ...extractShapeStyle(styleProps),
            } as CylinderComponent

        case "Hexagon":
            return {
                ...baseProps,
                component: "Hexagon",
                label: unescapeXmlValue(value),
                ...extractShapeStyle(styleProps),
            } as HexagonComponent

        case "Document":
            return {
                ...baseProps,
                component: "Document",
                label: unescapeXmlValue(value),
                ...extractShapeStyle(styleProps),
            } as DocumentComponent

        case "Cloud":
            return {
                ...baseProps,
                component: "Cloud",
                label: unescapeXmlValue(value),
                ...extractShapeStyle(styleProps),
            } as CloudComponent

        case "Callout":
            return {
                ...baseProps,
                component: "Callout",
                text: unescapeXmlValue(value),
                ...extractShapeStyle(styleProps),
            } as CalloutComponent

        case "Actor":
            return {
                ...baseProps,
                component: "Actor",
                label: unescapeXmlValue(value),
            } as ActorComponent

        case "Group":
            return {
                ...baseProps,
                component: "Group",
                children: [], // Children are determined by parent references
            } as GroupComponent

        case "AWSIcon": {
            const service = extractAWSService(style)
            return {
                ...baseProps,
                component: "AWSIcon",
                service,
                label: unescapeXmlValue(value),
            } as AWSIconComponent
        }

        case "AzureIcon": {
            const service = extractAzureService(style)
            return {
                ...baseProps,
                component: "AzureIcon",
                service,
                label: unescapeXmlValue(value),
            } as AzureIconComponent
        }

        case "GCPIcon": {
            const service = extractGCPService(style)
            return {
                ...baseProps,
                component: "GCPIcon",
                service,
                label: unescapeXmlValue(value),
            } as GCPIconComponent
        }

        default:
            // Default to Rectangle for unknown component types
            return {
                ...baseProps,
                component: "Rectangle",
                label: unescapeXmlValue(value),
                ...extractShapeStyle(styleProps),
            } as RectangleComponent
    }
}

/**
 * Parse connector/edge from mxCell
 */
function parseConnector(
    cell: Element,
    id: string,
    style: string,
    value: string,
    parent: string,
): ConnectorComponent {
    const source = cell.getAttribute("source") || ""
    const target = cell.getAttribute("target") || ""
    const styleProps = parseStyle(style)

    // Parse waypoints
    const waypoints: Position[] = []
    const pointsArray = cell.querySelector('Array[as="points"]')
    if (pointsArray) {
        pointsArray.querySelectorAll("mxPoint").forEach((point) => {
            const x = parseFloat(point.getAttribute("x") || "0")
            const y = parseFloat(point.getAttribute("y") || "0")
            waypoints.push({ x, y })
        })
    }

    // Parse connector style
    const connectorStyle: ConnectorStyle = {
        lineType: styleProps.edgeStyle?.includes("orthogonal")
            ? "orthogonal"
            : styleProps.curved === "1"
              ? "curved"
              : styleProps.edgeStyle?.includes("entityRelation")
                ? "entityRelation"
                : "straight",
        endArrow:
            (styleProps.endArrow as ConnectorStyle["endArrow"]) || "classic",
        startArrow:
            (styleProps.startArrow as ConnectorStyle["startArrow"]) || "none",
        strokeColor: styleProps.strokeColor,
        strokeWidth: styleProps.strokeWidth
            ? parseInt(styleProps.strokeWidth, 10)
            : undefined,
        dashed: styleProps.dashed === "1",
        animated: styleProps.flowAnimation === "1",
        exitX: styleProps.exitX ? parseFloat(styleProps.exitX) : undefined,
        exitY: styleProps.exitY ? parseFloat(styleProps.exitY) : undefined,
        entryX: styleProps.entryX ? parseFloat(styleProps.entryX) : undefined,
        entryY: styleProps.entryY ? parseFloat(styleProps.entryY) : undefined,
    }

    return {
        component: "Connector",
        id,
        source,
        target,
        parent: parent !== "1" ? parent : undefined,
        label: unescapeXmlValue(value),
        style: connectorStyle,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
    }
}

/**
 * Parse geometry from mxCell
 */
function parseGeometry(cell: Element): {
    position?: Position
    size?: Size
} {
    const geo = cell.querySelector("mxGeometry")
    if (!geo) return {}

    const x = geo.getAttribute("x")
    const y = geo.getAttribute("y")
    const width = geo.getAttribute("width")
    const height = geo.getAttribute("height")

    return {
        position:
            x !== null && y !== null
                ? { x: parseFloat(x), y: parseFloat(y) }
                : undefined,
        size:
            width !== null && height !== null
                ? { width: parseFloat(width), height: parseFloat(height) }
                : undefined,
    }
}

/**
 * Infer component type from style string
 */
function inferComponentType(style: string): ComponentType {
    const s = style.toLowerCase()

    // Check for specific shapes first
    if (s.includes("ellipse") && s.includes("shape=cloud")) return "Cloud"
    if (s.includes("ellipse")) return "Ellipse"
    if (s.includes("rhombus")) return "Diamond"
    if (s.includes("swimlane")) return "Swimlane"
    if (s.includes("group")) return "Group"
    if (s.includes("shape=cylinder")) return "Cylinder"
    if (s.includes("shape=hexagon")) return "Hexagon"
    if (s.includes("shape=document")) return "Document"
    if (s.includes("shape=callout")) return "Callout"
    if (s.includes("shape=umlactor")) return "Actor"
    if (s.includes("text;") || s.startsWith("text")) return "Text"

    // Cloud provider icons
    if (s.includes("mxgraph.aws4.")) return "AWSIcon"
    if (s.includes("mxgraph.azure.")) return "AzureIcon"
    if (s.includes("mxgraph.gcp2.")) return "GCPIcon"

    // Rounded vs regular rectangle
    if (s.includes("rounded=1")) return "RoundedRect"

    return "Rectangle"
}

/**
 * Parse style string to key-value pairs
 */
function parseStyle(style: string): Record<string, string> {
    const props: Record<string, string> = {}
    style.split(";").forEach((part) => {
        const eqIndex = part.indexOf("=")
        if (eqIndex > 0) {
            const key = part.substring(0, eqIndex).trim()
            const val = part.substring(eqIndex + 1).trim()
            props[key] = val
        }
    })
    return props
}

/**
 * Extract shape style properties from parsed style
 */
function extractShapeStyle(props: Record<string, string>): Partial<{
    fill: string
    stroke: string
    strokeWidth: number
    opacity: number
    shadow: boolean
    dashed: boolean
}> {
    const result: Record<string, unknown> = {}

    if (props.fillColor) result.fill = props.fillColor
    if (props.strokeColor) result.stroke = props.strokeColor
    if (props.strokeWidth) result.strokeWidth = parseInt(props.strokeWidth, 10)
    if (props.opacity) result.opacity = parseInt(props.opacity, 10)
    if (props.shadow === "1") result.shadow = true
    if (props.dashed === "1") result.dashed = true

    return result
}

/**
 * Extract text style properties from parsed style
 */
function extractTextStyle(props: Record<string, string>): Partial<{
    fontSize: number
    fontFamily: string
    fontColor: string
    fontStyle: "normal" | "bold" | "italic" | "boldItalic"
    align: "left" | "center" | "right"
    verticalAlign: "top" | "middle" | "bottom"
}> {
    const result: Record<string, unknown> = {}

    if (props.fontSize) result.fontSize = parseInt(props.fontSize, 10)
    if (props.fontFamily) result.fontFamily = props.fontFamily
    if (props.fontColor) result.fontColor = props.fontColor
    if (props.fontStyle) {
        const styleMap: Record<string, string> = {
            "0": "normal",
            "1": "bold",
            "2": "italic",
            "3": "boldItalic",
        }
        result.fontStyle = styleMap[props.fontStyle] || "normal"
    }
    if (props.align) {
        result.align = props.align as "left" | "center" | "right"
    }
    if (props.verticalAlign) {
        result.verticalAlign = props.verticalAlign as
            | "top"
            | "middle"
            | "bottom"
    }

    return result
}

/**
 * Extract AWS service name from style
 */
function extractAWSService(style: string): string {
    const match = style.match(/mxgraph\.aws4\.(\w+)/i)
    if (match) {
        // Convert snake_case to PascalCase
        return match[1]
            .split("_")
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join("")
    }
    return "EC2" // Default
}

/**
 * Extract Azure service name from style
 */
function extractAzureService(style: string): string {
    const match = style.match(/mxgraph\.azure\.[^.]+\.(\w+)/i)
    if (match) {
        return match[1]
            .split("_")
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join("")
    }
    return "VirtualMachine" // Default
}

/**
 * Extract GCP service name from style
 */
function extractGCPService(style: string): string {
    const match = style.match(/mxgraph\.gcp2\.(\w+)/i)
    if (match) {
        return match[1]
            .split("_")
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join("")
    }
    return "ComputeEngine" // Default
}

/**
 * Unescape XML character entities
 */
function unescapeXmlValue(value: string): string {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#xa;/g, "\n")
        .replace(/&#160;/g, " ")
}

/**
 * Populate children arrays for container components
 * This is a post-processing step after parsing all components
 */
export function resolveChildRelationships(
    components: DrawIOComponent[],
): DrawIOComponent[] {
    const componentMap = new Map(components.map((c) => [c.id, c]))

    for (const component of components) {
        // Check if this component has a non-root parent
        const parentId = "parent" in component ? component.parent : undefined
        if (parentId && parentId !== "1") {
            const parent = componentMap.get(parentId)
            if (
                parent &&
                (parent.component === "Swimlane" ||
                    parent.component === "Group")
            ) {
                // Add this component to parent's children
                if (!("children" in parent) || !parent.children) {
                    ;(parent as SwimlaneComponent | GroupComponent).children =
                        []
                }
                const children = (parent as SwimlaneComponent | GroupComponent)
                    .children!
                if (!children.includes(component.id)) {
                    children.push(component.id)
                }
            }
        }
    }

    return components
}

/**
 * Generate a summary of parsed components
 */
export function summarizeComponents(components: DrawIOComponent[]): string {
    const typeCount: Record<string, number> = {}

    for (const component of components) {
        const type = component.component
        typeCount[type] = (typeCount[type] || 0) + 1
    }

    const lines = [`Total components: ${components.length}`, "", "By type:"]

    for (const [type, count] of Object.entries(typeCount).sort(
        (a, b) => b[1] - a[1],
    )) {
        lines.push(`  ${type}: ${count}`)
    }

    return lines.join("\n")
}
