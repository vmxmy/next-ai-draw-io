import { PrismaAdapter } from "@next-auth/prisma-adapter"
import type { NextAuthOptions } from "next-auth"
import NextAuth from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import { db } from "@/server/db"

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(db),
    providers: [
        GitHubProvider({
            clientId: process.env.GITHUB_ID ?? "",
            clientSecret: process.env.GITHUB_SECRET ?? "",
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

export const authHandler = NextAuth(authOptions)
