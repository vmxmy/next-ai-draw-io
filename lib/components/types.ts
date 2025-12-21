/**
 * A2UI-style DrawIO Component Type Definitions
 *
 * Following A2UI v0.9 design principles:
 * - Flat component list with ID references
 * - Discriminator property ("component") for type identification
 * - Structured props instead of raw style strings
 */

// ============================================================================
// Base Types
// ============================================================================

/**
 * Position coordinates for components
 */
export interface Position {
    x: number
    y: number
}

/**
 * Size dimensions for components
 */
export interface Size {
    width: number
    height: number
}

/**
 * Common properties shared by all vertex components
 */
export interface ComponentBase {
    /** Unique identifier (required) */
    id: string
    /** Parent component ID (defaults to "1" for root) */
    parent?: string
    /** Position coordinates */
    position?: Position
    /** Size dimensions */
    size?: Size
}

/**
 * Common style properties for shape components
 */
export interface ShapeStyle {
    /** Fill color (hex, e.g., "#FF5733") */
    fill?: string
    /** Stroke/border color */
    stroke?: string
    /** Stroke width in pixels */
    strokeWidth?: number
    /** Opacity (0-100) */
    opacity?: number
    /** Enable shadow */
    shadow?: boolean
    /** Dashed stroke */
    dashed?: boolean
}

/**
 * Text style properties
 */
export interface TextStyle {
    /** Font size in pixels */
    fontSize?: number
    /** Font family name */
    fontFamily?: string
    /** Font color */
    fontColor?: string
    /** Font style */
    fontStyle?: "normal" | "bold" | "italic" | "boldItalic"
    /** Horizontal alignment */
    align?: "left" | "center" | "right"
    /** Vertical alignment */
    verticalAlign?: "top" | "middle" | "bottom"
}

// ============================================================================
// Basic Shape Components
// ============================================================================

/**
 * Rectangle shape component
 */
export interface RectangleComponent
    extends ComponentBase,
        ShapeStyle,
        TextStyle {
    component: "Rectangle"
    /** Text label inside the shape */
    label?: string
}

/**
 * Rounded rectangle shape component
 */
export interface RoundedRectComponent
    extends ComponentBase,
        ShapeStyle,
        TextStyle {
    component: "RoundedRect"
    /** Text label inside the shape */
    label?: string
    /** Corner radius (arc size, default 10) */
    cornerRadius?: number
}

/**
 * Ellipse/circle shape component
 */
export interface EllipseComponent extends ComponentBase, ShapeStyle, TextStyle {
    component: "Ellipse"
    /** Text label inside the shape */
    label?: string
}

/**
 * Diamond/rhombus shape component (typically for decisions)
 */
export interface DiamondComponent extends ComponentBase, ShapeStyle, TextStyle {
    component: "Diamond"
    /** Text label inside the shape */
    label?: string
}

/**
 * Hexagon shape component
 */
export interface HexagonComponent extends ComponentBase, ShapeStyle, TextStyle {
    component: "Hexagon"
    /** Text label inside the shape */
    label?: string
}

/**
 * Triangle shape component
 */
export interface TriangleComponent
    extends ComponentBase,
        ShapeStyle,
        TextStyle {
    component: "Triangle"
    /** Text label inside the shape */
    label?: string
    /** Rotation direction */
    direction?: "north" | "south" | "east" | "west"
}

/**
 * Cylinder shape component (typically for databases)
 */
export interface CylinderComponent
    extends ComponentBase,
        ShapeStyle,
        TextStyle {
    component: "Cylinder"
    /** Text label inside the shape */
    label?: string
}

/**
 * Parallelogram shape component (for IO operations)
 */
export interface ParallelogramComponent
    extends ComponentBase,
        ShapeStyle,
        TextStyle {
    component: "Parallelogram"
    /** Text label inside the shape */
    label?: string
}

/**
 * Step shape component (for sequential process steps)
 */
export interface StepComponent extends ComponentBase, ShapeStyle, TextStyle {
    component: "Step"
    /** Text label inside the shape */
    label?: string
}

/**
 * Note shape component (sticky note appearance)
 */
