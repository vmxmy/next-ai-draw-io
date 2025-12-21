/**
 * Diagram Operations Tests
 *
 * Tests for edit operations including addComponent and updateComponent
 */

import { describe, expect, it } from "vitest"
import { applyDiagramOps, type DiagramEditOp } from "../diagram-ops"

// Sample base diagram XML for testing
const BASE_DIAGRAM_XML = `<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="rect1" value="Box A" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#DBEAFE;" vertex="1" parent="1">
      <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
    </mxCell>
    <mxCell id="rect2" value="Box B" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#FEF3C7;" vertex="1" parent="1">
      <mxGeometry x="300" y="100" width="120" height="60" as="geometry"/>
    </mxCell>
    <mxCell id="edge1" value="" style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;html=1;" edge="1" parent="1" source="rect1" target="rect2">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`

describe("applyDiagramOps - addComponent", () => {
    it("should add a Rectangle component", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "newRect",
                    component: "Rectangle",
                    label: "New Box",
                    position: { x: 200, y: 200 },
                    size: { width: 100, height: 50 },
                    fill: "#E8F5E9",
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="newRect"')
            expect(result.xml).toContain('value="New Box"')
            expect(result.xml).toContain("fillColor=#E8F5E9")
            expect(result.xml).toContain('x="200"')
            expect(result.xml).toContain('y="200"')
        }
    })

    it("should add an Ellipse component", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "circle1",
                    component: "Ellipse",
                    label: "Start",
                    position: { x: 50, y: 50 },
                    fill: "#FFEBEE",
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="circle1"')
            expect(result.xml).toContain("ellipse")
        }
    })

    it("should add a Diamond component", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "decision1",
                    component: "Diamond",
                    label: "Condition?",
                    position: { x: 150, y: 150 },
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="decision1"')
            expect(result.xml).toContain("rhombus")
        }
    })

    it("should add a Connector component", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "newEdge",
                    component: "Connector",
                    source: "rect1",
                    target: "rect2",
                    label: "Flow",
                    style: {
                        lineType: "orthogonal",
                        endArrow: "classic",
                        strokeColor: "#FF0000",
                    },
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="newEdge"')
            expect(result.xml).toContain('edge="1"')
            expect(result.xml).toContain('source="rect1"')
            expect(result.xml).toContain('target="rect2"')
        }
    })

    it("should add an AWSIcon component", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "ec2",
                    component: "AWSIcon",
                    service: "EC2",
                    label: "Web Server",
                    position: { x: 100, y: 300 },
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="ec2"')
            expect(result.xml).toContain("mxgraph.aws4.ec2")
        }
    })

    it("should add a Parallelogram component", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "io1",
                    component: "Parallelogram",
                    label: "Input",
                    position: { x: 100, y: 250 },
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="io1"')
            expect(result.xml).toContain("shape=parallelogram")
        }
    })

    it("should add a Server component", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "server1",
                    component: "Server",
                    label: "App Server",
                    position: { x: 200, y: 300 },
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="server1"')
            expect(result.xml).toContain("mxgraph.cisco.servers.standard_host")
        }
    })

    it("should add a UMLClass component", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "class1",
                    component: "UMLClass",
                    name: "User",
                    attributes: ["+id: string", "+name: string"],
                    methods: ["+getId(): string"],
                    position: { x: 100, y: 400 },
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="class1"')
            expect(result.xml).toContain("User")
            expect(result.xml).toContain("swimlane")
        }
    })

    it("should fail when adding component with existing ID", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "rect1", // Already exists
                    component: "Rectangle",
                    label: "Duplicate",
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("error" in result).toBe(true)
        if ("error" in result) {
            expect(result.error).toContain("already exists")
        }
    })
})

describe("applyDiagramOps - updateComponent", () => {
    it("should update component position", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "rect1",
                updates: {
                    position: { x: 500, y: 500 },
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('x="500"')
            expect(result.xml).toContain('y="500"')
        }
    })

    it("should update component size", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "rect1",
                updates: {
                    size: { width: 200, height: 100 },
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('width="200"')
            expect(result.xml).toContain('height="100"')
        }
    })

    it("should update component label", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "rect1",
                updates: {
                    label: "Updated Label",
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('value="Updated Label"')
        }
    })

    it("should update component fill color", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "rect1",
                updates: {
                    fill: "#FF5733",
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain("fillColor=#FF5733")
        }
    })

    it("should update component stroke color", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "rect1",
                updates: {
                    stroke: "#000000",
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain("strokeColor=#000000")
        }
    })

    it("should update component fontSize", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "rect1",
                updates: {
                    fontSize: 18,
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain("fontSize=18")
        }
    })

    it("should update multiple properties at once", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "rect1",
                updates: {
                    label: "New Name",
                    fill: "#CCFFCC",
                    stroke: "#006600",
                    fontSize: 14,
                    position: { x: 150, y: 150 },
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('value="New Name"')
            expect(result.xml).toContain("fillColor=#CCFFCC")
            expect(result.xml).toContain("strokeColor=#006600")
            expect(result.xml).toContain("fontSize=14")
            expect(result.xml).toContain('x="150"')
            expect(result.xml).toContain('y="150"')
        }
    })

    it("should update shadow property", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "rect1",
                updates: {
                    shadow: true,
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain("shadow=1")
        }
    })

    it("should update dashed property", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "rect1",
                updates: {
                    dashed: true,
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain("dashed=1")
        }
    })

    it("should fail when updating non-existent component", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "nonexistent",
                updates: {
                    label: "Test",
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("error" in result).toBe(true)
    })
})

