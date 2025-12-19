import { auditLogRouter } from "@/server/api/routers/audit-log"
import { conversationRouter } from "@/server/api/routers/conversation"
import { exampleRouter } from "@/server/api/routers/example"
import { providerCatalogRouter } from "@/server/api/routers/provider-catalog"
import { providerConfigRouter } from "@/server/api/routers/provider-config"
import { quotaMonitoringRouter } from "@/server/api/routers/quota-monitoring"
import { systemConfigRouter } from "@/server/api/routers/system-config"
import { tierConfigRouter } from "@/server/api/routers/tier-config"
import { userManagementRouter } from "@/server/api/routers/user-management"
import { createTRPCRouter } from "@/server/api/trpc"

export const appRouter = createTRPCRouter({
    auditLog: auditLogRouter,
    conversation: conversationRouter,
    example: exampleRouter,
    providerCatalog: providerCatalogRouter,
    providerConfig: providerConfigRouter,
    quotaMonitoring: quotaMonitoringRouter,
    systemConfig: systemConfigRouter,
    tierConfig: tierConfigRouter,
    userManagement: userManagementRouter,
})

export type AppRouter = typeof appRouter
