import { type NextRequest, NextResponse } from "next/server"
import { MAX_FILE_SIZE, storeFile } from "@/lib/file-storage"

export const maxDuration = 60

/**
 * File upload API endpoint
 * Accepts multipart/form-data with a single file
 * Returns fileId and metadata for reference in messages
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File | null

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 },
            )
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
                },
                { status: 400 },
            )
        }

        // Validate file type
        const mimeType = file.type
        if (!isValidFileType(mimeType)) {
            return NextResponse.json(
                {
                    error: "Invalid file type. Supported types: images, PDF, text files",
                },
                { status: 400 },
            )
        }

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Determine file type category
        const fileType = inferFileType(mimeType)

        // Generate summary for text-based files
        let summary: string | undefined
        if (fileType === "pdf" || fileType === "text") {
            summary = await generateFileSummary(buffer, mimeType, file.name)
        }

        // Store the file
        const metadata = await storeFile(buffer, file.name, mimeType)

        // Return file reference
        return NextResponse.json({
            fileId: metadata.fileId,
            fileName: metadata.fileName,
            fileType,
            mimeType: metadata.mimeType,
            size: metadata.size,
            summary,
            uploadedAt: metadata.uploadedAt,
        })
    } catch (error) {
        console.error("File upload error:", error)
        return NextResponse.json(
            { error: "Failed to upload file" },
            { status: 500 },
        )
    }
}

/**
 * Validate if the file type is supported
 */
function isValidFileType(mimeType: string): boolean {
    return (
        mimeType.startsWith("image/") ||
        mimeType === "application/pdf" ||
        mimeType.startsWith("text/") ||
        // Additional text-based types
        [
            "application/json",
            "application/xml",
            "application/javascript",
            "application/typescript",
        ].includes(mimeType)
    )
}

/**
 * Infer file type category from MIME type
 */
function inferFileType(mimeType: string): "image" | "pdf" | "text" {
    if (mimeType.startsWith("image/")) return "image"
    if (mimeType === "application/pdf") return "pdf"
    return "text"
}

/**
 * Generate a summary for text-based files (PDF, text)
 * For images, no summary is generated (will be processed by vision API)
 */
async function generateFileSummary(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
): Promise<string> {
    const MAX_SUMMARY_LENGTH = 500

    try {
        if (mimeType === "application/pdf") {
            // For PDFs, we can't extract text server-side easily
            // Return a placeholder summary
            return `PDF file: ${fileName} (${(buffer.length / 1024).toFixed(1)}KB)`
        }

        // For text files, extract the first N characters
        const text = buffer.toString("utf-8")
        if (text.length <= MAX_SUMMARY_LENGTH) {
            return text
        }

        return `${text.slice(0, MAX_SUMMARY_LENGTH)}... [${text.length} chars total]`
    } catch (error) {
        console.error("Failed to generate file summary:", error)
        return `File: ${fileName} (${(buffer.length / 1024).toFixed(1)}KB)`
    }
}
