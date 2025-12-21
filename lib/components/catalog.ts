/**
 * DrawIO Component Catalog Registry
 *
 * Defines metadata for all supported component types including:
 * - Default sizes
 * - Supported properties
 * - Description for AI prompts
 * - mxGraph style mappings
 */

import type {
    AWSService,
    AzureService,
    ComponentType,
    GCPService,
} from "./types"

/**
 * Component metadata definition
 */
export interface ComponentMetadata {
    /** Human-readable description */
    description: string
    /** Default size when not specified */
    defaultSize: { width: number; height: number }
    /** Whether this is an edge/connector */
    isEdge?: boolean
    /** Whether this is a container component */
    isContainer?: boolean
    /** List of supported properties */
    properties: string[]
    /** Base mxGraph style string */
    baseStyle?: string
}

/**
 * Complete component catalog with metadata
 */
export const COMPONENT_CATALOG: {
    catalogId: string
    version: string
    components: Record<ComponentType, ComponentMetadata>
} = {
    catalogId: "com.drawio.components.v1",
    version: "1.0.0",

    components: {
        // =====================================================================
        // Basic Shapes
        // =====================================================================
        Rectangle: {
            description: "Basic rectangle shape for general use",
            defaultSize: { width: 120, height: 60 },
            properties: [
                "label",
                "fill",
                "stroke",
                "strokeWidth",
                "opacity",
                "shadow",
                "dashed",
            ],
            baseStyle: "rounded=0",
        },

        RoundedRect: {
            description:
                "Rectangle with rounded corners, often used for processes",
            defaultSize: { width: 120, height: 60 },
            properties: [
                "label",
                "fill",
                "stroke",
                "strokeWidth",
                "cornerRadius",
                "shadow",
            ],
            baseStyle: "rounded=1",
        },

        Ellipse: {
            description:
                "Ellipse or circle shape, often used for start/end states",
            defaultSize: { width: 80, height: 80 },
            properties: ["label", "fill", "stroke", "strokeWidth", "shadow"],
            baseStyle: "ellipse",
        },

        Diamond: {
            description: "Diamond/rhombus shape for decision points",
            defaultSize: { width: 80, height: 80 },
            properties: ["label", "fill", "stroke", "strokeWidth", "shadow"],
            baseStyle: "rhombus",
        },

        Hexagon: {
            description: "Hexagon shape for preparation or manual operations",
            defaultSize: { width: 120, height: 80 },
            properties: ["label", "fill", "stroke", "strokeWidth"],
            baseStyle: "shape=hexagon;perimeter=hexagonPerimeter2",
        },

        Triangle: {
            description: "Triangle shape with configurable direction",
            defaultSize: { width: 60, height: 80 },
            properties: ["label", "fill", "stroke", "direction"],
            baseStyle: "triangle",
        },

        Cylinder: {
            description: "Cylinder shape typically representing databases",
            defaultSize: { width: 60, height: 80 },
            properties: ["label", "fill", "stroke", "strokeWidth"],
            baseStyle:
                "shape=cylinder3;whiteSpace=wrap;boundedLbl=1;backgroundOutline=1;size=15",
        },

        Parallelogram: {
            description: "Parallelogram shape for input/output operations",
            defaultSize: { width: 120, height: 60 },
            properties: ["label", "fill", "stroke", "strokeWidth"],
            baseStyle: "shape=parallelogram;perimeter=parallelogramPerimeter",
        },

        Step: {
            description: "Step shape for sequential process steps",
            defaultSize: { width: 120, height: 60 },
            properties: ["label", "fill", "stroke", "strokeWidth"],
            baseStyle: "shape=step;perimeter=stepPerimeter;fixedSize=1",
        },

        Note: {
            description: "Sticky note shape for annotations",
            defaultSize: { width: 100, height: 80 },
            properties: ["label", "fill", "stroke"],
            baseStyle: "shape=note;whiteSpace=wrap;size=14",
        },

        // =====================================================================
        // UML Components
        // =====================================================================
        UMLClass: {
            description: "UML Class diagram component",
            defaultSize: { width: 160, height: 100 },
            properties: ["name", "attributes", "methods", "fill", "stroke"],
            baseStyle:
                "swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=30;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;marginBottom=0",
        },

        UMLInterface: {
            description: "UML Interface component",
            defaultSize: { width: 140, height: 80 },
            properties: ["name", "methods", "fill", "stroke"],
            baseStyle: "swimlane;fontStyle=1;startSize=30",
        },

        UMLPackage: {
            description: "UML Package container",
            defaultSize: { width: 200, height: 150 },
            isContainer: true,
            properties: ["name", "children", "fill", "stroke"],
            baseStyle: "shape=umlFrame;whiteSpace=wrap;html=1;pointerEvents=0",
        },

        // =====================================================================
        // Network Topology Components
        // =====================================================================
        Server: {
            description: "Server icon for network diagrams",
            defaultSize: { width: 50, height: 60 },
            properties: ["label", "fill", "stroke"],
            baseStyle: "shape=mxgraph.cisco.servers.standard_host;sketch=0",
        },

        Desktop: {
            description: "Desktop/Workstation icon",
            defaultSize: { width: 50, height: 50 },
            properties: ["label", "fill", "stroke"],
            baseStyle:
                "shape=mxgraph.cisco.computers_and_peripherals.pc;sketch=0",
        },

        Laptop: {
            description: "Laptop icon",
            defaultSize: { width: 50, height: 35 },
            properties: ["label", "fill", "stroke"],
            baseStyle:
                "shape=mxgraph.cisco.computers_and_peripherals.laptop;sketch=0",
        },

        Router: {
            description: "Network router icon",
            defaultSize: { width: 50, height: 30 },
            properties: ["label", "fill", "stroke"],
            baseStyle: "shape=mxgraph.cisco.routers.router;sketch=0",
        },

        Switch: {
            description: "Network switch icon",
            defaultSize: { width: 50, height: 15 },
            properties: ["label", "fill", "stroke"],
            baseStyle: "shape=mxgraph.cisco.switches.workgroup_switch;sketch=0",
        },

        Firewall: {
            description: "Firewall icon",
            defaultSize: { width: 40, height: 50 },
            properties: ["label", "fill", "stroke"],
            baseStyle: "shape=mxgraph.cisco.security.firewall;sketch=0",
        },

        Internet: {
            description: "Internet/Cloud icon for network diagrams",
            defaultSize: { width: 60, height: 40 },
            properties: ["label", "fill", "stroke"],
            baseStyle: "shape=mxgraph.cisco.misc.cloud;sketch=0",
        },

        Database: {
            description: "Database icon for network diagrams",
            defaultSize: { width: 40, height: 50 },
            properties: ["label", "fill", "stroke"],
            baseStyle: "shape=mxgraph.cisco.storage.database;sketch=0",
        },

        Text: {
            description: "Text label without any shape background",
            defaultSize: { width: 100, height: 40 },
            properties: [
                "text",
                "fontSize",
                "fontFamily",
                "fontColor",
                "fontStyle",
                "align",
                "verticalAlign",
            ],
            baseStyle: "text;strokeColor=none;fillColor=none",
        },

        Image: {
            description: "Image from URL or data URI",
            defaultSize: { width: 80, height: 80 },
            properties: ["src", "preserveAspect", "label"],
            baseStyle: "shape=image;imageAspect=0;aspect=fixed",
        },

        // =====================================================================
        // Connector
        // =====================================================================
        Connector: {
            description: "Line connecting two components with optional arrows",
            defaultSize: { width: 0, height: 0 },
            isEdge: true,
            properties: [
                "source",
                "target",
                "label",
                "lineType",
                "startArrow",
                "endArrow",
                "strokeColor",
                "strokeWidth",
                "dashed",
                "animated",
                "waypoints",
            ],
            baseStyle: "edgeStyle=orthogonalEdgeStyle",
        },

        // =====================================================================
        // Containers
        // =====================================================================
        Swimlane: {
            description: "Swimlane container for grouping related elements",
            defaultSize: { width: 200, height: 300 },
            isContainer: true,
            properties: [
                "title",
                "titleHeight",
                "horizontal",
                "children",
                "fill",
                "headerFill",
                "collapsible",
            ],
            baseStyle: "swimlane;startSize=30",
        },

        Group: {
            description: "Invisible container for grouping elements",
            defaultSize: { width: 200, height: 200 },
            isContainer: true,
            properties: ["children", "collapsible", "collapsed"],
            baseStyle: "group",
        },

        // =====================================================================
        // Cloud Provider Icons
        // =====================================================================
        AWSIcon: {
            description: "AWS service icon (2025 version)",
            defaultSize: { width: 78, height: 78 },
            properties: ["service", "label", "version"],
            baseStyle:
                "sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none",
        },

        AzureIcon: {
            description: "Microsoft Azure service icon",
            defaultSize: { width: 68, height: 68 },
            properties: ["service", "label"],
            baseStyle: "sketch=0;aspect=fixed",
        },

        GCPIcon: {
            description: "Google Cloud Platform service icon",
            defaultSize: { width: 68, height: 68 },
            properties: ["service", "label"],
            baseStyle: "sketch=0;aspect=fixed",
        },

        // =====================================================================
        // Specialized Components
        // =====================================================================
        Card: {
            description: "Card with header and content area",
            defaultSize: { width: 160, height: 120 },
            properties: [
                "title",
                "subtitle",
                "content",
                "headerColor",
                "fill",
                "stroke",
            ],
            baseStyle: "swimlane;startSize=40;horizontal=1",
        },

        List: {
            description: "Bulleted or numbered list",
            defaultSize: { width: 140, height: 100 },
            properties: ["title", "items", "numbered", "fill", "stroke"],
            baseStyle: "swimlane;fontStyle=0;startSize=26;horizontal=1",
        },

        Timeline: {
            description: "Timeline with events",
            defaultSize: { width: 400, height: 100 },
            properties: ["title", "events", "horizontal"],
            baseStyle: "rounded=1",
        },

        Table: {
            description: "Table with headers and rows",
            defaultSize: { width: 200, height: 120 },
            properties: ["title", "headers", "rows", "fill", "stroke"],
            baseStyle:
                "shape=table;startSize=30;container=1;collapsible=0;childLayout=tableLayout",
        },

        Process: {
            description: "Process/step indicator with status",
            defaultSize: { width: 400, height: 60 },
            properties: ["steps", "horizontal"],
            baseStyle: "rounded=1",
        },

        Callout: {
            description: "Callout or annotation bubble",
            defaultSize: { width: 120, height: 80 },
            properties: [
                "text",
                "calloutStyle",
                "pointerDirection",
                "fill",
                "stroke",
            ],
            baseStyle: "shape=callout;perimeter=calloutPerimeter",
        },

        Actor: {
            description: "Stick figure actor for use case diagrams",
            defaultSize: { width: 40, height: 80 },
            properties: ["label"],
            baseStyle:
                "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top",
        },

        Document: {
            description: "Document shape with wavy bottom",
            defaultSize: { width: 80, height: 100 },
            properties: ["label", "fill", "stroke"],
            baseStyle: "shape=document;whiteSpace=wrap;boundedLbl=1",
        },

        Cloud: {
            description: "Cloud shape for external systems or internet",
            defaultSize: { width: 120, height: 80 },
            properties: ["label", "fill", "stroke"],
            baseStyle: "ellipse;shape=cloud;whiteSpace=wrap",
        },
    },
}

