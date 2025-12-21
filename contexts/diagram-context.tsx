"use client"

import type React from "react"
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import type { DrawIoEmbedRef } from "react-drawio"
import type { ExportFormat } from "@/components/save-dialog"
import { initDebugParser } from "@/lib/debug-parser"
import { STORAGE_DIAGRAM_XML_KEY } from "@/lib/storage-keys"
import {
    autoFixXml,
    extractDiagramXML,
    validateMxCellStructure,
} from "@/lib/utils"

interface DiagramContextType {
    chartXML: string
    latestSvg: string
    diagramHistory: { svg: string; xml: string }[]
    canUndo: boolean
    canRedo: boolean
    undoDiagram: () => void
    redoDiagram: () => void
    restoreHistoryIndex: (index: number) => void
    loadDiagram: (chart: string, skipValidation?: boolean) => string | null
    syncDiagramXml: (chart: string) => void
    handleExport: () => void
    handleExportWithoutHistory: () => void
    resolverRef: React.Ref<((value: string) => void) | null>
    drawioRef: React.Ref<DrawIoEmbedRef | null>
    handleDiagramExport: (data: any) => void
    clearDiagram: () => void
    saveDiagramToFile: (
        filename: string,
        format: ExportFormat,
        sessionId?: string,
    ) => void
    isDrawioReady: boolean
    onDrawioLoad: () => void
    resetDrawioReady: () => void
}

const DiagramContext = createContext<DiagramContextType | undefined>(undefined)

