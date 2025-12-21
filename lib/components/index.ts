/**
 * DrawIO Component System
 *
 * A2UI-style component abstraction layer for draw.io diagrams.
 * Provides type-safe component definitions, XML conversion, and parsing.
 */

export type { ComponentMetadata } from "./catalog"
// Catalog
export {
    AWS_SERVICE_SHAPES,
    AZURE_SERVICE_SHAPES,
    COMPONENT_CATALOG,
    GCP_SERVICE_SHAPES,
    getAWSShape,
    getAzureShape,
    getBaseStyle,
    getDefaultSize,
    getGCPShape,
    isContainerType,
    isEdgeType,
} from "./catalog"
// Converter (Component → XML)
export {
    componentsToXml,
    componentToCellXml,
    validateComponents,
} from "./converter"
// Parser (XML → Component)
export {
    cellToComponent,
    resolveChildRelationships,
    summarizeComponents,
    xmlToComponents,
} from "./parser"
// Types
export type {
    ActorComponent,
    AWSIconComponent,
    // Service types
    AWSService,
    AzureIconComponent,
    AzureService,
    CalloutComponent,
    CardComponent,
    CloudComponent,
    ComponentBase,
    ComponentType,
    ConnectorComponent,
    ConnectorStyle,
    CylinderComponent,
    DiamondComponent,
    DocumentComponent,
    // Component types
    DrawIOComponent,
    EllipseComponent,
    GCPIconComponent,
    GCPService,
    GroupComponent,
    HexagonComponent,
    ImageComponent,
    ListComponent,
    // Base types
    Position,
    ProcessComponent,
    RectangleComponent,
    RoundedRectComponent,
    ShapeStyle,
    Size,
    SwimlaneComponent,
    TableComponent,
    TextComponent,
    TextStyle,
    TimelineComponent,
    TriangleComponent,
} from "./types"
// Type guards
export { isCloudIcon, isConnector, isContainer } from "./types"
