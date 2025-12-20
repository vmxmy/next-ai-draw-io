/**
 * Theme color extraction and conversion utilities
 * Used to extract current UI theme colors and format them for AI diagram styling
 */

export interface ThemeColors {
    // Core colors
    primary: string
    primaryForeground: string
    secondary: string
    secondaryForeground: string
    accent: string
    accentForeground: string
    background: string
    foreground: string
    muted: string
    mutedForeground: string
    border: string
    // Additional colors
    card: string
    cardForeground: string
    destructive: string
    success: string
    // Chart colors for data visualization
    chart1: string
    chart2: string
    chart3: string
    chart4: string
    chart5: string
}

export interface ThemeStyle {
    // Border radius
    radius: string
    // Shadow settings
    shadowColor: string
    shadowOffsetX: string
    shadowOffsetY: string
    shadowBlur: string
    // Font
    fontFamily: string
}

export interface FullThemeConfig {
    colors: ThemeColors
    style: ThemeStyle
}

/**
 * Convert OKLCH, LAB, or other CSS color format to HEX
 * Uses a canvas to reliably convert any CSS color to RGB
 */
export function cssColorToHex(cssColor: string): string {
    if (!cssColor || cssColor.trim() === "") {
        return "#808080"
    }

    // If already hex, return as-is
    if (cssColor.startsWith("#")) {
        return cssColor
    }

    // Use canvas to compute the RGB value (works in browser only)
    if (typeof document === "undefined") {
        return "#808080"
    }

    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext("2d")

    if (!ctx) {
        return "#808080"
    }

    // Fill a pixel with the color and read it back as RGB
    ctx.fillStyle = cssColor
    ctx.fillRect(0, 0, 1, 1)
    const imageData = ctx.getImageData(0, 0, 1, 1).data
    const [r, g, b] = imageData

    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

/**
 * Get computed color from CSS variable on document root
 * Reads --ds-* variables directly as they contain the actual OKLCH values
 * Uses getComputedStyle on documentElement to get the resolved color value
 */
function getComputedColor(varName: string): string {
    if (typeof document === "undefined") {
        return "#808080"
    }

    const root = document.documentElement
    const styles = getComputedStyle(root)
    const rawValue = styles.getPropertyValue(varName).trim()

    if (!rawValue) {
        return "#808080"
    }

    // If the value is already hex, return it
    if (rawValue.startsWith("#")) {
        return rawValue
    }

    // For oklch/lab or other color formats, use a canvas to convert to RGB
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext("2d")

    if (!ctx) {
        return "#808080"
    }

    // Fill a pixel with the color and read it back as RGB
    ctx.fillStyle = rawValue
    ctx.fillRect(0, 0, 1, 1)
    const imageData = ctx.getImageData(0, 0, 1, 1).data
    const [r, g, b] = imageData

    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

/**
 * Get computed CSS value (non-color) from document root
 */
function getComputedValue(varName: string, fallback: string): string {
    if (typeof document === "undefined") {
        return fallback
    }

    const root = document.documentElement
    const styles = getComputedStyle(root)
    const rawValue = styles.getPropertyValue(varName).trim()

    return rawValue || fallback
}

/**
 * Extract current theme colors from CSS variables
 * Uses --ds-* variables which contain the actual OKLCH values
 * These are defined in design-tokens.css and overridden by theme classes in palettes.css
 */
export function extractThemeColors(): ThemeColors {
    const defaultColors: ThemeColors = {
        primary: "#3B82F6",
        primaryForeground: "#FFFFFF",
        secondary: "#F3F4F6",
        secondaryForeground: "#1F2937",
        accent: "#FEF3C7",
        accentForeground: "#1F2937",
        background: "#FFFFFF",
        foreground: "#1F2937",
        muted: "#9CA3AF",
        mutedForeground: "#6B7280",
        border: "#E5E7EB",
        card: "#FFFFFF",
        cardForeground: "#1F2937",
        destructive: "#EF4444",
        success: "#22C55E",
        chart1: "#3B82F6",
        chart2: "#22C55E",
        chart3: "#F59E0B",
        chart4: "#EF4444",
        chart5: "#8B5CF6",
    }

    if (typeof document === "undefined") {
        return defaultColors
    }

    // Use --ds-* variables (design system tokens) as they contain the actual values
    return {
        primary: getComputedColor("--ds-primary"),
        primaryForeground: getComputedColor("--ds-primary-foreground"),
        secondary: getComputedColor("--ds-secondary"),
        secondaryForeground: getComputedColor("--ds-secondary-foreground"),
        accent: getComputedColor("--ds-accent"),
        accentForeground: getComputedColor("--ds-accent-foreground"),
        background: getComputedColor("--ds-background"),
        foreground: getComputedColor("--ds-foreground"),
        muted: getComputedColor("--ds-muted"),
        mutedForeground: getComputedColor("--ds-muted-foreground"),
        border: getComputedColor("--ds-border"),
        card: getComputedColor("--ds-card"),
        cardForeground: getComputedColor("--ds-card-foreground"),
        destructive: getComputedColor("--ds-destructive"),
        success: getComputedColor("--ds-success"),
        chart1: getComputedColor("--ds-chart-1"),
        chart2: getComputedColor("--ds-chart-2"),
        chart3: getComputedColor("--ds-chart-3"),
        chart4: getComputedColor("--ds-chart-4"),
        chart5: getComputedColor("--ds-chart-5"),
    }
}

/**
 * Extract theme style settings (non-color values)
 */
export function extractThemeStyle(): ThemeStyle {
    const defaultStyle: ThemeStyle = {
        radius: "8px",
        shadowColor: "#000000",
        shadowOffsetX: "0px",
        shadowOffsetY: "4px",
        shadowBlur: "6px",
        fontFamily: "sans-serif",
    }

    if (typeof document === "undefined") {
        return defaultStyle
    }

    return {
        radius: getComputedValue("--ds-radius", "8px"),
        shadowColor: getComputedColor("--ds-shadow-color"),
        shadowOffsetX: getComputedValue("--ds-shadow-offset-x", "0px"),
        shadowOffsetY: getComputedValue("--ds-shadow-offset-y", "4px"),
        shadowBlur: getComputedValue("--ds-shadow-blur", "6px"),
        fontFamily: getComputedValue("--ds-font-sans", "sans-serif"),
    }
}

/**
 * Extract full theme configuration (colors + style)
 */
export function extractFullThemeConfig(): FullThemeConfig {
    return {
        colors: extractThemeColors(),
        style: extractThemeStyle(),
    }
}

/**
 * Format full theme config as a prompt for the AI agent
 */
export function formatThemeColorsForPrompt(config: FullThemeConfig): string {
    const { colors, style } = config

    // Parse radius to get numeric value for draw.io
    const radiusValue = Number.parseInt(style.radius, 10) || 8

    return `Apply the following UI theme to the entire diagram. Update all shapes, containers, and connectors to create a cohesive design matching the current page theme.

## Color Palette (HEX format for draw.io styles)

### Primary Colors
- Primary: ${colors.primary} (main elements, headers, important shapes - fillColor)
- Primary Text: ${colors.primaryForeground} (text on primary backgrounds - fontColor)

### Secondary Colors
- Secondary: ${colors.secondary} (secondary elements, container backgrounds - fillColor)
- Secondary Text: ${colors.secondaryForeground} (text on secondary backgrounds - fontColor)

### Accent Colors
- Accent: ${colors.accent} (highlights, call-to-action elements - fillColor)
- Accent Text: ${colors.accentForeground} (text on accent backgrounds - fontColor)

### Base Colors
- Background: ${colors.background} (shape fill backgrounds - fillColor)
- Foreground: ${colors.foreground} (default text color - fontColor)
- Border: ${colors.border} (borders, edges, connectors - strokeColor)

### Supporting Colors
- Card: ${colors.card} (card/container backgrounds - fillColor)
- Card Text: ${colors.cardForeground} (text in cards - fontColor)
- Muted: ${colors.muted} (less important backgrounds - fillColor)
- Muted Text: ${colors.mutedForeground} (secondary text - fontColor)

### Status Colors
- Success: ${colors.success} (success states, positive indicators)
- Destructive: ${colors.destructive} (error states, warnings, negative indicators)

### Chart/Data Visualization Colors
- Chart 1: ${colors.chart1}
- Chart 2: ${colors.chart2}
- Chart 3: ${colors.chart3}
- Chart 4: ${colors.chart4}
- Chart 5: ${colors.chart5}

## Style Settings

### Border Radius
- Radius: ${radiusValue}px (use rounded=${radiusValue > 0 ? 1 : 0};arcSize=${Math.min(radiusValue * 2, 50)} in draw.io styles)

### Shadow Effect
- Shadow Color: ${style.shadowColor}
- Shadow Offset: ${style.shadowOffsetX} horizontal, ${style.shadowOffsetY} vertical
- Shadow Blur: ${style.shadowBlur}
- (Use shadow=1 in draw.io styles for shapes that need shadow)

### Font
- Font Family: ${style.fontFamily}

## Instructions

1. Apply these colors to ALL existing shapes using edit_diagram with updateCell operations
2. Color usage hierarchy:
   - Primary (${colors.primary}) → Main/important shapes, headers
   - Secondary (${colors.secondary}) → Container backgrounds, groups
   - Accent (${colors.accent}) → Highlights, call-to-action elements
   - Card (${colors.card}) → Content containers, boxes
   - Muted (${colors.muted}) → Less important elements

3. Text colors must contrast with backgrounds:
   - On Primary → use ${colors.primaryForeground}
   - On Secondary → use ${colors.secondaryForeground}
   - On Accent → use ${colors.accentForeground}
   - On Card → use ${colors.cardForeground}
   - Default text → use ${colors.foreground}

4. Borders and connectors → use ${colors.border}

5. Apply rounded corners: rounded=1;arcSize=${Math.min(radiusValue * 2, 50)}

6. For data visualizations, use chart colors in order: chart1→chart5

7. Use Success (${colors.success}) for positive states, Destructive (${colors.destructive}) for errors/warnings`
}
