/**
 * Component Converter Tests
 *
 * Tests for converting A2UI-style components to draw.io mxCell XML
 */

import { describe, expect, it } from "vitest"
import {
    componentsToXml,
    componentToCellXml,
    validateComponents,
} from "../converter"
import type {
    AWSIconComponent,
    ConnectorComponent,
    DiamondComponent,
    DrawIOComponent,
    EllipseComponent,
    ParallelogramComponent,
    RectangleComponent,
    ServerComponent,
    SwimlaneComponent,
    UMLClassComponent,
} from "../types"

describe("componentsToXml", () => {
    it("should generate valid mxGraphModel with root cells", () => {
        const components: DrawIOComponent[] = []
        const xml = componentsToXml(components)

        expect(xml).toContain("<mxGraphModel>")
        expect(xml).toContain('<mxCell id="0"/>')
        expect(xml).toContain('<mxCell id="1" parent="0"/>')
        expect(xml).toContain("</mxGraphModel>")
    })

    it("should include all components in output", () => {
        const components: DrawIOComponent[] = [
            {
                id: "rect1",
                component: "Rectangle",
                label: "Test",
                position: { x: 100, y: 100 },
            },
            {
                id: "rect2",
                component: "Rectangle",
                label: "Test2",
                position: { x: 200, y: 100 },
            },
        ]
        const xml = componentsToXml(components)

        expect(xml).toContain('id="rect1"')
        expect(xml).toContain('id="rect2"')
    })

    it("should process connectors after vertices", () => {
        const components: DrawIOComponent[] = [
            {
                id: "conn1",
                component: "Connector",
                source: "rect1",
                target: "rect2",
            },
            {
                id: "rect1",
                component: "Rectangle",
                label: "A",
            },
            {
                id: "rect2",
                component: "Rectangle",
                label: "B",
            },
        ]
        const xml = componentsToXml(components)

        // Vertices should appear before edges in XML
        const rect1Pos = xml.indexOf('id="rect1"')
        const rect2Pos = xml.indexOf('id="rect2"')
        const conn1Pos = xml.indexOf('id="conn1"')

        expect(rect1Pos).toBeLessThan(conn1Pos)
        expect(rect2Pos).toBeLessThan(conn1Pos)
    })
})

