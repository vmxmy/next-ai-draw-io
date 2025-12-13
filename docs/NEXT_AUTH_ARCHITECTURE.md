# Next-Auth 架构设计文档

> **项目**: Next AI Draw.io
> **版本**: v0.4.0
> **认证版本**: next-auth v4.24.13
> **创建日期**: 2025-12-14

---

## 📋 目录

1. [概述](#概述)
2. [核心架构](#核心架构)
3. [数据库模型](#数据库模型)
4. [认证流程](#认证流程)
5. [集成点分析](#集成点分析)
6. [安全性](#安全性)
7. [性能优化](#性能优化)
8. [最佳实践](#最佳实践)
9. [优化建议](#优化建议)

---

## 概述

### 认证策略

- **提供商**: GitHub OAuth
- **会话策略**: Database Sessions (Prisma Adapter)
- **前端集成**: SessionProvider + useSession hook
- **API 保护**: tRPC protectedProcedure middleware

### 技术栈

```
Next.js 16.0.7 (App Router)
├── next-auth@4.24.13          # 认证核心
├── @next-auth/prisma-adapter  # Prisma 适配器
├── Prisma + PostgreSQL        # 数据持久化
└── tRPC@11.7.2                # 类型安全的 API
```

---

## 核心架构

### 文件结构

```
next-ai-draw-io/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts          # ✅ OAuth 路由处理
│   └── providers.tsx                 # ✅ SessionProvider 根包装
│
├── server/
│   ├── auth.ts                       # ✅ NextAuth 核心配置
│   └── api/
│       ├── trpc.ts                   # ✅ tRPC 上下文 + 中间件
│       └── routers/
│           ├── conversation.ts       # 🔒 受保护：会话同步
│           └── provider-config.ts    # 🔒 受保护：AI 配置同步
│
├── features/chat/
│   ├── chat-panel.tsx               # ✅ useSession + signIn/signOut
│   └── sync/
│       └── use-conversation-sync.ts  # ✅ 云端同步（需登录）
│
├── components/
│   └── settings-dialog.tsx           # ✅ 认证状态显示
│
└── prisma/
    └── schema.prisma                 # ✅ 数据库模型
```

### 组件层次

```
app/layout.tsx
└── <Providers>                        # SessionProvider 包装
    ├── <TRPCReactProvider>            # tRPC 客户端
    │   └── <DiagramProvider>
    │       └── <ChatPanel>            # useSession() 消费者
    │           ├── signIn()           # 登录触发
    │           └── signOut()          # 登出触发
    └── <SettingsDialog>               # useSession() 消费者
```

---

## 数据库模型

### NextAuth 标准模型

#### 1. User（用户表）

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?

  // 关联
  accounts      Account[]       // OAuth 账号
  sessions      Session[]       // 活跃会话
  conversations Conversation[]  // 用户的图表会话
  providerConfigs ProviderConfig[] // AI 配置（BYOK）

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**关键字段**:
- `id`: 用户唯一标识（cuid）
- `email`: OAuth 获取的邮箱（唯一约束）
- `image`: GitHub 头像 URL
- `emailVerified`: 邮箱验证状态（可选）

#### 2. Account（OAuth 账号表）

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String         # "oauth"
  provider          String         # "github"
  providerAccountId String         # GitHub 用户 ID
  refresh_token     String?        # GitHub refresh token
  access_token      String?        # GitHub access token
  expires_at        Int?           # Token 过期时间
  token_type        String?        # "bearer"
  scope             String?        # OAuth scopes
  id_token          String?        # OIDC ID token
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

**安全设计**:
- `onDelete: Cascade`: 删除用户时自动删除 OAuth 账号
- `@@unique([provider, providerAccountId])`: 防止重复绑定

#### 3. Session（会话表）

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique        # Cookie 中的 token
  userId       String
  expires      DateTime                # 会话过期时间

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**会话管理**:
- **存储位置**: PostgreSQL（非 JWT）
- **Cookie 名称**: `next-auth.session-token`
- **过期策略**: 30 天（默认）
- **安全选项**: httpOnly, secure (生产环境)

#### 4. VerificationToken（验证 Token）

```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

**用途**:
- 邮箱验证链接
- 无密码登录（Magic Links）
- 密码重置（如果添加邮箱/密码登录）

---

## 认证流程

### 1. OAuth 登录流程

```mermaid
sequenceDiagram
    participant U as 用户浏览器
    participant A as Next.js App
    participant N as NextAuth API
    participant G as GitHub OAuth
    participant D as PostgreSQL

    U->>A: 点击 "Sign in with GitHub"
    A->>U: signIn("github")
    U->>N: GET /api/auth/signin/github
    N->>G: 重定向到 GitHub 授权页面
    G->>U: 显示授权页面
    U->>G: 用户授权
    G->>N: 回调 /api/auth/callback/github?code=xxx
    N->>G: 使用 code 交换 access_token
    G->>N: 返回 token + 用户信息
    N->>D: 创建/更新 User, Account, Session
    D->>N: 返回 session
    N->>U: 设置 Cookie (session-token)
    N->>U: 重定向到首页
    U->>A: 刷新页面，SessionProvider 读取 session
    A->>U: 显示已登录状态
```

### 2. 会话验证流程

```typescript
// 客户端（useSession）
const { data: session, status } = useSession()
// status: "loading" | "authenticated" | "unauthenticated"

// 服务端（getServerSession）
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/server/auth"

const session = await getServerSession(authOptions)
if (!session) {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}
```

### 3. 受保护的 API 流程

```typescript
// tRPC 中间件保护
const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { session: ctx.session } })
})

export const protectedProcedure = t.procedure.use(requireAuth)

// 使用示例
export const conversationRouter = createTRPCRouter({
  push: protectedProcedure
    .input(z.object({ conversations: z.array(...) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id  // ✅ 类型安全
      // ... 业务逻辑
    })
})
```

---

## 集成点分析

### 1. 前端集成

#### app/providers.tsx
```typescript
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>  {/* ✅ next-auth 会话提供者 */}
      <TRPCReactProvider>
        <TooltipProvider>
          <I18nProvider>
            <DiagramProvider>{children}</DiagramProvider>
          </I18nProvider>
        </TooltipProvider>
      </TRPCReactProvider>
    </SessionProvider>
  )
}
```

**作用**:
- 提供全局 session 上下文
- 自动处理 session 刷新
- 支持 SSR（服务端渲染时读取 cookie）

#### features/chat/chat-panel.tsx
```typescript
import { signIn, signOut, useSession } from "next-auth/react"

const { data: authSession, status: authStatus } = useSession()
const userId = authSession?.user?.id

// 登录按钮
<AuthButton
  authStatus={authStatus}
  onSignIn={() => void signIn("github")}
  onSignOut={() => void signOut()}
/>

// 条件渲染云端同步
{authStatus === "authenticated" && (
  <CloudSyncIndicator />
)}
```

**集成要点**:
- ✅ 使用 `useSession()` 获取认证状态
- ✅ 使用 `signIn("github")` 触发 OAuth 流程
- ✅ 使用 `signOut()` 清除会话
- ✅ 根据 `authStatus` 显示不同 UI

### 2. 服务端集成

#### server/api/trpc.ts
```typescript
export async function createTRPCContext() {
  const session = await getServerSession(authOptions)
  return { db, session }  // ✅ 注入到所有 tRPC 路由
}

const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { session: ctx.session } })
})
```

**受保护的路由**:
- `conversation.push` - 上传会话到云端
- `conversation.pull` - 从云端拉取会话
- `providerConfig.upsert` - 保存 AI 配置
- `providerConfig.list` - 获取 AI 配置列表

### 3. 数据库关联

所有用户数据通过 `userId` 关联：

```typescript
// Conversation（图表会话）
model Conversation {
  userId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, id])
}

