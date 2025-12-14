import type { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            phone?: string | null
        } & DefaultSession["user"]
    }

    interface User {
        phone?: string | null
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string
        phone?: string | null
    }
}
