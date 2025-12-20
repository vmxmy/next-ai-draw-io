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
 * Convert OKLCH or other CSS color format to HEX
 * Uses a temporary DOM element to leverage browser's color parsing
 */
export function cssColorToHex(cssColor: string): string {
    if (!cssColor || cssColor.trim() === "") {
        return "#808080"
    }

    // If already hex, return as-is
    if (cssColor.startsWith("#")) {
        return cssColor
    }

    // Use browser to compute the RGB value
    if (typeof document === "undefined") {
        return "#808080"
    }

    const temp = document.createElement("div")
    temp.style.color = cssColor
    temp.style.display = "none"
    document.body.appendChild(temp)

    const computed = getComputedStyle(temp).color
    document.body.removeChild(temp)

    // Parse rgb(r, g, b) or rgba(r, g, b, a) format
    const rgbMatch = computed.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/,
    )
    if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number)
        return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
    }

    return "#808080"
}

/**
 * Extract current theme colors from CSS variables
 */
export function extractThemeColors(): ThemeColors {
    if (typeof document === "undefined") {
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

    const styles = getComputedStyle(document.documentElement)

    const getColor = (varName: string): string => {
        const cssValue = styles.getPropertyValue(varName).trim()
        return cssColorToHex(cssValue)
    }

    return {
        primary: getColor("--primary"),
        secondary: getColor("--secondary"),
        accent: getColor("--accent"),
        background: getColor("--background"),
        foreground: getColor("--foreground"),
        muted: getColor("--muted"),
        border: getColor("--border"),
    }
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
