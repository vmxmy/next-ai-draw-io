import { PrismaClient } from "@prisma/client"
import { validateEncryptionKeys } from "./encryption"

const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient
}

export const db =
    globalForPrisma.prisma ??
    new PrismaClient({
        log:
            process.env.NODE_ENV === "development"
                ? ["error", "warn"]
                : ["error"],
    })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db

// Validate encryption keys on server startup (skip during build)
if (process.env.NEXT_PHASE !== "phase-production-build") {
    validateEncryptionKeys()
}
