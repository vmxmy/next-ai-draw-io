"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { PanelRightOpen } from "lucide-react"
import { useSession } from "next-auth/react"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Toaster, toast } from "sonner"
import { AuthDialog } from "@/components/auth-dialog"
import { AutoRetryLimitToast } from "@/components/auto-retry-limit-toast"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { ChatInput } from "@/components/chat-input"
import { ChatMessageDisplay } from "@/components/chat-message-display"
import { QuotaDialog } from "@/components/quota-dialog"
import { SettingsDialog } from "@/components/settings-dialog"
import { UserCenterDialog } from "@/components/user-center-dialog"
import { useDiagram } from "@/contexts/diagram-context"
import { useI18n } from "@/contexts/i18n-context"
import { classifyChatError } from "@/features/chat/ai/chat-error"
import {
    getLastToolErrorName,
    hasToolErrors,
} from "@/features/chat/ai/tool-errors"
import type { ChatMessage } from "@/features/chat/ai/types"
import { useLocalConversations } from "@/features/chat/sessions/use-local-conversations"
import { useConversationSync } from "@/features/chat/sync/use-conversation-sync"
import { ChatHeader } from "@/features/chat/ui/chat-header"
import { getAIConfig } from "@/lib/ai-config"
import { findCachedResponse } from "@/lib/cached-responses"
import { isPdfFile, isTextFile } from "@/lib/pdf-utils"
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

function createRequestId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID()
    }
    return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getLastToolErrorSummary(messages: ChatMessage[]): {
    toolName: string | null
    summary: string | null
    fullText: string | null
} {
    const lastMessage = messages[messages.length - 1] as any
    if (!lastMessage || lastMessage.role !== "assistant") {
        return { toolName: null, summary: null, fullText: null }
    }

    const toolParts = (lastMessage.parts || []).filter((p: any) =>
        String(p?.type || "").startsWith("tool-"),
    )
    if (toolParts.length === 0) {
        return { toolName: null, summary: null, fullText: null }
    }

    let errorPart: any = null
    for (let i = toolParts.length - 1; i >= 0; i--) {
        if (toolParts[i]?.state === "output-error") {
            errorPart = toolParts[i]
            break
        }
    }
    if (!errorPart) {
        return { toolName: null, summary: null, fullText: null }
    }

    const toolName = errorPart.toolName ? String(errorPart.toolName) : null
    const fullText =
        typeof errorPart.output === "string"
            ? errorPart.output
            : typeof errorPart.errorText === "string"
              ? errorPart.errorText
              : typeof errorPart.result === "string"
                ? errorPart.result
                : null

    const firstLine = fullText ? String(fullText).split("\n")[0]?.trim() : ""
    const summary = firstLine ? firstLine.slice(0, 160) : null

    return { toolName, summary, fullText }
}

