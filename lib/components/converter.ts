/**
 * Component to mxCell XML Converter
 *
 * Converts A2UI-style component definitions to draw.io mxCell XML format.
 */

import {
    getAWSShape,
    getAzureShape,
    getDefaultSize,
    getGCPShape,
} from "./catalog"
import type {
    AWSIconComponent,
    AzureIconComponent,
    CalloutComponent,
    CardComponent,
    ConnectorComponent,
    ConnectorStyle,
    DrawIOComponent,
    GCPIconComponent,
    ImageComponent,
    ListComponent,
    ProcessComponent,
    ShapeStyle,
    SwimlaneComponent,
    TableComponent,
    TextComponent,
    TextStyle,
    TimelineComponent,
} from "./types"

/**
 * Convert a flat list of components to complete mxGraphModel XML
 */
export function componentsToXml(components: DrawIOComponent[]): string {
    const cellsXml: string[] = []

    // Add root cells (required by draw.io)
    cellsXml.push('    <mxCell id="0"/>')
    cellsXml.push('    <mxCell id="1" parent="0"/>')

    // Sort components: vertices first, then edges (edges need source/target to exist)
    const vertices = components.filter((c) => c.component !== "Connector")
    const edges = components.filter(
        (c) => c.component === "Connector",
    ) as ConnectorComponent[]

    // Process vertices
    for (const component of vertices) {
        const cellXml = componentToCellXml(component)
        cellsXml.push(cellXml)
    }

    // Process edges
    for (const edge of edges) {
        const cellXml = connectorToCellXml(edge)
        cellsXml.push(cellXml)
    }

    return `<mxGraphModel>
  <root>
${cellsXml.join("\n")}
  </root>
</mxGraphModel>`
}

/**
 * Convert a single component to mxCell XML
 */
export function componentToCellXml(component: DrawIOComponent): string {
    if (component.component === "Connector") {
        return connectorToCellXml(component as ConnectorComponent)
    }

    const style = buildStyleString(component)
    const parent = ("parent" in component && component.parent) || "1"
    const label = escapeXmlValue(getComponentLabel(component))
    const geometry = buildGeometryXml(component)

    return `    <mxCell id="${component.id}" value="${label}" style="${style}" vertex="1" parent="${parent}">
      ${geometry}
    </mxCell>`
}

/**
 * Build mxGraph style string from component properties
 */