describe("applyDiagramOps - Combined Operations", () => {
    it("should execute multiple operations in sequence", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "newRect",
                    component: "Rectangle",
                    label: "New",
                    position: { x: 200, y: 300 },
                },
            },
            {
                type: "updateComponent",
                id: "rect1",
                updates: {
                    label: "Updated A",
                },
            },
            {
                type: "addComponent",
                component: {
                    id: "newConn",
                    component: "Connector",
                    source: "rect1",
                    target: "newRect",
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="newRect"')
            expect(result.xml).toContain('value="Updated A"')
            expect(result.xml).toContain('id="newConn"')
            expect(result.xml).toContain('source="rect1"')
            expect(result.xml).toContain('target="newRect"')
        }
    })

    it("should handle addComponent followed by updateComponent on same cell", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "addComponent",
                component: {
                    id: "newNode",
                    component: "Rectangle",
                    label: "Initial",
                    position: { x: 100, y: 100 },
                },
            },
            {
                type: "updateComponent",
                id: "newNode",
                updates: {
                    label: "Modified",
                    fill: "#FFCCCC",
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="newNode"')
            expect(result.xml).toContain('value="Modified"')
            expect(result.xml).toContain("fillColor=#FFCCCC")
        }
    })
})

describe("applyDiagramOps - Existing Operations", () => {
    it("should still support setCellValue", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "setCellValue",
                id: "rect1",
                value: "New Value",
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('value="New Value"')
        }
    })

    it("should still support deleteCell", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "deleteCell",
                id: "rect2",
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).not.toContain('id="rect2"')
        }
    })

    it("should still support updateCell", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "updateCell",
                id: "rect1",
                value: "Updated",
                geometry: { x: 50, y: 50 },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('value="Updated"')
            expect(result.xml).toContain('x="50"')
            expect(result.xml).toContain('y="50"')
        }
    })
})

describe("applyDiagramOps - connectComponents", () => {
    it("should create a connector between two components", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "connectComponents",
                id: "newConn",
                source: "rect1",
                target: "rect2",
                label: "Connection",
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="newConn"')
            expect(result.xml).toContain('source="rect1"')
            expect(result.xml).toContain('target="rect2"')
            expect(result.xml).toContain('value="Connection"')
            expect(result.xml).toContain('edge="1"')
        }
    })

    it("should create connector with custom style", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "connectComponents",
                id: "styledConn",
                source: "rect1",
                target: "rect2",
                style: {
                    lineType: "curved",
                    endArrow: "block",
                    startArrow: "diamond",
                    dashed: true,
                    stroke: "#FF0000",
                    strokeWidth: 2,
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain('id="styledConn"')
            expect(result.xml).toContain("curved=1")
            expect(result.xml).toContain("endArrow=block")
            expect(result.xml).toContain("startArrow=diamond")
            expect(result.xml).toContain("dashed=1")
            expect(result.xml).toContain("strokeColor=#FF0000")
            expect(result.xml).toContain("strokeWidth=2")
        }
    })

    it("should create connector with orthogonal line type", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "connectComponents",
                id: "orthoConn",
                source: "rect1",
                target: "rect2",
                style: {
                    lineType: "orthogonal",
                },
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
        if ("xml" in result) {
            expect(result.xml).toContain("edgeStyle=orthogonalEdgeStyle")
        }
    })

    it("should fail when source component not found", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "connectComponents",
                id: "failConn",
                source: "nonexistent",
                target: "rect2",
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("error" in result).toBe(true)
        if ("error" in result) {
            expect(result.error).toContain("nonexistent")
        }
    })

    it("should fail when target component not found", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "connectComponents",
                id: "failConn",
                source: "rect1",
                target: "nonexistent",
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("error" in result).toBe(true)
        if ("error" in result) {
            expect(result.error).toContain("nonexistent")
        }
    })

    it("should fail when connector id already exists", () => {
        const ops: DiagramEditOp[] = [
            {
                type: "connectComponents",
                id: "edge1", // This ID already exists in BASE_DIAGRAM_XML
                source: "rect1",
                target: "rect2",
            },
        ]

        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("error" in result).toBe(true)
        if ("error" in result) {
            expect(result.error).toContain("already exists")
        }
    })
})

describe("applyDiagramOps - Error Handling", () => {
    it("should handle invalid XML gracefully", () => {
        const invalidXml = "<invalid>not closed"
        const ops: DiagramEditOp[] = [
            {
                type: "updateComponent",
                id: "any",
                updates: { label: "test" },
            },
        ]

        const result = applyDiagramOps(invalidXml, ops)

        expect("error" in result).toBe(true)
    })

    it("should handle empty ops array", () => {
        const ops: DiagramEditOp[] = []
        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("xml" in result).toBe(true)
    })

    it("should report unsupported operation type", () => {
        const ops = [
            { type: "unknownOp", id: "test" },
        ] as unknown as DiagramEditOp[]
        const result = applyDiagramOps(BASE_DIAGRAM_XML, ops)

        expect("error" in result).toBe(true)
        if ("error" in result) {
            expect(result.error).toContain("Unsupported op type")
        }
    })
})
