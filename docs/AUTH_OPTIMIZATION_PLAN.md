# Next-Auth 优化方案

> **项目**: Next AI Draw.io
> **优先级分类**: P0（紧急）、P1（重要）、P2（优化）、P3（未来）

---

## 🚀 优化清单

### P0 - 安全性增强（立即实施）

#### 1. 添加速率限制到认证端点

**问题**: 当前认证端点无速率限制，容易被暴力破解

**解决方案**:
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 保护认证端点
  if (pathname.startsWith('/api/auth')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()
    const limit = rateLimitMap.get(ip)

    if (limit) {
      if (now < limit.resetTime) {
        if (limit.count >= 10) {  // 10次/分钟
          return new NextResponse('Too Many Requests', { status: 429 })
        }
        limit.count++
      } else {
        rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 })
      }
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/auth/:path*',
}
```

**优先级**: P0
**工作量**: 2小时
**风险**: 低

---

#### 2. 添加 NEXTAUTH_URL 环境变量验证

**问题**: 缺少 NEXTAUTH_URL 会导致 OAuth 回调失败

**解决方案**:
```typescript
// server/auth.ts
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`[auth] Missing required environment variable: ${name}`)
  }
  return value
}

// 添加验证
requireEnv("NEXTAUTH_URL")
requireEnv("NEXTAUTH_SECRET")
requireEnv("GITHUB_ID")
requireEnv("GITHUB_SECRET")
```

**优先级**: P0
**工作量**: 30分钟
**风险**: 无

---

### P1 - 用户体验改进（近期实施）

#### 3. 会话过期提醒

**问题**: 用户会话过期时没有提醒，可能丢失未保存工作

**解决方案**:
```typescript
// components/session-expiry-toast.tsx
"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export function SessionExpiryToast() {
  const { data: session } = useSession()
  const [hasWarned, setHasWarned] = useState(false)

  useEffect(() => {
    if (!session?.expires || hasWarned) return

    const expiryTime = new Date(session.expires).getTime()
    const now = Date.now()
    const timeUntilExpiry = expiryTime - now

    // 5分钟前提醒
    const warningTime = timeUntilExpiry - 5 * 60 * 1000

    if (warningTime > 0) {
      const timer = setTimeout(() => {
        toast.warning("会话即将过期", {
          description: "请保存您的工作。会话将在 5 分钟后过期。",
          duration: 10000,
        })
        setHasWarned(true)
      }, warningTime)

      return () => clearTimeout(timer)
    }
  }, [session, hasWarned])

  return null
}
```

```typescript
// app/providers.tsx
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionExpiryToast />  {/* ✅ 添加 */}
      <TRPCReactProvider>
        {/* ... */}
      </TRPCReactProvider>
    </SessionProvider>
  )
}
```

**优先级**: P1
**工作量**: 3小时
**收益**: 防止数据丢失

---

#### 4. 登录重定向优化

**问题**: 用户登录后总是重定向到首页，而不是原来的页面

**解决方案**:
```typescript
// components/auth-button.tsx
import { useRouter } from "next/navigation"

export function AuthButton() {
  const router = useRouter()

  const handleSignIn = async () => {
    const currentPath = window.location.pathname
    await signIn("github", {
      callbackUrl: currentPath,  // ✅ 回到当前页面
    })
  }

  return (
    <Button onClick={handleSignIn}>
      Sign in with GitHub
    </Button>
  )
}
```

**优先级**: P1
**工作量**: 1小时
**风险**: 低

---

#### 5. 添加登录加载状态

**问题**: 点击登录按钮后没有视觉反馈

**解决方案**:
```typescript
// features/chat/ui/auth-button.tsx
export function AuthButton({ onSignIn }: { onSignIn: () => void }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    try {
      await onSignIn()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ButtonWithTooltip
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Spinner className="h-4 w-4" />
      ) : (
        <GithubIcon className="h-4 w-4" />
      )}
    </ButtonWithTooltip>
  )
}
```

**优先级**: P1
**工作量**: 2小时
**风险**: 无

---

### P2 - 功能增强（中期计划）

#### 6. 添加 Google OAuth 登录

**需求**: 提供更多登录选项

**实施步骤**:

1. **配置 Google Cloud Console**
   - 创建 OAuth 2.0 客户端 ID
   - 添加授权回调 URL: `http://localhost:6002/api/auth/callback/google`

