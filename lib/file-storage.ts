import crypto from "crypto"
import { promises as fs } from "fs"
import { join } from "path"

/**
 * Base directory for temporary file storage
 */
const TEMP_DIR = "/tmp/next-ai-drawio-files"

/**
 * File retention period in milliseconds (7 days)
 */
const FILE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Maximum file size for storage (20MB)
 */
export const MAX_FILE_SIZE = 20 * 1024 * 1024

interface FileMetadata {
    fileId: string
    fileName: string
    mimeType: string
    size: number
    uploadedAt: number
}

/**
 * Initialize the temporary file storage directory
 */
export async function initFileStorage(): Promise<void> {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true })
    } catch (error) {
        console.error("Failed to create temp directory:", error)
    }
}

/**
 * Generate a unique file ID
 */
export function generateFileId(): string {
    const timestamp = Date.now()
    const random = crypto.randomBytes(8).toString("hex")
    return `file-${timestamp}-${random}`
}

/**
 * Store a file in the temporary directory
 * Returns the file ID and metadata
 */
export async function storeFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
): Promise<FileMetadata> {
    await initFileStorage()

    const fileId = generateFileId()
    const filePath = join(TEMP_DIR, fileId)
    const metadataPath = join(TEMP_DIR, `${fileId}.meta.json`)

    const metadata: FileMetadata = {
        fileId,
        fileName,
        mimeType,
        size: buffer.length,
        uploadedAt: Date.now(),
    }

    // Store the file
    await fs.writeFile(filePath, buffer)

    // Store metadata
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))

    return metadata
}

/**
 * Retrieve a file from storage
 * Returns the file buffer and metadata, or null if not found
 */
export async function retrieveFile(
    fileId: string,
): Promise<{ buffer: Buffer; metadata: FileMetadata } | null> {
    const filePath = join(TEMP_DIR, fileId)
    const metadataPath = join(TEMP_DIR, `${fileId}.meta.json`)

    try {
        const [buffer, metadataJson] = await Promise.all([
            fs.readFile(filePath),
            fs.readFile(metadataPath, "utf-8"),
        ])

        const metadata = JSON.parse(metadataJson) as FileMetadata

        return { buffer, metadata }
    } catch (error) {
        console.error(`Failed to retrieve file ${fileId}:`, error)
        return null
    }
}

/**
 * Delete a file and its metadata
 */
export async function deleteFile(fileId: string): Promise<void> {
    const filePath = join(TEMP_DIR, fileId)
    const metadataPath = join(TEMP_DIR, `${fileId}.meta.json`)

    try {
        await Promise.all([
            fs.unlink(filePath).catch(() => {}),
            fs.unlink(metadataPath).catch(() => {}),
        ])
    } catch (error) {
        console.error(`Failed to delete file ${fileId}:`, error)
    }
}

/**
 * Clean up old files that exceed the retention period
 * Should be called periodically (e.g., via cron job or on server startup)
 */
export async function cleanupOldFiles(): Promise<{
    deleted: number
    errors: number
}> {
    await initFileStorage()

    let deleted = 0
    let errors = 0

    try {
        const files = await fs.readdir(TEMP_DIR)
        const metaFiles = files.filter((f) => f.endsWith(".meta.json"))

        const now = Date.now()

        for (const metaFile of metaFiles) {
            try {
                const metadataPath = join(TEMP_DIR, metaFile)
                const metadataJson = await fs.readFile(metadataPath, "utf-8")
                const metadata = JSON.parse(metadataJson) as FileMetadata

                // Check if file is old enough to delete
                if (now - metadata.uploadedAt > FILE_RETENTION_MS) {
                    await deleteFile(metadata.fileId)
                    deleted++
                }
            } catch (error) {
                console.error(`Error processing ${metaFile}:`, error)
                errors++
            }
        }
    } catch (error) {
        console.error("Failed to cleanup old files:", error)
        errors++
    }

    return { deleted, errors }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
    totalFiles: number
    totalSize: number
}> {
    await initFileStorage()

    let totalFiles = 0
    let totalSize = 0

    try {
        const files = await fs.readdir(TEMP_DIR)
        const metaFiles = files.filter((f) => f.endsWith(".meta.json"))

        totalFiles = metaFiles.length

        for (const metaFile of metaFiles) {
            try {
                const metadataPath = join(TEMP_DIR, metaFile)
                const metadataJson = await fs.readFile(metadataPath, "utf-8")
                const metadata = JSON.parse(metadataJson) as FileMetadata
                totalSize += metadata.size
            } catch (error) {
                // Skip invalid metadata files
            }
        }
    } catch (error) {
        console.error("Failed to get storage stats:", error)
    }

    return { totalFiles, totalSize }
}