// ProviderConfig（AI 配置）
model ProviderConfig {
  userId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, provider])
}
```

**级联删除**:
- 删除 User → 自动删除所有 Conversations
- 删除 User → 自动删除所有 ProviderConfigs
- 删除 User → 自动删除所有 Sessions/Accounts

---

## 安全性

### 1. 环境变量配置

```env
# GitHub OAuth（必需）
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret

# NextAuth 配置（必需）
NEXTAUTH_URL=http://localhost:6002
NEXTAUTH_SECRET=your_random_secret_32chars

# 数据库连接（必需）
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

**生成 NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

### 2. Cookie 安全选项

```typescript
// NextAuth 自动配置（生产环境）
cookies: {
  sessionToken: {
    name: `next-auth.session-token`,
    options: {
      httpOnly: true,      // ✅ 防止 XSS 攻击
      sameSite: 'lax',     // ✅ CSRF 保护
      path: '/',
      secure: true,        // ✅ 仅 HTTPS（生产环境）
    }
  }
}
```

### 3. CSRF 保护

NextAuth 内置 CSRF Token 验证：
- 每个请求自动验证 `csrfToken`
- 防止跨站请求伪造攻击

### 4. 密码加密存储

AI Provider 配置中的 API Key 使用 AES-256-GCM 加密：

