"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import {
    STORAGE_AI_API_KEY_KEY,
    STORAGE_AI_BASE_URL_KEY,
    STORAGE_AI_MODEL_KEY,
    STORAGE_AI_PROVIDER_KEY,
} from "@/components/settings-dialog"
import { api } from "@/lib/trpc/client"

const MIGRATION_FLAG_KEY = "next-ai-draw-io-provider-migrated"

/**
 * One-time migration hook to sync existing localStorage provider config to cloud
 * Runs automatically when user logs in for the first time
 */
export function useProviderMigration() {
    const { data: session } = useSession()
    const [isMigrated, setIsMigrated] = useState(false)
    const upsertMutation = api.providerConfig.upsert.useMutation()

    useEffect(() => {
        // Only run if user is logged in and migration hasn't been completed
        if (!session?.user || isMigrated) return

        const migrationFlag = localStorage.getItem(MIGRATION_FLAG_KEY)
        if (migrationFlag === "true") {
            setIsMigrated(true)
            return
        }

        // Read local config
        const localProvider = localStorage.getItem(STORAGE_AI_PROVIDER_KEY)
        const localApiKey = localStorage.getItem(STORAGE_AI_API_KEY_KEY)
        const localBaseUrl = localStorage.getItem(STORAGE_AI_BASE_URL_KEY)
        const localModelId = localStorage.getItem(STORAGE_AI_MODEL_KEY)

        // Only migrate if there's a provider and API key configured
        if (localProvider && localApiKey) {
            upsertMutation.mutate(
                {
                    provider: localProvider as any,
                    apiKey: localApiKey,
                    baseUrl: localBaseUrl || undefined,
                    modelId: localModelId || undefined,
                },
                {
                    onSuccess: () => {
                        console.log(
                            "[migration] Provider config migrated to cloud",
                        )
                        localStorage.setItem(MIGRATION_FLAG_KEY, "true")
                        setIsMigrated(true)
                    },
                    onError: (error) => {
                        console.error("[migration] Failed to migrate:", error)
                        // Don't set flag on error - will retry on next login
                    },
                },
            )
        } else {
            // Nothing to migrate
            localStorage.setItem(MIGRATION_FLAG_KEY, "true")
            setIsMigrated(true)
        }
    }, [session, isMigrated, upsertMutation])

    return { isMigrated }
}
