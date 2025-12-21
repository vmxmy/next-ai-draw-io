// Centralized localStorage keys
// Consolidates all storage keys from chat-panel.tsx and settings-dialog.tsx

export const STORAGE_KEYS = {
    // Chat data (legacy single-session keys, kept for migration)
    messages: "next-ai-draw-io-messages",
    xmlSnapshots: "next-ai-draw-io-xml-snapshots",
    diagramXml: "next-ai-draw-io-diagram-xml",
    sessionId: "next-ai-draw-io-session-id",

    // Chat data (multi-session)
    conversations: "next-ai-draw-io-conversations",
    currentConversationId: "next-ai-draw-io-current-conversation-id",
    conversationPrefix: "next-ai-draw-io-conversation:",

    // Quota tracking
    requestCount: "next-ai-draw-io-request-count",
    requestDate: "next-ai-draw-io-request-date",
    tokenCount: "next-ai-draw-io-token-count",
    tokenDate: "next-ai-draw-io-token-date",
    tpmCount: "next-ai-draw-io-tpm-count",
    tpmMinute: "next-ai-draw-io-tpm-minute",

    // Settings
    accessCode: "next-ai-draw-io-access-code",
    closeProtection: "next-ai-draw-io-close-protection",
    accessCodeRequired: "next-ai-draw-io-access-code-required",
    // Legacy single config (for backwards compatibility)
    aiProvider: "next-ai-draw-io-ai-provider",
    aiProviderConnection: "next-ai-draw-io-ai-provider-connection",
    aiBaseUrl: "next-ai-draw-io-ai-base-url",
    aiApiKey: "next-ai-draw-io-ai-api-key",
    aiModel: "next-ai-draw-io-ai-model",
    // Fast mode config
    fastProvider: "next-ai-draw-io-fast-provider",
    fastBaseUrl: "next-ai-draw-io-fast-base-url",
    fastApiKey: "next-ai-draw-io-fast-api-key",
    fastModel: "next-ai-draw-io-fast-model",
    // Max mode config
    maxProvider: "next-ai-draw-io-max-provider",
    maxBaseUrl: "next-ai-draw-io-max-base-url",
    maxApiKey: "next-ai-draw-io-max-api-key",
    maxModel: "next-ai-draw-io-max-model",
} as const
