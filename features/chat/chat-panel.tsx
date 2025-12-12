"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { PanelRightOpen } from "lucide-react"
import { signIn, signOut, useSession } from "next-auth/react"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Toaster, toast } from "sonner"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { ChatInput } from "@/components/chat-input"
import { ChatMessageDisplay } from "@/components/chat-message-display"
import { SettingsDialog } from "@/components/settings-dialog"
import { useDiagram } from "@/contexts/diagram-context"
import { useI18n } from "@/contexts/i18n-context"
import {
    getLastToolErrorName,
    hasToolErrors,
} from "@/features/chat/ai/tool-errors"
import type { ChatMessage } from "@/features/chat/ai/types"
import {
    extractIdFromSearch,
    findMxCellLineById,
} from "@/features/chat/ai/xml-search"
import type {
    ConversationMeta,
    ConversationPayload,
} from "@/features/chat/sessions/storage"
import {
    conversationStorageKey,
    createConversationId,
    createSessionId,
    STORAGE_CONVERSATIONS_KEY,
    STORAGE_CURRENT_CONVERSATION_ID_KEY,
    STORAGE_MESSAGES_KEY,
    STORAGE_SESSION_ID_KEY,
    STORAGE_XML_SNAPSHOTS_KEY,
    syncCursorStorageKey,
} from "@/features/chat/sessions/storage"
import { ChatHeader } from "@/features/chat/ui/chat-header"
import { getAIConfig } from "@/lib/ai-config"
import { findCachedResponse } from "@/lib/cached-responses"
import { isPdfFile, isTextFile } from "@/lib/pdf-utils"
import { STORAGE_DIAGRAM_XML_KEY } from "@/lib/storage-keys"
import { api } from "@/lib/trpc/client"
import { type FileData, useFileProcessor } from "@/lib/use-file-processor"
import { useQuotaManager } from "@/lib/use-quota-manager"
import { formatXML, wrapWithMxFile } from "@/lib/utils"

interface ChatPanelProps {
    isVisible: boolean
    onToggleVisibility: () => void
    drawioUi: "min" | "sketch"
    onToggleDrawioUi: () => void
    darkMode: boolean
    onToggleDarkMode: () => void
    isMobile?: boolean
    onCloseProtectionChange?: (enabled: boolean) => void
}

const DEBUG = process.env.NODE_ENV === "development"
const MAX_AUTO_RETRY_COUNT = 3