describe("componentToCellXml - Basic Shapes", () => {
    it("should convert Rectangle with all properties", () => {
        const component: RectangleComponent = {
            id: "rect1",
            component: "Rectangle",
            label: "Test Label",
            position: { x: 100, y: 200 },
            size: { width: 120, height: 60 },
            fill: "#FF5733",
            stroke: "#000000",
            strokeWidth: 2,
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain('id="rect1"')
        expect(xml).toContain('value="Test Label"')
        expect(xml).toContain("rounded=0")
        expect(xml).toContain("fillColor=#FF5733")
        expect(xml).toContain("strokeColor=#000000")
        expect(xml).toContain("strokeWidth=2")
        expect(xml).toContain('x="100"')
        expect(xml).toContain('y="200"')
        expect(xml).toContain('width="120"')
        expect(xml).toContain('height="60"')
        expect(xml).toContain('vertex="1"')
    })

    it("should convert RoundedRect with cornerRadius", () => {
        const component: DrawIOComponent = {
            id: "rounded1",
            component: "RoundedRect",
            label: "Rounded",
            cornerRadius: 15,
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("rounded=1")
        expect(xml).toContain("arcSize=15")
    })

    it("should convert Ellipse", () => {
        const component: EllipseComponent = {
            id: "ellipse1",
            component: "Ellipse",
            label: "Circle",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("ellipse")
        expect(xml).toContain('value="Circle"')
    })

    it("should convert Diamond", () => {
        const component: DiamondComponent = {
            id: "diamond1",
            component: "Diamond",
            label: "Decision?",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("rhombus")
    })

    it("should convert Hexagon", () => {
        const component: DrawIOComponent = {
            id: "hex1",
            component: "Hexagon",
            label: "Hex",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=hexagon")
        expect(xml).toContain("perimeter=hexagonPerimeter2")
    })

    it("should convert Triangle with direction", () => {
        const component: DrawIOComponent = {
            id: "tri1",
            component: "Triangle",
            label: "Arrow",
            direction: "east",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("triangle")
        expect(xml).toContain("direction=east")
    })

    it("should convert Cylinder", () => {
        const component: DrawIOComponent = {
            id: "cyl1",
            component: "Cylinder",
            label: "Database",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=cylinder3")
        expect(xml).toContain("boundedLbl=1")
    })

    it("should convert Text component", () => {
        const component: DrawIOComponent = {
            id: "text1",
            component: "Text",
            text: "Hello World",
            fontSize: 16,
            fontColor: "#333333",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("text")
        expect(xml).toContain("strokeColor=none")
        expect(xml).toContain("fillColor=none")
        expect(xml).toContain('value="Hello World"')
        expect(xml).toContain("fontSize=16")
        expect(xml).toContain("fontColor=#333333")
    })
})

describe("componentToCellXml - New Shape Types", () => {
    it("should convert Parallelogram", () => {
        const component: ParallelogramComponent = {
            id: "para1",
            component: "Parallelogram",
            label: "Input/Output",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=parallelogram")
        expect(xml).toContain("perimeter=parallelogramPerimeter")
    })

    it("should convert Step shape", () => {
        const component: DrawIOComponent = {
            id: "step1",
            component: "Step",
            label: "Step 1",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=step")
        expect(xml).toContain("perimeter=stepPerimeter")
        expect(xml).toContain("fixedSize=1")
    })

    it("should convert Note shape", () => {
        const component: DrawIOComponent = {
            id: "note1",
            component: "Note",
            label: "Important note",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=note")
    })
})

describe("componentToCellXml - UML Components", () => {
    it("should convert UMLClass with attributes and methods", () => {
        const component: UMLClassComponent = {
            id: "class1",
            component: "UMLClass",
            name: "Person",
            attributes: ["+name: string", "-age: number"],
            methods: ["+getName(): string", "+setAge(age: number): void"],
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("swimlane")
        expect(xml).toContain("fontStyle=1")
        expect(xml).toContain("childLayout=stackLayout")
        expect(xml).toContain("Person")
        expect(xml).toContain("+name: string")
        expect(xml).toContain("+getName(): string")
    })

    it("should convert UMLInterface", () => {
        const component: DrawIOComponent = {
            id: "interface1",
            component: "UMLInterface",
            name: "Serializable",
            methods: ["+serialize(): string"],
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("swimlane")
        expect(xml).toContain("interface")
        expect(xml).toContain("Serializable")
    })

    it("should convert UMLPackage", () => {
        const component: DrawIOComponent = {
            id: "pkg1",
            component: "UMLPackage",
            name: "com.example",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=umlFrame")
        expect(xml).toContain("com.example")
    })
})

describe("componentToCellXml - Network Topology", () => {
    it("should convert Server", () => {
        const component: ServerComponent = {
            id: "server1",
            component: "Server",
            label: "Web Server",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=mxgraph.cisco.servers.standard_host")
        expect(xml).toContain("sketch=0")
    })

    it("should convert Router", () => {
        const component: DrawIOComponent = {
            id: "router1",
            component: "Router",
            label: "Core Router",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=mxgraph.cisco.routers.router")
    })

    it("should convert Switch", () => {
        const component: DrawIOComponent = {
            id: "switch1",
            component: "Switch",
            label: "L2 Switch",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=mxgraph.cisco.switches.workgroup_switch")
    })

    it("should convert Firewall", () => {
        const component: DrawIOComponent = {
            id: "fw1",
            component: "Firewall",
            label: "Firewall",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=mxgraph.cisco.security.firewall")
    })

    it("should convert Desktop", () => {
        const component: DrawIOComponent = {
            id: "desktop1",
            component: "Desktop",
            label: "Workstation",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain(
            "shape=mxgraph.cisco.computers_and_peripherals.pc",
        )
    })

    it("should convert Laptop", () => {
        const component: DrawIOComponent = {
            id: "laptop1",
            component: "Laptop",
            label: "Laptop",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain(
            "shape=mxgraph.cisco.computers_and_peripherals.laptop",
        )
    })

    it("should convert Internet", () => {
        const component: DrawIOComponent = {
            id: "internet1",
            component: "Internet",
            label: "Internet",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=mxgraph.cisco.misc.cloud")
    })

    it("should convert Database (network style)", () => {
        const component: DrawIOComponent = {
            id: "db1",
            component: "Database",
            label: "DB Server",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=mxgraph.cisco.storage.database")
    })
})

describe("componentToCellXml - Cloud Icons", () => {
    it("should convert AWSIcon", () => {
        const component: AWSIconComponent = {
            id: "aws1",
            component: "AWSIcon",
            service: "EC2",
            label: "Web Server",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=mxgraph.aws4.ec2")
        expect(xml).toContain("sketch=0")
        expect(xml).toContain("outlineConnect=0")
    })

    it("should convert AzureIcon", () => {
        const component: DrawIOComponent = {
            id: "azure1",
            component: "AzureIcon",
            service: "VirtualMachine",
            label: "VM",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=mxgraph.azure.compute.virtual_machine")
    })

    it("should convert GCPIcon", () => {
        const component: DrawIOComponent = {
            id: "gcp1",
            component: "GCPIcon",
            service: "ComputeEngine",
            label: "GCE",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shape=mxgraph.gcp2.compute_engine")
    })
})

describe("componentToCellXml - Connectors", () => {
    it("should convert basic Connector", () => {
        const component: ConnectorComponent = {
            id: "conn1",
            component: "Connector",
            source: "rect1",
            target: "rect2",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain('id="conn1"')
        expect(xml).toContain('edge="1"')
        expect(xml).toContain('source="rect1"')
        expect(xml).toContain('target="rect2"')
        expect(xml).toContain("edgeStyle=orthogonalEdgeStyle")
        expect(xml).toContain("endArrow=classic")
    })

    it("should convert Connector with label and style", () => {
        const component: ConnectorComponent = {
            id: "conn2",
            component: "Connector",
            source: "a",
            target: "b",
            label: "Yes",
            style: {
                lineType: "curved",
                startArrow: "diamond",
                endArrow: "block",
                strokeColor: "#FF0000",
                strokeWidth: 2,
                dashed: true,
            },
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain('value="Yes"')
        expect(xml).toContain("curved=1")
        expect(xml).toContain("startArrow=diamond")
        expect(xml).toContain("endArrow=block")
        expect(xml).toContain("strokeColor=#FF0000")
        expect(xml).toContain("strokeWidth=2")
        expect(xml).toContain("dashed=1")
    })

    it("should convert Connector with waypoints", () => {
        const component: ConnectorComponent = {
            id: "conn3",
            component: "Connector",
            source: "a",
            target: "b",
            waypoints: [
                { x: 200, y: 100 },
                { x: 200, y: 200 },
            ],
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain('<Array as="points">')
        expect(xml).toContain('x="200" y="100"')
        expect(xml).toContain('x="200" y="200"')
    })

    it("should convert Connector with exit/entry points", () => {
        const component: ConnectorComponent = {
            id: "conn4",
            component: "Connector",
            source: "a",
            target: "b",
            style: {
                exitX: 1,
                exitY: 0.5,
                entryX: 0,
                entryY: 0.5,
            },
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("exitX=1")
        expect(xml).toContain("exitY=0.5")
        expect(xml).toContain("entryX=0")
        expect(xml).toContain("entryY=0.5")
    })
})

describe("componentToCellXml - Containers", () => {
    it("should convert Swimlane", () => {
        const component: SwimlaneComponent = {
            id: "lane1",
            component: "Swimlane",
            title: "Frontend",
            titleHeight: 40,
            horizontal: true,
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("swimlane")
        expect(xml).toContain("startSize=40")
        expect(xml).toContain("horizontal=1")
        expect(xml).toContain('value="Frontend"')
    })

    it("should convert Group", () => {
        const component: DrawIOComponent = {
            id: "group1",
            component: "Group",
            children: ["child1", "child2"],
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("group")
    })
})

describe("componentToCellXml - Style Properties", () => {
    it("should apply shadow style", () => {
        const component: RectangleComponent = {
            id: "rect1",
            component: "Rectangle",
            label: "With Shadow",
            shadow: true,
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("shadow=1")
    })

    it("should apply dashed style", () => {
        const component: RectangleComponent = {
            id: "rect1",
            component: "Rectangle",
            label: "Dashed",
            dashed: true,
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("dashed=1")
    })

    it("should apply opacity", () => {
        const component: RectangleComponent = {
            id: "rect1",
            component: "Rectangle",
            label: "Transparent",
            opacity: 50,
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("opacity=50")
    })

    it("should apply font styles", () => {
        const component: RectangleComponent = {
            id: "rect1",
            component: "Rectangle",
            label: "Styled Text",
            fontSize: 18,
            fontFamily: "Arial",
            fontColor: "#FF0000",
            fontStyle: "bold",
            align: "center",
            verticalAlign: "middle",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("fontSize=18")
        expect(xml).toContain("fontFamily=Arial")
        expect(xml).toContain("fontColor=#FF0000")
        expect(xml).toContain("fontStyle=1")
        expect(xml).toContain("align=center")
        expect(xml).toContain("verticalAlign=middle")
    })
})

describe("componentToCellXml - Parent Hierarchy", () => {
    it("should set parent attribute for child components", () => {
        const component: RectangleComponent = {
            id: "child1",
            component: "Rectangle",
            label: "Child",
            parent: "lane1",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain('parent="lane1"')
    })

    it("should use default parent for root components", () => {
        const component: RectangleComponent = {
            id: "root1",
            component: "Rectangle",
            label: "Root",
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain('parent="1"')
    })
})

describe("componentToCellXml - XML Escaping", () => {
    it("should escape special characters in labels", () => {
        const component: RectangleComponent = {
            id: "rect1",
            component: "Rectangle",
            label: 'Test <script> & "quotes"',
        }
        const xml = componentToCellXml(component)

        expect(xml).toContain("&lt;script&gt;")
        expect(xml).toContain("&amp;")
        expect(xml).toContain("&quot;quotes&quot;")
    })
})

describe("validateComponents", () => {
    it("should pass for valid components", () => {
        const components: DrawIOComponent[] = [
            { id: "rect1", component: "Rectangle", label: "A" },
            { id: "rect2", component: "Rectangle", label: "B" },
            {
                id: "conn1",
                component: "Connector",
                source: "rect1",
                target: "rect2",
            },
        ]
        const result = validateComponents(components)

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })

    it("should detect duplicate IDs", () => {
        const components: DrawIOComponent[] = [
            { id: "same", component: "Rectangle", label: "A" },
            { id: "same", component: "Rectangle", label: "B" },
        ]
        const result = validateComponents(components)

        expect(result.valid).toBe(false)
        expect(result.errors).toContain("Duplicate component ID: same")
    })

    it("should detect invalid connector source", () => {
        const components: DrawIOComponent[] = [
            { id: "rect1", component: "Rectangle", label: "A" },
            {
                id: "conn1",
                component: "Connector",
                source: "nonexistent",
                target: "rect1",
            },
        ]
        const result = validateComponents(components)

        expect(result.valid).toBe(false)
        expect(
            result.errors.some((e) => e.includes("non-existent source")),
        ).toBe(true)
    })

    it("should detect invalid connector target", () => {
        const components: DrawIOComponent[] = [
            { id: "rect1", component: "Rectangle", label: "A" },
            {
                id: "conn1",
                component: "Connector",
                source: "rect1",
                target: "nonexistent",
            },
        ]
        const result = validateComponents(components)

        expect(result.valid).toBe(false)
        expect(
            result.errors.some((e) => e.includes("non-existent target")),
        ).toBe(true)
    })

    it("should detect invalid parent reference", () => {
        const components: DrawIOComponent[] = [
            {
                id: "child1",
                component: "Rectangle",
                label: "Child",
                parent: "nonexistent",
            },
        ]
        const result = validateComponents(components)

        expect(result.valid).toBe(false)
        expect(
            result.errors.some((e) => e.includes("non-existent parent")),
        ).toBe(true)
    })
})
