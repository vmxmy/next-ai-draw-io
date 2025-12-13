import { PrismaAdapter } from "@next-auth/prisma-adapter"
import type { NextAuthOptions } from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import { db } from "@/server/db"

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`[auth] Missing required environment variable: ${name}`)
    }
    return value
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(db),
    debug:
        process.env.NEXTAUTH_DEBUG === "true" ||
        process.env.NODE_ENV === "development",
    logger: {
        error(code, metadata) {
            console.error("[next-auth][error]", code, metadata)
        },
        warn(code) {
            console.warn("[next-auth][warn]", code)
        },
        debug(code, metadata) {
            if (process.env.NEXTAUTH_DEBUG === "true") {
                console.debug("[next-auth][debug]", code, metadata)
            }
        },
    },
    providers: [
        GitHubProvider({
            clientId: requireEnv("GITHUB_ID"),
            clientSecret: requireEnv("GITHUB_SECRET"),
        }),
    ],
    callbacks: {
        session: ({ session, user }) => {
            if (session.user) {
                session.user.id = user.id
            }
            return session
        },
    },
}
