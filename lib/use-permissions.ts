import { useMemo } from "react"
import { api } from "@/lib/trpc/client"

/**
 * Hook to check if the current user has a specific permission
 * @param permission Permission name (e.g., "users:read", "users:write")
 * @returns boolean indicating if the user has the permission
 */
export function usePermission(permission: string): boolean {
    const { data: userPermissions } =
        api.userManagement.getMyPermissions.useQuery()

    return useMemo(() => {
        if (!userPermissions) return false
        // Check for exact permission match or wildcard permissions
        return (
            userPermissions.includes(permission) ||
            userPermissions.includes("*") ||
            userPermissions.includes(`${permission.split(":")[0]}:*`)
        )
    }, [userPermissions, permission])
}

/**
 * Hook to check if the current user has a specific role
 * @param roleName Role name (e.g., "superAdmin", "admin")
 * @returns boolean indicating if the user has the role
 */
export function useRole(roleName: string): boolean {
    const { data: userRoles } = api.userManagement.getMyRoles.useQuery()

    return useMemo(() => {
        return userRoles?.some((r) => r.name === roleName) ?? false
    }, [userRoles, roleName])
}

/**
 * Hook to check if the current user has any admin permissions
 * @returns boolean indicating if the user has any admin access
 */
export function useHasAdminAccess(): boolean {
    const { data: userRoles } = api.userManagement.getMyRoles.useQuery()

    return useMemo(() => {
        return (userRoles && userRoles.length > 0) ?? false
    }, [userRoles])
}

/**
 * Hook to get all user permissions
 * @returns array of permission names
 */
export function useUserPermissions(): string[] {
    const { data: userPermissions } =
        api.userManagement.getMyPermissions.useQuery()
    return userPermissions ?? []
}

/**
 * Hook to get all user roles
 * @returns array of role objects
 */
export function useUserRoles() {
    const { data: userRoles } = api.userManagement.getMyRoles.useQuery()
    return userRoles ?? []
}
