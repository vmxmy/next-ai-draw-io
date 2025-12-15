/**
 * Database retry utility for handling transient connection errors
 */

type DbOperation<T> = () => Promise<T>

interface RetryOptions {
    maxRetries?: number
    baseDelayMs?: number
    onRetry?: (attempt: number, error: unknown) => void
}

/**
 * Retry a database operation on connection errors
 * Implements exponential backoff for transient failures
 */
export async function withDbRetry<T>(
    operation: DbOperation<T>,
    options: RetryOptions = {},
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelayMs = 100,
        onRetry = (attempt, error) => {
            console.warn(
                `[DB Retry] Attempt ${attempt}/${maxRetries} failed:`,
                error instanceof Error ? error.message : String(error),
            )
        },
    } = options

    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error: unknown) {
            lastError = error

            // Check if this is a retryable connection error
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            const isConnectionError =
                errorMessage.includes("Connection") ||
                errorMessage.includes("Closed") ||
                errorMessage.includes("timeout") ||
                errorMessage.includes("ECONNRESET") ||
                errorMessage.includes("ENOTFOUND") ||
                errorMessage.includes("ETIMEDOUT") ||
                errorMessage.includes("Socket") ||
                errorMessage.includes("Can't reach database server")

            // Don't retry non-connection errors
            if (!isConnectionError) {
                throw error
            }

            // Don't retry if we've exhausted attempts
            if (attempt >= maxRetries) {
                console.error(`[DB Retry] Max retries (${maxRetries}) exceeded`)
                throw error
            }

            // Notify about retry
            onRetry(attempt + 1, error)

            // Exponential backoff with jitter
            const delay = baseDelayMs * 2 ** attempt
            const jitter = Math.random() * 0.3 * delay // 0-30% jitter
            await new Promise((resolve) => setTimeout(resolve, delay + jitter))
        }
    }

    throw lastError
}

/**
 * Check if an error is a database connection error
 */
export function isConnectionError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return (
        errorMessage.includes("Connection") ||
        errorMessage.includes("Closed") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("Socket")
    )
}
