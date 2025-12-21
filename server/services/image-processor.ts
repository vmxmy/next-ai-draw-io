/**
 * Image Processor
 * Resizes images to optimize token usage for vision models
 *
 * Vision models (Claude, GPT-4V, Gemini) calculate tokens based on image dimensions,
 * not file size. Reducing dimensions significantly reduces token consumption.
 */

import sharp from "sharp"

// Maximum dimension (width or height) for images
// 1568 is Claude's recommended max for optimal quality/cost balance
const MAX_DIMENSION = 1568

// Supported image MIME types
const SUPPORTED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
])

export interface ProcessedImage {
    dataUrl: string
    originalWidth: number
    originalHeight: number
    newWidth: number
    newHeight: number
    wasResized: boolean
}

/**
 * Extract MIME type and base64 data from a data URL
 */
function parseDataUrl(
    dataUrl: string,
): { mimeType: string; base64: string } | null {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
        return null
    }
    return {
        mimeType: match[1],
        base64: match[2],
    }
}

/**
 * Check if an image needs resizing based on dimensions
 */
function needsResize(width: number, height: number): boolean {
    return width > MAX_DIMENSION || height > MAX_DIMENSION
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateNewDimensions(
    width: number,
    height: number,
): { width: number; height: number } {
    if (!needsResize(width, height)) {
        return { width, height }
    }

    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
    return {
        width: Math.round(width * ratio),
        height: Math.round(height * ratio),
    }
}

/**
 * Process a single image data URL - resize if needed
 */
export async function processImage(dataUrl: string): Promise<ProcessedImage> {
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) {
        throw new Error("Invalid data URL format")
    }

    const { mimeType, base64 } = parsed

    // Skip unsupported types
    if (!SUPPORTED_TYPES.has(mimeType)) {
        throw new Error(`Unsupported image type: ${mimeType}`)
    }

    const buffer = Buffer.from(base64, "base64")
    const image = sharp(buffer)
    const metadata = await image.metadata()

    const originalWidth = metadata.width || 0
    const originalHeight = metadata.height || 0

    // Check if resize is needed
    if (!needsResize(originalWidth, originalHeight)) {
        return {
            dataUrl,
            originalWidth,
            originalHeight,
            newWidth: originalWidth,
            newHeight: originalHeight,
            wasResized: false,
        }
    }

    // Calculate new dimensions
    const { width: newWidth, height: newHeight } = calculateNewDimensions(
        originalWidth,
        originalHeight,
    )

    // Resize and convert to JPEG for better compression (unless it's PNG with transparency)
    let outputBuffer: Buffer
    let outputMimeType: string

    if (mimeType === "image/png") {
        // Keep PNG format to preserve transparency
        outputBuffer = await image
            .resize(newWidth, newHeight, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .png({ quality: 85 })
            .toBuffer()
        outputMimeType = "image/png"
    } else {
        // Convert to JPEG for better compression
        outputBuffer = await image
            .resize(newWidth, newHeight, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .jpeg({ quality: 85 })
            .toBuffer()
        outputMimeType = "image/jpeg"
    }

    const newBase64 = outputBuffer.toString("base64")
    const newDataUrl = `data:${outputMimeType};base64,${newBase64}`

    return {
        dataUrl: newDataUrl,
        originalWidth,
        originalHeight,
        newWidth,
        newHeight,
        wasResized: true,
    }
}

/**
 * Process file parts in a message, resizing images as needed
 */
export async function processMessageImages(
    parts: any[],
): Promise<{ parts: any[]; imagesProcessed: number; tokensSaved: number }> {
    let imagesProcessed = 0
    let tokensSaved = 0

    const processedParts = await Promise.all(
        parts.map(async (part) => {
            if (part.type !== "file" || !part.url?.startsWith("data:image/")) {
                return part
            }

            try {
                const result = await processImage(part.url)
                if (result.wasResized) {
                    imagesProcessed++
                    // Rough token estimation: ~1 token per 32 pixels for Claude
                    const originalTokens = Math.ceil(
                        (result.originalWidth * result.originalHeight) / 32,
                    )
                    const newTokens = Math.ceil(
                        (result.newWidth * result.newHeight) / 32,
                    )
                    tokensSaved += originalTokens - newTokens

                    console.log(
                        `[ImageProcessor] Resized ${result.originalWidth}x${result.originalHeight} → ${result.newWidth}x${result.newHeight} (~${originalTokens - newTokens} tokens saved)`,
                    )

                    return { ...part, url: result.dataUrl }
                }
                return part
            } catch (error) {
                console.warn(
                    "[ImageProcessor] Failed to process image:",
                    error instanceof Error ? error.message : error,
                )
                return part // Return original on error
            }
        }),
    )

    return { parts: processedParts, imagesProcessed, tokensSaved }
}

/**
 * Check if image processing is available
 */
export function isImageProcessingAvailable(): boolean {
    return true // sharp is always available when installed
}