/**
 * AWS service to mxGraph shape mapping
 */
export const AWS_SERVICE_SHAPES: Record<AWSService, string> = {
    EC2: "mxgraph.aws4.ec2",
    S3: "mxgraph.aws4.s3",
    Lambda: "mxgraph.aws4.lambda",
    RDS: "mxgraph.aws4.rds",
    DynamoDB: "mxgraph.aws4.dynamodb",
    VPC: "mxgraph.aws4.vpc",
    CloudFront: "mxgraph.aws4.cloudfront",
    Route53: "mxgraph.aws4.route_53",
    APIGateway: "mxgraph.aws4.api_gateway",
    SNS: "mxgraph.aws4.sns",
    SQS: "mxgraph.aws4.sqs",
    ECS: "mxgraph.aws4.ecs",
    EKS: "mxgraph.aws4.eks",
    Fargate: "mxgraph.aws4.fargate",
    ElasticLoadBalancing: "mxgraph.aws4.elastic_load_balancing",
    CloudWatch: "mxgraph.aws4.cloudwatch",
    IAM: "mxgraph.aws4.iam",
    Cognito: "mxgraph.aws4.cognito",
    SecretsManager: "mxgraph.aws4.secrets_manager",
    KMS: "mxgraph.aws4.kms",
    Kinesis: "mxgraph.aws4.kinesis",
    Redshift: "mxgraph.aws4.redshift",
    ElastiCache: "mxgraph.aws4.elasticache",
    StepFunctions: "mxgraph.aws4.step_functions",
    EventBridge: "mxgraph.aws4.eventbridge",
    Athena: "mxgraph.aws4.athena",
    Glue: "mxgraph.aws4.glue",
    SageMaker: "mxgraph.aws4.sagemaker",
    Bedrock: "mxgraph.aws4.bedrock",
}

