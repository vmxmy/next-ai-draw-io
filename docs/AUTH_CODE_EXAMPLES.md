# Next-Auth 代码示例速查表

> **快速参考**: 常用的认证相关代码片段

---

## 📑 目录

1. [客户端认证](#客户端认证)
2. [服务端认证](#服务端认证)
3. [受保护的 API](#受保护的-api)
4. [数据库查询](#数据库查询)
5. [错误处理](#错误处理)
6. [测试](#测试)

---

## 客户端认证

### 获取会话状态

```typescript
import { useSession } from "next-auth/react"

export function MyComponent() {
  const { data: session, status } = useSession()

  // status: "loading" | "authenticated" | "unauthenticated"

  if (status === "loading") {
    return <div>Loading...</div>
  }

  if (status === "unauthenticated") {
    return <div>Please sign in</div>
  }

  // 现在可以安全使用 session
  return <div>Welcome, {session.user?.name}</div>
}
```

### 登录/登出按钮

```typescript
import { signIn, signOut, useSession } from "next-auth/react"

export function AuthButton() {
  const { data: session } = useSession()

  if (session) {
    return (
      <button onClick={() => signOut()}>
        Sign out ({session.user?.email})
      </button>
    )
  }

  return (
    <button onClick={() => signIn("github")}>
      Sign in with GitHub
    </button>
  )
}
```

### 带回调 URL 的登录

```typescript
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export function ProtectedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return

    if (!session) {
      // 登录后回到当前页面
      signIn("github", {
        callbackUrl: window.location.href,
      })
    }
  }, [session, status])

  // ...
}
```

### 条件渲染（仅登录用户可见）

```typescript
import { useSession } from "next-auth/react"

export function CloudSyncButton() {
  const { data: session } = useSession()

  if (!session) {
    return null  // 未登录用户不显示
  }

  return (
    <button>
      Sync to Cloud
    </button>
  )
}
```

---

## 服务端认证

### API 路由中验证会话

```typescript
// app/api/my-api/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/server/auth"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 业务逻辑
  const userId = session.user.id
  return Response.json({ userId })
}
```

### Server Component 中获取会话

```typescript
// app/dashboard/page.tsx
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/server/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/api/auth/signin")
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
    </div>
  )
}
```

### Middleware 中保护路由

```typescript
// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  // 保护 /dashboard 路径
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/api/auth/signin", req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
```

---

## 受保护的 API

### tRPC Protected Procedure

```typescript
// server/api/routers/user.ts
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"

export const userRouter = createTRPCRouter({
  // ✅ 需要登录
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id  // 类型安全

    return ctx.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    })
  }),

  // ✅ 需要登录 + 参数验证
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { name: input.name },
      })
    }),
})
```

### 客户端调用

```typescript
// components/profile-form.tsx
"use client"

import { trpc } from "@/lib/trpc/client"

export function ProfileForm() {
  const { data: profile } = trpc.user.getProfile.useQuery()
  const updateMutation = trpc.user.updateProfile.useMutation()

  const handleSubmit = async (name: string) => {
    await updateMutation.mutateAsync({ name })
  }

  if (!profile) return <div>Loading...</div>

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      handleSubmit(e.currentTarget.name.value)
    }}>
      <input name="name" defaultValue={profile.name || ""} />
      <button type="submit">Save</button>
    </form>
  )
}
```

---

## 数据库查询

### 查询用户数据（带关联）

```typescript
// server/api/routers/user.ts
getUserWithConversations: protectedProcedure.query(async ({ ctx }) => {
  return ctx.db.user.findUnique({
    where: { id: ctx.session.user.id },
    include: {
      conversations: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 10,
      },
      providerConfigs: true,
    },
  })
})
```

### 创建用户关联数据

```typescript
// server/api/routers/conversation.ts
createConversation: protectedProcedure
  .input(z.object({
    title: z.string(),
    data: z.any(),
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.conversation.create({
      data: {
        id: generateId(),
        userId: ctx.session.user.id,  // ✅ 自动关联用户
        title: input.title,
        data: input.data,
        clientCreatedAt: new Date(),
        clientUpdatedAt: new Date(),
      },
    })
  })
```

### 验证数据所有权

```typescript
// server/api/routers/conversation.ts
deleteConversation: protectedProcedure
  .input(z.object({ conversationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // ✅ 验证所有权
    const conversation = await ctx.db.conversation.findUnique({
      where: {
        userId_id: {
          userId: ctx.session.user.id,
          id: input.conversationId,
        },
      },
    })

    if (!conversation) {
      throw new TRPCError({ code: "NOT_FOUND" })
    }

    // 软删除
    return ctx.db.conversation.update({
      where: {
        userId_id: {
          userId: ctx.session.user.id,
          id: input.conversationId,
        },
      },
      data: { deletedAt: new Date() },
    })
  })
```

---

## 错误处理

### 处理未认证错误

```typescript
// components/protected-content.tsx
import { trpc } from "@/lib/trpc/client"
import { useSession } from "next-auth/react"
import { signIn } from "next-auth/react"

export function ProtectedContent() {
  const { data: session } = useSession()
  const { data, error } = trpc.user.getProfile.useQuery(undefined, {
    enabled: !!session,  // ✅ 仅在登录后查询
  })

  if (error?.data?.code === "UNAUTHORIZED") {
    return (
      <div>
        <p>Please sign in to continue</p>
        <button onClick={() => signIn("github")}>
          Sign in
        </button>
      </div>
    )
  }

  // ...
}
```

### 全局错误处理

```typescript
// lib/trpc/provider.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { useState } from "react"
import { trpc } from "./client"
import { toast } from "sonner"

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          onError: (error: any) => {
            if (error.data?.code === "UNAUTHORIZED") {
              toast.error("Please sign in to continue")
              // 可选：自动重定向到登录页
              // window.location.href = "/api/auth/signin"
            }
          },
        },
      },
    })
  )

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
```

---

## 测试

### Mock useSession

```typescript
// __tests__/components/auth-button.test.tsx
import { render, screen } from "@testing-library/react"
import { useSession } from "next-auth/react"
import { AuthButton } from "@/components/auth-button"

jest.mock("next-auth/react")

describe("AuthButton", () => {
  it("shows sign in button when not authenticated", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    })

    render(<AuthButton />)
    expect(screen.getByText("Sign in")).toBeInTheDocument()
  })

  it("shows user email when authenticated", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: { email: "test@example.com" },
      },
      status: "authenticated",
    })

    render(<AuthButton />)
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument()
  })
})
```

### Mock getServerSession

```typescript
// __tests__/api/protected-route.test.ts
import { GET } from "@/app/api/protected/route"
import { getServerSession } from "next-auth/next"

jest.mock("next-auth/next")

describe("Protected API Route", () => {
  it("returns 401 when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null)

    const response = await GET(new Request("http://localhost/api/protected"))
    expect(response.status).toBe(401)
  })

  it("returns data when authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "123", email: "test@example.com" },
    })

    const response = await GET(new Request("http://localhost/api/protected"))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty("userId", "123")
  })
})
```

### 集成测试

```typescript
// __tests__/integration/auth-flow.test.ts
import { createMocks } from "node-mocks-http"
import { GET as authCallbackHandler } from "@/app/api/auth/callback/github/route"
import { db } from "@/server/db"

describe("Auth Flow Integration", () => {
  it("creates user and session on successful OAuth", async () => {
    const { req } = createMocks({
      method: "GET",
      url: "/api/auth/callback/github?code=test_code",
    })

    // 执行 OAuth 回调
    const response = await authCallbackHandler(req as any)

    // 验证数据库
    const users = await db.user.findMany()
    expect(users).toHaveLength(1)

    const sessions = await db.session.findMany()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].userId).toBe(users[0].id)
  })
})
```

---

## 常见模式

### 受保护的页面（重定向）

```typescript
// app/dashboard/page.tsx
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/server/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/dashboard")
  }

  return <Dashboard user={session.user} />
}
```

### 受保护的页面（显示登录提示）

```typescript
// app/premium/page.tsx
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/server/auth"
import { SignInPrompt } from "@/components/sign-in-prompt"

export default async function PremiumPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return <SignInPrompt message="Sign in to access premium features" />
  }

  return <PremiumContent user={session.user} />
}
```

### 条件功能（登录后解锁）

```typescript
// components/export-button.tsx
"use client"

import { useSession } from "next-auth/react"
import { trpc } from "@/lib/trpc/client"

export function ExportButton() {
  const { data: session } = useSession()
  const exportMutation = trpc.diagram.export.useMutation()

  const handleExport = async () => {
    if (!session) {
      // 提示登录以使用高级功能
      toast.info("Sign in to export diagrams")
      return
    }

    await exportMutation.mutateAsync({ format: "pdf" })
  }

  return (
    <button onClick={handleExport}>
      Export {!session && "(Sign in required)"}
    </button>
  )
}
```

### 用户菜单下拉

```typescript
// components/user-menu.tsx
import { useSession, signOut } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar } from "@/components/ui/avatar"

export function UserMenu() {
  const { data: session } = useSession()

  if (!session) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar src={session.user.image} alt={session.user.name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-sm">
          <p className="font-medium">{session.user.name}</p>
          <p className="text-muted-foreground">{session.user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/settings">Settings</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/dashboard">Dashboard</a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## 调试技巧

### 启用 NextAuth 调试日志

```env
# .env.local
NEXTAUTH_DEBUG=true
```

### 检查会话 Cookie

```typescript
// 浏览器控制台
document.cookie.split(';').find(c => c.includes('next-auth'))
```

### 查看会话数据

```typescript
// 任意组件中
import { useSession } from "next-auth/react"

export function DebugSession() {
  const { data: session } = useSession()

  return <pre>{JSON.stringify(session, null, 2)}</pre>
}
```

### 数据库查询调试

```typescript
// server/db.ts
const prisma = new PrismaClient({
  log: ["query", "error", "warn"],  // ✅ 启用查询日志
})
```

---

## 性能优化

### 缓存会话查询

```typescript
// components/user-profile.tsx
import { trpc } from "@/lib/trpc/client"

export function UserProfile() {
  const { data: profile } = trpc.user.getProfile.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,  // ✅ 5分钟内不重新查询
    cacheTime: 10 * 60 * 1000,  // ✅ 缓存保留10分钟
  })

  // ...
}
```

### 预取数据

```typescript
// app/dashboard/page.tsx
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/server/auth"
import { api } from "@/lib/trpc/server"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/api/auth/signin")
  }

  // ✅ 在服务端预取数据
  await api.user.getProfile.prefetch()

  return (
    <HydrateClient>
      <DashboardContent />
    </HydrateClient>
  )
}
```

---

## 安全检查清单

- [ ] ✅ 所有敏感 API 使用 `protectedProcedure`
- [ ] ✅ 数据库查询验证用户所有权
- [ ] ✅ 环境变量包含 `NEXTAUTH_SECRET`
- [ ] ✅ 生产环境强制 HTTPS
- [ ] ✅ Cookie 设置 `httpOnly: true`
- [ ] ✅ CSRF token 自动验证
- [ ] ✅ Session 过期时间合理（默认30天）
- [ ] ✅ OAuth redirect URLs 白名单配置

---

**最后更新**: 2025-12-14
**维护者**: 开发团队