```typescript
// server/encryption.ts
export function encrypt(text: string, key: string): EncryptedData {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv)

  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag().toString('base64')

  return { encrypted, iv: iv.toString('base64'), authTag }
}
```

**存储结构**:
```prisma
model ProviderConfig {
  encryptedApiKey String?  // AES-256-GCM 加密后的 API Key
  encryptionIv    String?  // 初始化向量
  authTag         String?  // GCM 认证标签
  keyVersion      Int      // 密钥版本（支持密钥轮换）
}
```

---

## 性能优化

### 1. 会话缓存

```typescript
// SessionProvider 自动缓存
<SessionProvider refetchInterval={300}>  {/* 5分钟刷新一次 */}
  {children}
</SessionProvider>
```

### 2. 数据库索引

```prisma
model Session {
  @@index([userId])          // ✅ 快速查询用户会话
}

model Account {
  @@index([userId])          // ✅ 快速查询用户账号
  @@unique([provider, providerAccountId])  // ✅ 防止重复+快速查询
}

model Conversation {
  @@index([userId, updatedAt])        // ✅ 按时间排序查询
  @@index([userId, clientUpdatedAt])  // ✅ 客户端时间戳查询
}
```

### 3. 连接池优化

```typescript
// server/db.ts
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
})

// 生产环境自动使用连接池
// 默认配置: connection_limit=10
```

---

## 最佳实践

### ✅ DO（推荐）

1. **始终使用 protectedProcedure**
   ```typescript
   // ✅ 正确
   export const userRouter = createTRPCRouter({
     getData: protectedProcedure.query(async ({ ctx }) => {
       return ctx.db.user.findUnique({ where: { id: ctx.session.user.id } })
     })
   })
   ```

2. **检查 session 状态**
   ```typescript
   // ✅ 正确
   const { data: session, status } = useSession()

   if (status === "loading") return <Spinner />
   if (status === "unauthenticated") return <LoginPrompt />

   // 现在可以安全使用 session.user
   ```

3. **使用 Cascade 删除**
   ```prisma
   // ✅ 正确
   user User @relation(fields: [userId], references: [id], onDelete: Cascade)
   ```

4. **环境变量验证**
   ```typescript
   // ✅ 正确
   function requireEnv(name: string): string {
     const value = process.env[name]
     if (!value) {
       throw new Error(`Missing required environment variable: ${name}`)
     }
     return value
   }
   ```

### ❌ DON'T（避免）

1. **不要在客户端信任 session**
   ```typescript
   // ❌ 错误：客户端可以伪造
   const canDelete = session?.user?.role === "admin"

   // ✅ 正确：服务端验证
   const canDelete = await checkAdminRole(ctx.session.user.id)
   ```

2. **不要暴露敏感字段**
   ```typescript
   // ❌ 错误
   select: { id: true, email: true, password: true }

   // ✅ 正确
   select: { id: true, name: true, image: true }
   ```

3. **不要跳过 CSRF 验证**
   ```typescript
   // ❌ 错误
   providers: [
     CredentialsProvider({
       credentials: { ... },
       authorize: async (credentials) => { ... }
     })
   ]

   // ✅ 正确：使用 OAuth（内置 CSRF 保护）
   providers: [GitHubProvider({ ... })]
   ```

