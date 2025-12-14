# Google OAuth 设置指南

本指南将帮助你配置 Google OAuth 登录功能。

---

## 📋 前提条件

- Google 账号
- Google Cloud Platform 项目访问权限
- 本地开发环境已配置

---

## 🚀 快速开始（5 分钟）

### 步骤 1: 创建 Google Cloud Project

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击顶部的项目选择器
3. 点击 "New Project"（新建项目）
4. 输入项目名称：`AI Draw IO`
5. 点击 "Create"（创建）

### 步骤 2: 启用 Google+ API

1. 在左侧菜单中，导航到 **APIs & Services** > **Library**
2. 搜索 "Google+ API"
3. 点击 "Google+ API"
4. 点击 "Enable"（启用）

### 步骤 3: 配置 OAuth同意屏幕

1. 导航到 **APIs & Services** > **OAuth consent screen**
2. 选择 "External"（外部）用户类型
3. 点击 "Create"（创建）

**填写应用信息**:
```
App name: AI Draw IO
User support email: your-email@example.com
App logo: (可选，上传你的 Logo)
Application home page: http://localhost:6002
Application privacy policy: http://localhost:6002/privacy
Application terms of service: http://localhost:6002/terms
```

**Authorized domains** (授权域名):
```
localhost (开发环境)
yourdomain.com (生产环境)
```

**Developer contact information** (开发者联系信息):
```
Email addresses: your-email@example.com
```

4. 点击 "Save and Continue"（保存并继续）

**Scopes** (权限范围):
- 点击 "Add or Remove Scopes"（添加或移除权限范围）
- 选择以下权限：
  - `/auth/userinfo.email` - 查看邮箱地址
  - `/auth/userinfo.profile` - 查看基本个人信息
  - `openid` - OpenID Connect 认证
- 点击 "Update"（更新）
- 点击 "Save and Continue"（保存并继续）

**Test users** (测试用户):
- 在开发阶段，添加测试用户邮箱（可选）
- 点击 "Save and Continue"（保存并继续）

5. 查看摘要，点击 "Back to Dashboard"（返回控制面板）

### 步骤 4: 创建 OAuth 2.0 凭据

1. 导航到 **APIs & Services** > **Credentials**
2. 点击 "+ Create Credentials"（创建凭据）
3. 选择 "OAuth client ID"（OAuth 客户端 ID）

**配置 OAuth 客户端**:

```
Application type: Web application
Name: AI Draw IO - Development
```

**Authorized JavaScript origins** (已授权的 JavaScript 来源):
```
http://localhost:6002
http://localhost:3000
```

**Authorized redirect URIs** (已授权的重定向 URI):
```
http://localhost:6002/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

4. 点击 "Create"（创建）

### 步骤 5: 保存凭据

创建成功后，会显示 **Client ID** 和 **Client Secret**：

```
Client ID: 123456789-abcdefg.apps.googleusercontent.com
Client Secret: GOCSPX-abc123def456
```

⚠️ **重要**: 妥善保管 Client Secret，不要泄露或提交到版本控制！

### 步骤 6: 配置环境变量

1. 复制 `.env.local.example` 到 `.env.local`（如果还没有）
2. 添加 Google OAuth 凭据：

```env
# Google OAuth
GOOGLE_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_SECRET=GOCSPX-abc123def456
```

3. 确保已配置其他必需环境变量：

```env
NEXTAUTH_URL=http://localhost:6002
NEXTAUTH_SECRET=your-random-32-char-secret
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

**生成 NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

### 步骤 7: 测试登录

1. 启动开发服务器：
   ```bash
   npm run dev
   ```

2. 打开浏览器访问：
   ```
   http://localhost:6002/auth/signin
   ```

3. 点击 "Continue with Google"

4. 使用你的 Google 账号登录

5. 授权应用访问你的基本信息

6. 登录成功后，你应该被重定向回首页

---

## 🌐 生产环境配置

### 步骤 1: 更新 OAuth 客户端

