import { useSession } from "next-auth/react"
import { useCallback, useState } from "react"
import { api } from "@/lib/trpc/client"

export type ModelModeType = "fast" | "max"

export interface UserModeConfig {
    id: string
    mode: string
    provider?: string | null
    credentialName?: string | null
    modelId?: string | null
}

export interface UseUserModeConfigOptions {
    onConfigSaved?: () => void
}

/**
 * Hook for managing user mode config (Fast/Max mode settings)
 */
export function useUserModeConfig(options?: UseUserModeConfigOptions) {
    const { onConfigSaved } = options || {}
    const { data: session } = useSession()

    const [isSaving, setIsSaving] = useState(false)

    // Query all mode configs
    const {
        data: modeConfigs,
        isLoading,
        refetch,
    } = api.userModeConfig.list.useQuery(undefined, {
        enabled: !!session?.user,
    })

    // Mutations
    const upsertMutation = api.userModeConfig.upsert.useMutation({
        onSuccess: () => {
            void refetch()
            onConfigSaved?.()
        },
    })

    const updateAllMutation = api.userModeConfig.updateAll.useMutation({
        onSuccess: () => {
            void refetch()
            onConfigSaved?.()
        },
    })

    // Get config for a specific mode
    const getConfigForMode = useCallback(
        (mode: ModelModeType): UserModeConfig | undefined => {
            return modeConfigs?.find((c) => c.mode === mode)
        },
        [modeConfigs],
    )

    // Check if user has config for a mode
    const hasConfigForMode = useCallback(
        (mode: ModelModeType) => {
            const config = modeConfigs?.find((c) => c.mode === mode)
            return !!(config?.provider || config?.modelId)
        },
        [modeConfigs],
    )

    // Save config for a mode
    const saveModeConfig = useCallback(
        async (
            mode: ModelModeType,
            data: {
                provider?: string | null
                credentialName?: string | null
                modelId?: string | null
            },
        ) => {
            setIsSaving(true)
            try {
                await upsertMutation.mutateAsync({
                    mode,
                    provider: data.provider,
                    credentialName: data.credentialName,
                    modelId: data.modelId,
                })
            } finally {
                setIsSaving(false)
            }
        },
        [upsertMutation],
    )

    // Save both mode configs at once
    const saveAllModeConfigs = useCallback(
        async (configs: {
            fast?: {
                provider?: string | null
                credentialName?: string | null
                modelId?: string | null
            }
            max?: {
                provider?: string | null
                credentialName?: string | null
                modelId?: string | null
            }
        }) => {
            setIsSaving(true)
            try {
                await updateAllMutation.mutateAsync(configs)
            } finally {
                setIsSaving(false)
            }
        },
        [updateAllMutation],
    )

    // Check if user has any BYOK config (for aiMode toggle)
    const hasByokConfig = useCallback(() => {
        if (!modeConfigs) return false
        return modeConfigs.some((c) => c.provider || c.modelId)
    }, [modeConfigs])

    return {
        // State
        modeConfigs: modeConfigs || [],
        isLoading,
        isSaving,
        isLoggedIn: !!session?.user,

        // Computed
        fastConfig: getConfigForMode("fast"),
        maxConfig: getConfigForMode("max"),

        // Actions
        saveModeConfig,
        saveAllModeConfigs,
        refetch,

        // Helpers
        getConfigForMode,
        hasConfigForMode,
        hasByokConfig,
    }
}