export interface NoteComponent extends ComponentBase, ShapeStyle, TextStyle {
    component: "Note"
    /** Text label inside the shape */
    label?: string
}

// ============================================================================
// UML Components
// ============================================================================

/**
 * UML Class component
 */
export interface UMLClassComponent extends ComponentBase, ShapeStyle {
    component: "UMLClass"
    /** Class name */
    name: string
    /** Class attributes */
    attributes?: string[]
    /** Class methods */
    methods?: string[]
}

/**
 * UML Interface component
 */
export interface UMLInterfaceComponent extends ComponentBase, ShapeStyle {
    component: "UMLInterface"
    /** Interface name */
    name: string
    /** Interface methods */
    methods?: string[]
}

/**
 * UML Package component
 */
export interface UMLPackageComponent extends ComponentBase, ShapeStyle {
    component: "UMLPackage"
    /** Package name */
    name: string
    /** Child component IDs */
    children?: string[]
}

// ============================================================================
// Network Topology Components
// ============================================================================

/**
 * Server component (network topology)
 */
export interface ServerComponent extends ComponentBase, ShapeStyle {
    component: "Server"
    /** Server name/label */
    label?: string
}

/**
 * Desktop/Workstation component
 */
export interface DesktopComponent extends ComponentBase, ShapeStyle {
    component: "Desktop"
    /** Desktop name/label */
    label?: string
}

/**
 * Laptop component
 */
export interface LaptopComponent extends ComponentBase, ShapeStyle {
    component: "Laptop"
    /** Laptop name/label */
    label?: string
}

/**
 * Router component
 */
export interface RouterComponent extends ComponentBase, ShapeStyle {
    component: "Router"
    /** Router name/label */
    label?: string
}

/**
 * Switch component
 */
export interface SwitchComponent extends ComponentBase, ShapeStyle {
    component: "Switch"
    /** Switch name/label */
    label?: string
}

/**
 * Firewall component
 */
export interface FirewallComponent extends ComponentBase, ShapeStyle {
    component: "Firewall"
    /** Firewall name/label */
    label?: string
}

/**
 * Internet/Cloud component (network topology)
 */
export interface InternetComponent extends ComponentBase, ShapeStyle {
    component: "Internet"
    /** Label */
    label?: string
}

/**
 * Database component (network topology style)
 */
export interface DatabaseComponent extends ComponentBase, ShapeStyle {
    component: "Database"
    /** Database name/label */
    label?: string
}

/**
 * Text-only component (no shape)
 */
export interface TextComponent extends ComponentBase, TextStyle {
    component: "Text"
    /** Text content (required) */
    text: string
}

/**
 * Image component
 */
export interface ImageComponent extends ComponentBase {
    component: "Image"
    /** Image URL or data URI */
    src: string
    /** Preserve aspect ratio */
    preserveAspect?: boolean
    /** Text label below image */
    label?: string
}

// ============================================================================
// Connector Component
// ============================================================================

/**
 * Connector/edge style properties
 */
export interface ConnectorStyle {
    /** Line routing type */
    lineType?: "straight" | "orthogonal" | "curved" | "entityRelation"
    /** Arrow style at start */
    startArrow?:
        | "none"
        | "classic"
        | "block"
        | "open"
        | "diamond"
        | "circle"
        | "oval"
    /** Arrow style at end */
    endArrow?:
        | "none"
        | "classic"
        | "block"
        | "open"
        | "diamond"
        | "circle"
        | "oval"
    /** Stroke color */
    strokeColor?: string
    /** Stroke width */
    strokeWidth?: number
    /** Dashed line */
    dashed?: boolean
    /** Animated flow effect */
    animated?: boolean
    /** Exit point on source (0-1) */
    exitX?: number
    exitY?: number
    /** Entry point on target (0-1) */
    entryX?: number
    entryY?: number
}

/**
 * Connector/edge component
 */
export interface ConnectorComponent {
    component: "Connector"
    /** Unique identifier */
    id: string
    /** Source component ID */
    source: string
    /** Target component ID */
    target: string
    /** Parent component ID */
    parent?: string
    /** Edge label */
    label?: string
    /** Connector style */
    style?: ConnectorStyle
    /** Intermediate waypoints for routing */
    waypoints?: Position[]
}