2. **更新环境变量**
   ```env
   GOOGLE_ID=your_google_client_id
   GOOGLE_SECRET=your_google_client_secret
   ```

3. **修改 server/auth.ts**
   ```typescript
   import GoogleProvider from "next-auth/providers/google"

   providers: [
     GitHubProvider({
       clientId: requireEnv("GITHUB_ID"),
       clientSecret: requireEnv("GITHUB_SECRET"),
     }),
     GoogleProvider({
       clientId: requireEnv("GOOGLE_ID"),
       clientSecret: requireEnv("GOOGLE_SECRET"),
     }),
   ]
   ```

4. **更新 UI**
   ```typescript
   // features/chat/ui/auth-button.tsx
   <DropdownMenu>
     <DropdownMenuTrigger>Sign In</DropdownMenuTrigger>
     <DropdownMenuContent>
       <DropdownMenuItem onClick={() => signIn("github")}>
         GitHub
       </DropdownMenuItem>
       <DropdownMenuItem onClick={() => signIn("google")}>
         Google
       </DropdownMenuItem>
     </DropdownMenuContent>
   </DropdownMenu>
   ```

**优先级**: P2
**工作量**: 4小时
**收益**: 增加用户选择

---

#### 7. 实现多设备管理

**需求**: 用户可以查看并管理所有登录设备

**数据库模型更新**:
```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  // ✅ 新增字段
  deviceName   String?        // 设备名称（从 User-Agent 解析）
  ipAddress    String?        // IP 地址
  lastActive   DateTime @default(now())  // 最后活跃时间
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, lastActive])
}
```

**UI 组件**:
```typescript
// components/settings-dialog.tsx
import { format } from "date-fns"

function ActiveSessionsList({ userId }: { userId: string }) {
  const { data: sessions } = trpc.session.list.useQuery()
  const revokeMutation = trpc.session.revoke.useMutation()

  return (
    <div className="space-y-2">
      <h3>活跃设备</h3>
      {sessions?.map((session) => (
        <div key={session.id} className="flex items-center justify-between">
          <div>
            <p className="font-medium">{session.deviceName}</p>
            <p className="text-sm text-muted-foreground">
              最后活跃: {format(session.lastActive, "PPpp")}
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => revokeMutation.mutate({ sessionId: session.id })}
          >
            撤销
          </Button>
        </div>
      ))}
    </div>
  )
}
```

**tRPC 路由**:
```typescript
// server/api/routers/session.ts
export const sessionRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.session.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { lastActive: "desc" },
    })
  }),

  revoke: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.session.findUnique({
        where: { id: input.sessionId },
      })

      // 验证所有权
      if (session?.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      await ctx.db.session.delete({
        where: { id: input.sessionId },
      })

      return { success: true }
    }),
})
```

**优先级**: P2
**工作量**: 8小时
**收益**: 增强安全性

---

#### 8. 添加登录审计日志

**需求**: 追踪所有登录活动，检测异常行为

**数据库模型**:
```prisma
model LoginAudit {
  id        String   @id @default(cuid())
  userId    String?  // 可选（登录失败时为空）
  email     String?
  ip        String
  userAgent String
  provider  String   // "github" | "google"
  success   Boolean
  failureReason String?
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([ip, createdAt])
  @@index([success, createdAt])
}
```

