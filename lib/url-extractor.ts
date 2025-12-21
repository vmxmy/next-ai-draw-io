/**
 * URL extraction utility
 * Extracts URLs from text for web scraping preprocessing
 */

// Regex pattern for matching URLs
// Matches http:// and https:// URLs with common TLDs
const URL_REGEX =
    /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi

// Domains that typically cannot be scraped or are not useful
const BLOCKED_DOMAINS = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "10.",
    "172.16.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.20.",
    "172.21.",
    "172.22.",
    "172.23.",
    "172.24.",
    "172.25.",
    "172.26.",
    "172.27.",
    "172.28.",
    "172.29.",
    "172.30.",
    "172.31.",
    "192.168.",
]

// File extensions that should not be scraped
const BLOCKED_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".7z",
    ".mp3",
    ".mp4",
    ".avi",
    ".mov",
    ".wmv",
    ".exe",
    ".dmg",
    ".apk",
    ".ipa",
]

/**
 * Check if a URL should be blocked from scraping
 */
function isBlockedUrl(url: string): boolean {
    try {
        const parsed = new URL(url)
        const hostname = parsed.hostname.toLowerCase()
        const pathname = parsed.pathname.toLowerCase()

        // Check blocked domains (internal/private networks)
        for (const blocked of BLOCKED_DOMAINS) {
            if (hostname.startsWith(blocked) || hostname === blocked) {
                return true
            }
        }

        // Check blocked file extensions
        for (const ext of BLOCKED_EXTENSIONS) {
            if (pathname.endsWith(ext)) {
                return true
            }
        }

        return false
    } catch {
        // Invalid URL
        return true
    }
}

/**
 * Extract URLs from text
 * @param text - Input text to extract URLs from
 * @returns Array of unique, valid URLs
 */
export function extractUrls(text: string): string[] {
    if (!text || typeof text !== "string") {
        return []
    }

    const matches = text.match(URL_REGEX)
    if (!matches) {
        return []
    }

    // Remove duplicates and filter blocked URLs
    const uniqueUrls = [...new Set(matches)]
    const validUrls = uniqueUrls.filter((url) => !isBlockedUrl(url))

    return validUrls
}

/**
 * Check if text contains any URLs
 */
export function hasUrls(text: string): boolean {
    if (!text || typeof text !== "string") {
        return false
    }
    return URL_REGEX.test(text)
}

/**
 * Validate a single URL
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url)
        return !isBlockedUrl(url)
    } catch {
        return false
    }
}
