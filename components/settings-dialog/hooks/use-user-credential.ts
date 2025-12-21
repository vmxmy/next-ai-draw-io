import { useSession } from "next-auth/react"
import { useCallback, useState } from "react"
import { api } from "@/lib/trpc/client"

export interface UserCredential {
    id: string
    provider: string
    name: string
    baseUrl?: string | null
    hasCredentials: boolean
    isDefault: boolean
    isDisabled: boolean
}

export interface UseUserCredentialOptions {
    onCredentialSaved?: () => void
    onCredentialDeleted?: () => void
}

/**
 * Hook for managing user credentials (API keys per provider)
 */
export function useUserCredential(options?: UseUserCredentialOptions) {
    const { onCredentialSaved, onCredentialDeleted } = options || {}
    const { data: session } = useSession()
    const _utils = api.useUtils()

    const [isSaving, setIsSaving] = useState(false)

    // Query all credentials
    const {
        data: credentials,
        isLoading,
        refetch,
    } = api.userCredential.list.useQuery(undefined, {
        enabled: !!session?.user,
    })

    // Mutations
    const upsertMutation = api.userCredential.upsert.useMutation({
        onSuccess: () => {
            void refetch()
            onCredentialSaved?.()
        },
    })

    const deleteMutation = api.userCredential.delete.useMutation({
        onSuccess: () => {
            void refetch()
            onCredentialDeleted?.()
        },
    })

    const setDefaultMutation = api.userCredential.setDefault.useMutation({
        onSuccess: () => {
            void refetch()
        },
    })

    // Get credentials for a specific provider
    const getCredentialsForProvider = useCallback(
        (provider: string) => {
            return credentials?.filter((c) => c.provider === provider) || []
        },
        [credentials],
    )

    // Check if user has any credentials for a provider
    const hasCredentialForProvider = useCallback(
        (provider: string) => {
            return (
                credentials?.some(
                    (c) => c.provider === provider && c.hasCredentials,
                ) || false
            )
        },
        [credentials],
    )

    // Save credential
    const saveCredential = useCallback(
        async (data: {
            provider: string
            name?: string
            apiKey?: string
            baseUrl?: string
            isDefault?: boolean
        }) => {
            setIsSaving(true)
            try {
                await upsertMutation.mutateAsync({
                    provider: data.provider,
                    name: data.name || "default",
                    apiKey: data.apiKey,
                    baseUrl: data.baseUrl,
                    isDefault: data.isDefault ?? false,
                })
            } finally {
                setIsSaving(false)
            }
        },
        [upsertMutation],
    )

    // Delete credential
    const deleteCredential = useCallback(
        async (provider: string, name: string) => {
            await deleteMutation.mutateAsync({ provider, name })
        },
        [deleteMutation],
    )

    // Set default credential
    const setDefaultCredential = useCallback(
        async (provider: string, name: string) => {
            await setDefaultMutation.mutateAsync({ provider, name })
        },
        [setDefaultMutation],
    )

    return {
        // State
        credentials: credentials || [],
        isLoading,
        isSaving,
        isDeleting: deleteMutation.isPending,
        isLoggedIn: !!session?.user,

        // Actions
        saveCredential,
        deleteCredential,
        setDefaultCredential,
        refetch,

        // Helpers
        getCredentialsForProvider,
        hasCredentialForProvider,
    }
}
