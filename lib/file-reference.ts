import type { ChatMessage } from "@/features/chat/ai/types"
import { retrieveFile } from "@/lib/file-storage"

/**
 * Expand file references in messages
 * - For the last message: load full file content (images as data URLs)
 * - For historical messages: keep only fileId and summary (save tokens)
 */
export async function expandFileReferences(
    messages: ChatMessage[],
): Promise<ChatMessage[]> {
    if (messages.length === 0) return messages

    const result = [...messages]

    // Process all messages
    for (let i = 0; i < result.length; i++) {
        const msg = result[i]
        if (!msg.parts || !Array.isArray(msg.parts)) continue

        // Check if this is the last message (needs full expansion)
        const isLastMessage = i === result.length - 1

        const expandedParts = await Promise.all(
            msg.parts.map(async (part: any) => {
                // Skip non-file parts
                if (part.type !== "file") return part

                // If part already has url (data URL), keep it (backward compatibility)
                if (part.url) return part

                // If part has no fileId, keep it as is
                if (!part.fileId) return part

                // For last message: expand to full content
                if (isLastMessage) {
                    return await expandFileReference(part)
                }

                // For historical messages: keep compressed reference
                return {
                    type: "file",
                    fileId: part.fileId,
                    fileName: part.fileName,
                    fileType: part.fileType,
                    summary:
                        part.summary || "[File content available on request]",
                }
            }),
        )

        result[i] = { ...msg, parts: expandedParts }
    }

    return result
}

/**
 * Expand a single file reference to full content
 */
async function expandFileReference(part: any): Promise<any> {
    const { fileId, fileName, fileType } = part

    if (!fileId) return part

    // Retrieve file from storage
    const fileData = await retrieveFile(fileId)

    if (!fileData) {
        // File not found (may have been cleaned up)
        return {
            type: "file",
            fileId,
            fileName,
            summary: "[File expired or not found]",
            error: true,
        }
    }

    const { buffer, metadata } = fileData

    // For images: convert to data URL
    if (metadata.mimeType.startsWith("image/")) {
        const base64 = buffer.toString("base64")
        const dataUrl = `data:${metadata.mimeType};base64,${base64}`

        return {
            type: "file",
            url: dataUrl,
            mediaType: metadata.mimeType,
            // Keep metadata for reference
            fileId,
            fileName: metadata.fileName,
            fileType: "image",
        }
    }

    // For text files: convert to text
    if (fileType === "text" || metadata.mimeType.startsWith("text/")) {
        const text = buffer.toString("utf-8")

        return {
            type: "file",
            text,
            mediaType: metadata.mimeType,
            // Keep metadata for reference
            fileId,
            fileName: metadata.fileName,
            fileType: "text",
        }
    }

    // For PDFs: return buffer as base64 (if vision API supports it)
    // Or keep as reference with summary
    if (metadata.mimeType === "application/pdf") {
        // Currently, most vision APIs don't support PDF directly
        // Keep as reference with summary
        return {
            type: "file",
            fileId,
            fileName: metadata.fileName,
            fileType: "pdf",
            summary:
                part.summary ||
                `PDF file: ${metadata.fileName} (${(metadata.size / 1024).toFixed(1)}KB)`,
        }
    }

    // Fallback: keep as reference
    return part
}

/**
 * Remove file content from parts, keeping only references
 * Useful for compressing messages before storage
 */
export function compressFileReferences(parts: any[]): any[] {
    return parts.map((part: any) => {
        if (part.type !== "file") return part

        // If already a reference (has fileId), keep it
        if (part.fileId) {
            return {
                type: "file",
                fileId: part.fileId,
                fileName: part.fileName,
                fileType: part.fileType,
                summary: part.summary,
            }
        }

        // If has data URL but no fileId (old format), keep as is for backward compatibility
        return part
    })
}
