"use client"

import {
    Activity,
    FileText,
    LayoutDashboard,
    Settings,
    Users,
    Wrench,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { usePermission } from "@/lib/use-permissions"
import { cn } from "@/lib/utils"
import { useSidebar } from "./sidebar-context"

interface MenuItem {
    label: string
    icon: React.ComponentType<{ className?: string }>
    href: string
    permission?: string
    children?: Array<{ label: string; href: string; permission?: string }>
}

const menuItems: MenuItem[] = [
    {
        label: "仪表板",
        icon: LayoutDashboard,
        href: "/admin",
        permission: undefined, // All admin users can see dashboard
    },
    {
        label: "用户管理",
        icon: Users,
        href: "/admin/users",
        permission: "users:read",
        children: [
            {
                label: "用户列表",
                href: "/admin/users",
                permission: "users:read",
            },
            {
                label: "角色管理",
                href: "/admin/roles",
                permission: "users:read",
            },
        ],
    },
    {
        label: "配额监控",
        icon: Activity,
        href: "/admin/quotas",
        permission: "quotas:read",
    },
    {
        label: "系统配置",
        icon: Settings,
        href: "/admin/system-config",
        permission: "system:read",
        children: [
            {
                label: "等级配置",
                href: "/admin/tier-management",
                permission: "tiers:read",
            },
            {
                label: "系统参数",
                href: "/admin/system-config",
                permission: "system:read",
            },
        ],
    },
    {
        label: "操作日志",
        icon: FileText,
        href: "/admin/audit-logs",
        permission: "logs:read",
    },
    {
        label: "运维工具",
        icon: Wrench,
        href: "/admin/sessions",
        permission: "users:read",
        children: [
            {
                label: "会话管理",
                href: "/admin/sessions",
                permission: "users:read",
            },
            {
                label: "IP 管理",
                href: "/admin/ip-management",
                permission: "quotas:read",
            },
        ],
    },
]

function ChildNavItem({
    child,
    onNavigate,
}: {
    child: { label: string; href: string; permission?: string }
    onNavigate?: () => void
}) {
    const pathname = usePathname()
    const hasPermission = usePermission(child.permission ?? "")

    // Don't render if user doesn't have permission
    if (child.permission && !hasPermission) {
        return null
    }

    const isActive = pathname === child.href

    return (
        <Link
            href={child.href}
            onClick={onNavigate}
            className={cn(
                "block rounded-md px-3 py-1.5 text-sm transition-all hover:bg-accent",
                isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground",
            )}
        >
            {child.label}
        </Link>
    )
}

function NavItem({
    item,
    onNavigate,
}: {
    item: MenuItem
    onNavigate?: () => void
}) {
    const pathname = usePathname()
    const hasPermission = usePermission(item.permission ?? "")
    const Icon = item.icon

    // Don't render if user doesn't have permission
    if (item.permission && !hasPermission) {
        return null
    }

    const isActive =
        pathname === item.href || pathname.startsWith(item.href + "/")

    return (
        <div>
            <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent",
                    isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground",
                )}
            >
                <Icon className="h-4 w-4" />
                {item.label}
            </Link>
            {item.children && (
                <div className="ml-6 mt-1 space-y-1">
                    {item.children.map((child) => (
                        <ChildNavItem
                            key={child.href}
                            child={child}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    return (
        <>
            {/* Navigation */}
            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
                {menuItems.map((item) => (
                    <NavItem
                        key={item.href}
                        item={item}
                        onNavigate={onNavigate}
                    />
                ))}
            </nav>

            {/* Footer */}
            <div className="border-t p-4">
                <p className="text-xs text-muted-foreground">
                    Admin Platform v1.0
                </p>
            </div>
        </>
    )
}

export function AdminSidebar() {
    return (
        <div className="hidden md:flex h-full w-64 flex-col border-r bg-background">
            {/* Logo/Title */}
            <div className="flex h-16 items-center border-b px-6">
                <h1 className="text-xl font-bold">运维管理平台</h1>
            </div>

            <SidebarContent />
        </div>
    )
}

export function MobileSidebar() {
    const { isOpen, close } = useSidebar()

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
            <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="h-16 flex-row items-center border-b px-6">
                    <SheetTitle className="text-xl font-bold">
                        运维管理平台
                    </SheetTitle>
                </SheetHeader>
                <div className="flex h-[calc(100%-4rem)] flex-col">
                    <SidebarContent onNavigate={close} />
                </div>
            </SheetContent>
        </Sheet>
    )
}
