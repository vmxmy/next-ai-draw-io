"use client"

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"

import { tweakcnThemes } from "@/lib/tweakcn-themes"

type TweakcnThemeName = (typeof tweakcnThemes)[number]["name"]
type Appearance = "light" | "dark" | "system"
export type PaletteTheme = TweakcnThemeName
type ThemeStorage = { appearance: Appearance; palette: PaletteTheme | null }

type ThemeProviderState = {
    appearance: Appearance
    resolvedAppearance: "light" | "dark"
    palette: PaletteTheme | null
    setAppearance: (appearance: Appearance) => void
    setPalette: (palette: PaletteTheme | null) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | null>(null)

type ThemeProviderProps = {
    children: React.ReactNode
    defaultAppearance?: Appearance
    defaultPalette?: PaletteTheme | null
    storageKey?: string
}

const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)"

function isPaletteTheme(
    value: unknown,
    paletteNames: PaletteTheme[],
): value is PaletteTheme {
    return (
        typeof value === "string" &&
        paletteNames.includes(value as PaletteTheme)
    )
}

export function ThemeProvider({
    children,
    defaultAppearance = "system",
    defaultPalette = null,
    storageKey = "next-ai-draw-io-theme",
}: ThemeProviderProps) {
    const paletteNames = useMemo<PaletteTheme[]>(
        () => tweakcnThemes.map((theme) => theme.name as PaletteTheme),
        [],
    )

    const [appearance, setAppearanceState] =
        useState<Appearance>(defaultAppearance)
    const [palette, setPaletteState] = useState<PaletteTheme | null>(
        isPaletteTheme(defaultPalette, paletteNames) ? defaultPalette : null,
    )
    const [resolvedAppearance, setResolvedAppearance] = useState<
        "light" | "dark"
    >("light")

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        const storedRaw = window.localStorage.getItem(storageKey)
        if (!storedRaw) {
            return
        }

        try {
            const parsed = JSON.parse(storedRaw) as ThemeStorage | string
            if (typeof parsed === "string") {
                if (
                    parsed === "light" ||
                    parsed === "dark" ||
                    parsed === "system"
                ) {
                    setAppearanceState(parsed)
                } else if (isPaletteTheme(parsed, paletteNames)) {
                    setPaletteState(parsed)
                }
                return
            }

            if (parsed && typeof parsed === "object") {
                if (
                    parsed.appearance === "light" ||
                    parsed.appearance === "dark" ||
                    parsed.appearance === "system"
                ) {
                    setAppearanceState(parsed.appearance)
                }
                if (isPaletteTheme(parsed.palette, paletteNames)) {
                    setPaletteState(parsed.palette)
                }
            }
        } catch (error) {
            console.warn("[ThemeProvider] Failed to parse stored theme", error)
        }
    }, [paletteNames, storageKey])

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        const media = window.matchMedia(THEME_MEDIA_QUERY)
        const root = window.document.documentElement
        const classPrefix = "theme-"
        const paletteClasses = paletteNames.map(
            (name) => `${classPrefix}${name}`,
        )

        const getSystemAppearance = () => (media.matches ? "dark" : "light")

        const applyVisualAppearance = (value: "light" | "dark") => {
            root.classList.remove("light", "dark")
            root.classList.add(value)
            setResolvedAppearance(value)
        }

        const applyPalette = (nextPalette: PaletteTheme | null) => {
            paletteClasses.forEach((className) => {
                root.classList.remove(className)
            })

            if (nextPalette && paletteNames.includes(nextPalette)) {
                root.classList.add(`${classPrefix}${nextPalette}`)
            }
        }

        const resolveAppearance = () =>
            appearance === "system" ? getSystemAppearance() : appearance

        const update = () => {
            applyVisualAppearance(resolveAppearance())
            applyPalette(palette)
        }

        update()

        const listener = () => {
            if (appearance === "system") {
                update()
            }
        }

        if (appearance === "system") {
            media.addEventListener("change", listener)
        }

        return () => {
            media.removeEventListener("change", listener)
        }
    }, [appearance, palette, paletteNames])

    const persistState = useCallback(
        (next: ThemeStorage) => {
            if (typeof window === "undefined") {
                return
            }
            try {
                window.localStorage.setItem(storageKey, JSON.stringify(next))
            } catch (error) {
                console.warn("[ThemeProvider] Failed to persist theme", error)
            }
        },
        [storageKey],
    )

    const setAppearance = useCallback(
        (value: Appearance) => {
            setAppearanceState(value)
            persistState({ appearance: value, palette })
        },
        [palette, persistState],
    )

    const setPalette = useCallback(
        (value: PaletteTheme | null) => {
            const nextValue =
                value && paletteNames.includes(value) ? value : null
            setPaletteState(nextValue)
            persistState({ appearance, palette: nextValue })
        },
        [appearance, paletteNames, persistState],
    )

    const value = useMemo<ThemeProviderState>(
        () => ({
            appearance,
            resolvedAppearance,
            palette,
            setAppearance,
            setPalette,
        }),
        [appearance, palette, resolvedAppearance, setAppearance, setPalette],
    )

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeProviderContext)
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider")
    }
    return context
}
