/**
 * Tool descriptions for AI function calling
 * Separated from route handlers for easier maintenance and testing
 */

export const DISPLAY_DIAGRAM_DESCRIPTION = `Display a diagram on draw.io. Pass the XML content inside <root> tags.

VALIDATION RULES (XML will be rejected if violated):
1. All mxCell elements must be DIRECT children of <root> - never nested
2. Every mxCell needs a unique id
3. Every mxCell (except id="0") needs a valid parent attribute
4. Edge source/target must reference existing cell IDs
5. Escape special chars ONLY inside attribute values (especially value="..."):
   - &lt; for <
   - &gt; for >
   - &amp; for &
   - &quot; for "
   - &apos; for '
6. Always start with: <mxCell id="0"/><mxCell id="1" parent="0"/>

⚠️ CRITICAL - XML Entity Rules:
- ONLY use the 5 predefined XML entities above
- NEVER use HTML entities like &nbsp; &mdash; &copy; - they will cause parser errors!
- For non-breaking space: use regular space " " or numeric entity &#160;
- For special symbols: use numeric entities (&#8212; for —, &#169; for ©)

✅ CORRECT Examples:
<mxCell value="Hello World" .../>              <!-- Regular space -->
<mxCell value="Price: $5 &lt; $10" .../>       <!-- Escaped < -->
<mxCell value="Copyright &#169; 2024" .../>    <!-- Numeric entity -->

❌ WRONG Examples:
<mxCell value="Hello&nbsp;World" .../>         <!-- Invalid entity! -->
<mxCell value="Em&mdash;dash" .../>            <!-- Invalid entity! -->
<mxCell value="Price: $5 < $10" .../>          <!-- Unescaped < -->

CRITICAL (common failure): DO NOT HTML-escape XML tags
- ✅ Correct: <mxGraphModel> / <root> / <mxCell>
- ❌ Wrong: &lt;mxCell ...&gt; (HTML-escaped tags). This will be rejected or will break later when unescaped.

CRITICAL (common failure): Return ONLY raw XML
- ❌ Don't wrap with Markdown code fences
- ❌ Don't add trailing characters like ", or extra text after the last >
- ✅ Output must start with <root> and end with </root> (or full <mxfile>), nothing else.

Example with swimlanes and edges (note: all mxCells are siblings):
<root>
  <mxCell id="0"/>
  <mxCell id="1" parent="0"/>
  <mxCell id="lane1" value="Frontend" style="swimlane;" vertex="1" parent="1">
    <mxGeometry x="40" y="40" width="200" height="200" as="geometry"/>
  </mxCell>
  <mxCell id="step1" value="Step 1" style="rounded=1;" vertex="1" parent="lane1">
    <mxGeometry x="20" y="60" width="160" height="40" as="geometry"/>
  </mxCell>
  <mxCell id="lane2" value="Backend" style="swimlane;" vertex="1" parent="1">
    <mxGeometry x="280" y="40" width="200" height="200" as="geometry"/>
  </mxCell>
  <mxCell id="step2" value="Step 2" style="rounded=1;" vertex="1" parent="lane2">
    <mxGeometry x="20" y="60" width="160" height="40" as="geometry"/>
  </mxCell>
  <mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;" edge="1" parent="1" source="step1" target="step2">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root>

Notes:
- For AWS diagrams, use **AWS 2025 icons**.
- For animated connectors, add "flowAnimation=1" to edge style.
`

export const EDIT_DIAGRAM_DESCRIPTION = `Edit specific parts of the current diagram using structured operations.

Use structured "ops" with mxCell id anchors. This is robust and avoids failures from attribute order / whitespace / self-closing tag differences.

⚠️ CRITICAL SCHEMA RULES:
- Use "id" field (NOT "cellId", NOT "attributeName"!)
- Field names must match exactly: "id", "type", "value", "style", "geometry"
- Do NOT use generic wrapper fields like "attributeName" or "attributeValue"

✅ CORRECT updateCell examples:
{"type": "updateCell", "id": "2", "style": "rounded=1;fillColor=#FF0000;"}
{"type": "updateCell", "id": "3", "value": "New Label"}
{"type": "updateCell", "id": "4", "geometry": {"x": 100, "y": 200, "width": 120, "height": 60}}

❌ WRONG - do NOT do this:
{"cellId": "2", "attributeName": "style", "attributeValue": "..."}  // INVALID!

--- Operation types ---
1. setEdgePoints: Move edge endpoints
   {"type": "setEdgePoints", "id": "edge1", "sourcePoint": {"x": 100, "y": 50}, "targetPoint": {"x": 300, "y": 50}}

2. setCellValue: Change cell text
   {"type": "setCellValue", "id": "cell1", "value": "New text", "escape": true}

3. updateCell: Update cell properties (style, value, geometry)
   {"type": "updateCell", "id": "cell1", "style": "rounded=1;fillColor=#00FF00;"}
   {"type": "updateCell", "id": "cell2", "geometry": {"x": 200, "y": 100, "width": 80, "height": 40}}

4. addCell: Add new cell
   {"type": "addCell", "id": "newCell1", "parent": "1", "value": "Label", "style": "rounded=1;", "vertex": true, "geometry": {"x": 50, "y": 50, "width": 100, "height": 50}}

5. deleteCell: Remove cell
   {"type": "deleteCell", "id": "cell1"}

--- Additional guidance ---
- HTML labels are supported when style includes "html=1". Provide RAW HTML in "value" field.
- For line breaks in HTML labels, use "<br>" (not "\\n").
- For adding elements, ensure unique id and valid parent id (usually "1").

⚠️ JSON ESCAPING: Every " inside string values MUST be escaped as \\". Example: x=\\"100\\" y=\\"200\\"`