export default function ChatPanel({
    isVisible,
    onToggleVisibility,
    drawioUi,
    onToggleDrawioUi,
    darkMode,
    onToggleDarkMode,
    isMobile = false,
    onCloseProtectionChange,
}: ChatPanelProps) {
    const { t, locale } = useI18n()
    const {
        loadDiagram: onDisplayChart,
        handleExport: onExport,
        handleExportWithoutHistory,
        resolverRef,
        chartXML,
        clearDiagram,
        isDrawioReady,
    } = useDiagram()

    const onFetchChart = useCallback(
        (saveToHistory = true) => {
            return Promise.race([
                new Promise<string>((resolve) => {
                    if (resolverRef && "current" in resolverRef) {
                        resolverRef.current = resolve
                    }
                    if (saveToHistory) {
                        onExport()
                    } else {
                        handleExportWithoutHistory()
                    }
                }),
                new Promise<string>((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(
                                    "Chart export timed out after 10 seconds",
                                ),
                            ),
                        10000,
                    ),
                ),
            ])
        },
        [handleExportWithoutHistory, onExport, resolverRef],
    )

    // File processing using extracted hook
    const { files, pdfData, handleFileChange, setFiles } = useFileProcessor()

    const [showHistory, setShowHistory] = useState(false)
    const [showSettingsDialog, setShowSettingsDialog] = useState(false)
    const [, setAccessCodeRequired] = useState(false)
    const [input, setInput] = useState("")
    const [dailyRequestLimit, setDailyRequestLimit] = useState(0)
    const [dailyTokenLimit, setDailyTokenLimit] = useState(0)
    const [tpmLimit, setTpmLimit] = useState(0)
    // Conversation sessions (multi-session)
    const [conversations, setConversations] = useState<ConversationMeta[]>([])
    const [currentConversationId, setCurrentConversationId] = useState(() => {
        if (typeof window !== "undefined") {
            return (
                localStorage.getItem(STORAGE_CURRENT_CONVERSATION_ID_KEY) || ""
            )
        }
        return ""
    })

    const getConversationDisplayTitle = useCallback(
        (id: string): string => {
            const idx = conversations.findIndex((c) => c.id === id)
            const meta = idx >= 0 ? conversations[idx] : undefined
            if (meta?.title) return meta.title
            if (idx >= 0) {
                return locale === "zh-CN"
                    ? `会话 ${idx + 1}`
                    : `Session ${idx + 1}`
            }
            return id
        },
        [conversations, locale],
    )

    // Check config on mount
    useEffect(() => {
        fetch("/api/config")
            .then((res) => res.json())
            .then((data) => {
                setAccessCodeRequired(data.accessCodeRequired)
                setDailyRequestLimit(data.dailyRequestLimit || 0)
                setDailyTokenLimit(data.dailyTokenLimit || 0)
                setTpmLimit(data.tpmLimit || 0)
            })
            .catch(() => setAccessCodeRequired(false))
    }, [])

    // Quota management using extracted hook
    const quotaManager = useQuotaManager({
        dailyRequestLimit,
        dailyTokenLimit,
        tpmLimit,
    })

    // Session ID for Langfuse tracing (per conversation)
    const [sessionId, setSessionId] = useState(() => createSessionId())

    // Store XML snapshots for each user message (keyed by message index)
    const xmlSnapshotsRef = useRef<Map<number, string>>(new Map())

    // Flag to track if we've restored from localStorage
    const hasRestoredRef = useRef(false)

    // Ref to track latest chartXML for use in callbacks (avoids stale closure)
    const chartXMLRef = useRef(chartXML)
    useEffect(() => {
        chartXMLRef.current = chartXML
    }, [chartXML])

    // Ref to hold stop function for use in onToolCall (avoids stale closure)
    const stopRef = useRef<(() => void) | null>(null)

    // Ref to track consecutive auto-retry count (reset on user action)
    const autoRetryCountRef = useRef(0)
    // Ref to track consecutive edit_diagram failures
    const editFailureCountRef = useRef(0)
    // When true, we inject a system hint to force display_diagram on next attempt
    const forceDisplayNextRef = useRef(false)

    // Persist processed tool call IDs so collapsing the chat doesn't replay old tool outputs
    const processedToolCallsRef = useRef<Set<string>>(new Set())

    // 登录态（OAuth）+ 云端同步（tRPC）
    const { data: authSession, status: authStatus } = useSession()
    const pushConversationsMutation = api.conversation.push.useMutation()
    const pullConversationsMutation = api.conversation.pull.useMutation()
    const pushConversationsMutateAsyncRef = useRef(
        pushConversationsMutation.mutateAsync,
    )
    const pullConversationsMutateAsyncRef = useRef(
        pullConversationsMutation.mutateAsync,
    )
    useEffect(() => {
        pushConversationsMutateAsyncRef.current =
            pushConversationsMutation.mutateAsync
        pullConversationsMutateAsyncRef.current =
            pullConversationsMutation.mutateAsync
    }, [
        pushConversationsMutation.mutateAsync,
        pullConversationsMutation.mutateAsync,
    ])

    const syncBootstrappedUserIdRef = useRef<string | null>(null)
    const syncPullIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
        null,
    )
    const syncDebounceTimersRef = useRef<
        Map<string, ReturnType<typeof setTimeout>>
    >(new Map())
    const syncPullInFlightRef = useRef(false)
    const syncPullOnceRef = useRef<(() => void) | null>(null)
    const [isOnline, setIsOnline] = useState(() => {
        if (typeof navigator === "undefined") return true
        return navigator.onLine
    })
    const [syncInFlightCount, setSyncInFlightCount] = useState(0)
    const [lastSyncOkAt, setLastSyncOkAt] = useState<number | null>(null)
    const [lastSyncErrorAt, setLastSyncErrorAt] = useState<number | null>(null)

    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)
        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
        }
    }, [])

    const markSyncStart = useCallback(() => {
        setSyncInFlightCount((c) => c + 1)
    }, [])

    const markSyncEnd = useCallback(() => {
        setSyncInFlightCount((c) => Math.max(0, c - 1))
    }, [])

    const getSyncCursor = useCallback((): string => {
        const userId = authSession?.user?.id
        if (!userId) return "0"
        try {
            return localStorage.getItem(syncCursorStorageKey(userId)) || "0"
        } catch {
            return "0"
        }
    }, [authSession?.user?.id])

    const setSyncCursor = useCallback(
        (cursor: string) => {
            const userId = authSession?.user?.id
            if (!userId) return
            try {
                localStorage.setItem(syncCursorStorageKey(userId), cursor)
            } catch {
                // ignore
            }
        },
        [authSession?.user?.id],
    )

    const readConversationMetasFromStorage =
        useCallback((): ConversationMeta[] => {
            try {
                const raw = localStorage.getItem(STORAGE_CONVERSATIONS_KEY)
                const metas = raw ? (JSON.parse(raw) as unknown) : []
                return Array.isArray(metas) ? (metas as ConversationMeta[]) : []
            } catch {
                return []
            }
        }, [])

    const readConversationPayloadFromStorage = useCallback(
        (id: string): ConversationPayload | null => {
            try {
                const raw = localStorage.getItem(conversationStorageKey(id))
                if (!raw) return null
                return JSON.parse(raw) as ConversationPayload
            } catch {
                return null
            }
        },
        [],
    )

    const buildPushConversationInput = useCallback(
        (id: string, opts?: { deleted?: boolean }) => {
            const metas = readConversationMetasFromStorage()
            const meta = metas.find((m) => m.id === id)
            const now = Date.now()
            const createdAt = meta?.createdAt ?? now
            const updatedAt = meta?.updatedAt ?? now

            const payload = opts?.deleted
                ? undefined
                : readConversationPayloadFromStorage(id)

            return {
                id,
                title: meta?.title,
                createdAt,
                updatedAt,
                deleted: opts?.deleted,
                payload: payload ?? undefined,
            }
        },
        [readConversationMetasFromStorage, readConversationPayloadFromStorage],
    )

    const pushConversationNow = useCallback(
        async (id: string, opts?: { deleted?: boolean }) => {
            if (authStatus !== "authenticated") return
            const userId = authSession?.user?.id
            if (!userId) return
            if (!isOnline) return

            const input = buildPushConversationInput(id, opts)
            // 非删除必须有 payload；否则跳过（避免把空数据覆盖到云端）
            if (!input.deleted && !input.payload) return

            markSyncStart()
            try {
                const res = await pushConversationsMutateAsyncRef.current({
                    conversations: [input],
                })
                if (res?.cursor) setSyncCursor(res.cursor)
                setLastSyncOkAt(Date.now())
                setLastSyncErrorAt(null)
            } catch {
                setLastSyncErrorAt(Date.now())
            } finally {
                markSyncEnd()
            }

            // push 成功后短延迟 pull 一次，尽快在其它设备体现
            setTimeout(() => {
                syncPullOnceRef.current?.()
            }, 1500)
        },
        [
            authSession?.user?.id,
            authStatus,
            buildPushConversationInput,
            isOnline,
            markSyncEnd,
            markSyncStart,
            setSyncCursor,
        ],
    )

    const queuePushConversation = useCallback(
        (id: string, opts?: { immediate?: boolean; deleted?: boolean }) => {
            if (authStatus !== "authenticated") return
            if (!authSession?.user?.id) return

            const delay = opts?.immediate ? 0 : 1000
            const existing = syncDebounceTimersRef.current.get(id)
            if (existing) clearTimeout(existing)
            const timer = setTimeout(() => {
                syncDebounceTimersRef.current.delete(id)
                void pushConversationNow(id, { deleted: opts?.deleted })
            }, delay)
            syncDebounceTimersRef.current.set(id, timer)
        },
        [authSession?.user?.id, authStatus, pushConversationNow],
    )

    const {
        messages,
        sendMessage,
        addToolOutput,
        stop,
        status,
        error,
        setMessages,
    } = useChat({
        transport: new DefaultChatTransport({
            api: "/api/chat",
        }),
        async onToolCall({ toolCall }) {
            if (DEBUG) {
                console.log(
                    `[onToolCall] Tool: ${toolCall.toolName}, CallId: ${toolCall.toolCallId}`,
                )
            }

            if (toolCall.toolName === "display_diagram") {
                const { xml } = toolCall.input as { xml: string }
                if (DEBUG) {
                    console.log(
                        `[display_diagram] Received XML length: ${xml.length}`,
                    )
                }

                // Wrap raw XML with full mxfile structure for draw.io
                const fullXml = wrapWithMxFile(xml)

                // loadDiagram validates and returns error if invalid
                const _previousXml = chartXMLRef.current
                const validationError = onDisplayChart(fullXml)

                if (validationError) {
                    console.warn(
                        "[display_diagram] Validation error:",
                        validationError,
                    )
                    // Return error to model - sendAutomaticallyWhen will trigger retry
                    if (DEBUG) {
                        console.log(
                            "[display_diagram] Adding tool output with state: output-error",
                        )
                    }
                    addToolOutput({
                        tool: "display_diagram",
                        toolCallId: toolCall.toolCallId,
                        state: "output-error",
                        errorText: `${validationError}

Please fix the XML issues and call display_diagram again with corrected XML.

Your failed XML:
\`\`\`xml
${xml}
\`\`\``,
                    })
                } else {
                    // Success - diagram will be rendered by chat-message-display
                    if (DEBUG) {
                        console.log(
                            "[display_diagram] Success! Adding tool output with state: output-available",
                        )
                    }
                    addToolOutput({
                        tool: "display_diagram",
                        toolCallId: toolCall.toolCallId,
                        output: "Successfully displayed the diagram.",
                    })
                    if (DEBUG) {
                        console.log(
                            "[display_diagram] Tool output added. Diagram should be visible now.",
                        )
                    }
                }
            } else if (toolCall.toolName === "edit_diagram") {
                const { edits } = toolCall.input as {
                    edits: Array<{ search: string; replace: string }>
                }

                let currentXml = ""
                try {
                    console.log("[edit_diagram] Starting...")
                    // Use chartXML from ref directly - more reliable than export
                    // especially on Vercel where DrawIO iframe may have latency issues
                    // Using ref to avoid stale closure in callback
                    const cachedXML = chartXMLRef.current
                    if (cachedXML) {
                        currentXml = cachedXML
                        console.log(
                            "[edit_diagram] Using cached chartXML, length:",
                            currentXml.length,
                        )
                    } else {
                        // Fallback to export only if no cached XML
                        console.log(
                            "[edit_diagram] No cached XML, fetching from DrawIO...",
                        )
                        currentXml = await onFetchChart(false)
                        console.log(
                            "[edit_diagram] Got XML from export, length:",
                            currentXml.length,
                        )
                    }

                    const { replaceXMLParts, formatXML } = await import(
                        "@/lib/utils"
                    )

                    // Pattern precheck: ensure each search block exists in current XML
                    const formattedCurrent = formatXML(currentXml)
                    const missing = edits
                        .map((edit, index) => {
                            const rawHit = currentXml.includes(edit.search)
                            if (rawHit) return null
                            const formattedSearch = formatXML(edit.search)
                            const formattedHit =
                                formattedSearch &&
                                formattedCurrent.includes(formattedSearch)
                            if (formattedHit) return null

                            const id = extractIdFromSearch(edit.search)
                            const idHint =
                                id && currentXml
                                    ? findMxCellLineById(currentXml, id)
                                    : null

                            return {
                                index,
                                id,
                                idHint,
                                searchPreview: edit.search.trim().slice(0, 200),
                            }
                        })
                        .filter(Boolean) as Array<{
                        index: number
                        id: string | null
                        idHint: string | null
                        searchPreview: string
                    }>

                    if (missing.length > 0) {
                        const details = missing
                            .map((m) => {
                                const header = `Change ${m.index + 1} not found`
                                const idPart = m.id ? ` (id="${m.id}")` : ""
                                const hintPart = m.idHint
                                    ? `Suggested mxCell line from current XML:\n${m.idHint}`
                                    : "Suggestion: copy the exact mxCell lines (attribute order matters) from the CURRENT XML."
                                return `${header}${idPart}\nSearch preview:\n${m.searchPreview}\n\n${hintPart}`
                            })
                            .join("\n\n---\n\n")

                        addToolOutput({
                            tool: "edit_diagram",
                            toolCallId: toolCall.toolCallId,
                            state: "output-error",
                            errorText: `Search pattern(s) not found in CURRENT diagram XML.

${details}

Please retry edit_diagram with exact lines copied from the CURRENT XML (preserve attribute order and whitespace).`,
                        })
                        return
                    }

                    const editedXml = replaceXMLParts(currentXml, edits)

                    // loadDiagram validates and returns error if invalid
                    const validationError = onDisplayChart(editedXml)
                    if (validationError) {
                        console.warn(
                            "[edit_diagram] Validation error:",
                            validationError,
                        )
                        addToolOutput({
                            tool: "edit_diagram",
                            toolCallId: toolCall.toolCallId,
                            state: "output-error",
                            errorText: `Edit produced invalid XML: ${validationError}

Current diagram XML:
\`\`\`xml
${currentXml}
\`\`\`

Please fix the edit to avoid structural issues (e.g., duplicate IDs, invalid references).`,
                        })
                        return
                    }
                    onExport()
                    addToolOutput({
                        tool: "edit_diagram",
                        toolCallId: toolCall.toolCallId,
                        output: `Successfully applied ${edits.length} edit(s) to the diagram.`,
                    })
                    console.log("[edit_diagram] Success")
                } catch (error) {
                    console.error("[edit_diagram] Failed:", error)

                    const errorMessage =
                        error instanceof Error ? error.message : String(error)

                    // Use addToolOutput with state: 'output-error' for proper error signaling
                    addToolOutput({
                        tool: "edit_diagram",
                        toolCallId: toolCall.toolCallId,
                        state: "output-error",
                        errorText: `Edit failed: ${errorMessage}

Current diagram XML:
\`\`\`xml
${currentXml || "No XML available"}
\`\`\`

Please retry with an adjusted search pattern or use display_diagram if retries are exhausted.`,
                    })
                }
            }
        },
        onError: (error) => {
            // Silence access code error in console since it's handled by UI
            if (!error.message.includes("Invalid or missing access code")) {
                console.error("Chat error:", error)
            }

            // Translate technical errors into user-friendly messages
            // The server now handles detailed error messages, so we can display them directly.
            // But we still handle connection/network errors that happen before reaching the server.
            let friendlyMessage = error.message

            // Simple check for network errors if message is generic
            if (friendlyMessage === "Failed to fetch") {
                friendlyMessage = t("toast.networkError")
            }

            // Translate image not supported error
            if (friendlyMessage.includes("image content block")) {
                friendlyMessage = t("toast.imageNotSupported")
            }

            // Add system message for error so it can be cleared
            setMessages((currentMessages) => {
                const errorMessage = {
                    id: `error-${Date.now()}`,
                    role: "system" as const,
                    content: friendlyMessage,
                    parts: [{ type: "text" as const, text: friendlyMessage }],
                }
                return [...currentMessages, errorMessage]
            })

            if (error.message.includes("Invalid or missing access code")) {
                // Show settings button and open dialog to help user fix it
                setAccessCodeRequired(true)
                setShowSettingsDialog(true)
            }
        },
        onFinish: ({ message }) => {
            // Track actual token usage from server metadata
            const metadata = message?.metadata as
                | Record<string, unknown>
                | undefined
            if (metadata) {
                // Use Number.isFinite to guard against NaN (typeof NaN === 'number' is true)
                const inputTokens = Number.isFinite(metadata.inputTokens)
                    ? (metadata.inputTokens as number)
                    : 0
                const outputTokens = Number.isFinite(metadata.outputTokens)
                    ? (metadata.outputTokens as number)
                    : 0
                const actualTokens = inputTokens + outputTokens
                if (actualTokens > 0) {
                    quotaManager.incrementTokenCount(actualTokens)
                    quotaManager.incrementTPMCount(actualTokens)
                }
            }

            // 自动同步：消息生成完成后尽快 push（比 messages 变更更“稳定”）
            if (currentConversationId) {
                queuePushConversation(currentConversationId, {
                    immediate: true,
                })
            }
        },
        sendAutomaticallyWhen: ({ messages }) => {
            const chatMessages = messages as unknown as ChatMessage[]
            const shouldRetry = hasToolErrors(chatMessages)
            const lastErrorToolName = getLastToolErrorName(chatMessages)

            if (!shouldRetry) {
                // No error, reset retry count
                autoRetryCountRef.current = 0
                editFailureCountRef.current = 0
                forceDisplayNextRef.current = false
                if (DEBUG) {
                    console.log("[sendAutomaticallyWhen] No errors, stopping")
                }
                return false
            }

            if (lastErrorToolName === "edit_diagram") {
                editFailureCountRef.current++
            } else {
                editFailureCountRef.current = 0
            }

            // If edit_diagram keeps failing, stop auto-retry and force display_diagram next time
            if (
                lastErrorToolName === "edit_diagram" &&
                editFailureCountRef.current >= 2
            ) {
                if (!forceDisplayNextRef.current) {
                    forceDisplayNextRef.current = true
                    setMessages((currentMessages) => [
                        ...currentMessages,
                        {
                            id: `system-fallback-${Date.now()}`,
                            role: "system" as const,
                            content:
                                "[Auto-recovery] The previous edit_diagram attempts failed. For the next attempt, you MUST use display_diagram to regenerate a corrected full XML instead of edit_diagram.",
                            parts: [
                                {
                                    type: "text" as const,
                                    text: "[Auto-recovery] The previous edit_diagram attempts failed. For the next attempt, you MUST use display_diagram to regenerate a corrected full XML instead of edit_diagram.",
                                },
                            ],
                        } as any,
                    ])
                }

                toast.error(t("toast.editFallbackStopRetry"))
                autoRetryCountRef.current = 0
                return false
            }

            // Check retry count limit
            if (autoRetryCountRef.current >= MAX_AUTO_RETRY_COUNT) {
                if (DEBUG) {
                    console.log(
                        `[sendAutomaticallyWhen] Max retry count (${MAX_AUTO_RETRY_COUNT}) reached, stopping`,
                    )
                }
                toast.error(t("toast.autoRetryLimitReached"))
                if (
                    lastErrorToolName === "edit_diagram" &&
                    !forceDisplayNextRef.current
                ) {
                    forceDisplayNextRef.current = true
                    setMessages((currentMessages) => [
                        ...currentMessages,
                        {
                            id: `system-fallback-${Date.now()}`,
                            role: "system" as const,
                            content:
                                "[Auto-recovery] edit_diagram retries exhausted. Please use display_diagram to regenerate full XML.",
                            parts: [
                                {
                                    type: "text" as const,
                                    text: "[Auto-recovery] edit_diagram retries exhausted. Please use display_diagram to regenerate full XML.",
                                },
                            ],
                        } as any,
                    ])
                }
                autoRetryCountRef.current = 0
                return false
            }

            // Check quota limits before auto-retry
            const tokenLimitCheck = quotaManager.checkTokenLimit()
            if (!tokenLimitCheck.allowed) {
                if (DEBUG) {
                    console.log(
                        "[sendAutomaticallyWhen] Token limit exceeded, stopping",
                    )
                }
                quotaManager.showTokenLimitToast(tokenLimitCheck.used)
                autoRetryCountRef.current = 0
                return false
            }

            const tpmCheck = quotaManager.checkTPMLimit()
            if (!tpmCheck.allowed) {
                if (DEBUG) {
                    console.log(
                        "[sendAutomaticallyWhen] TPM limit exceeded, stopping",
                    )
                }
                quotaManager.showTPMLimitToast()
                autoRetryCountRef.current = 0
                return false
            }

            // Increment retry count and allow retry
            autoRetryCountRef.current++
            if (DEBUG) {
                console.log(
                    `[sendAutomaticallyWhen] Retrying (${autoRetryCountRef.current}/${MAX_AUTO_RETRY_COUNT})`,
                )
            }
            return true
        },
    })

    // Update stopRef so onToolCall can access it
    stopRef.current = stop

    // Ref to track latest messages for unload persistence
    const messagesRef = useRef(messages)
    useEffect(() => {
        messagesRef.current = messages
    }, [messages])

    const messagesEndRef = useRef<HTMLDivElement>(null)

    const pendingDiagramXmlRef = useRef<string | null>(null)

    const deriveConversationTitle = useCallback(
        (msgs: ChatMessage[]): string | undefined => {
            const firstUser = msgs.find((m) => m.role === "user") as any
            const textPart =
                firstUser?.parts?.find((p: any) => p.type === "text")?.text ||
                ""
            const trimmed = String(textPart).trim()
            if (!trimmed) return undefined
            return trimmed.slice(0, 24)
        },
        [],
    )

    const loadConversation = useCallback(
        (id: string) => {
            try {
                const raw = localStorage.getItem(conversationStorageKey(id))
                const payload: ConversationPayload = raw
                    ? JSON.parse(raw)
                    : {
                          messages: [],
                          xml: "",
                          snapshots: [],
                          sessionId: createSessionId(),
                      }

                setMessages((payload.messages || []) as any)
                xmlSnapshotsRef.current = new Map(payload.snapshots || [])
                setSessionId(payload.sessionId || createSessionId())

                processedToolCallsRef.current = new Set()
                autoRetryCountRef.current = 0
                editFailureCountRef.current = 0
                forceDisplayNextRef.current = false

                // Load diagram if ready, else defer to DrawIO-ready effect
                if (payload.xml) {
                    if (isDrawioReady) {
                        onDisplayChart(payload.xml, true)
                        chartXMLRef.current = payload.xml
                    } else {
                        pendingDiagramXmlRef.current = payload.xml
                    }
                } else {
                    clearDiagram()
                    chartXMLRef.current = ""
                }
            } catch (error) {
                console.error("Failed to load conversation:", error)
                setMessages([])
                xmlSnapshotsRef.current = new Map()
                setSessionId(createSessionId())
                clearDiagram()
            }
        },
        [clearDiagram, isDrawioReady, onDisplayChart, setMessages],
    )

    const applyRemoteConversations = useCallback(
        (remote: Array<any>) => {
            if (!Array.isArray(remote) || remote.length === 0) return

            let shouldReloadCurrent = false
            let currentRemoved = false

            const localMetas = readConversationMetasFromStorage()
            const metaById = new Map(localMetas.map((m) => [m.id, m]))

            for (const rc of remote) {
                const id = String(rc?.id || "")
                if (!id) continue

                if (rc?.deleted) {
                    metaById.delete(id)
                    try {
                        localStorage.removeItem(conversationStorageKey(id))
                    } catch {
                        // ignore
                    }
                    if (id === currentConversationId) currentRemoved = true
                    continue
                }

                const localMeta = metaById.get(id)
                const remoteUpdatedAt = Number(rc?.updatedAt ?? 0)
                if (localMeta && localMeta.updatedAt >= remoteUpdatedAt) {
                    continue
                }

                try {
                    localStorage.setItem(
                        conversationStorageKey(id),
                        JSON.stringify(rc?.payload ?? {}),
                    )
                } catch {
                    // ignore
                }

                metaById.set(id, {
                    id,
                    createdAt: Number(rc?.createdAt ?? Date.now()),
                    updatedAt: remoteUpdatedAt || Date.now(),
                    title: rc?.title,
                })

                if (id === currentConversationId) shouldReloadCurrent = true
            }

            const nextMetas = Array.from(metaById.values()).sort(
                (a, b) => b.updatedAt - a.updatedAt,
            )
            try {
                localStorage.setItem(
                    STORAGE_CONVERSATIONS_KEY,
                    JSON.stringify(nextMetas),
                )
            } catch {
                // ignore
            }
            setConversations(nextMetas)

            if (currentRemoved) {
                const nextId = nextMetas[0]?.id || ""
                if (nextId) {
                    try {
                        localStorage.setItem(
                            STORAGE_CURRENT_CONVERSATION_ID_KEY,
                            nextId,
                        )
                    } catch {
                        // ignore
                    }
                    setCurrentConversationId(nextId)
                    return
                }
                // 云端删除导致本地无会话：兜底创建一个新的空会话（保持产品可用性）
                const newId = createConversationId()
                const now = Date.now()
                const payload: ConversationPayload = {
                    messages: [],
                    xml: "",
                    snapshots: [],
                    sessionId: createSessionId(),
                }
                try {
                    localStorage.setItem(
                        conversationStorageKey(newId),
                        JSON.stringify(payload),
                    )
                    const metas: ConversationMeta[] = [
                        { id: newId, createdAt: now, updatedAt: now },
                    ]
                    localStorage.setItem(
                        STORAGE_CONVERSATIONS_KEY,
                        JSON.stringify(metas),
                    )
                    localStorage.setItem(
                        STORAGE_CURRENT_CONVERSATION_ID_KEY,
                        newId,
                    )
                    setConversations(metas)
                    setCurrentConversationId(newId)
                    queuePushConversation(newId, { immediate: true })
                } catch {
                    // ignore
                }
                return
            }

            if (shouldReloadCurrent && currentConversationId) {
                loadConversation(currentConversationId)
            }
        },
        [
            currentConversationId,
            loadConversation,
            queuePushConversation,
            readConversationMetasFromStorage,
            setConversations,
        ],
    )

    const pullOnce = useCallback(async () => {
        if (authStatus !== "authenticated") return
        if (!authSession?.user?.id) return
        if (!isOnline) return
        if (syncPullInFlightRef.current) return

        syncPullInFlightRef.current = true
        markSyncStart()
        try {
            const cursor = getSyncCursor()
            const res = await pullConversationsMutateAsyncRef.current({
                cursor,
                limit: 200,
            })
            if (res?.cursor) setSyncCursor(res.cursor)
            if (Array.isArray(res?.conversations) && res.conversations.length) {
                applyRemoteConversations(res.conversations as any[])
            }
            setLastSyncOkAt(Date.now())
            setLastSyncErrorAt(null)
        } catch {
            // 自动同步失败不打扰用户；UI 只在需要时提示（后续可加状态指示）
            setLastSyncErrorAt(Date.now())
        } finally {
            syncPullInFlightRef.current = false
            markSyncEnd()
        }
    }, [
        applyRemoteConversations,
        authSession?.user?.id,
        authStatus,
        getSyncCursor,
        isOnline,
        markSyncEnd,
        markSyncStart,
        setSyncCursor,
    ])

    useEffect(() => {
        syncPullOnceRef.current = () => void pullOnce()
        return () => {
            syncPullOnceRef.current = null
        }
    }, [pullOnce])

    // 登录后自动同步：首次合并上传 + 轮询拉取（20s）+ 聚合触发（focus/online）
    useEffect(() => {
        const userId = authSession?.user?.id
        if (authStatus !== "authenticated" || !userId) {
            syncBootstrappedUserIdRef.current = null
            if (syncPullIntervalRef.current) {
                clearInterval(syncPullIntervalRef.current)
                syncPullIntervalRef.current = null
            }
            return
        }

        if (!hasRestoredRef.current) return
        if (conversations.length === 0) return

        let cancelled = false

        const bootstrap = async () => {
            if (syncBootstrappedUserIdRef.current === userId) return
            syncBootstrappedUserIdRef.current = userId

            const metas = readConversationMetasFromStorage()
            const toPush = metas
                .map((m) => {
                    const payload = readConversationPayloadFromStorage(m.id)
                    if (!payload) return null
                    return {
                        id: m.id,
                        title: m.title,
                        createdAt: m.createdAt,
                        updatedAt: m.updatedAt,
                        payload,
                    }
                })
                .filter(Boolean) as Array<{
                id: string
                title?: string
                createdAt: number
                updatedAt: number
                payload: ConversationPayload
            }>

            if (toPush.length > 0) {
                try {
                    const res = await pushConversationsMutateAsyncRef.current({
                        conversations: toPush as any,
                    })
                    if (!cancelled && res?.cursor) setSyncCursor(res.cursor)
                } catch {
                    // ignore
                }
            }

            if (!cancelled) {
                await pullOnce()
            }
        }

        void bootstrap()

        if (!syncPullIntervalRef.current) {
            syncPullIntervalRef.current = setInterval(() => {
                void pullOnce()
            }, 20_000)
        }

        const handleWake = () => void pullOnce()
        const handleVisibility = () => {
            if (document.visibilityState === "visible") void pullOnce()
        }

        window.addEventListener("focus", handleWake)
        window.addEventListener("online", handleWake)
        document.addEventListener("visibilitychange", handleVisibility)

        return () => {
            cancelled = true
            window.removeEventListener("focus", handleWake)
            window.removeEventListener("online", handleWake)
            document.removeEventListener("visibilitychange", handleVisibility)
        }
    }, [
        authSession?.user?.id,
        authStatus,
        conversations.length,
        pullOnce,
        readConversationMetasFromStorage,
        readConversationPayloadFromStorage,
        setSyncCursor,
    ])

    // Restore conversations on mount (with legacy migration)
    useEffect(() => {
        if (hasRestoredRef.current) return
        hasRestoredRef.current = true

        try {
            const stored = localStorage.getItem(STORAGE_CONVERSATIONS_KEY)
            let metas: ConversationMeta[] = stored ? JSON.parse(stored) : []
            if (!Array.isArray(metas)) metas = []

            const legacyMessages = localStorage.getItem(STORAGE_MESSAGES_KEY)
            const legacySnapshots = localStorage.getItem(
                STORAGE_XML_SNAPSHOTS_KEY,
            )
            const legacyXml = localStorage.getItem(STORAGE_DIAGRAM_XML_KEY)
            const legacySession = localStorage.getItem(STORAGE_SESSION_ID_KEY)

            if (
                metas.length === 0 &&
                (legacyMessages || legacySnapshots || legacyXml)
            ) {
                const id = createConversationId()
                const payload: ConversationPayload = {
                    messages: legacyMessages ? JSON.parse(legacyMessages) : [],
                    xml: legacyXml || "",
                    snapshots: legacySnapshots
                        ? JSON.parse(legacySnapshots)
                        : [],
                    sessionId: legacySession || createSessionId(),
                }
                localStorage.setItem(
                    conversationStorageKey(id),
                    JSON.stringify(payload),
                )
                metas = [
                    {
                        id,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        title: deriveConversationTitle(payload.messages),
                    },
                ]
                localStorage.setItem(
                    STORAGE_CONVERSATIONS_KEY,
                    JSON.stringify(metas),
                )
                localStorage.setItem(STORAGE_CURRENT_CONVERSATION_ID_KEY, id)
                setCurrentConversationId(id)

                // Clean up legacy keys
                localStorage.removeItem(STORAGE_MESSAGES_KEY)
                localStorage.removeItem(STORAGE_XML_SNAPSHOTS_KEY)
                localStorage.removeItem(STORAGE_DIAGRAM_XML_KEY)
                localStorage.removeItem(STORAGE_SESSION_ID_KEY)
            }

            if (metas.length === 0) {
                const id = createConversationId()
                metas = [{ id, createdAt: Date.now(), updatedAt: Date.now() }]
                localStorage.setItem(
                    STORAGE_CONVERSATIONS_KEY,
                    JSON.stringify(metas),
                )
                localStorage.setItem(STORAGE_CURRENT_CONVERSATION_ID_KEY, id)
                localStorage.setItem(
                    conversationStorageKey(id),
                    JSON.stringify({
                        messages: [],
                        xml: "",
                        snapshots: [],
                        sessionId: createSessionId(),
                    } satisfies ConversationPayload),
                )
                setCurrentConversationId(id)
            } else if (!currentConversationId) {
                const id = metas[0].id
                localStorage.setItem(STORAGE_CURRENT_CONVERSATION_ID_KEY, id)
                setCurrentConversationId(id)
            }

            setConversations(metas)
        } catch (error) {
            console.error("Failed to restore conversations:", error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Load conversation when current ID changes
    useEffect(() => {
        if (!currentConversationId) return
        loadConversation(currentConversationId)
    }, [currentConversationId, loadConversation])

    // Restore diagram XML when DrawIO becomes ready, per conversations
    const [canSaveDiagram, setCanSaveDiagram] = useState(false)
    useEffect(() => {
        if (!isDrawioReady) {
            setCanSaveDiagram(false)
            return
        }
        const pending = pendingDiagramXmlRef.current
        pendingDiagramXmlRef.current = null
        let xmlToLoad = pending
        if (!xmlToLoad && currentConversationId) {
            try {
                const raw = localStorage.getItem(
                    conversationStorageKey(currentConversationId),
                )
                if (raw) {
                    const payload = JSON.parse(raw) as ConversationPayload
                    xmlToLoad = payload?.xml || ""
                }
            } catch {
                xmlToLoad = ""
            }
        }
        if (xmlToLoad) {
            onDisplayChart(xmlToLoad, true)
            chartXMLRef.current = xmlToLoad
        }
        setTimeout(() => setCanSaveDiagram(true), 300)
    }, [currentConversationId, isDrawioReady, onDisplayChart])

    const persistCurrentConversation = useCallback(
        (overrides: Partial<ConversationPayload>) => {
            if (!currentConversationId) return
            try {
                const raw = localStorage.getItem(
                    conversationStorageKey(currentConversationId),
                )
                const existing: ConversationPayload = raw
                    ? JSON.parse(raw)
                    : {
                          messages: [],
                          xml: "",
                          snapshots: [],
                          sessionId,
                      }

                const merged: ConversationPayload = {
                    messages:
                        overrides.messages ?? existing.messages ?? ([] as any),
                    xml: overrides.xml ?? existing.xml ?? "",
                    snapshots: overrides.snapshots ?? existing.snapshots ?? [],
                    sessionId:
                        overrides.sessionId ?? existing.sessionId ?? sessionId,
                }

                localStorage.setItem(
                    conversationStorageKey(currentConversationId),
                    JSON.stringify(merged),
                )

                setConversations((prev) => {
                    const now = Date.now()
                    let found = false
                    const next = prev.map((m) => {
                        if (m.id !== currentConversationId) return m
                        found = true
                        return {
                            ...m,
                            updatedAt: now,
                            title:
                                m.title ||
                                deriveConversationTitle(merged.messages),
                        }
                    })
                    if (!found) {
                        next.unshift({
                            id: currentConversationId,
                            createdAt: now,
                            updatedAt: now,
                            title: deriveConversationTitle(merged.messages),
                        })
                    }
                    localStorage.setItem(
                        STORAGE_CONVERSATIONS_KEY,
                        JSON.stringify(next),
                    )
                    return next
                })

                // 登录态自动同步：本地写入后做一次防抖 push
                queuePushConversation(currentConversationId)
            } catch (error) {
                console.error("Failed to persist current conversation:", error)
            }
        },
        [
            currentConversationId,
            deriveConversationTitle,
            queuePushConversation,
            sessionId,
            setConversations,
        ],
    )

    // Save messages to current conversation
    useEffect(() => {
        if (!hasRestoredRef.current) return
        persistCurrentConversation({ messages: messages as any })
    }, [messages, persistCurrentConversation])

    // Save diagram XML to current conversation whenever it changes
    useEffect(() => {
        if (!canSaveDiagram) return
        if (chartXML && chartXML.length > 300) {
            persistCurrentConversation({ xml: chartXML })
        } else if (chartXML === "") {
            persistCurrentConversation({ xml: "" })
        }
    }, [chartXML, canSaveDiagram, persistCurrentConversation])

    // Save XML snapshots to current conversation whenever they change
    const saveXmlSnapshots = useCallback(() => {
        const snapshotsArray = Array.from(xmlSnapshotsRef.current.entries())
        persistCurrentConversation({ snapshots: snapshotsArray })
    }, [persistCurrentConversation])

    // Save session ID to current conversation
    useEffect(() => {
        persistCurrentConversation({ sessionId })
    }, [sessionId, persistCurrentConversation])

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages])

    // Save state right before page unload (refresh/close)
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (!currentConversationId) return
            try {
                const payload: ConversationPayload = {
                    messages: messagesRef.current as any,
                    xml: chartXMLRef.current || "",
                    snapshots: Array.from(xmlSnapshotsRef.current.entries()),
                    sessionId,
                }
                localStorage.setItem(
                    conversationStorageKey(currentConversationId),
                    JSON.stringify(payload),
                )
                const stored = localStorage.getItem(STORAGE_CONVERSATIONS_KEY)
                const metas: ConversationMeta[] = stored
                    ? JSON.parse(stored)
                    : []
                const now = Date.now()
                const next = Array.isArray(metas)
                    ? metas.map((m) =>
                          m.id === currentConversationId
                              ? {
                                    ...m,
                                    updatedAt: now,
                                    title:
                                        m.title ||
                                        deriveConversationTitle(
                                            payload.messages,
                                        ),
                                }
                              : m,
                      )
                    : []
                localStorage.setItem(
                    STORAGE_CONVERSATIONS_KEY,
                    JSON.stringify(next),
                )
            } catch (error) {
                console.error("Failed to persist state before unload:", error)
            }
        }

        window.addEventListener("beforeunload", handleBeforeUnload)
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload)
    }, [currentConversationId, deriveConversationTitle, sessionId])

    const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const isProcessing = status === "streaming" || status === "submitted"
        if (input.trim() && !isProcessing) {
            // Check if input matches a cached example (only when no messages yet)
            if (messages.length === 0) {
                const cached = findCachedResponse(
                    input.trim(),
                    files.length > 0,
                )
                if (cached) {
                    // Add user message and fake assistant response to messages
                    // The chat-message-display useEffect will handle displaying the diagram
                    const toolCallId = `cached-${Date.now()}`

                    // Build user message text including any file content
                    const userText = await processFilesAndAppendContent(
                        input,
                        files,
                        pdfData,
                    )

                    setMessages([
                        {
                            id: `user-${Date.now()}`,
                            role: "user" as const,
                            parts: [{ type: "text" as const, text: userText }],
                        },
                        {
                            id: `assistant-${Date.now()}`,
                            role: "assistant" as const,
                            parts: [
                                {
                                    type: "tool-display_diagram" as const,
                                    toolCallId,
                                    state: "output-available" as const,
                                    input: { xml: cached.xml },
                                    output: "Successfully displayed the diagram.",
                                },
                            ],
                        },
                    ] as any)
                    setInput("")
                    setFiles([])
                    return
                }
            }

            try {
                let chartXml = await onFetchChart()
                chartXml = formatXML(chartXml)

                // Update ref directly to avoid race condition with React's async state update
                // This ensures edit_diagram has the correct XML before AI responds
                chartXMLRef.current = chartXml

                // Build user text by concatenating input with pre-extracted text
                // (Backend only reads first text part, so we must combine them)
                const parts: any[] = []
                const userText = await processFilesAndAppendContent(
                    input,
                    files,
                    pdfData,
                    parts,
                )

                // Add the combined text as the first part
                parts.unshift({ type: "text", text: userText })

                // Get previous XML from the last snapshot (before this message)
                const snapshotKeys = Array.from(
                    xmlSnapshotsRef.current.keys(),
                ).sort((a, b) => b - a)
                const previousXml =
                    snapshotKeys.length > 0
                        ? xmlSnapshotsRef.current.get(snapshotKeys[0]) || ""
                        : ""

                // Save XML snapshot for this message (will be at index = current messages.length)
                const messageIndex = messages.length
                xmlSnapshotsRef.current.set(messageIndex, chartXml)
                saveXmlSnapshots()

                // Check all quota limits
                if (!checkAllQuotaLimits()) return

                sendChatMessage(parts, chartXml, previousXml, sessionId)

                // Token count is tracked in onFinish with actual server usage
                setInput("")
                setFiles([])
            } catch (error) {
                console.error("Error fetching chart data:", error)
            }
        }
    }

    const handleNewChat = useCallback(() => {
        const id = createConversationId()
        const now = Date.now()
        const payload: ConversationPayload = {
            messages: [],
            xml: "",
            snapshots: [],
            sessionId: createSessionId(),
        }

        try {
            // 先保存当前会话，避免未落盘的内容丢失
            persistCurrentConversation({})

            localStorage.setItem(
                conversationStorageKey(id),
                JSON.stringify(payload),
            )
            const nextMetas = [
                {
                    id,
                    createdAt: now,
                    updatedAt: now,
                } satisfies ConversationMeta,
                ...conversations,
            ]
            localStorage.setItem(
                STORAGE_CONVERSATIONS_KEY,
                JSON.stringify(nextMetas),
            )
            localStorage.setItem(STORAGE_CURRENT_CONVERSATION_ID_KEY, id)

            // Reset UI state
            setMessages([])
            clearDiagram()
            handleFileChange([]) // Also clears pdfData
            xmlSnapshotsRef.current.clear()
            setSessionId(payload.sessionId)
            setConversations(nextMetas)
            setCurrentConversationId(id)

            // 登录态自动同步：新会话立即推送，让其它设备尽快可见
            queuePushConversation(id, { immediate: true })

            toast.success(t("toast.startedFreshChat"))
        } catch (error) {
            console.error("Failed to create new conversation:", error)
            toast.warning(t("toast.storageUpdateFailed"))
        }
    }, [
        clearDiagram,
        conversations,
        handleFileChange,
        persistCurrentConversation,
        queuePushConversation,
        setMessages,
        t,
    ])

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        setInput(e.target.value)
    }

    const handleSelectConversation = useCallback(
        (id: string) => {
            if (!id || id === currentConversationId) return
            try {
                localStorage.setItem(STORAGE_CURRENT_CONVERSATION_ID_KEY, id)
                setCurrentConversationId(id)
            } catch (error) {
                console.error("Failed to select conversation:", error)
                toast.warning(t("toast.storageUpdateFailed"))
            }
        },
        [currentConversationId, t],
    )

    const handleDeleteConversation = useCallback(
        (id: string) => {
            try {
                // 登录态自动同步：先把“删除事件”推送到云端，再删本地缓存
                queuePushConversation(id, { immediate: true, deleted: true })

                localStorage.removeItem(conversationStorageKey(id))
                const nextMetas = conversations.filter((c) => c.id !== id)
                localStorage.setItem(
                    STORAGE_CONVERSATIONS_KEY,
                    JSON.stringify(nextMetas),
                )
                setConversations(nextMetas)

                if (id === currentConversationId) {
                    const nextId = nextMetas[0]?.id
                    if (nextId) {
                        localStorage.setItem(
                            STORAGE_CURRENT_CONVERSATION_ID_KEY,
                            nextId,
                        )
                        setCurrentConversationId(nextId)
                    } else {
                        // If all sessions removed, create a fresh one
                        const newId = createConversationId()
                        const now = Date.now()
                        const payload: ConversationPayload = {
                            messages: [],
                            xml: "",
                            snapshots: [],
                            sessionId: createSessionId(),
                        }
                        localStorage.setItem(
                            conversationStorageKey(newId),
                            JSON.stringify(payload),
                        )
                        const metas = [
                            {
                                id: newId,
                                createdAt: now,
                                updatedAt: now,
                            } satisfies ConversationMeta,
                        ]
                        localStorage.setItem(
                            STORAGE_CONVERSATIONS_KEY,
                            JSON.stringify(metas),
                        )
                        localStorage.setItem(
                            STORAGE_CURRENT_CONVERSATION_ID_KEY,
                            newId,
                        )
                        setConversations(metas)
                        setCurrentConversationId(newId)
                    }
                }
            } catch (error) {
                console.error("Failed to delete conversation:", error)
                toast.warning(t("toast.storageUpdateFailed"))
            }
        },
        [conversations, currentConversationId, queuePushConversation, t],
    )

    // Helper functions for message actions (regenerate/edit)
    // Extract previous XML snapshot before a given message index
    const getPreviousXml = useCallback((beforeIndex: number): string => {
        const snapshotKeys = Array.from(xmlSnapshotsRef.current.keys())
            .filter((k) => k < beforeIndex)
            .sort((a, b) => b - a)
        return snapshotKeys.length > 0
            ? xmlSnapshotsRef.current.get(snapshotKeys[0]) || ""
            : ""
    }, [])

    // Restore diagram from snapshot and update ref
    const restoreDiagramFromSnapshot = useCallback(
        (savedXml: string) => {
            onDisplayChart(savedXml, true) // Skip validation for trusted snapshots
            chartXMLRef.current = savedXml
        },
        [onDisplayChart],
    )

    // Clean up snapshots after a given message index
    const cleanupSnapshotsAfter = useCallback(
        (messageIndex: number) => {
            for (const key of xmlSnapshotsRef.current.keys()) {
                if (key > messageIndex) {
                    xmlSnapshotsRef.current.delete(key)
                }
            }
            saveXmlSnapshots()
        },
        [saveXmlSnapshots],
    )

    // Check all quota limits (daily requests, tokens, TPM)
    const checkAllQuotaLimits = useCallback((): boolean => {
        const limitCheck = quotaManager.checkDailyLimit()
        if (!limitCheck.allowed) {
            quotaManager.showQuotaLimitToast()
            return false
        }

        const tokenLimitCheck = quotaManager.checkTokenLimit()
        if (!tokenLimitCheck.allowed) {
            quotaManager.showTokenLimitToast(tokenLimitCheck.used)
            return false
        }

        const tpmCheck = quotaManager.checkTPMLimit()
        if (!tpmCheck.allowed) {
            quotaManager.showTPMLimitToast()
            return false
        }

        return true
    }, [quotaManager])

    // Send chat message with headers and increment quota
    const sendChatMessage = useCallback(
        (parts: any, xml: string, previousXml: string, sessionId: string) => {
            // Reset auto-retry count on user-initiated message
            autoRetryCountRef.current = 0
            editFailureCountRef.current = 0
            forceDisplayNextRef.current = false

            const config = getAIConfig()

            sendMessage(
                { parts },
                {
                    body: { xml, previousXml, sessionId },
                    headers: {
                        "x-access-code": config.accessCode,
                        ...(config.aiProvider && {
                            "x-ai-provider": config.aiProvider,
                            ...(config.aiBaseUrl && {
                                "x-ai-base-url": config.aiBaseUrl,
                            }),
                            ...(config.aiApiKey && {
                                "x-ai-api-key": config.aiApiKey,
                            }),
                            ...(config.aiModel && {
                                "x-ai-model": config.aiModel,
                            }),
                        }),
                    },
                },
            )
            quotaManager.incrementRequestCount()
        },
        [quotaManager, sendMessage],
    )

    // Process files and append content to user text (handles PDF, text, and optionally images)
    const processFilesAndAppendContent = async (
        baseText: string,
        files: File[],
        pdfData: Map<File, FileData>,
        imageParts?: any[],
    ): Promise<string> => {
        let userText = baseText

        for (const file of files) {
            if (isPdfFile(file)) {
                const extracted = pdfData.get(file)
                if (extracted?.text) {
                    userText += `\n\n[PDF: ${file.name}]\n${extracted.text}`
                }
            } else if (isTextFile(file)) {
                const extracted = pdfData.get(file)
                if (extracted?.text) {
                    userText += `\n\n[File: ${file.name}]\n${extracted.text}`
                }
            } else if (imageParts) {
                // Handle as image (only if imageParts array provided)
                const reader = new FileReader()
                const dataUrl = await new Promise<string>((resolve) => {
                    reader.onload = () => resolve(reader.result as string)
                    reader.readAsDataURL(file)
                })

                imageParts.push({
                    type: "file",
                    url: dataUrl,
                    mediaType: file.type,
                })
            }
        }

        return userText
    }

    const handleRegenerate = useCallback(
        async (messageIndex: number) => {
            const isProcessing =
                status === "streaming" || status === "submitted"
            if (isProcessing) return

            // Find the user message before this assistant message
            let userMessageIndex = messageIndex - 1
            while (
                userMessageIndex >= 0 &&
                messages[userMessageIndex].role !== "user"
            ) {
                userMessageIndex--
            }

            if (userMessageIndex < 0) return

            const userMessage = messages[userMessageIndex]
            const userParts = userMessage.parts

            // Get the text from the user message
            const textPart = userParts?.find((p: any) => p.type === "text")
            if (!textPart) return

            // Get the saved XML snapshot for this user message
            const savedXml = xmlSnapshotsRef.current.get(userMessageIndex)
            if (!savedXml) {
                console.error(
                    "No saved XML snapshot for message index:",
                    userMessageIndex,
                )
                return
            }

            // Get previous XML and restore diagram state
            const previousXml = getPreviousXml(userMessageIndex)
            restoreDiagramFromSnapshot(savedXml)

            // Clean up snapshots for messages after the user message (they will be removed)
            cleanupSnapshotsAfter(userMessageIndex)

            // Remove the user message AND assistant message onwards (sendMessage will re-add the user message)
            // Use flushSync to ensure state update is processed synchronously before sending
            const newMessages = messages.slice(0, userMessageIndex)
            flushSync(() => {
                setMessages(newMessages)
            })

            // Check all quota limits
            if (!checkAllQuotaLimits()) return

            // Now send the message after state is guaranteed to be updated
            sendChatMessage(userParts, savedXml, previousXml, sessionId)

            // Token count is tracked in onFinish with actual server usage
        },
        [
            checkAllQuotaLimits,
            cleanupSnapshotsAfter,
            getPreviousXml,
            messages,
            restoreDiagramFromSnapshot,
            sendChatMessage,
            sessionId,
            setMessages,
            status,
        ],
    )

    const handleEditMessage = useCallback(
        async (messageIndex: number, newText: string) => {
            const isProcessing =
                status === "streaming" || status === "submitted"
            if (isProcessing) return

            const message = messages[messageIndex]
            if (!message || message.role !== "user") return

            // Get the saved XML snapshot for this user message
            const savedXml = xmlSnapshotsRef.current.get(messageIndex)
            if (!savedXml) {
                console.error(
                    "No saved XML snapshot for message index:",
                    messageIndex,
                )
                return
            }

            // Get previous XML and restore diagram state
            const previousXml = getPreviousXml(messageIndex)
            restoreDiagramFromSnapshot(savedXml)

            // Clean up snapshots for messages after the user message (they will be removed)
            cleanupSnapshotsAfter(messageIndex)

            // Create new parts with updated text
            const newParts = message.parts?.map((part: any) => {
                if (part.type === "text") {
                    return { ...part, text: newText }
                }
                return part
            }) || [{ type: "text", text: newText }]

            // Remove the user message AND assistant message onwards (sendMessage will re-add the user message)
            // Use flushSync to ensure state update is processed synchronously before sending
            const newMessages = messages.slice(0, messageIndex)
            flushSync(() => {
                setMessages(newMessages)
            })

            // Check all quota limits
            if (!checkAllQuotaLimits()) return

            // Now send the edited message after state is guaranteed to be updated
            sendChatMessage(newParts, savedXml, previousXml, sessionId)
            // Token count is tracked in onFinish with actual server usage
        },
        [
            checkAllQuotaLimits,
            cleanupSnapshotsAfter,
            getPreviousXml,
            messages,
            restoreDiagramFromSnapshot,
            sendChatMessage,
            sessionId,
            setMessages,
            status,
        ],
    )

    // Collapsed view (desktop only)
    if (!isVisible && !isMobile) {
        return (
            <div className="h-full flex flex-col items-center pt-4 bg-card border border-border/30 rounded-xl">
                <ButtonWithTooltip
                    tooltipContent={t("chat.header.showTooltip")}
                    variant="ghost"
                    size="icon"
                    onClick={onToggleVisibility}
                    className="hover:bg-accent transition-colors"
                >
                    <PanelRightOpen className="h-5 w-5 text-muted-foreground" />
                </ButtonWithTooltip>
                <div
                    className="text-sm font-medium text-muted-foreground mt-8 tracking-wide"
                    style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                    }}
                >
                    {t("chat.header.aiChatLabel")}
                </div>
            </div>
        )
    }

    // Full view
    return (
        <div className="h-full flex flex-col bg-card shadow-soft animate-slide-in-right rounded-xl border border-border/30 relative">
            <Toaster
                position="bottom-center"
                richColors
                expand
                style={{ position: "absolute" }}
                toastOptions={{
                    style: {
                        maxWidth: "480px",
                    },
                }}
            />
            {/* Header */}
            <ChatHeader
                isMobile={isMobile}
                isVisible={isVisible}
                onToggleVisibility={onToggleVisibility}
                title="Next AI Drawio"
                noticeTooltip={isMobile ? "" : t("chat.header.noticeTooltip")}
                onShowSettings={() => setShowSettingsDialog(true)}
                newSessionTooltip={t("chat.header.newSessionTooltip")}
                onNewSession={() => handleNewChat()}
                settingsTooltip={t("chat.header.settingsTooltip")}
                hideTooltip={t("chat.header.hideTooltip")}
                showTooltip={t("chat.header.showTooltip")}
                authStatus={authStatus}
                userImage={authSession?.user?.image}
                signInLabel={t("auth.signIn")}
                signOutLabel={t("auth.signOut")}
                onSignIn={() => void signIn("github")}
                onSignOut={() => void signOut()}
                showSync={authStatus === "authenticated"}
                isOnline={isOnline}
                syncInFlightCount={syncInFlightCount}
                lastSyncOkAt={lastSyncOkAt}
                lastSyncErrorAt={lastSyncErrorAt}
                syncOkLabel={t("sync.status.ok")}
                syncOkAtLabel={(time: string) =>
                    t("sync.status.okAt", { time })
                }
                syncSyncingLabel={t("sync.status.syncing")}
                syncOfflineLabel={t("sync.status.offline")}
                syncErrorLabel={t("sync.status.error")}
                locale={locale}
                onSyncClick={() => void pullOnce()}
                conversations={conversations}
                currentConversationId={currentConversationId}
                getConversationDisplayTitle={getConversationDisplayTitle}
                sessionSwitcherPlaceholder={t("chat.header.sessionSwitcher")}
                deleteLabel={t("settings.sessions.delete")}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={handleDeleteConversation}
            />
            {/* Messages */}
            <main className="flex-1 w-full overflow-hidden">
                <ChatMessageDisplay
                    messages={messages}
                    setInput={setInput}
                    setFiles={handleFileChange}
                    processedToolCallsRef={processedToolCallsRef}
                    sessionId={sessionId}
                    onRegenerate={handleRegenerate}
                    status={status}
                    onEditMessage={handleEditMessage}
                />
            </main>

            {/* Input */}
            <footer
                className={`${isMobile ? "p-2" : "p-4"} border-t border-border/50 bg-card/50`}
            >
                <ChatInput
                    input={input}
                    status={status}
                    onSubmit={onFormSubmit}
                    onChange={handleInputChange}
                    onClearChat={handleNewChat}
                    files={files}
                    onFileChange={handleFileChange}
                    pdfData={pdfData}
                    showHistory={showHistory}
                    onToggleHistory={setShowHistory}
                    sessionId={sessionId}
                    error={error}
                />
            </footer>

            <SettingsDialog
                open={showSettingsDialog}
                onOpenChange={setShowSettingsDialog}
                onCloseProtectionChange={onCloseProtectionChange}
                drawioUi={drawioUi}
                onToggleDrawioUi={onToggleDrawioUi}
                darkMode={darkMode}
                onToggleDarkMode={onToggleDarkMode}
            />
        </div>
    )
}
