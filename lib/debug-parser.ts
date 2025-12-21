/**
 * Debug utility for testing XML → Component parser in browser console
 *
 * Usage in browser console:
 *   // Parse current diagram
 *   window.parseCurrentDiagram()
 *
 *   // Parse custom XML
 *   window.parseXmlToComponents('<mxGraphModel>...</mxGraphModel>')
 *
 *   // Get summary
 *   window.summarizeDiagram()
 */

import {
    type DrawIOComponent,
    summarizeComponents,
    xmlToComponents,
} from "./components"

declare global {
    interface Window {
        parseXmlToComponents: (xml: string) => DrawIOComponent[]
        parseCurrentDiagram: () => DrawIOComponent[] | null
        summarizeDiagram: () => string | null
        _currentDiagramXml: string | null
    }
}

/**
 * Initialize debug tools on window object
 * Only call this in development mode from a client component
 */
export function initDebugParser() {
    if (typeof window === "undefined") return

    // Parse XML string to components
    window.parseXmlToComponents = (xml: string) => {
        try {
            const components = xmlToComponents(xml)
            console.log("Parsed components:", components)
            console.table(
                components.map((c) => ({
                    id: c.id,
                    type: c.component,
                    label:
                        "label" in c
                            ? c.label
                            : "title" in c
                              ? c.title
                              : "text" in c
                                ? c.text
                                : "",
                    position:
                        "position" in c && c.position
                            ? `(${c.position.x}, ${c.position.y})`
                            : "-",
                    size:
                        "size" in c && c.size
                            ? `${c.size.width}x${c.size.height}`
                            : "default",
                })),
            )
            return components
        } catch (error) {
            console.error("Parse error:", error)
            throw error
        }
    }

    // Parse current diagram (requires _currentDiagramXml to be set)
    window.parseCurrentDiagram = () => {
        const xml = window._currentDiagramXml
        if (!xml) {
            console.warn(
                "No diagram XML available. Make sure a diagram is loaded.",
            )
            return null
        }
        return window.parseXmlToComponents(xml)
    }

    // Get summary of current diagram
    window.summarizeDiagram = () => {
        const xml = window._currentDiagramXml
        if (!xml) {
            console.warn(
                "No diagram XML available. Make sure a diagram is loaded.",
            )
            return null
        }
        try {
            const components = xmlToComponents(xml)
            const summary = summarizeComponents(components)
            console.log("Diagram Summary:\n" + summary)
            return summary
        } catch (error) {
            console.error("Summary error:", error)
            throw error
        }
    }

    console.log(
        "%c[Debug] Parser tools loaded. Available commands:",
        "color: #4CAF50; font-weight: bold",
    )
    console.log("  parseCurrentDiagram() - Parse the current diagram")
    console.log("  parseXmlToComponents(xml) - Parse custom XML")
    console.log("  summarizeDiagram() - Get diagram summary")
}