export const ANALYZE_DIAGRAM_DESCRIPTION =
    "Analyze the CURRENT diagram XML and return a concise structural summary (nodes, edges, containers, warnings). Use this before edit_diagram when the diagram is non-empty or complex. This tool is READ-ONLY and does not modify the diagram."

export const DISPLAY_COMPONENTS_DESCRIPTION = `Display a diagram using component-based specification (A2UI-style).

Components are sent as a flat array with parent-child relationships via ID references.
This is an alternative to display_diagram that uses structured JSON instead of raw XML.

BENEFITS:
- Simpler syntax: No need to write raw mxCell XML
- Type-safe: Structured properties instead of semicolon-separated style strings
- Less error-prone: System handles XML escaping and style formatting

COMPONENT TYPES:

**Basic Shapes:**
- Rectangle: Basic rectangle shape
- RoundedRect: Rectangle with rounded corners (cornerRadius option)
- Ellipse: Ellipse or circle
- Diamond: Rhombus for decision points
- Hexagon: Preparation/manual operations
- Triangle: Triangle with direction option
- Cylinder: Database representation
- Text: Text label without shape
- Image: Image from URL (src property)

**Connector (⚠️ CRITICAL - source & target REQUIRED):**
- Connector: Line between components
  - source (REQUIRED): Source component ID - MUST reference an existing component id
  - target (REQUIRED): Target component ID - MUST reference an existing component id
  - label: Optional edge label text
  - style: { lineType, startArrow, endArrow, strokeColor, dashed, animated }
  - waypoints: Array of {x, y} for routing

  ⚠️ VALIDATION: Connectors WITHOUT source/target will be REJECTED with error:
  "Connector references non-existent source/target: undefined"

**Containers:**
- Swimlane: Container with title bar (title, children, horizontal)
- Group: Invisible grouping container (children)

**Cloud Provider Icons:**
- AWSIcon: AWS service icon (service: "EC2", "S3", "Lambda", etc.)
- AzureIcon: Azure service icon (service: "VirtualMachine", "Functions", etc.)
- GCPIcon: GCP service icon (service: "ComputeEngine", "CloudFunctions", etc.)

**Specialized:**
- Card: Card with title, subtitle, content
- List: Bulleted/numbered list (items array)
- Callout: Annotation bubble (text, calloutStyle: "note"|"warning"|"info"|"tip")
- Actor: Stick figure for use case diagrams
- Document: Document shape with wavy bottom
- Cloud: Cloud shape for external systems

COMMON PROPERTIES:
- id (required): Unique identifier
- position: { x, y } coordinates
- size: { width, height } dimensions
- parent: Parent component ID (defaults to "1" for root)

SHAPE STYLE PROPERTIES:
- fill: Fill color (hex, e.g., "#FF5733")
- stroke: Stroke color
- strokeWidth: Stroke width in pixels
- opacity: Opacity (0-100)
- shadow: Enable shadow (boolean)
- dashed: Dashed stroke (boolean)

TEXT STYLE PROPERTIES:
- fontSize: Font size in pixels
- fontColor: Font color
- fontStyle: "normal" | "bold" | "italic" | "boldItalic"
- align: "left" | "center" | "right"

EXAMPLE - Simple Flowchart:
{
  "components": [
    {"id": "start", "component": "RoundedRect", "label": "Start", "position": {"x": 100, "y": 50}, "fill": "#90EE90"},
    {"id": "process", "component": "Rectangle", "label": "Process Data", "position": {"x": 100, "y": 150}},
    {"id": "decision", "component": "Diamond", "label": "Valid?", "position": {"x": 100, "y": 250}},
    {"id": "end", "component": "RoundedRect", "label": "End", "position": {"x": 100, "y": 350}, "fill": "#FFB6C1"},
    {"id": "e1", "component": "Connector", "source": "start", "target": "process"},
    {"id": "e2", "component": "Connector", "source": "process", "target": "decision"},
    {"id": "e3", "component": "Connector", "source": "decision", "target": "end", "label": "Yes"}
  ]
}

EXAMPLE - AWS Architecture:
{
  "components": [
    {"id": "vpc", "component": "Swimlane", "title": "VPC", "position": {"x": 50, "y": 50}, "size": {"width": 400, "height": 300}},
    {"id": "elb", "component": "AWSIcon", "service": "ElasticLoadBalancing", "label": "ALB", "position": {"x": 100, "y": 100}, "parent": "vpc"},
    {"id": "ec2", "component": "AWSIcon", "service": "EC2", "label": "Web Server", "position": {"x": 250, "y": 100}, "parent": "vpc"},
    {"id": "rds", "component": "AWSIcon", "service": "RDS", "label": "Database", "position": {"x": 250, "y": 200}, "parent": "vpc"},
    {"id": "e1", "component": "Connector", "source": "elb", "target": "ec2"},
    {"id": "e2", "component": "Connector", "source": "ec2", "target": "rds"}
  ]
}

WHEN TO USE:
- Use display_components for: New diagrams, simple to medium complexity, structured layouts
- Use display_diagram for: Complex custom styling, precise XML control, advanced mxGraph features
`
