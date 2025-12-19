"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/trpc/client"
import { usePermission } from "@/lib/use-permissions"
import {
    CredentialsTab,
    ProviderCatalogTab,
    SystemDefaultsTab,
} from "./components"

interface ModelOption {
    id: string
    label?: string
}

interface ProviderCatalogForm {
    key: string
    displayName: string
    compatibility: string
    authType: string
    defaultBaseUrl: string
    defaultModelId: string
    defaultHeaders: string
    defaultParams: string
    isBuiltin: boolean
    isActive: boolean
}

export default function SystemConfigPage() {
    const hasReadPermission = usePermission("system:read")
    const hasWritePermission = usePermission("system:write")

    // 模型选择相关状态
    const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
    const [modelSearchValue, setModelSearchValue] = useState("")

    // Base URL 本地编辑状态
    const [baseUrlInput, setBaseUrlInput] = useState<string>("")

    // Provider 目录配置
    const [editingProviderKey, setEditingProviderKey] = useState<string | null>(
        null,
    )
    const [providerForm, setProviderForm] = useState<ProviderCatalogForm>({
        key: "",
        displayName: "",
        compatibility: "openai_compat",
        authType: "apiKey",
        defaultBaseUrl: "",
        defaultModelId: "",
        defaultHeaders: "",
        defaultParams: "",
        isBuiltin: false,
        isActive: true,
    })

    // 获取 AI 类别的配置
    const { data: configs, refetch } = api.systemConfig.adminList.useQuery(
        { category: "ai" },
        {
            enabled: hasReadPermission,
        },
    )

    const {
        data: providerCatalogs,
        refetch: refetchCatalogs,
        isLoading: isLoadingCatalogs,
    } = api.providerCatalog.adminList.useQuery(undefined, {
        enabled: hasReadPermission,
    })

    // 获取动态选项（兼容模式、鉴权方式）
    const { data: catalogOptions } = api.providerCatalog.getOptions.useQuery(
        undefined,
        {
            enabled: hasReadPermission,
        },
    )

    // 更新配置
    const updateMutation = api.systemConfig.adminUpdate.useMutation({
        onSuccess: () => {
            toast.success("配置已更新")
            void refetch()
        },
        onError: (error) => {
            toast.error(`更新失败：${error.message}`)
        },
    })

    const providerCatalogMutation = api.providerCatalog.adminUpsert.useMutation(
        {
            onSuccess: () => {
                toast.success("Provider 配置已更新")
                void refetchCatalogs()
                setEditingProviderKey(null)
            },
            onError: (error) => {
                toast.error(`更新失败：${error.message}`)
            },
        },
    )

    // 获取当前 provider 和 API key（用于加载模型）
    const currentProvider =
        configs?.find((c) => c.key === "ai.default.provider")?.value ||
        "openrouter"
    const currentApiKey =
        configs?.find((c) => c.key === `ai.${currentProvider}.apiKey`)?.value ||
        ""
    const currentBaseUrl =
        configs?.find((c) => c.key === `ai.${currentProvider}.baseUrl`)
            ?.value || ""
    const currentModel =
        configs?.find((c) => c.key === "ai.default.model")?.value || ""

    // Provider 选项完全从数据库获取，不再使用硬编码 fallback
    const providerOptions =
        providerCatalogs
            ?.filter((provider) => provider.isActive)
            .map((provider) => ({
                value: provider.key,
                label: provider.displayName,
            })) || []

    const currentProviderCatalog = providerCatalogs?.find(
        (provider) => provider.key === currentProvider,
    )

    // 同步 base URL 到本地状态
    useEffect(() => {
        setBaseUrlInput(String(currentBaseUrl))
    }, [currentBaseUrl])

    // 自动加载模型列表
    useEffect(() => {
        if (!currentProvider) {
            setModelOptions([])
            return
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => {
            setIsLoadingModels(true)
            fetch("/api/models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: currentProvider,
                    apiKey: currentApiKey,
                    baseUrl: currentBaseUrl,
                }),
                signal: controller.signal,
            })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    return res.json()
                })
                .then((data) => {
                    const models = Array.isArray(data?.models)
                        ? data.models
                        : []
                    setModelOptions(models)
                })
                .catch(() => {
                    setModelOptions([])
                })
                .finally(() => {
                    setIsLoadingModels(false)
                })
        }, 250)

        return () => {
            clearTimeout(timeout)
            controller.abort()
        }
    }, [currentProvider, currentApiKey, currentBaseUrl])

    // 权限检查
    if (!hasReadPermission) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-destructive">403</h1>
                    <p className="mt-2 text-lg">访问被拒绝</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        您没有权限访问此页面
                    </p>
                </div>
            </div>
        )
    }

    const handleQuickUpdate = (key: string, value: string) => {
        updateMutation.mutate({ key, value, category: "ai" })
    }

    const handleProviderSave = () => {
        const key = providerForm.key.trim()
        if (!key || !providerForm.displayName.trim()) {
            toast.error("请填写 Provider Key 和显示名称")
            return
        }

        let defaultHeaders: Record<string, unknown> | undefined
        let defaultParams: Record<string, unknown> | undefined

        if (providerForm.defaultHeaders.trim()) {
            try {
                defaultHeaders = JSON.parse(providerForm.defaultHeaders)
            } catch {
                toast.error("Default Headers 不是有效的 JSON")
                return
            }
        }

        if (providerForm.defaultParams.trim()) {
            try {
                defaultParams = JSON.parse(providerForm.defaultParams)
            } catch {
                toast.error("Default Params 不是有效的 JSON")
                return
            }
        }

        providerCatalogMutation.mutate({
            key,
            displayName: providerForm.displayName.trim(),
            compatibility: providerForm.compatibility,
            authType: providerForm.authType,
            defaultBaseUrl: providerForm.defaultBaseUrl.trim() || "",
            defaultModelId: providerForm.defaultModelId.trim() || "",
            defaultHeaders,
            defaultParams,
            isBuiltin: providerForm.isBuiltin,
            isActive: providerForm.isActive,
        })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold">系统配置管理</h1>
                <p className="text-muted-foreground mt-2">
                    管理 AI 模型、API 密钥等系统级配置，更改将立即生效（带 1
                    分钟缓存）
                </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="provider" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="provider">Provider 目录</TabsTrigger>
                    <TabsTrigger value="credentials">连接凭证</TabsTrigger>
                    <TabsTrigger value="defaults">系统默认</TabsTrigger>
                </TabsList>

                <TabsContent value="provider" className="mt-6">
                    <ProviderCatalogTab
                        providerCatalogs={providerCatalogs}
                        isLoadingCatalogs={isLoadingCatalogs}
                        providerForm={providerForm}
                        setProviderForm={setProviderForm}
                        editingProviderKey={editingProviderKey}
                        setEditingProviderKey={setEditingProviderKey}
                        hasWritePermission={hasWritePermission}
                        onProviderSave={handleProviderSave}
                        isPending={providerCatalogMutation.isPending}
                        compatibilityOptions={
                            catalogOptions?.compatibilityOptions || []
                        }
                        authTypeOptions={catalogOptions?.authTypeOptions || []}
                    />
                </TabsContent>

                <TabsContent value="credentials" className="mt-6">
                    <CredentialsTab
                        configs={configs}
                        providerCatalogs={providerCatalogs}
                        hasWritePermission={hasWritePermission}
                        onUpdateConfig={handleQuickUpdate}
                        isPending={updateMutation.isPending}
                    />
                </TabsContent>

                <TabsContent value="defaults" className="mt-6">
                    <SystemDefaultsTab
                        currentProvider={String(currentProvider)}
                        currentModel={String(currentModel)}
                        currentBaseUrl={String(currentBaseUrl)}
                        currentApiKey={String(currentApiKey)}
                        currentProviderCatalog={currentProviderCatalog}
                        providerOptions={providerOptions}
                        modelOptions={modelOptions}
                        isLoadingModels={isLoadingModels}
                        isModelMenuOpen={isModelMenuOpen}
                        setIsModelMenuOpen={setIsModelMenuOpen}
                        modelSearchValue={modelSearchValue}
                        setModelSearchValue={setModelSearchValue}
                        hasWritePermission={hasWritePermission}
                        onQuickUpdate={handleQuickUpdate}
                        baseUrlInput={baseUrlInput}
                        setBaseUrlInput={setBaseUrlInput}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