function buildStyleString(component: DrawIOComponent): string {
    const parts: string[] = []

    // Add base shape style
    switch (component.component) {
        case "Rectangle":
            parts.push("rounded=0")
            break

        case "RoundedRect":
            parts.push("rounded=1")
            if (component.cornerRadius !== undefined) {
                parts.push(`arcSize=${component.cornerRadius}`)
            }
            break

        case "Ellipse":
            parts.push("ellipse")
            break

        case "Diamond":
            parts.push("rhombus")
            break

        case "Hexagon":
            parts.push("shape=hexagon")
            parts.push("perimeter=hexagonPerimeter2")
            break

        case "Triangle":
            parts.push("triangle")
            if (component.direction) {
                parts.push(`direction=${component.direction}`)
            }
            break

        case "Cylinder":
            parts.push("shape=cylinder3")
            parts.push("boundedLbl=1")
            parts.push("backgroundOutline=1")
            parts.push("size=15")
            break

        case "Parallelogram":
            parts.push("shape=parallelogram")
            parts.push("perimeter=parallelogramPerimeter")
            break

        case "Step":
            parts.push("shape=step")
            parts.push("perimeter=stepPerimeter")
            parts.push("fixedSize=1")
            break

        case "Note":
            parts.push("shape=note")
            parts.push("size=14")
            break

        case "UMLClass":
            parts.push("swimlane")
            parts.push("fontStyle=1")
            parts.push("childLayout=stackLayout")
            parts.push("horizontal=1")
            parts.push("startSize=30")
            parts.push("horizontalStack=0")
            parts.push("resizeParent=1")
            parts.push("resizeParentMax=0")
            parts.push("resizeLast=0")
            parts.push("collapsible=1")
            parts.push("marginBottom=0")
            break

        case "UMLInterface":
            parts.push("swimlane")
            parts.push("fontStyle=1")
            parts.push("startSize=30")
            break

        case "UMLPackage":
            parts.push("shape=umlFrame")
            parts.push("pointerEvents=0")
            break

        case "Server":
            parts.push("shape=mxgraph.cisco.servers.standard_host")
            parts.push("sketch=0")
            break

        case "Desktop":
            parts.push("shape=mxgraph.cisco.computers_and_peripherals.pc")
            parts.push("sketch=0")
            break

        case "Laptop":
            parts.push("shape=mxgraph.cisco.computers_and_peripherals.laptop")
            parts.push("sketch=0")
            break

        case "Router":
            parts.push("shape=mxgraph.cisco.routers.router")
            parts.push("sketch=0")
            break

        case "Switch":
            parts.push("shape=mxgraph.cisco.switches.workgroup_switch")
            parts.push("sketch=0")
            break

        case "Firewall":
            parts.push("shape=mxgraph.cisco.security.firewall")
            parts.push("sketch=0")
            break

        case "Internet":
            parts.push("shape=mxgraph.cisco.misc.cloud")
            parts.push("sketch=0")
            break

        case "Database":
            parts.push("shape=mxgraph.cisco.storage.database")
            parts.push("sketch=0")
            break

        case "Text":
            parts.push("text")
            parts.push("strokeColor=none")
            parts.push("fillColor=none")
            break

        case "Image":
            parts.push("shape=image")
            parts.push(`image=${component.src}`)
            if (component.preserveAspect) {
                parts.push("imageAspect=1")
                parts.push("aspect=fixed")
            }
            break

        case "Swimlane":
            parts.push("swimlane")
            if (component.titleHeight) {
                parts.push(`startSize=${component.titleHeight}`)
            } else {
                parts.push("startSize=30")
            }
            if (component.horizontal) {
                parts.push("horizontal=1")
            }
            if (component.collapsible) {
                parts.push("collapsible=1")
            }
            if (component.collapsed) {
                parts.push("collapsed=1")
            }
            break

        case "Group":
            parts.push("group")
            if (component.collapsible) {
                parts.push("collapsible=1")
            }
            break

        case "AWSIcon":
            parts.push(`shape=${getAWSShape(component.service)}`)
            parts.push("sketch=0")
            parts.push("outlineConnect=0")
            parts.push("fontColor=#232F3E")
            parts.push("gradientColor=none")
            break

        case "AzureIcon":
            parts.push(`shape=${getAzureShape(component.service)}`)
            parts.push("sketch=0")
            parts.push("aspect=fixed")
            break

        case "GCPIcon":
            parts.push(`shape=${getGCPShape(component.service)}`)
            parts.push("sketch=0")
            parts.push("aspect=fixed")
            break

        case "Card":
            parts.push("swimlane")
            parts.push("startSize=40")
            parts.push("horizontal=1")
            break

        case "List":
            parts.push("swimlane")
            parts.push("fontStyle=0")
            parts.push("startSize=26")
            parts.push("horizontal=1")
            break

        case "Table":
            parts.push("shape=table")
            parts.push("startSize=30")
            parts.push("container=1")
            parts.push("collapsible=0")
            parts.push("childLayout=tableLayout")
            break

        case "Timeline":
            parts.push("rounded=1")
            break

        case "Process":
            parts.push("rounded=1")
            break

        case "Callout":
            parts.push("shape=callout")
            parts.push("perimeter=calloutPerimeter")
            if (component.pointerDirection) {
                const dirMap = { left: 0, right: 180, top: 90, bottom: 270 }
                parts.push(
                    `base=20;position=0.5;position2=0.5;direction=${dirMap[component.pointerDirection] || 0}`,
                )
            }
            break

        case "Actor":
            parts.push("shape=umlActor")
            parts.push("verticalLabelPosition=bottom")
            parts.push("verticalAlign=top")
            break

        case "Document":
            parts.push("shape=document")
            parts.push("boundedLbl=1")
            break

        case "Cloud":
            parts.push("ellipse")
            parts.push("shape=cloud")
            break
    }

    // Add shape style properties
    addShapeStyleProperties(component, parts)

    // Add text style properties
    addTextStyleProperties(component, parts)

    // Common properties
    parts.push("whiteSpace=wrap")
    parts.push("html=1")

    return parts.join(";") + ";"
}

/**
 * Add shape style properties to style parts array
 */