// ============================================================================
// Container Components
// ============================================================================

/**
 * Swimlane container component
 */
export interface SwimlaneComponent extends ComponentBase, ShapeStyle {
    component: "Swimlane"
    /** Swimlane title (required) */
    title: string
    /** Title bar height */
    titleHeight?: number
    /** Horizontal orientation */
    horizontal?: boolean
    /** Child component IDs (flat reference) */
    children?: string[]
    /** Header background color */
    headerFill?: string
    /** Collapsible swimlane */
    collapsible?: boolean
    /** Collapsed state */
    collapsed?: boolean
}

/**
 * Group container component (invisible grouping)
 */
export interface GroupComponent extends ComponentBase {
    component: "Group"
    /** Child component IDs */
    children: string[]
    /** Collapsible group */
    collapsible?: boolean
    /** Collapsed state */
    collapsed?: boolean
}

// ============================================================================
// Cloud Provider Icon Components
// ============================================================================

/**
 * AWS service icons (2025 version)
 */
export type AWSService =
    | "EC2"
    | "S3"
    | "Lambda"
    | "RDS"
    | "DynamoDB"
    | "VPC"
    | "CloudFront"
    | "Route53"
    | "APIGateway"
    | "SNS"
    | "SQS"
    | "ECS"
    | "EKS"
    | "Fargate"
    | "ElasticLoadBalancing"
    | "CloudWatch"
    | "IAM"
    | "Cognito"
    | "SecretsManager"
    | "KMS"
    | "Kinesis"
    | "Redshift"
    | "ElastiCache"
    | "StepFunctions"
    | "EventBridge"
    | "Athena"
    | "Glue"
    | "SageMaker"
    | "Bedrock"
    | string // Allow custom service names

/**
 * AWS icon component
 */
export interface AWSIconComponent extends ComponentBase {
    component: "AWSIcon"
    /** AWS service name */
    service: AWSService
    /** Label below icon */
    label?: string
    /** Icon version */
    version?: "2025" | "2024" | "2019"
}

/**
 * Azure service icons
 */
export type AzureService =
    | "VirtualMachine"
    | "AppService"
    | "Functions"
    | "SQLDatabase"
    | "CosmosDB"
    | "BlobStorage"
    | "VirtualNetwork"
    | "LoadBalancer"
    | "ApplicationGateway"
    | "AzureAD"
    | "KeyVault"
    | "Monitor"
    | "AKS"
    | "ContainerInstances"
    | "ServiceBus"
    | "EventHub"
    | "LogicApps"
    | "DataFactory"
    | "Synapse"
    | "MachineLearning"
    | "OpenAI"
    | string

/**
 * Azure icon component
 */
export interface AzureIconComponent extends ComponentBase {
    component: "AzureIcon"
    /** Azure service name */
    service: AzureService
    /** Label below icon */
    label?: string
}

/**
 * GCP service icons
 */
export type GCPService =
    | "ComputeEngine"
    | "CloudFunctions"
    | "CloudRun"
    | "GKE"
    | "CloudSQL"
    | "Firestore"
    | "BigQuery"
    | "CloudStorage"
    | "VPC"
    | "CloudLoadBalancing"
    | "CloudCDN"
    | "CloudDNS"
    | "IAM"
    | "SecretManager"
    | "PubSub"
    | "Dataflow"
    | "Composer"
    | "VertexAI"
    | "CloudMonitoring"
    | string

/**
 * GCP icon component
 */
export interface GCPIconComponent extends ComponentBase {
    component: "GCPIcon"
    /** GCP service name */
    service: GCPService
    /** Label below icon */
    label?: string
}

// ============================================================================
// Specialized Components
// ============================================================================

/**
 * Card component with header and content
 */
export interface CardComponent extends ComponentBase, ShapeStyle {
    component: "Card"
    /** Card title (required) */
    title: string
    /** Card subtitle */
    subtitle?: string
    /** Card body content */
    content?: string
    /** Header background color */
    headerColor?: string
}

