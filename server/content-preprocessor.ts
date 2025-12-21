/**
 * Content Preprocessor
 * Preprocesses user messages before sending to AI
 * Currently supports: URL extraction and web scraping
 */

import { extractUrls, hasUrls } from "@/lib/url-extractor"
import {
    formatScrapeResults,
    isFirecrawlConfigured,
    scrapeUrls,
} from "@/server/services/firecrawl"

export interface PreprocessResult {
    processedMessage: string
    urlsFound: string[]
    urlsScraped: number
    processingTime: number
}

/**
 * Preprocess a user message
 * - Detects URLs in the message
 * - Scrapes web content using Firecrawl
 * - Appends scraped content to the message
 */
export async function preprocessUserMessage(
    message: string,
): Promise<PreprocessResult> {
    const startTime = Date.now()

    // Quick check if there are any URLs
    if (!hasUrls(message)) {
        return {
            processedMessage: message,
            urlsFound: [],
            urlsScraped: 0,
            processingTime: Date.now() - startTime,
        }
    }

    // Extract URLs from message
    const urls = extractUrls(message)

    if (urls.length === 0) {
        return {
            processedMessage: message,
            urlsFound: [],
            urlsScraped: 0,
            processingTime: Date.now() - startTime,
        }
    }

    console.log(`[ContentPreprocessor] Found ${urls.length} URLs:`, urls)

    // Check if Firecrawl is configured
    if (!isFirecrawlConfigured()) {
        console.log(
            "[ContentPreprocessor] Firecrawl not configured, skipping URL scraping",
        )
        return {
            processedMessage: message,
            urlsFound: urls,
            urlsScraped: 0,
            processingTime: Date.now() - startTime,
        }
    }

    // Scrape URLs
    const scrapeResults = await scrapeUrls(urls)
    const successCount = scrapeResults.filter((r) => r.success).length

    console.log(
        `[ContentPreprocessor] Scraped ${successCount}/${urls.length} URLs successfully`,
    )

    // Format and append results to message
    const formattedResults = formatScrapeResults(scrapeResults)

    const processedMessage = formattedResults
        ? `${message}\n\n${formattedResults}`
        : message

    return {
        processedMessage,
        urlsFound: urls,
        urlsScraped: successCount,
        processingTime: Date.now() - startTime,
    }
}

/**
 * Check if preprocessing is available
 */
export function isPreprocessingAvailable(): boolean {
    return isFirecrawlConfigured()
}
