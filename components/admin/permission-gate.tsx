import type { ReactNode } from "react"
import { usePermission, useRole } from "@/lib/use-permissions"

interface PermissionGateProps {
    permission?: string
    role?: string
    children: ReactNode
    fallback?: ReactNode
}

/**
 * Component that conditionally renders children based on user permissions or roles
 * @param permission Permission to check (e.g., "users:read")
 * @param role Role to check (e.g., "superAdmin")
 * @param children Content to render if permission/role is granted
 * @param fallback Content to render if permission/role is denied
 */
export function PermissionGate({
    permission,
    role,
    children,
    fallback = null,
}: PermissionGateProps) {
    const hasPermission = usePermission(permission ?? "")
    const hasRole = useRole(role ?? "")

    // If both permission and role are specified, require both
    if (permission && role) {
        return hasPermission && hasRole ? children : fallback
    }

    // If only permission is specified
    if (permission) {
        return hasPermission ? children : fallback
    }

    // If only role is specified
    if (role) {
        return hasRole ? children : fallback
    }

    // If neither is specified, render children
    return <>{children}</>
}