/**
 * List component with items
 */
export interface ListComponent extends ComponentBase, ShapeStyle {
    component: "List"
    /** List title */
    title?: string
    /** List items */
    items: string[]
    /** Use numbered list */
    numbered?: boolean
}

/**
 * Timeline component
 */
export interface TimelineComponent extends ComponentBase {
    component: "Timeline"
    /** Timeline title */
    title?: string
    /** Timeline events */
    events: Array<{
        label: string
        description?: string
    }>
    /** Orientation */
    horizontal?: boolean
}

/**
 * Table component
 */
export interface TableComponent extends ComponentBase, ShapeStyle {
    component: "Table"
    /** Table title */
    title?: string
    /** Column headers */
    headers: string[]
    /** Table rows (array of arrays) */
    rows: string[][]
}

/**
 * Process/step indicator component
 */
export interface ProcessComponent extends ComponentBase {
    component: "Process"
    /** Process steps */
    steps: Array<{
        label: string
        status?: "pending" | "active" | "completed"
    }>
    /** Orientation */
    horizontal?: boolean
}

/**
 * Callout/annotation component
 */
export interface CalloutComponent extends ComponentBase, ShapeStyle, TextStyle {
    component: "Callout"
    /** Callout text */
    text: string
    /** Callout style */
    calloutStyle?: "note" | "warning" | "info" | "tip"
    /** Pointer direction */
    pointerDirection?: "left" | "right" | "top" | "bottom"
}

/**
 * Actor/person component (for use case diagrams)
 */
export interface ActorComponent extends ComponentBase {
    component: "Actor"
    /** Actor name */
    label?: string
}

/**
 * Document shape component
 */
export interface DocumentComponent
    extends ComponentBase,
        ShapeStyle,
        TextStyle {
    component: "Document"
    /** Document label */
    label?: string
}

/**
 * Cloud shape component
 */
export interface CloudComponent extends ComponentBase, ShapeStyle, TextStyle {
    component: "Cloud"
    /** Cloud label */
    label?: string
}

// ============================================================================
// Union Type for All Components
// ============================================================================

/**
 * Discriminated union of all DrawIO component types
 */
export type DrawIOComponent =
    // Basic shapes
    | RectangleComponent
    | RoundedRectComponent
    | EllipseComponent
    | DiamondComponent
    | HexagonComponent
    | TriangleComponent
    | CylinderComponent
    | ParallelogramComponent
    | StepComponent
    | NoteComponent
    | TextComponent
    | ImageComponent
    // Connector
    | ConnectorComponent
    // Containers
    | SwimlaneComponent
    | GroupComponent
    // Cloud icons
    | AWSIconComponent
    | AzureIconComponent
    | GCPIconComponent
    // UML
    | UMLClassComponent
    | UMLInterfaceComponent
    | UMLPackageComponent
    // Network topology
    | ServerComponent
    | DesktopComponent
    | LaptopComponent
    | RouterComponent
    | SwitchComponent
    | FirewallComponent
    | InternetComponent
    | DatabaseComponent
    // Specialized
    | CardComponent
    | ListComponent
    | TimelineComponent
    | TableComponent
    | ProcessComponent
    | CalloutComponent
    | ActorComponent
    | DocumentComponent
    | CloudComponent

/**
 * Extract component type string from component object
 */
export type ComponentType = DrawIOComponent["component"]

/**
 * Type guard to check if a component is an edge/connector
 */
export function isConnector(
    component: DrawIOComponent,
): component is ConnectorComponent {
    return component.component === "Connector"
}

/**
 * Type guard to check if a component is a container
 */
export function isContainer(
    component: DrawIOComponent,
): component is SwimlaneComponent | GroupComponent {
    return component.component === "Swimlane" || component.component === "Group"
}

/**
 * Type guard to check if a component is a cloud icon
 */
export function isCloudIcon(
    component: DrawIOComponent,
): component is AWSIconComponent | AzureIconComponent | GCPIconComponent {
    return ["AWSIcon", "AzureIcon", "GCPIcon"].includes(component.component)
}
