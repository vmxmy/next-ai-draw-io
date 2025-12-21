import { STORAGE_KEYS } from "./storage"

export type ModelMode = "fast" | "max"

/**
 * Get AI configuration from localStorage based on model mode.
 * Returns API keys and settings for custom AI providers.
 * Used to override server defaults when user provides their own API key.
 */
export function getAIConfig(mode: ModelMode = "fast") {
    if (typeof window === "undefined") {
        return {
            accessCode: "",
            aiProvider: "",
            aiBaseUrl: "",
            aiApiKey: "",
            aiModel: "",
        }
    }

    const accessCode = localStorage.getItem(STORAGE_KEYS.accessCode) || ""

    // Try mode-specific keys first, fall back to legacy keys
    if (mode === "fast") {
        const provider = localStorage.getItem(STORAGE_KEYS.fastProvider)
        if (provider) {
            return {
                accessCode,
                aiProvider: provider,
                aiBaseUrl: localStorage.getItem(STORAGE_KEYS.fastBaseUrl) || "",
                aiApiKey: localStorage.getItem(STORAGE_KEYS.fastApiKey) || "",
                aiModel: localStorage.getItem(STORAGE_KEYS.fastModel) || "",
            }
        }
    } else {
        const provider = localStorage.getItem(STORAGE_KEYS.maxProvider)
        if (provider) {
            return {
                accessCode,
                aiProvider: provider,
                aiBaseUrl: localStorage.getItem(STORAGE_KEYS.maxBaseUrl) || "",
                aiApiKey: localStorage.getItem(STORAGE_KEYS.maxApiKey) || "",
                aiModel: localStorage.getItem(STORAGE_KEYS.maxModel) || "",
            }
        }
    }

    // Fall back to legacy keys for backwards compatibility
    return {
        accessCode,
        aiProvider: localStorage.getItem(STORAGE_KEYS.aiProvider) || "",
        aiBaseUrl: localStorage.getItem(STORAGE_KEYS.aiBaseUrl) || "",
        aiApiKey: localStorage.getItem(STORAGE_KEYS.aiApiKey) || "",
        aiModel: localStorage.getItem(STORAGE_KEYS.aiModel) || "",
    }
}