function stripAllFilePartsFromMessages(messages: any[]): {
    nextMessages: any[]
    removedCount: number
} {
    let removedCount = 0
    const nextMessages = messages.map((msg) => {
        const parts = (msg as any)?.parts
        if (!Array.isArray(parts)) return msg

        const kept = parts.filter((p: any) => p?.type !== "file")
        removedCount += parts.length - kept.length
        if (kept.length === parts.length) return msg
        return { ...msg, parts: kept }
    })

    return { nextMessages, removedCount }
}

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
    const [showAuthDialog, setShowAuthDialog] = useState(false)
    const [showUserCenterDialog, setShowUserCenterDialog] = useState(false)
    const [showQuotaDialog, setShowQuotaDialog] = useState(false)
    const [, setAccessCodeRequired] = useState(false)
    const [input, setInput] = useState("")
    const [dailyRequestLimit, setDailyRequestLimit] = useState(0)
    const [dailyTokenLimit, setDailyTokenLimit] = useState(0)
    const [tpmLimit, setTpmLimit] = useState(0)
    const [disableImageUpload, setDisableImageUpload] = useState(false)

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

    // Store XML snapshots for each user message (keyed by message index)

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
    const activeRequestIdRef = useRef<string | null>(null)
    const retryLastFailedRef = useRef<(() => void) | null>(null)

    // 登录态（OAuth）
    const { data: authSession, status: authStatus } = useSession()

    const currentConversationIdRef = useRef("")
    const queuePushConversationRef = useRef<
        (id: string, opts?: { immediate?: boolean; deleted?: boolean }) => void
    >(() => {})
    const queuePushConversation = useCallback(
        (id: string, opts?: { immediate?: boolean; deleted?: boolean }) => {
            queuePushConversationRef.current?.(id, opts)
        },
        [],
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
                    appendDiagramVersion(fullXml, "display_diagram")
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
                const { ops } = toolCall.input as {
                    ops?: any[]
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

                    const { applyDiagramOps } = await import(
                        "@/lib/diagram-ops"
                    )

                    // Strict Ops Mode: search/replace (edits) is no longer supported
                    if (ops && ops.length > 0) {
                        const applied = applyDiagramOps(currentXml, ops as any)
                        if ("error" in applied) {
                            addToolOutput({
                                tool: "edit_diagram",
                                toolCallId: toolCall.toolCallId,
                                state: "output-error",
                                errorText: `结构化编辑失败：${applied.error}`,
                            })
                            return
                        }

                        const validationError = onDisplayChart(applied.xml)
                        if (validationError) {
                            addToolOutput({
                                tool: "edit_diagram",
                                toolCallId: toolCall.toolCallId,
                                state: "output-error",
                                errorText: `结构化编辑产生了无效 XML: ${validationError}`,
                            })
                            return
                        }

                        appendDiagramVersion(applied.xml, "edit_diagram")
                        onExport()
                        addToolOutput({
                            tool: "edit_diagram",
                            toolCallId: toolCall.toolCallId,
                            output: `Successfully applied ${ops.length} structured op(s) to the diagram.`,
                        })
                        console.log("[edit_diagram] Success (ops)")
                        return
                    }

                    // No ops provided
                    addToolOutput({
                        tool: "edit_diagram",
                        toolCallId: toolCall.toolCallId,
                        state: "output-error",
                        errorText:
                            "edit_diagram 缺少 ops 参数。请使用 structured ops 进行编辑。",
                    })
                    return
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
            const classified = classifyChatError(error, t)
            if (classified.kind === "aborted") return
            activeRequestIdRef.current = null

            const rawMessage =
                error instanceof Error ? error.message : String(error ?? "")
            // Silence access code error in console since it's handled by UI
            if (!rawMessage.includes("Invalid or missing access code")) {
                console.error("Chat error:", error)
            }

            const friendlyMessage = classified.message

            // 图片输入不支持：自动清理会话中已有的图片 parts，避免后续对话持续失败（用户无法继续）。
            if (classified.kind === "imageNotSupported") {
                setDisableImageUpload(true)

                // 同步移除当前待发送的图片文件（保留 PDF/文本文件）
                const nonImageFiles = files.filter(
                    (f) => !f.type.startsWith("image/"),
                )
                if (nonImageFiles.length !== files.length) {
                    void handleFileChange(nonImageFiles)
                }

                setMessages((currentMessages) => {
                    const { nextMessages, removedCount } =
                        stripAllFilePartsFromMessages(currentMessages as any[])
                    if (removedCount === 0) return currentMessages

                    return [
                        ...nextMessages,
                        {
                            id: `system-remove-images-${Date.now()}`,
                            role: "system" as const,
                            content: friendlyMessage,
                            parts: [
                                {
                                    type: "text" as const,
                                    text: `${friendlyMessage}（已自动从对话中移除 ${removedCount} 张图片，你可以继续发送文字；如需图片分析，请在设置中更换支持图片输入的模型）`,
                                },
                            ],
                        },
                    ]
                })
                return
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

            if (rawMessage.includes("Invalid or missing access code")) {
                // Show settings button and open dialog to help user fix it
                setAccessCodeRequired(true)
                setShowSettingsDialog(true)
            }
        },
        onFinish: ({ message }) => {
            const metadata = message?.metadata as
                | Record<string, unknown>
                | undefined

            // 忽略已过期请求（例如切换会话后旧流的 finish 迟到）
            const requestId = metadata?.requestId
            if (
                typeof requestId === "string" &&
                activeRequestIdRef.current &&
                requestId !== activeRequestIdRef.current
            ) {
                return
            }

            // Track actual token usage from server metadata
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
            const conversationId = currentConversationIdRef.current
            if (conversationId) {
                queuePushConversation(conversationId, {
                    immediate: true,
                })
            }

            activeRequestIdRef.current = null
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
                const { toolName, summary, fullText } =
                    getLastToolErrorSummary(chatMessages)
                const detailLines: string[] = []
                if (toolName) {
                    detailLines.push(
                        t("toast.lastFailureLabel") + ` ${toolName}`,
                    )
                }
                if (summary) {
                    detailLines.push(summary)
                }

                toast.custom(
                    (toastId) => (
                        <AutoRetryLimitToast
                            title={t("toast.autoRetryLimitReached")}
                            detail={
                                detailLines.length > 0
                                    ? `${detailLines.join("\n")}\n\n${t("toast.autoRetryLimitReachedHint")}`
                                    : t("toast.autoRetryLimitReachedHint")
                            }
                            regenerateLabel={t("chat.tooltip.regenerate")}
                            copyLabel={t("toast.copyDiagnostics")}
                            settingsLabel={t("toast.openSettings")}
                            closeLabel={t("common.close")}
                            onRegenerate={() => {
                                toast.dismiss(toastId)
                                retryLastFailedRef.current?.()
                            }}
                            onCopy={() => {
                                const diagnostic = [
                                    `[auto-retry] reached limit: ${MAX_AUTO_RETRY_COUNT}`,
                                    toolName ? `tool=${toolName}` : null,
                                    fullText ? `error=${fullText}` : null,
                                ]
                                    .filter(Boolean)
                                    .join("\n")
                                void navigator.clipboard
                                    .writeText(diagnostic)
                                    .then(() => {
                                        toast.success(t("chat.tooltip.copied"))
                                    })
                                    .catch(() => {
                                        toast.error(t("toast.copyFailed"))
                                    })
                            }}
                            onOpenSettings={() => {
                                toast.dismiss(toastId)
                                setShowSettingsDialog(true)
                            }}
                            onDismiss={() => toast.dismiss(toastId)}
                        />
                    ),
                    { id: "autoRetryLimitReached", duration: 10000 },
                )
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

    const stopCurrentRequest = useCallback(() => {
        activeRequestIdRef.current = null
        try {
            stopRef.current?.()
        } catch {
            // ignore
        }
    }, [])

    // Ref to track latest messages for unload persistence
    const messagesRef = useRef(messages)
    useEffect(() => {
        messagesRef.current = messages
    }, [messages])

    const messagesEndRef = useRef<HTMLDivElement>(null)

    const resetFiles = useCallback(
        () => handleFileChange([]),
        [handleFileChange],
    )

    const {
        conversations,
        setConversations,
        currentConversationId,
        setCurrentConversationId,
        sessionId,
        hasRestored,
        getConversationDisplayTitle,
        loadConversation,
        persistCurrentConversation,
        handleNewChat,
        handleSelectConversation,
        handleDeleteConversation,
        diagramVersions,
        diagramVersionCursor,
        canUndo,
        canRedo,
        undoDiagram,
        redoDiagram,
        restoreDiagramVersionIndex,
        ensureDiagramVersionForMessage,
        appendDiagramVersion,
        getDiagramXmlForMessage,
        getDiagramVersionIndexForMessage,
        getPreviousDiagramXmlBeforeMessage,
        truncateDiagramVersionsAfterMessage,
    } = useLocalConversations({
        userId: authSession?.user?.id || "anonymous",
        locale,
        t,
        isDrawioReady,
        onDisplayChart,
        clearDiagram,
        chartXML,
        chartXMLRef,
        messages,
        processedToolCallsRef,
        autoRetryCountRef,
        editFailureCountRef,
        forceDisplayNextRef,
        setMessages,
        messagesRef,
        resetFiles,
        queuePushConversation,
        stopCurrentRequest,
    })

    const {
        isOnline,
        syncInFlightCount,
        lastSyncOkAt,
        lastSyncErrorAt,
        pullOnce,
        queuePushConversation: syncQueuePushConversation,
    } = useConversationSync({
        authStatus,
        userId: authSession?.user?.id,
        hasRestored,
        conversations,
        currentConversationId,
        setConversations,
        setCurrentConversationId,
        loadConversation,
    })

    useEffect(() => {
        queuePushConversationRef.current = syncQueuePushConversation
    }, [syncQueuePushConversation])

    useEffect(() => {
        currentConversationIdRef.current = currentConversationId
    }, [currentConversationId])

    // Sync chartXML changes to current conversation (fixes manual draw.io edits not syncing)
    useEffect(() => {
        if (!currentConversationId || !chartXML) return

        // Debounce to avoid frequent writes during rapid diagram changes
        const timer = setTimeout(() => {
            persistCurrentConversation({ xml: chartXML })
        }, 500)

        return () => clearTimeout(timer)
    }, [chartXML, currentConversationId, persistCurrentConversation])

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages])

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

                const messageIndex = messages.length
                const previousXml =
                    getPreviousDiagramXmlBeforeMessage(messageIndex)
                ensureDiagramVersionForMessage(
                    messageIndex,
                    chartXml,
                    "before-send",
                )

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

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        setInput(e.target.value)
    }

    // Helper functions for message actions (regenerate/edit)

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
            const requestId = createRequestId()
            activeRequestIdRef.current = requestId

            sendMessage(
                { parts },
                {
                    body: {
                        xml,
                        previousXml,
                        sessionId,
                        conversationId: currentConversationIdRef.current,
                        requestId,
                    },
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

            const currentMessages = (messagesRef.current || []) as any[]

            // Find the user message before this assistant message
            let userMessageIndex = messageIndex - 1
            while (
                userMessageIndex >= 0 &&
                currentMessages[userMessageIndex].role !== "user"
            ) {
                userMessageIndex--
            }

            if (userMessageIndex < 0) return

            const userMessage = currentMessages[userMessageIndex]
            const userParts = userMessage.parts

            // Get the text from the user message
            const textPart = userParts?.find((p: any) => p.type === "text")
            if (!textPart) return

            // Get the saved XML snapshot for this user message
            const savedXml = getDiagramXmlForMessage(userMessageIndex)
            const savedVersionIndex =
                getDiagramVersionIndexForMessage(userMessageIndex)
            if (!savedXml || savedVersionIndex < 0) {
                console.error(
                    "No saved XML snapshot for message index:",
                    userMessageIndex,
                )
                return
            }

            // Get previous XML and restore diagram state
            const previousXml =
                getPreviousDiagramXmlBeforeMessage(userMessageIndex)
            restoreDiagramVersionIndex(savedVersionIndex)

            // 清理该消息之后的版本/书签（用户将重写后续对话）
            truncateDiagramVersionsAfterMessage(userMessageIndex)

            // Remove the user message AND assistant message onwards (sendMessage will re-add the user message)
            // Use flushSync to ensure state update is processed synchronously before sending
            const newMessages = currentMessages.slice(0, userMessageIndex)
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
            getDiagramVersionIndexForMessage,
            getDiagramXmlForMessage,
            getPreviousDiagramXmlBeforeMessage,
            messagesRef,
            restoreDiagramVersionIndex,
            sendChatMessage,
            sessionId,
            setMessages,
            status,
            truncateDiagramVersionsAfterMessage,
        ],
    )

    useEffect(() => {
        retryLastFailedRef.current = () => {
            const currentMessages = (messagesRef.current || []) as any[]
            let idx = currentMessages.length - 1
            while (idx >= 0 && currentMessages[idx]?.role !== "assistant") idx--
            if (idx < 0) return
            void handleRegenerate(idx)
        }
    }, [handleRegenerate, messagesRef])

    const handleEditMessage = useCallback(
        async (messageIndex: number, newText: string) => {
            const isProcessing =
                status === "streaming" || status === "submitted"
            if (isProcessing) return

            const message = messages[messageIndex]
            if (!message || message.role !== "user") return

            // Get the saved XML snapshot for this user message
            const savedXml = getDiagramXmlForMessage(messageIndex)
            const savedVersionIndex =
                getDiagramVersionIndexForMessage(messageIndex)
            if (!savedXml || savedVersionIndex < 0) {
                console.error(
                    "No saved XML snapshot for message index:",
                    messageIndex,
                )
                return
            }

            // Get previous XML and restore diagram state
            const previousXml = getPreviousDiagramXmlBeforeMessage(messageIndex)
            restoreDiagramVersionIndex(savedVersionIndex)

            // 清理该消息之后的版本/书签（用户将重写后续对话）
            truncateDiagramVersionsAfterMessage(messageIndex)

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
            getDiagramVersionIndexForMessage,
            getDiagramXmlForMessage,
            getPreviousDiagramXmlBeforeMessage,
            messages,
            restoreDiagramVersionIndex,
            sendChatMessage,
            sessionId,
            setMessages,
            status,
            truncateDiagramVersionsAfterMessage,
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
                style={{ position: "absolute", pointerEvents: "none" }}
                toastOptions={{
                    style: {
                        maxWidth: "480px",
                        pointerEvents: "auto",
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
                profileLabel={t("auth.profile")}
                onSignIn={() => setShowAuthDialog(true)}
                onProfileClick={() => setShowUserCenterDialog(true)}
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
                quotaTooltip={t("chat.header.quotaTooltip")}
                onShowQuota={() => setShowQuotaDialog(true)}
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
                    onClearChat={({ clearDiagram }) => {
                        if (clearDiagram) {
                            handleNewChat()
                        } else {
                            handleNewChat({ keepDiagram: true })
                        }
                    }}
                    onStop={stopCurrentRequest}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undoDiagram}
                    onRedo={redoDiagram}
                    historyCount={diagramVersions.length}
                    historyVersions={diagramVersions}
                    historyCursor={diagramVersionCursor}
                    onRestoreHistory={restoreDiagramVersionIndex}
                    files={files}
                    onFileChange={handleFileChange}
                    pdfData={pdfData}
                    showHistory={showHistory}
                    onToggleHistory={setShowHistory}
                    sessionId={sessionId}
                    conversationTitle={getConversationDisplayTitle(
                        currentConversationId,
                    )}
                    error={error}
                    disableImageUpload={disableImageUpload}
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

            <AuthDialog
                open={showAuthDialog}
                onOpenChange={setShowAuthDialog}
            />

            <UserCenterDialog
                open={showUserCenterDialog}
                onOpenChange={setShowUserCenterDialog}
                user={authSession?.user}
            />

            <QuotaDialog
                open={showQuotaDialog}
                onOpenChange={setShowQuotaDialog}
                tier={quotaManager.tier}
                config={quotaManager.config}
                usage={quotaManager.usage}
                hasOwnApiKey={quotaManager.hasOwnApiKey()}
            />
        </div>
    )
}