---

## 优化建议

### 1. 添加更多 OAuth 提供商

```typescript
// server/auth.ts
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"

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

### 2. 实现会话过期提醒

```typescript
// components/session-expiry-warning.tsx
export function SessionExpiryWarning() {
  const { data: session } = useSession()
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    if (!session?.expires) return

    const expiryTime = new Date(session.expires).getTime()
    const now = Date.now()
    const timeUntilExpiry = expiryTime - now

    // 5分钟前提醒
    if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
      setShowWarning(true)
    }
  }, [session])

  if (!showWarning) return null

  return (
    <Alert>
      <AlertTitle>会话即将过期</AlertTitle>
      <AlertDescription>
        请保存您的工作并重新登录
      </AlertDescription>
    </Alert>
  )
}
```

### 3. 添加用户角色管理

```prisma
// schema.prisma
model User {
  id    String @id @default(cuid())
  role  String @default("user")  // "user" | "admin" | "premium"
  // ...
}
```

```typescript
// server/auth.ts
callbacks: {
  session: ({ session, user }) => {
    if (session.user) {
      session.user.id = user.id
      session.user.role = user.role  // ✅ 添加角色到 session
    }
    return session
  },
}
```

### 4. 实现会话活跃度追踪

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  lastActive   DateTime @default(now())  // ✅ 新增

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([lastActive])  // ✅ 清理过期会话
}
```

### 5. 添加登录审计日志

```prisma
model LoginAudit {
  id        String   @id @default(cuid())
  userId    String
  ip        String
  userAgent String
  success   Boolean
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([ip, createdAt])
}
```

```typescript
// server/auth.ts
callbacks: {
  signIn: async ({ user, account, profile }) => {
    await db.loginAudit.create({
      data: {
        userId: user.id,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: true,
      }
    })
    return true
  }
}
```

### 6. 实现 JWT 策略（可选）

如果需要无状态会话：

```typescript
// server/auth.ts
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",  // ✅ 使用 JWT 代替数据库会话
    maxAge: 30 * 24 * 60 * 60,  // 30 天
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id
      }
      return session
    },
  },
}
```

**JWT vs Database Sessions**:

| 特性 | Database Sessions | JWT |
|------|------------------|-----|
| 性能 | 需要数据库查询 | 无需查询（解码 token） |
| 安全性 | 可立即撤销 | 无法撤销（直到过期） |
| 扩展性 | 受限于数据库 | 无状态，易扩展 |
| 数据大小 | 不限制 | 受 Cookie 大小限制（4KB） |
| **推荐** | ✅ 需要即时撤销会话 | ⚠️ 高并发无状态场景 |

---

## 总结

### 当前架构优势

✅ **安全性**
- OAuth 2.0 标准流程
- Database Sessions（可即时撤销）
- CSRF 自动保护
- API Key AES-256-GCM 加密

✅ **类型安全**
- TypeScript 全栈类型推导
- tRPC 自动生成客户端类型
- Prisma 类型安全的数据库查询

✅ **用户体验**
- 一键 GitHub 登录
- 自动会话刷新
- 云端数据同步（需登录）

✅ **开发体验**
- 清晰的文件结构
- 统一的认证中间件
- 完善的错误处理

### 潜在改进空间

⚠️ **多租户支持**
- 添加组织/团队概念
- 实现权限管理（RBAC）

⚠️ **监控和审计**
- 登录审计日志
- 异常登录检测
- 会话活跃度追踪

⚠️ **用户体验优化**
- 会话过期提醒
- 多设备管理
- 账号绑定/解绑

---

## 参考资源

- [NextAuth.js 官方文档](https://next-auth.js.org/)
- [Prisma Adapter 文档](https://authjs.dev/reference/adapter/prisma)
- [tRPC 认证指南](https://trpc.io/docs/server/authorization)
- [OAuth 2.0 规范](https://oauth.net/2/)

---

**文档维护**: 建议每次认证相关修改后更新此文档
