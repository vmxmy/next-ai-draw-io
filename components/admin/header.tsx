"use client"

import { LogOut, User } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUserRoles } from "@/lib/use-permissions"

export function AdminHeader() {
    const { data: session } = useSession()
    const userRoles = useUserRoles()

    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/admin/login" })
    }

    const userInitials = session?.user?.name
        ? session.user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
        : (session?.user?.email?.[0]?.toUpperCase() ?? "U")

    const roleNames = userRoles.map((r) => r.displayName).join(", ")

    return (
        <header className="flex h-16 items-center justify-between border-b bg-background px-6">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-muted-foreground">
                    {/* Breadcrumbs can be added here */}
                </h2>
            </div>

            <div className="flex items-center gap-4">
                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="relative h-10 w-10 rounded-full"
                        >
                            <Avatar className="h-10 w-10">
                                <AvatarImage
                                    src={session?.user?.image ?? undefined}
                                    alt={session?.user?.name ?? "User"}
                                />
                                <AvatarFallback>{userInitials}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">
                                    {session?.user?.name ?? "User"}
                                </p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {session?.user?.email}
                                </p>
                                {roleNames && (
                                    <p className="text-xs leading-none text-muted-foreground mt-1">
                                        角色: {roleNames}
                                    </p>
                                )}
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <a
                                href="/"
                                className="flex items-center cursor-pointer"
                            >
                                <User className="mr-2 h-4 w-4" />
                                <span>返回主应用</span>
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={handleSignOut}
                            className="cursor-pointer text-red-600"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>退出登录</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