1. 返回 [Google Cloud Console](https://console.cloud.google.com/)
2. 导航到 **APIs & Services** > **Credentials**
3. 点击你创建的 OAuth 客户端
4. 添加生产环境 URL：

**Authorized JavaScript origins**:
```
https://yourdomain.com
```

**Authorized redirect URIs**:
```
https://yourdomain.com/api/auth/callback/google
```

5. 点击 "Save"（保存）

### 步骤 2: 更新环境变量

在生产环境的 `.env` 文件中：

```env
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-production-secret
GOOGLE_ID=your-google-client-id
GOOGLE_SECRET=your-google-client-secret
```

### 步骤 3: 发布应用（可选）

如果你的应用需要对所有 Google 用户开放：

1. 导航到 **OAuth consent screen**
2. 点击 "Publish App"（发布应用）
3. 提交验证（可能需要 Google 审核，通常需要几天时间）

---

## 🔧 常见问题

### 问题 1: "redirect_uri_mismatch" 错误

**原因**: 重定向 URI 不匹配

**解决方案**:
1. 检查 OAuth 客户端配置中的 **Authorized redirect URIs**
2. 确保包含: `http://localhost:6002/api/auth/callback/google`
3. URL 必须完全匹配，包括协议、域名、端口和路径

### 问题 2: "access_denied" 错误

**原因**: 用户拒绝授权或应用未发布

**解决方案**:
- 确保在 OAuth 同意屏幕中添加了测试用户
- 或者发布应用（生产环境）

### 问题 3: "invalid_client" 错误

**原因**: Client ID 或 Client Secret 错误

**解决方案**:
1. 检查 `.env.local` 文件中的 `GOOGLE_ID` 和 `GOOGLE_SECRET`
2. 确保没有多余的空格
3. 重新生成凭据（如果怀疑泄露）

### 问题 4: 登录后立即退出

**原因**: 数据库配置问题

**解决方案**:
1. 检查 `DATABASE_URL` 是否正确
2. 确保数据库迁移已执行：
   ```bash
   npx prisma migrate dev
   ```
3. 检查数据库连接是否正常

### 问题 5: "Cannot find module 'next-auth/providers/google'"

**原因**: 依赖未安装

**解决方案**:
```bash
npm install next-auth
```

---

## 🔐 安全最佳实践

### 1. 保护 Client Secret

❌ **不要**:
- 将 Client Secret 提交到 Git
- 在客户端代码中暴露 Client Secret
- 在日志中打印 Client Secret

✅ **应该**:
- 使用环境变量存储
- 添加 `.env.local` 到 `.gitignore`
- 定期轮换凭据（每 90 天）

### 2. 限制权限范围

只请求必要的权限：
```typescript
// ✅ 推荐：仅请求基本信息
scopes: ['openid', 'email', 'profile']

// ❌ 避免：请求过多权限
scopes: ['openid', 'email', 'profile', 'drive', 'calendar']
```

### 3. 验证重定向 URI

确保 OAuth 客户端中只包含合法的重定向 URI：
```
✅ https://yourdomain.com/api/auth/callback/google
❌ https://evil-site.com/steal-tokens
```

### 4. 启用 HTTPS（生产环境）

生产环境必须使用 HTTPS：
```env
# ✅ 生产环境
NEXTAUTH_URL=https://yourdomain.com

# ❌ 不安全
NEXTAUTH_URL=http://yourdomain.com
```

---

## 📊 监控和分析

### Google Cloud Console 仪表板

1. 导航到 **APIs & Services** > **Dashboard**
2. 查看 API 使用情况
3. 监控配额和限制

### NextAuth 日志

启用调试日志：
```env
NEXTAUTH_DEBUG=true
```

查看控制台输出：
```bash
[next-auth][debug] oauth: sign in with google
[next-auth][debug] oauth: callback from google
```

---

## 🔄 轮换凭据

建议每 90 天轮换一次 OAuth 凭据：

### 步骤 1: 创建新凭据

1. 创建新的 OAuth 客户端（保留旧的）
2. 获取新的 Client ID 和 Secret

### 步骤 2: 更新环境变量

```env
GOOGLE_ID=new-client-id
GOOGLE_SECRET=new-client-secret
```

### 步骤 3: 部署并测试

1. 部署新配置
2. 测试登录流程
3. 确认正常后，删除旧的 OAuth 客户端

---

## 📚 参考资源

- [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)

---

## ✅ 配置检查清单

- [ ] Google Cloud Project 已创建
- [ ] Google+ API 已启用
- [ ] OAuth 同意屏幕已配置
- [ ] OAuth 客户端已创建
- [ ] Client ID 和 Secret 已保存
- [ ] 环境变量已配置
- [ ] 重定向 URI 已添加
- [ ] 本地测试成功
- [ ] 生产环境 URL 已添加（如果适用）
- [ ] 安全最佳实践已遵循

---

**最后更新**: 2025-12-14
**维护者**: 开发团队