/**
 * Azure service to mxGraph shape mapping
 */
export const AZURE_SERVICE_SHAPES: Record<AzureService, string> = {
    VirtualMachine: "mxgraph.azure.compute.virtual_machine",
    AppService: "mxgraph.azure.compute.app_service",
    Functions: "mxgraph.azure.compute.function_apps",
    SQLDatabase: "mxgraph.azure.databases.sql_database",
    CosmosDB: "mxgraph.azure.databases.cosmos_db",
    BlobStorage: "mxgraph.azure.storage.blob_storage",
    VirtualNetwork: "mxgraph.azure.networking.virtual_network",
    LoadBalancer: "mxgraph.azure.networking.load_balancer",
    ApplicationGateway: "mxgraph.azure.networking.application_gateway",
    AzureAD: "mxgraph.azure.identity.azure_active_directory",
    KeyVault: "mxgraph.azure.security.key_vault",
    Monitor: "mxgraph.azure.management.monitor",
    AKS: "mxgraph.azure.compute.kubernetes_services",
    ContainerInstances: "mxgraph.azure.compute.container_instances",
    ServiceBus: "mxgraph.azure.integration.service_bus",
    EventHub: "mxgraph.azure.analytics.event_hubs",
    LogicApps: "mxgraph.azure.integration.logic_apps",
    DataFactory: "mxgraph.azure.analytics.data_factory",
    Synapse: "mxgraph.azure.analytics.synapse_analytics",
    MachineLearning: "mxgraph.azure.ai_machine_learning.machine_learning",
    OpenAI: "mxgraph.azure.ai_machine_learning.azure_openai",
}