**实现**:
```typescript
// server/auth.ts
import { headers } from "next/headers"

export const authOptions: NextAuthOptions = {
  // ...
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      const headersList = headers()
      const ip = headersList.get("x-forwarded-for") || "unknown"
      const userAgent = headersList.get("user-agent") || "unknown"

      await db.loginAudit.create({
        data: {
          userId: user.id,
          email: user.email,
          ip,
          userAgent,
          provider: account?.provider || "unknown",
          success: true,
        },
      })

      // 异常登录检测
      const recentLogins = await db.loginAudit.findMany({
        where: {
          userId: user.id,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),  // 24小时内
          },
        },
        select: { ip: true },
      })

      const uniqueIps = new Set(recentLogins.map(l => l.ip))
      if (uniqueIps.size > 5) {
        // 发送警告邮件
        await sendSecurityAlert(user.email, {
          type: "multiple_ips",
          count: uniqueIps.size,
        })
      }
    },
  },
}
```

**查询 UI**:
```typescript
// components/settings-dialog.tsx
function LoginHistoryTab({ userId }: { userId: string }) {
  const { data: audits } = trpc.loginAudit.list.useQuery()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>时间</TableHead>
          <TableHead>IP 地址</TableHead>
          <TableHead>设备</TableHead>
          <TableHead>状态</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {audits?.map((audit) => (
          <TableRow key={audit.id}>
            <TableCell>{format(audit.createdAt, "PPpp")}</TableCell>
            <TableCell>{audit.ip}</TableCell>
            <TableCell>{parseUserAgent(audit.userAgent).device}</TableCell>
            <TableCell>
              {audit.success ? (
                <Badge variant="success">成功</Badge>
              ) : (
                <Badge variant="destructive">失败</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

**优先级**: P2
**工作量**: 6小时
**收益**: 安全审计

---

### P3 - 高级功能（长期规划）

#### 9. 实现 RBAC（基于角色的访问控制）

**需求**: 支持管理员、付费用户、普通用户等角色

**数据库模型**:
```prisma
enum UserRole {
  USER
  PREMIUM
  ADMIN
}

model User {
  id   String   @id @default(cuid())
  role UserRole @default(USER)
  // ...
}
```

**中间件**:
```typescript
// server/api/trpc.ts
const requireRole = (allowedRoles: UserRole[]) => {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    if (!allowedRoles.includes(ctx.session.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    return next({ ctx: { session: ctx.session } })
  })
}

export const adminProcedure = t.procedure.use(requireRole([UserRole.ADMIN]))
export const premiumProcedure = t.procedure.use(requireRole([UserRole.PREMIUM, UserRole.ADMIN]))
```

**使用示例**:
```typescript
// server/api/routers/admin.ts
export const adminRouter = createTRPCRouter({
  listUsers: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany()
  }),

  banUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: input.userId },
        data: { banned: true },
      })
    }),
})
```

**优先级**: P3
**工作量**: 12小时
**依赖**: 需要先定义角色系统

---

#### 10. 实现 2FA（双因素认证）

**需求**: 为敏感操作添加额外安全层

**依赖包**:
```bash
npm install speakeasy qrcode
npm install --save-dev @types/speakeasy @types/qrcode
```

**数据库模型**:
```prisma
model User {
  id            String    @id @default(cuid())
  twoFactorEnabled Boolean @default(false)
  twoFactorSecret  String?
  // ...
}

