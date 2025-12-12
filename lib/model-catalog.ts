export interface ModelOption {
    id: string
    label?: string
}

// 说明：
// - 这里维护“常用模型”的静态目录，用于设置页下拉建议。
// - 不是强约束：用户仍可手动输入任意模型 ID（兼容自部署/自定义网关/私有部署）。
export function getModelOptions(provider: string): ModelOption[] {
    switch (provider) {
        case "openai":
            return [
                { id: "gpt-4o" },
                { id: "gpt-4o-mini" },
                { id: "gpt-4.1" },
                { id: "gpt-4.1-mini" },
                { id: "o3-mini" },
            ]
        case "anthropic":
            return [
                { id: "claude-3-5-sonnet-latest" },
                { id: "claude-3-5-haiku-latest" },
                { id: "claude-3-opus-latest" },
            ]
        case "google":
            return [
                { id: "gemini-2.0-flash" },
                { id: "gemini-2.5-flash" },
                { id: "gemini-2.5-pro" },
                { id: "gemini-1.5-pro" },
            ]
        case "azure":
            // 注意：Azure OpenAI 常用的是“部署名（deployment name）”而非原始模型 ID；
            // 这里仅给出常见示例，实际以你的 Azure 部署为准。
            return [{ id: "gpt-4o" }, { id: "gpt-4.1" }]
        case "openrouter":
            // OpenRouter 模型很多，列出少量常用示例；用户可自定义输入任意 openrouter 模型 slug。
            return [
                { id: "google/gemini-2.5-pro" },
                { id: "google/gemini-2.5-flash" },
                { id: "anthropic/claude-3.5-sonnet" },
                { id: "openai/gpt-4o" },
            ]
        case "deepseek":
            return [{ id: "deepseek-chat" }, { id: "deepseek-reasoner" }]
        case "siliconflow":
            return [
                { id: "deepseek-ai/DeepSeek-V3" },
                { id: "deepseek-ai/DeepSeek-R1" },
                { id: "Qwen/Qwen2.5-72B-Instruct" },
            ]
        default:
            return []
    }
}
