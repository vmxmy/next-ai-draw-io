import { PrismaClient } from "@prisma/client"
import { validateEncryptionKeys } from "./encryption"

const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient
}

// Create Prisma client with connection pooling and error handling
function createPrismaClient() {
    // Add connection pool parameters to DATABASE_URL if not present
    let dbUrl = process.env.DATABASE_URL
    if (dbUrl && !dbUrl.includes("connection_limit")) {
        const separator = dbUrl.includes("?") ? "&" : "?"
        // Set connection pool limits
        dbUrl = `${dbUrl}${separator}connection_limit=10&pool_timeout=10&connect_timeout=10`
    }

    const client = new PrismaClient({
        log:
            process.env.NODE_ENV === "development"
                ? ["error", "warn"]
                : ["error"],
        datasources: {
            db: {
                url: dbUrl,
            },
        },
    })

    // Handle connection errors gracefully with retry
    client
        .$connect()
        .then(() => {
            console.log("[Prisma] Database connected successfully")
        })
        .catch((err) => {
            console.error("[Prisma] Initial connection failed:", err)
            // Retry connection after delay
            setTimeout(() => {
                client
                    .$connect()
                    .then(() => {
                        console.log(
                            "[Prisma] Database reconnected successfully",
                        )
                    })
                    .catch((retryErr) => {
                        console.error(
                            "[Prisma] Connection retry failed:",
                            retryErr,
                        )
                    })
            }, 5000)
        })

    // Periodically check connection health
    if (process.env.NODE_ENV === "production") {
        setInterval(async () => {
            try {
                await client.$queryRaw`SELECT 1`
            } catch (err) {
                console.error("[Prisma] Health check failed:", err)
                // Attempt to reconnect
                client
                    .$connect()
                    .catch((reconnectErr) =>
                        console.error(
                            "[Prisma] Reconnection failed:",
                            reconnectErr,
                        ),
                    )
            }
        }, 60000) // Check every 60 seconds
    }

    return client
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db

// Validate encryption keys on server startup (skip during build)
if (process.env.NEXT_PHASE !== "phase-production-build") {
    validateEncryptionKeys()
}