export function DiagramProvider({ children }: { children: React.ReactNode }) {
    const [chartXML, setChartXML] = useState<string>("")
    const [latestSvg, setLatestSvg] = useState<string>("")
    const [diagramHistory, setDiagramHistory] = useState<
        { svg: string; xml: string }[]
    >([])
    const [historyCursor, setHistoryCursor] = useState<number>(-1)
    const [isDrawioReady, setIsDrawioReady] = useState(false)
    const hasCalledOnLoadRef = useRef(false)
    const drawioRef = useRef<DrawIoEmbedRef | null>(null)
    const resolverRef = useRef<((value: string) => void) | null>(null)
    // Track if we're expecting an export for history (user-initiated)
    const expectHistoryExportRef = useRef<boolean>(false)
    const historyCursorRef = useRef<number>(-1)

    useEffect(() => {
        historyCursorRef.current = historyCursor
    }, [historyCursor])

    // Initialize debug parser in development mode
    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            initDebugParser()
        }
    }, [])

    // Sync current diagram XML to window for debug parser
    useEffect(() => {
        if (
            typeof window !== "undefined" &&
            process.env.NODE_ENV === "development"
        ) {
            window._currentDiagramXml = chartXML || null
        }
    }, [chartXML])

    const onDrawioLoad = useCallback(() => {
        // Only set ready state once to prevent infinite loops
        if (hasCalledOnLoadRef.current) return
        hasCalledOnLoadRef.current = true
        // console.log("[DiagramContext] DrawIO loaded, setting ready state")
        setIsDrawioReady(true)
    }, [])

    const resetDrawioReady = useCallback(() => {
        // console.log("[DiagramContext] Resetting DrawIO ready state")
        hasCalledOnLoadRef.current = false
        setIsDrawioReady(false)
    }, [])

    // Track if we're expecting an export for file save (stores raw export data)
    const saveResolverRef = useRef<{
        resolver: ((data: string) => void) | null
        format: ExportFormat | null
    }>({ resolver: null, format: null })

    const handleExport = useCallback(() => {
        if (drawioRef.current) {
            // Mark that this export should be saved to history
            expectHistoryExportRef.current = true
            drawioRef.current.exportDiagram({
                format: "xmlsvg",
            })
        }
    }, [])

    const handleExportWithoutHistory = useCallback(() => {
        if (drawioRef.current) {
            // Export without saving to history (for edit_diagram fetching current state)
            drawioRef.current.exportDiagram({
                format: "xmlsvg",
            })
        }
    }, [])

    const loadDiagram = useCallback(
        (chart: string, skipValidation?: boolean): string | null => {
            let xmlToLoad = chart

            // Validate XML structure before loading (unless skipped for internal use)
            if (!skipValidation) {
                const validationError = validateMxCellStructure(chart)
                if (validationError) {
                    console.warn(
                        "[loadDiagram] Validation error, attempting auto-fix:",
                        validationError,
                    )

                    // Try auto-fix before failing
                    const { fixed, fixes } = autoFixXml(chart)
                    if (fixes.length > 0) {
                        console.log(
                            `[loadDiagram] Auto-fixed ${fixes.length} issue(s):`,
                            fixes,
                        )
                    }

                    // Re-validate after fix
                    const postFixError = validateMxCellStructure(fixed)
                    if (postFixError) {
                        console.warn(
                            "[loadDiagram] Still invalid after auto-fix:",
                            postFixError,
                        )
                        return postFixError
                    }

                    // Use fixed XML
                    xmlToLoad = fixed
                    console.log(
                        "[loadDiagram] Auto-fix successful, loading fixed XML",
                    )
                }
            }

            // Keep chartXML in sync even when diagrams are injected (e.g., display_diagram tool)
            setChartXML(xmlToLoad)

            if (drawioRef.current) {
                try {
                    drawioRef.current.load({
                        xml: xmlToLoad,
                    })
                } catch (error) {
                    console.error(
                        "[loadDiagram] drawioRef.load() failed:",
                        error,
                    )
                }
            }

            return null
        },
        [],
    )

    // Sync XML from draw.io save without reloading iframe.
    const syncDiagramXml = useCallback((chart: string) => {
        setChartXML(chart)
        try {
            localStorage.setItem(STORAGE_DIAGRAM_XML_KEY, chart)
        } catch {
            // ignore storage failures
        }
    }, [])

    const handleDiagramExport = useCallback((data: any) => {
        // Handle save to file if requested (process raw data before extraction)
        if (saveResolverRef.current.resolver) {
            const format = saveResolverRef.current.format
            saveResolverRef.current.resolver(data.data)
            saveResolverRef.current = { resolver: null, format: null }
            // For non-xmlsvg formats, skip XML extraction as it will fail
            // Only drawio (which uses xmlsvg internally) has the content attribute
            if (format === "png" || format === "svg") {
                return
            }
        }

        const extractedXML = extractDiagramXML(data.data)
        setChartXML(extractedXML)
        setLatestSvg(data.data)

        // Only add to history if this was a user-initiated export
        if (expectHistoryExportRef.current) {
            setDiagramHistory((prev) => {
                const cursor = historyCursorRef.current
                const truncated =
                    cursor >= 0 && cursor < prev.length - 1
                        ? prev.slice(0, cursor + 1)
                        : prev
                const next = [
                    ...truncated,
                    {
                        svg: data.data,
                        xml: extractedXML,
                    },
                ]
                setHistoryCursor(next.length - 1)
                return next
            })
            expectHistoryExportRef.current = false
        }

        if (resolverRef.current) {
            resolverRef.current(extractedXML)
            resolverRef.current = null
        }
    }, [])

    const clearDiagram = useCallback(() => {
        const emptyDiagram = `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
        // Skip validation for trusted internal template (loadDiagram also sets chartXML)
        loadDiagram(emptyDiagram, true)
        setLatestSvg("")
        setDiagramHistory([])
        setHistoryCursor(-1)
    }, [loadDiagram])

    const restoreHistoryIndex = useCallback(
        (index: number) => {
            const item = diagramHistory[index]
            if (!item) return
            loadDiagram(item.xml, true)
            setHistoryCursor(index)
        },
        [diagramHistory, loadDiagram],
    )

    const canUndo = historyCursor > 0
    const canRedo =
        historyCursor >= 0 && historyCursor < diagramHistory.length - 1

    const undoDiagram = useCallback(() => {
        if (!canUndo) return
        restoreHistoryIndex(historyCursor - 1)
    }, [canUndo, historyCursor, restoreHistoryIndex])

    const redoDiagram = useCallback(() => {
        if (!canRedo) return
        restoreHistoryIndex(historyCursor + 1)
    }, [canRedo, historyCursor, restoreHistoryIndex])

    // Log save event to Langfuse (just flags the trace, doesn't send content)
    const logSaveToLangfuse = useCallback(
        async (filename: string, format: string, sessionId?: string) => {
            try {
                await fetch("/api/log-save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename, format, sessionId }),
                })
            } catch (error) {
                console.warn("Failed to log save to Langfuse:", error)
            }
        },
        [],
    )

    const saveDiagramToFile = useCallback(
        (filename: string, format: ExportFormat, sessionId?: string) => {
            if (!drawioRef.current) {
                console.warn("Draw.io editor not ready")
                return
            }

            // Map format to draw.io export format
            const drawioFormat = format === "drawio" ? "xmlsvg" : format

            // Set up the resolver before triggering export
            saveResolverRef.current = {
                resolver: (exportData: string) => {
                    let fileContent: string | Blob
                    let mimeType: string
                    let extension: string

                    if (format === "drawio") {
                        // Extract XML from SVG for .drawio format
                        const xml = extractDiagramXML(exportData)
                        let xmlContent = xml
                        if (!xml.includes("<mxfile")) {
                            xmlContent = `<mxfile><diagram name="Page-1" id="page-1">${xml}</diagram></mxfile>`
                        }
                        fileContent = xmlContent
                        mimeType = "application/xml"
                        extension = ".drawio"

                        // Save to localStorage when user manually saves
                        localStorage.setItem(
                            STORAGE_DIAGRAM_XML_KEY,
                            xmlContent,
                        )
                    } else if (format === "png") {
                        // PNG data comes as base64 data URL
                        fileContent = exportData
                        mimeType = "image/png"
                        extension = ".png"
                    } else {
                        // SVG format
                        fileContent = exportData
                        mimeType = "image/svg+xml"
                        extension = ".svg"
                    }

                    // Log save event to Langfuse (flags the trace)
                    logSaveToLangfuse(filename, format, sessionId)

                    // Handle download
                    let url: string
                    if (
                        typeof fileContent === "string" &&
                        fileContent.startsWith("data:")
                    ) {
                        // Already a data URL (PNG)
                        url = fileContent
                    } else {
                        const blob = new Blob([fileContent], { type: mimeType })
                        url = URL.createObjectURL(blob)
                    }

                    const a = document.createElement("a")
                    a.href = url
                    a.download = `${filename}${extension}`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)

                    // Delay URL revocation to ensure download completes
                    if (!url.startsWith("data:")) {
                        setTimeout(() => URL.revokeObjectURL(url), 100)
                    }
                },
                format,
            }

            // Export diagram - callback will be handled in handleDiagramExport
            drawioRef.current.exportDiagram({ format: drawioFormat })
        },
        [logSaveToLangfuse],
    )

    const value = useMemo(
        () => ({
            chartXML,
            latestSvg,
            diagramHistory,
            canUndo,
            canRedo,
            undoDiagram,
            redoDiagram,
            restoreHistoryIndex,
            loadDiagram,
            syncDiagramXml,
            handleExport,
            handleExportWithoutHistory,
            resolverRef,
            drawioRef,
            handleDiagramExport,
            clearDiagram,
            saveDiagramToFile,
            isDrawioReady,
            onDrawioLoad,
            resetDrawioReady,
        }),
        [
            chartXML,
            latestSvg,
            diagramHistory,
            canUndo,
            canRedo,
            undoDiagram,
            redoDiagram,
            restoreHistoryIndex,
            loadDiagram,
            syncDiagramXml,
            handleExport,
            handleExportWithoutHistory,
            handleDiagramExport,
            clearDiagram,
            saveDiagramToFile,
            isDrawioReady,
            onDrawioLoad,
            resetDrawioReady,
        ],
    )

    return (
        <DiagramContext.Provider value={value}>
            {children}
        </DiagramContext.Provider>
    )
}

export function useDiagram() {
    const context = useContext(DiagramContext)
    if (context === undefined) {
        throw new Error("useDiagram must be used within a DiagramProvider")
    }
    return context
}
