import { api } from "@/lib/trpc/client"

export interface ProviderCatalogItem {
    key: string
    displayName: string
    defaultBaseUrl: string | null
    suggestedModels: unknown
}

export function useProviderCatalog() {
    const { data, isLoading } = api.providerCatalog.list.useQuery()

    const providerOptions =
        data?.map((p) => ({
            value: p.key,
            label: p.displayName,
        })) || []

    const getProviderDefaultBaseUrl = (providerKey: string): string => {
        const provider = data?.find((p) => p.key === providerKey)
        return provider?.defaultBaseUrl || ""
    }

    const getProviderSuggestedModels = (
        providerKey: string,
    ): Array<{ id: string; label?: string }> => {
        const provider = data?.find((p) => p.key === providerKey)
        if (!provider?.suggestedModels) return []
        const models = provider.suggestedModels as unknown
        if (!Array.isArray(models)) return []
        return models
            .filter(
                (m): m is { id: string; label?: string } =>
                    typeof m === "object" &&
                    m !== null &&
                    typeof (m as { id?: unknown }).id === "string",
            )
            .map((m) => ({ id: m.id, label: m.label }))
    }

    // 动态生成 placeholder
    const getModelPlaceholder = (providerKey: string): string => {
        const models = getProviderSuggestedModels(providerKey)
        if (models.length > 0) {
            return `e.g., ${models[0].id}`
        }
        return ""
    }

    const getBaseUrlPlaceholder = (providerKey: string): string => {
        const baseUrl = getProviderDefaultBaseUrl(providerKey)
        return baseUrl || ""
    }

    return {
        providers: data || [],
        providerOptions,
        isLoading,
        getProviderDefaultBaseUrl,
        getProviderSuggestedModels,
        getModelPlaceholder,
        getBaseUrlPlaceholder,
    }
}