/**
 * GCP service to mxGraph shape mapping
 */
export const GCP_SERVICE_SHAPES: Record<GCPService, string> = {
    ComputeEngine: "mxgraph.gcp2.compute_engine",
    CloudFunctions: "mxgraph.gcp2.cloud_functions",
    CloudRun: "mxgraph.gcp2.cloud_run",
    GKE: "mxgraph.gcp2.google_kubernetes_engine",
    CloudSQL: "mxgraph.gcp2.cloud_sql",
    Firestore: "mxgraph.gcp2.firestore",
    BigQuery: "mxgraph.gcp2.bigquery",
    CloudStorage: "mxgraph.gcp2.cloud_storage",
    VPC: "mxgraph.gcp2.virtual_private_cloud",
    CloudLoadBalancing: "mxgraph.gcp2.cloud_load_balancing",
    CloudCDN: "mxgraph.gcp2.cloud_cdn",
    CloudDNS: "mxgraph.gcp2.cloud_dns",
    IAM: "mxgraph.gcp2.cloud_iam",
    SecretManager: "mxgraph.gcp2.secret_manager",
    PubSub: "mxgraph.gcp2.cloud_pubsub",
    Dataflow: "mxgraph.gcp2.dataflow",
    Composer: "mxgraph.gcp2.cloud_composer",
    VertexAI: "mxgraph.gcp2.vertex_ai",
    CloudMonitoring: "mxgraph.gcp2.cloud_monitoring",
}

/**
 * Get default size for a component type
 */
export function getDefaultSize(componentType: ComponentType): {
    width: number
    height: number
} {
    return (
        COMPONENT_CATALOG.components[componentType]?.defaultSize ?? {
            width: 120,
            height: 60,
        }
    )
}

/**
 * Get base style for a component type
 */
export function getBaseStyle(componentType: ComponentType): string {
    return COMPONENT_CATALOG.components[componentType]?.baseStyle ?? ""
}

/**
 * Check if component type is an edge
 */
export function isEdgeType(componentType: ComponentType): boolean {
    return COMPONENT_CATALOG.components[componentType]?.isEdge ?? false
}

/**
 * Check if component type is a container
 */
export function isContainerType(componentType: ComponentType): boolean {
    return COMPONENT_CATALOG.components[componentType]?.isContainer ?? false
}

/**
 * Get AWS shape name for a service
 */
export function getAWSShape(service: AWSService): string {
    return (
        AWS_SERVICE_SHAPES[service] ?? `mxgraph.aws4.${service.toLowerCase()}`
    )
}

/**
 * Get Azure shape name for a service
 */
export function getAzureShape(service: AzureService): string {
    return (
        AZURE_SERVICE_SHAPES[service] ??
        `mxgraph.azure.${service.toLowerCase()}`
    )
}

/**
 * Get GCP shape name for a service
 */
export function getGCPShape(service: GCPService): string {
    return (
        GCP_SERVICE_SHAPES[service] ?? `mxgraph.gcp2.${service.toLowerCase()}`
    )
}
