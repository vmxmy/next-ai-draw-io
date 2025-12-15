import { PrismaClient } from "@prisma/client"
import { validateEncryptionKeys } from "./encryption"

const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient
}

// Create Prisma client with connection pooling and error handling
function createPrismaClient() {
    const client = new PrismaClient({
        log:
            process.env.NODE_ENV === "development"
                ? ["error", "warn"]
                : ["error"],
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
    })

    // Handle connection errors gracefully
    client.$connect().catch((err) => {
        console.error("[Prisma] Initial connection failed:", err)
    })

    return client
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db

// Validate encryption keys on server startup (skip during build)
if (process.env.NEXT_PHASE !== "phase-production-build") {
    validateEncryptionKeys()
}
