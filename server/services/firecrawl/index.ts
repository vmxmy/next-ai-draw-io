/**
 * Firecrawl service for web scraping
 * Wraps the Firecrawl SDK with error handling and content processing
 */

import Firecrawl from "@mendable/firecrawl-js"

// Maximum content length to avoid token explosion
const MAX_CONTENT_LENGTH = 10000

// Timeout for scraping requests (ms)
const SCRAPE_TIMEOUT = 15000

export interface ScrapeResult {
    url: string
    success: boolean
    title?: string
    content?: string
    error?: string
}

/**
 * Check if Firecrawl is configured
 */
export function isFirecrawlConfigured(): boolean {
    return Boolean(process.env.FIRECRAWL_API_KEY)
}

/**
 * Get Firecrawl client instance
 */
function getClient(): Firecrawl {
    const apiKey = process.env.FIRECRAWL_API_KEY
    if (!apiKey) {
        throw new Error("FIRECRAWL_API_KEY is not configured")
    }
    return new Firecrawl({ apiKey })
}

/**
 * Truncate content to maximum length
 */
function truncateContent(
    content: string,
    maxLength: number = MAX_CONTENT_LENGTH,
): string {
    if (content.length <= maxLength) {
        return content
    }
    return content.slice(0, maxLength) + "\n\n[内容已截断...]"
}

/**
 * Scrape a single URL
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
    if (!isFirecrawlConfigured()) {
        return {
            url,
            success: false,
            error: "Firecrawl 未配置",
        }
    }

    try {
        const client = getClient()

        const response = await client.scrape(url, {
            formats: ["markdown"],
            onlyMainContent: true,
            timeout: SCRAPE_TIMEOUT,
        })

        const title = response.metadata?.title || ""
        const content = response.markdown || ""

        return {
            url,
            success: true,
            title,
            content: truncateContent(content),
        }
    } catch (error) {
        console.error(`[Firecrawl] Error scraping ${url}:`, error)
        return {
            url,
            success: false,
            error: error instanceof Error ? error.message : "未知错误",
        }
    }
}

/**
 * Scrape multiple URLs in parallel
 */
export async function scrapeUrls(urls: string[]): Promise<ScrapeResult[]> {
    if (!isFirecrawlConfigured()) {
        return urls.map((url) => ({
            url,
            success: false,
            error: "Firecrawl 未配置",
        }))
    }

    if (urls.length === 0) {
        return []
    }

    // Limit concurrent requests
    const maxConcurrent = 3
    const results: ScrapeResult[] = []

    for (let i = 0; i < urls.length; i += maxConcurrent) {
        const batch = urls.slice(i, i + maxConcurrent)
        const batchResults = await Promise.all(
            batch.map((url) => scrapeUrl(url)),
        )
        results.push(...batchResults)
    }

    return results
}

/**
 * Format scrape result for injection into message
 */
export function formatScrapeResult(result: ScrapeResult): string {
    if (result.success) {
        const titlePart = result.title ? `标题: ${result.title}\n` : ""
        return `---
[网页内容: ${result.url}]
${titlePart}内容:
${result.content}
---`
    } else {
        return `---
[网页抓取失败: ${result.url}]
错误: ${result.error}
---`
    }
}

/**
 * Format multiple scrape results
 */
export function formatScrapeResults(results: ScrapeResult[]): string {
    if (results.length === 0) {
        return ""
    }
    return results.map(formatScrapeResult).join("\n\n")
}