model TwoFactorBackupCode {
  id        String   @id @default(cuid())
  userId    String
  code      String   @unique
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**实现流程**:

1. **启用 2FA**
   ```typescript
   // server/api/routers/two-factor.ts
   export const twoFactorRouter = createTRPCRouter({
     enable: protectedProcedure.mutation(async ({ ctx }) => {
       const secret = speakeasy.generateSecret({ length: 20 })

       await ctx.db.user.update({
         where: { id: ctx.session.user.id },
         data: { twoFactorSecret: secret.base32 },
       })

       const qrCode = await QRCode.toDataURL(secret.otpauth_url!)
       return { secret: secret.base32, qrCode }
     }),

     verify: protectedProcedure
       .input(z.object({ token: z.string() }))
       .mutation(async ({ ctx, input }) => {
         const user = await ctx.db.user.findUnique({
           where: { id: ctx.session.user.id },
         })

         const verified = speakeasy.totp.verify({
           secret: user.twoFactorSecret!,
           encoding: 'base32',
           token: input.token,
         })

         if (verified) {
           await ctx.db.user.update({
             where: { id: ctx.session.user.id },
             data: { twoFactorEnabled: true },
           })
         }

         return { success: verified }
       }),
   })
   ```

2. **登录时验证**
   ```typescript
   // server/auth.ts
   callbacks: {
     async signIn({ user, account }) {
       const dbUser = await db.user.findUnique({
         where: { id: user.id },
       })

       if (dbUser?.twoFactorEnabled) {
         // 重定向到 2FA 验证页面
         return `/auth/2fa?userId=${user.id}`
       }

       return true
     },
   }
   ```

**优先级**: P3
**工作量**: 16小时
**风险**: 中（需要充分测试）

---

## 实施时间表

### 第一阶段（1-2周）- 安全性优化

- ✅ P0-1: 速率限制（2小时）
- ✅ P0-2: 环境变量验证（30分钟）
- ✅ P1-3: 会话过期提醒（3小时）
- ✅ P1-4: 登录重定向优化（1小时）
- ✅ P1-5: 登录加载状态（2小时）

**总计**: 8.5小时

### 第二阶段（3-4周）- 功能增强

- ⏳ P2-6: Google OAuth（4小时）
- ⏳ P2-7: 多设备管理（8小时）
- ⏳ P2-8: 登录审计日志（6小时）

**总计**: 18小时

### 第三阶段（长期）- 高级功能

- 🔮 P3-9: RBAC（12小时）
- 🔮 P3-10: 2FA（16小时）

**总计**: 28小时

---

## 测试清单

### 功能测试

- [ ] OAuth 登录流程正常
- [ ] 登出后会话被清除
- [ ] 受保护的 API 拒绝未认证请求
- [ ] 会话过期后自动重定向到登录页
- [ ] 多设备登录互不干扰
- [ ] 会话撤销立即生效

### 安全测试

- [ ] CSRF token 验证
- [ ] 速率限制生效
- [ ] SQL 注入防护
- [ ] XSS 防护
- [ ] 敏感数据加密存储
- [ ] HTTPS 强制（生产环境）

### 性能测试

- [ ] 登录响应时间 < 2秒
- [ ] Session 查询使用索引
- [ ] 数据库连接池正常
- [ ] 并发登录处理

---

## 监控指标

### 关键指标

- **登录成功率**: > 95%
- **平均登录时间**: < 2秒
- **会话持续时间**: 平均 30 天
- **异常登录检测**: 每日报告

### 告警规则

- 登录失败率 > 20% → 警告
- 同一 IP 10分钟内失败 > 5次 → 封禁
- 同一用户 24小时内登录 IP > 5个 → 安全邮件
- 数据库连接池耗尽 → 紧急告警

---

## 成本分析

### 数据库存储

| 模型 | 每条记录 | 10万用户/年 |
|------|---------|------------|
| User | ~500 bytes | 50 MB |
| Session | ~300 bytes | 30 MB |
| Account | ~400 bytes | 40 MB |
| LoginAudit | ~200 bytes | 200 MB (1000万条) |

**总计**: ~320 MB/年（可忽略）

### API 调用成本

- GitHub OAuth: 免费
- Google OAuth: 免费
- 数据库查询: 包含在主数据库费用中

**额外成本**: $0

---

## 回滚计划

如果优化出现问题，回滚步骤：

1. **代码回滚**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **数据库回滚**
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

3. **环境变量恢复**
   - 恢复 `.env` 文件
   - 重启应用

4. **清除缓存**
   ```bash
   npm run build
   pm2 restart all
   ```

---

## 文档更新

每次实施优化后，需要更新：

- [ ] `NEXT_AUTH_ARCHITECTURE.md`
- [ ] `README.md`（如果有用户可见的变更）
- [ ] API 文档
- [ ] 环境变量示例（`env.example`）
- [ ] Prisma schema 注释

---

**维护者**: 开发团队
**审核者**: 安全团队
**最后更新**: 2025-12-14