function addShapeStyleProperties(
    component: DrawIOComponent,
    parts: string[],
): void {
    const shape = component as ShapeStyle

    if (shape.fill) {
        parts.push(`fillColor=${shape.fill}`)
    }
    if (shape.stroke) {
        parts.push(`strokeColor=${shape.stroke}`)
    }
    if (shape.strokeWidth !== undefined) {
        parts.push(`strokeWidth=${shape.strokeWidth}`)
    }
    if (shape.opacity !== undefined) {
        parts.push(`opacity=${shape.opacity}`)
    }
    if (shape.shadow) {
        parts.push("shadow=1")
    }
    if (shape.dashed) {
        parts.push("dashed=1")
    }

    // Swimlane-specific
    if (component.component === "Swimlane" || component.component === "Card") {
        const swimlane = component as SwimlaneComponent | CardComponent
        if ("headerFill" in swimlane && swimlane.headerFill) {
            parts.push(`swimlaneFillColor=${swimlane.headerFill}`)
        }
        if ("headerColor" in swimlane && swimlane.headerColor) {
            parts.push(`swimlaneFillColor=${swimlane.headerColor}`)
        }
    }

    // Callout-specific
    if (component.component === "Callout" && component.calloutStyle) {
        const colorMap = {
            note: "#ffffc0",
            warning: "#ffcccc",
            info: "#cce5ff",
            tip: "#ccffcc",
        }
        parts.push(`fillColor=${colorMap[component.calloutStyle] || "#ffffc0"}`)
    }
}

/**
 * Add text style properties to style parts array
 */
function addTextStyleProperties(
    component: DrawIOComponent,
    parts: string[],
): void {
    const text = component as TextStyle

    if (text.fontSize !== undefined) {
        parts.push(`fontSize=${text.fontSize}`)
    }
    if (text.fontFamily) {
        parts.push(`fontFamily=${text.fontFamily}`)
    }
    if (text.fontColor) {
        parts.push(`fontColor=${text.fontColor}`)
    }
    if (text.fontStyle) {
        const fontStyleMap = { normal: 0, bold: 1, italic: 2, boldItalic: 3 }
        parts.push(`fontStyle=${fontStyleMap[text.fontStyle]}`)
    }
    if (text.align) {
        parts.push(`align=${text.align}`)
    }
    if (text.verticalAlign) {
        parts.push(`verticalAlign=${text.verticalAlign}`)
    }
}

/**
 * Convert connector component to mxCell XML
 */
function connectorToCellXml(connector: ConnectorComponent): string {
    const styleParts: string[] = []
    const style = connector.style || ({} as ConnectorStyle)

    // Edge routing style
    switch (style.lineType) {
        case "orthogonal":
            styleParts.push("edgeStyle=orthogonalEdgeStyle")
            break
        case "curved":
            styleParts.push("curved=1")
            break
        case "entityRelation":
            styleParts.push("edgeStyle=entityRelationEdgeStyle")
            break
        default:
            styleParts.push("edgeStyle=orthogonalEdgeStyle")
    }

    // Arrow styles
    styleParts.push(`endArrow=${style.endArrow || "classic"}`)
    styleParts.push(`startArrow=${style.startArrow || "none"}`)

    // Stroke properties
    if (style.strokeColor) {
        styleParts.push(`strokeColor=${style.strokeColor}`)
    }
    if (style.strokeWidth !== undefined) {
        styleParts.push(`strokeWidth=${style.strokeWidth}`)
    }
    if (style.dashed) {
        styleParts.push("dashed=1")
    }
    if (style.animated) {
        styleParts.push("flowAnimation=1")
    }

    // Exit/entry points
    if (style.exitX !== undefined) {
        styleParts.push(`exitX=${style.exitX}`)
    }
    if (style.exitY !== undefined) {
        styleParts.push(`exitY=${style.exitY}`)
    }
    if (style.entryX !== undefined) {
        styleParts.push(`entryX=${style.entryX}`)
    }
    if (style.entryY !== undefined) {
        styleParts.push(`entryY=${style.entryY}`)
    }

    styleParts.push("html=1")

    const styleStr = styleParts.join(";") + ";"
    const parent = connector.parent || "1"
    const label = connector.label ? escapeXmlValue(connector.label) : ""

    // Build geometry with waypoints
    let geometryContent = ""
    if (connector.waypoints && connector.waypoints.length > 0) {
        const pointsXml = connector.waypoints
            .map((p) => `          <mxPoint x="${p.x}" y="${p.y}"/>`)
            .join("\n")
        geometryContent = `
        <Array as="points">
${pointsXml}
        </Array>
      `
    }

    return `    <mxCell id="${connector.id}" value="${label}" style="${styleStr}" edge="1" parent="${parent}" source="${connector.source}" target="${connector.target}">
      <mxGeometry relative="1" as="geometry">${geometryContent}</mxGeometry>
    </mxCell>`
}

