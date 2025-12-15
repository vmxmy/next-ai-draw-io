"use client"

import { redirect, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { AdminHeader } from "@/components/admin/header"
import { AdminSidebar } from "@/components/admin/sidebar"
import { useHasAdminAccess } from "@/lib/use-permissions"

function LoadingScreen() {
    return (
        <div className="flex h-screen items-center justify-center">
            <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                <p className="mt-4 text-sm text-muted-foreground">加载中...</p>
            </div>
        </div>
    )
}

function AccessDenied() {
    return (
        <div className="flex h-screen items-center justify-center">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-destructive">403</h1>
                <p className="mt-2 text-lg">访问被拒绝</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    您没有权限访问此页面
                </p>
                <a
                    href="/"
                    className="mt-4 inline-block text-sm text-primary hover:underline"
                >
                    返回首页
                </a>
            </div>
        </div>
    )
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { status } = useSession()
    const hasAdminAccess = useHasAdminAccess()
    const pathname = usePathname()

    // Don't apply auth checks on the login page
    const isLoginPage = pathname === "/admin/login"

    if (isLoginPage) {
        return <>{children}</>
    }

    // Show loading screen while checking authentication
    if (status === "loading") {
        return <LoadingScreen />
    }

    // Redirect to admin login if not authenticated
    if (status === "unauthenticated") {
        redirect(`/admin/login?callbackUrl=${encodeURIComponent(pathname)}`)
    }

    // Show access denied if user doesn't have any admin roles
    // Note: We need to wait for the roles to load
    // The useHasAdminAccess hook will return false initially while loading
    // We should show loading screen until we know for sure
    if (status === "authenticated") {
        // If session exists but we don't have admin access info yet, keep loading
        // This prevents flashing the access denied screen
        if (hasAdminAccess === false) {
            // Only show access denied if we're sure they don't have access
            return <AccessDenied />
        }
    }

    return (
        <div className="flex h-screen overflow-hidden">
            <AdminSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <AdminHeader />
                <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
