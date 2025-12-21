import { aiModeRouter } from "@/server/api/routers/ai-mode"
import { auditLogRouter } from "@/server/api/routers/audit-log"
import { conversationRouter } from "@/server/api/routers/conversation"
import { exampleRouter } from "@/server/api/routers/example"
import { providerCatalogRouter } from "@/server/api/routers/provider-catalog"
import { providerConfigRouter } from "@/server/api/routers/provider-config"
import { quotaMonitoringRouter } from "@/server/api/routers/quota-monitoring"
import { systemConfigRouter } from "@/server/api/routers/system-config"
import { systemCredentialRouter } from "@/server/api/routers/system-credential"
import { tierConfigRouter } from "@/server/api/routers/tier-config"
import { userCredentialRouter } from "@/server/api/routers/user-credential"
import { userManagementRouter } from "@/server/api/routers/user-management"
import { userModeConfigRouter } from "@/server/api/routers/user-mode-config"
import { createTRPCRouter } from "@/server/api/trpc"

export const appRouter = createTRPCRouter({
    aiMode: aiModeRouter,
    auditLog: auditLogRouter,
    conversation: conversationRouter,
    example: exampleRouter,
    providerCatalog: providerCatalogRouter,
    providerConfig: providerConfigRouter,
    quotaMonitoring: quotaMonitoringRouter,
    systemConfig: systemConfigRouter,
    systemCredential: systemCredentialRouter,
    tierConfig: tierConfigRouter,
    userCredential: userCredentialRouter,
    userManagement: userManagementRouter,
    userModeConfig: userModeConfigRouter,
})

export type AppRouter = typeof appRouter