/**
 * Build mxGeometry XML for a component
 */
function buildGeometryXml(component: DrawIOComponent): string {
    if (component.component === "Connector") {
        return '<mxGeometry relative="1" as="geometry"/>'
    }

    const defaultSize = getDefaultSize(component.component)
    const x = component.position?.x ?? 100
    const y = component.position?.y ?? 100
    const width = component.size?.width ?? defaultSize.width
    const height = component.size?.height ?? defaultSize.height

    return `<mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>`
}

/**
 * Get the label/text content for a component
 */
function getComponentLabel(component: DrawIOComponent): string {
    switch (component.component) {
        case "Text":
            return (component as TextComponent).text || ""

        case "Swimlane":
            return (component as SwimlaneComponent).title || ""

        case "Card": {
            const card = component as CardComponent
            let label = card.title || ""
            if (card.subtitle) {
                label += `<br><font style="font-size:10px">${card.subtitle}</font>`
            }
            return label
        }

        case "List": {
            const list = component as ListComponent
            let label = list.title ? `<b>${list.title}</b><hr>` : ""
            if (list.items?.length) {
                label += list.items
                    .map((item, i) =>
                        list.numbered ? `${i + 1}. ${item}` : `• ${item}`,
                    )
                    .join("<br>")
            }
            return label || "List"
        }

        case "Table": {
            const table = component as TableComponent
            // Table content is handled via child cells in draw.io
            return table.title || ""
        }

        case "Timeline": {
            const timeline = component as TimelineComponent
            return timeline.title || "Timeline"
        }

        case "Process": {
            const process = component as ProcessComponent
            return process.steps?.map((s) => s.label).join(" → ") || "Process"
        }

        case "Callout":
            return (component as CalloutComponent).text || ""

        case "AWSIcon":
            return (component as AWSIconComponent).label || ""

        case "AzureIcon":
            return (component as AzureIconComponent).label || ""

        case "GCPIcon":
            return (component as GCPIconComponent).label || ""

        case "Image":
            return (component as ImageComponent).label || ""

        case "UMLClass": {
            const umlClass = component as import("./types").UMLClassComponent
            let label = umlClass.name || "ClassName"
            if (umlClass.attributes?.length) {
                label += "<hr>" + umlClass.attributes.join("<br>")
            }
            if (umlClass.methods?.length) {
                label += "<hr>" + umlClass.methods.join("<br>")
            }
            return label
        }

        case "UMLInterface": {
            const umlInterface =
                component as import("./types").UMLInterfaceComponent
            let label = `«interface»<br>${umlInterface.name || "InterfaceName"}`
            if (umlInterface.methods?.length) {
                label += "<hr>" + umlInterface.methods.join("<br>")
            }
            return label
        }

        case "UMLPackage":
            return (
                (component as import("./types").UMLPackageComponent).name || ""
            )

        default:
            // Handle components with 'name' property (UML components, etc.)
            if ("name" in component) {
                return (component as { name?: string }).name ?? ""
            }
            return "label" in component
                ? ((component as { label?: string }).label ?? "")
                : ""
    }
}

/**
 * Escape special XML characters in attribute values
 */
function escapeXmlValue(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

/**
 * Validate components before conversion
 */
export function validateComponents(components: DrawIOComponent[]): {
    valid: boolean
    errors: string[]
} {
    const errors: string[] = []
    const ids = new Set<string>()

    for (const component of components) {
        // Check for duplicate IDs
        if (ids.has(component.id)) {
            errors.push(`Duplicate component ID: ${component.id}`)
        }
        ids.add(component.id)

        // Check connector references
        if (component.component === "Connector") {
            const conn = component as ConnectorComponent
            if (!components.some((c) => c.id === conn.source)) {
                errors.push(
                    `Connector "${conn.id}" references non-existent source: ${conn.source}`,
                )
            }
            if (!components.some((c) => c.id === conn.target)) {
                errors.push(
                    `Connector "${conn.id}" references non-existent target: ${conn.target}`,
                )
            }
        }

        // Check parent references (excluding root parent "1")
        if (
            "parent" in component &&
            component.parent &&
            component.parent !== "1"
        ) {
            if (!components.some((c) => c.id === component.parent)) {
                errors.push(
                    `Component "${component.id}" references non-existent parent: ${component.parent}`,
                )
            }
        }
    }

    return { valid: errors.length === 0, errors }
}
