# Code Review Report - next-ai-draw-io

**版本**: 0.4.0
**审查日期**: 2025-12-16
**审查类型**: 全面审查 (安全、性能、代码质量、最佳实践)

---

## 目录

- [执行摘要](#执行摘要)
- [问题汇总](#问题汇总)
- [阶段 1: 认证系统](#阶段-1-认证系统)
- [阶段 2: 配额限流](#阶段-2-配额限流)
- [阶段 3: AI 功能](#阶段-3-ai-功能)
- [阶段 4: 会话管理](#阶段-4-会话管理)
- [阶段 5: 安全性补充](#阶段-5-安全性补充)
- [阶段 6: 代码质量和性能](#阶段-6-代码质量和性能)
- [修复建议优先级](#修复建议优先级)

---

## 执行摘要

### 整体评估

项目代码质量整体良好，具备以下优点：
- 完善的 RBAC 权限系统
- AES-256-GCM 加密 API Key
- 良好的 SSRF 防护
- 本地/云端会话同步机制设计合理
- 使用 Zod 进行输入验证

需要关注的问题：
- SMS 验证码安全性不足
- BYOK 配额绕过风险
- 部分 API 端点缺少速率限制

### 问题统计

| 优先级 | 数量 | 已修复 | 待处理 |
|--------|------|--------|--------|
| P0 (必须修复) | 3 | 3 | 0 |
| P1 (应该修复) | 5 | 2 | 3 |
| P2 (建议修复) | 4 | 0 | 4 |
| P3 (可选) | 3 | 0 | 3 |

---

## 问题汇总

### P0 - 必须修复

| ID | 问题 | 位置 | 风险 | 状态 |
|----|------|------|------|------|
| P0-1 | SMS 验证码仅 6 位 | `server/services/sms/verification.ts:5` | 暴力破解 | **已修复** |
| P0-2 | 验证码尝试次数无上限 | `server/services/sms/verification.ts:111-115` | 暴力破解 | **已修复** |
| P0-3 | BYOK 可绕过所有配额限制 | `server/quota-enforcement.ts` | 资源滥用 | **已修复** |

### P1 - 应该修复

| ID | 问题 | 位置 | 风险 | 状态 |
|----|------|------|------|------|
| P1-1 | SMS 发送端点无速率限制 | `app/api/auth/phone/send-code/route.ts` | SMS 费用滥用 | **已修复** |
| P1-2 | SMS 使用 GET 请求 | `server/services/sms/smsbao.ts:70-73` | 敏感信息泄露 | 待处理 |
| P1-3 | 手机号明文存储 | `prisma/schema.prisma` | 数据泄露风险 | 待处理 |
| P1-4 | RBAC 权限检查 N+1 查询 | `server/api/middleware/rbac.ts` | 性能问题 | **已修复** |
| P1-5 | Fail-Open 策略风险 | `server/quota-enforcement.ts:309-313` | 配额失效 | 待处理 |

### P2 - 建议修复

| ID | 问题 | 位置 | 风险 |
|----|------|------|------|
| P2-1 | 文件上传仅检查 MIME 类型 | `app/api/files/upload/route.ts:82-95` | 文件类型欺骗 |
| P2-2 | 审计日志缺少 IP 和 UA | `server/api/middleware/audit.ts` | 追踪困难 |
| P2-3 | 手机号验证过于宽松 | `lib/validation/phone.ts:1` | 无效号码 |
| P2-4 | 开发环境返回验证码 | `app/api/auth/phone/send-code/route.ts:40` | 信息泄露 |

### P3 - 可选

| ID | 问题 | 位置 | 风险 |
|----|------|------|------|
| P3-1 | Ollama 允许 HTTP | `server/api/routers/provider-config.ts:27` | 中间人攻击 |
| P3-2 | 大型文件可拆分优化 | 多个文件 | 可维护性 |
| P3-3 | 访问码明文存储 | 环境变量 | 低风险 |

---

## 阶段 1: 认证系统

### 审查文件
- `/server/auth.ts`
- `/server/services/sms/verification.ts`
- `/server/services/sms/smsbao.ts`
- `/app/api/auth/phone/send-code/route.ts`
- `/server/api/middleware/rbac.ts`

### 优点

1. **NextAuth 配置合理** (`server/auth.ts`)
   - JWT 策略
   - 支持多种 OAuth 提供商
   - 自动注册机制

2. **验证码 Hash 存储** (`server/services/sms/verification.ts:17-18`)
   ```typescript
   const hashCode = (code: string) =>
       createHash("sha256").update(code).digest("hex")
   ```

3. **RBAC 权限系统完善** (`server/api/middleware/rbac.ts`)
   - 支持超级管理员 (*)
   - 支持资源级通配符 (users:*)
   - 支持精确权限匹配

### 问题详情

#### P0-1: SMS 验证码仅 6 位 **[已修复]**

**位置**: `server/services/sms/verification.ts:5`

**风险**: 6 位数字仅有 100 万种组合，平均 50 万次尝试即可破解。

**修复内容**: 已将验证码长度从 6 位增加到 8 位 (1 亿种组合)
```typescript
const CODE_LENGTH = 8 // 8 位验证码，1 亿种组合，增强安全性
```

#### P0-2: 验证码尝试次数无上限 **[已修复]**

**位置**: `server/services/sms/verification.ts:111-115`

**风险**: 虽然记录了尝试次数，但没有检查和限制。

**修复内容**: 添加了 5 次尝试限制，超过后返回 `MAX_ATTEMPTS_EXCEEDED`
```typescript
const MAX_VERIFICATION_ATTEMPTS = 5 // 最大验证尝试次数

// 检查尝试次数是否超限
if (record.attemptCount >= MAX_VERIFICATION_ATTEMPTS) {
    return { ok: false, reason: "MAX_ATTEMPTS_EXCEEDED" }
}
```

#### P1-1: SMS 发送端点无速率限制 **[已修复]**

**位置**: `app/api/auth/phone/send-code/route.ts`

**风险**: 可以无限制发送验证码，造成 SMS 费用。

**修复内容**: 添加了基于 IP 的速率限制，每小时每 IP 最多 5 次请求
```typescript
const SMS_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 小时
const SMS_RATE_LIMIT_MAX_REQUESTS = 5 // 每小时每 IP 最多 5 次

const ipRequestCounts = new Map<string, { count: number; resetAt: number }>()

function checkSmsRateLimit(ipHash: string): { allowed: boolean; retryAfter?: number } {
    // ... 速率限制检查逻辑
}
```

#### P1-2: SMS 使用 GET 请求

**位置**: `server/services/sms/smsbao.ts:70-73`
```typescript
const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
})
```

**风险**: 敏感信息（用户名、密码）在 URL 中，可能被日志记录。

**修复建议**: 联系 SMS 提供商确认是否支持 POST，或配置反向代理不记录该 URL 的参数。

---

## 阶段 2: 配额限流

### 审查文件
- `/server/quota-enforcement.ts`
- `/lib/use-quota-manager.tsx`
- `/app/api/chat/route.ts`

### 优点

1. **多维度配额** (`server/quota-enforcement.ts`)
   - 日请求数
   - 日 Token 数
   - 每分钟 Token 数

2. **IP Hash 存储** (`server/quota-enforcement.ts:23-26`)
   ```typescript
   function hashIp(ip: string): string {
       const salt = process.env.RATE_LIMIT_SALT || ""
       return createHash("sha256").update(`${salt}${ip}`).digest("hex")
   }
   ```

3. **Tier 过期自动降级** (`server/quota-enforcement.ts:73-76`)

### 问题详情

#### P0-3: BYOK 可绕过所有配额限制 **[已修复]**

**位置**: `server/quota-enforcement.ts`

**风险**: 任何提供 API Key 的用户都可以完全绕过配额限制。

**修复内容**: BYOK 用户现在仍受请求数限制 (dailyRequestLimit)，仅绕过 Token 限制
```typescript
// BYOK 用户只检查请求数，不检查 token 限制
const effectiveDailyTokenLimit = bypassBYOK ? 0 : dailyTokenLimit
const effectiveTpmLimit = bypassBYOK ? 0 : tpmLimit

// 返回的 limits 中，BYOK 用户的 token 限制已被清零
const effectiveLimits = bypassBYOK
    ? { ...limits, dailyTokenLimit: 0, tpmLimit: 0 }
    : limits
```

这样 BYOK 用户:
- 仍受每日请求次数限制，防止滥用
- 不受 Token 限制，因为 Token 消耗在用户自己的 API Key 上

#### P1-5: Fail-Open 策略风险

**位置**: `server/quota-enforcement.ts:309-313`
```typescript
const failOpen = process.env.RATE_LIMIT_FAIL_OPEN !== "false"
if (failOpen && !(error instanceof QuotaExceededError)) {
    console.warn("[quota-enforcement] Error, failing open:", error)
    return null
}
```

**风险**: 数据库故障时配额完全失效。

**修复建议**:
- 添加告警通知
- 考虑使用 Redis 作为配额缓存的 fallback
- 或在 fail-open 时应用保守的默认配额

---

## 阶段 3: AI 功能

### 审查文件
- `/lib/ai-providers.ts`
- `/lib/diagram-ops.ts`
- `/server/api/routers/provider-config.ts`

### 优点

1. **完善的 SSRF 防护** (`server/api/routers/provider-config.ts:37-93`)
   - Base URL 白名单
   - 禁止内网 IP
   - 仅允许 HTTPS（Ollama 除外）

2. **DOM 操作而非字符串替换** (`lib/diagram-ops.ts`)
   - 使用 xmldom 解析和操作
   - 避免正则表达式的脆弱性

3. **API Key 加密存储**
   - AES-256-GCM
   - 随机 IV
   - 密钥版本化

### 问题详情

#### P3-1: Ollama 允许 HTTP

**位置**: `server/api/routers/provider-config.ts:27`
```typescript
ollama: /^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\d+)?$/,
```

**风险**: 本地 HTTP 可能被中间人攻击（风险较低）。

**修复建议**: 文档说明风险，建议用户配置 HTTPS。

---

## 阶段 4: 会话管理

### 审查文件
- `/features/chat/sessions/local-storage.ts`
- `/features/chat/sessions/use-cloud-conversations.ts`
- `/server/api/routers/conversation.ts`

### 优点

1. **存储配额管理** (`features/chat/sessions/local-storage.ts`)
   - 80% 阈值警告
   - 自动清理旧会话

2. **防抖保存** (`features/chat/sessions/use-cloud-conversations.ts:227-244`)
   - 1000ms 防抖
   - 数据指纹检测避免重复保存

3. **乐观更新**
   - 立即更新 UI
   - 后台同步云端

4. **输入验证** (`server/api/routers/conversation.ts`)
   - XML 10MB 限制
   - 100 个版本限制
   - 请求 20MB 限制

### 无严重问题

会话管理模块代码质量良好，无需立即修复的问题。

---

## 阶段 5: 安全性补充

### 审查文件
- `/server/encryption.ts`
- `/app/api/files/upload/route.ts`

### 优点

1. **加密实现** (`server/encryption.ts`)
   - AES-256-GCM（带认证）
   - 随机 IV
   - 密钥版本化支持轮换
   - 启动时验证密钥

### 问题详情

#### P2-1: 文件上传仅检查 MIME 类型

**位置**: `app/api/files/upload/route.ts:82-95`
```typescript
function isValidFileType(mimeType: string): boolean {
    return (
        mimeType.startsWith("image/") ||
        mimeType === "application/pdf" ||
        // ...
    )
}
```

**风险**: MIME 类型可以被客户端伪造。

**修复建议**: 添加文件魔数（magic bytes）检查
```typescript
import { fileTypeFromBuffer } from "file-type"

const type = await fileTypeFromBuffer(buffer)
if (!type || !isValidFileType(type.mime)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
}
```

#### P2-4: 开发环境返回验证码

**位置**: `app/api/auth/phone/send-code/route.ts:40`
```typescript
debugCode: process.env.NODE_ENV !== "production" ? code : undefined,
```

**风险**: 如果开发环境被意外暴露，验证码会泄露。

**修复建议**: 使用更严格的条件
```typescript
debugCode: process.env.DEBUG_SMS === "true" ? code : undefined,
```

---

## 阶段 6: 代码质量和性能

### 大型文件分析

| 文件 | 大小 | 建议 |
|------|------|------|
| `components/chat-message-display.tsx` | 79KB | 考虑拆分为子组件 |
| `lib/cached-responses.ts` | 57KB | 可按功能拆分 |
| `contexts/i18n-context.tsx` | 48KB | 翻译数据可外置 |
| `lib/utils.ts` | 38KB | 按功能拆分 |

### 性能问题

#### P1-4: RBAC 权限检查 N+1 查询 **[已修复]**

**位置**: `server/api/middleware/rbac.ts`

**风险**: 每次权限检查都查询数据库，频繁操作时性能差。

**修复内容**: 添加了内存缓存，TTL 1 分钟，最多 1000 个用户
```typescript
const PERMISSION_CACHE_TTL_MS = 60_000 // 1 分钟缓存
const PERMISSION_CACHE_MAX_SIZE = 1000 // 最多缓存 1000 个用户

const permissionCache = new Map<string, CacheEntry>()

function getCachedPermissions(userId: string): string[] | null { ... }
function setCachedPermissions(userId: string, permissions: string[]): void { ... }

// 在用户角色变更时调用此函数清除缓存
export function invalidatePermissionCache(userId: string): void {
    permissionCache.delete(userId)
}
```

`checkUserPermission` 和 `getUserPermissions` 函数现在都使用缓存。

---

## 修复建议优先级

### 立即修复 (P0) - **全部已修复**

1. ~~**SMS 验证码强度** - 增加到 8 位~~ **已修复**
2. ~~**验证码尝试限制** - 添加 5 次尝试上限~~ **已修复**
3. ~~**BYOK 配额绕过** - BYOK 仍受请求数限制~~ **已修复**

### 短期修复 (P1) - 2/5 已修复

1. ~~**SMS 发送速率限制** - 添加基于 IP 的限制~~ **已修复**
2. **SMS 请求方式** - 文档说明或配置 (待处理)
3. ~~**RBAC 权限缓存** - 添加内存缓存~~ **已修复**
4. **手机号加密** - 考虑字段级加密 (待处理)

### 中期改进 (P2)

1. **文件上传魔数检查** - 添加 file-type 库
2. **审计日志增强** - 添加 IP 和 User-Agent
3. **手机号验证** - 使用更严格的正则
4. **调试代码清理** - 使用显式环境变量

### 可选优化 (P3)

1. **大文件拆分** - 提高可维护性
2. **Ollama HTTPS** - 文档说明
3. **访问码存储** - 考虑哈希存储

---

## 附录: 关键文件路径

### 认证相关
```
/server/auth.ts
/server/services/sms/verification.ts
/server/services/sms/smsbao.ts
/app/api/auth/phone/send-code/route.ts
/server/api/middleware/rbac.ts
```

### 配额相关
```
/server/quota-enforcement.ts
/lib/use-quota-manager.tsx
/app/api/chat/route.ts
```

### AI 功能
```
/lib/ai-providers.ts
/lib/diagram-ops.ts
/server/api/routers/provider-config.ts
```

### 会话管理
```
/features/chat/sessions/local-storage.ts
/features/chat/sessions/use-cloud-conversations.ts
/server/api/routers/conversation.ts
```

### 安全相关
```
/server/encryption.ts
/app/api/files/upload/route.ts
```
