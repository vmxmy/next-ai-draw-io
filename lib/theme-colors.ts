/**
 * Theme color extraction and conversion utilities
 * Used to extract current UI theme colors and format them for AI diagram styling
 */

export interface ThemeColors {
    primary: string
    secondary: string
    accent: string
    background: string
    foreground: string
    muted: string
    border: string
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
        console.log(
            `[getComputedColor] ${varName}: SSR environment, returning fallback`,
        )
        return "#808080"
    }

    const root = document.documentElement
    const styles = getComputedStyle(root)

    // Debug: log the root element's class list
    console.log(`[getComputedColor] ${varName}: root classes =`, root.className)

    // Try to get the value directly from computed styles
    // This works for --ds-* variables defined in :root or theme classes
    const rawValue = styles.getPropertyValue(varName).trim()

    console.log(`[getComputedColor] ${varName}: rawValue = "${rawValue}"`)

    if (!rawValue) {
        console.log(
            `[getComputedColor] ${varName}: empty rawValue, returning fallback`,
        )
        return "#808080"
    }

    // If the value is already hex, return it
    if (rawValue.startsWith("#")) {
        console.log(
            `[getComputedColor] ${varName}: already hex, returning "${rawValue}"`,
        )
        return rawValue
    }

    // For oklch/lab or other color formats, use a canvas to convert to RGB
    // Canvas getImageData always returns RGB values
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext("2d")

    if (!ctx) {
        console.log(
            `[getComputedColor] ${varName}: Canvas context failed, returning fallback`,
        )
        return "#808080"
    }

    // Fill a pixel with the color and read it back as RGB
    ctx.fillStyle = rawValue
    ctx.fillRect(0, 0, 1, 1)
    const imageData = ctx.getImageData(0, 0, 1, 1).data
    const [r, g, b] = imageData

    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
    console.log(
        `[getComputedColor] ${varName}: canvas RGB = [${r}, ${g}, ${b}], hex = "${hex}"`,
    )
    return hex
}

/**
 * Extract current theme colors from CSS variables
 * Uses --ds-* variables which contain the actual OKLCH values
 * These are defined in design-tokens.css and overridden by theme classes in palettes.css
 */
export function extractThemeColors(): ThemeColors {
    console.log("[extractThemeColors] Starting extraction...")

    if (typeof document === "undefined") {
        console.log(
            "[extractThemeColors] SSR environment, returning default colors",
        )
        return {
            primary: "#3B82F6",
            secondary: "#F3F4F6",
            accent: "#FEF3C7",
            background: "#FFFFFF",
            foreground: "#1F2937",
            muted: "#9CA3AF",
            border: "#E5E7EB",
        }
    }

    // Use --ds-* variables (design system tokens) as they contain the actual values
    // The --primary etc. are @theme directive aliases that may not be accessible via getComputedStyle
    const colors = {
        primary: getComputedColor("--ds-primary"),
        secondary: getComputedColor("--ds-secondary"),
        accent: getComputedColor("--ds-accent"),
        background: getComputedColor("--ds-background"),
        foreground: getComputedColor("--ds-foreground"),
        muted: getComputedColor("--ds-muted"),
        border: getComputedColor("--ds-border"),
    }

    console.log("[extractThemeColors] Final colors:", colors)
    return colors
}

/**
 * Format theme colors as a prompt for the AI agent
 */
export function formatThemeColorsForPrompt(colors: ThemeColors): string {
    return `Apply the following UI theme colors to the entire diagram. Update all shapes, containers, and connectors to create a cohesive color scheme matching the current page theme:

[Theme Colors - HEX format for draw.io styles]
- Primary: ${colors.primary} (use for main elements, headers, important shapes - as fillColor)
- Secondary: ${colors.secondary} (use for secondary elements, container backgrounds)
- Accent: ${colors.accent} (use for highlights, call-to-action elements)
- Background: ${colors.background} (use for shape fill backgrounds - as fillColor for less prominent shapes)
- Foreground: ${colors.foreground} (use for text, labels - as fontColor)
- Muted: ${colors.muted} (use for less important elements, secondary text)
- Border: ${colors.border} (use for borders, edges - as strokeColor)

Instructions:
1. Apply these colors to ALL existing shapes using edit_diagram with updateCell operations
2. Use Primary (${colors.primary}) for main/important shapes (fillColor)
3. Use Foreground (${colors.foreground}) for all text labels (fontColor)
4. Use Border (${colors.border}) for all shape borders and edges (strokeColor)
5. Ensure text remains readable with appropriate contrast
6. Apply consistent styling across the entire diagram`
}
