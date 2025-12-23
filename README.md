# Next AI Draw.io（增强版 Fork）

本仓库基于原项目 `DayuanJiang/next-ai-draw-io` 二次开发，重点补齐了“账号体系 + 云端能力 + 配额治理 + 管理后台”等工程化能力，并对 AI/绘图可靠性与移动端体验做了增强。

<div align="center">

**AI 驱动的 draw.io 图表创作工具（对话、绘图、可视化）**

中文（本页） | [中文（上游翻译）](./docs/README_CN.md) | [日本語](./docs/README_JA.md)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb)](https://react.dev/)

（上游）[![Sponsor](https://img.shields.io/badge/Sponsor-❤-ea4aaa)](https://github.com/sponsors/DayuanJiang)

（演示）[![Live Demo](./public/live-demo-button.svg)](https://drawio.gaoxin.net.cn/)

</div>

https://github.com/user-attachments/assets/9d60a3e8-4a1c-4b5e-acbb-26af2d3eabd1

## 本 Fork 的增强功能（相对原项目）

> 目标：在保留“自然语言生成/编辑 draw.io”的核心体验基础上，补齐可运营、可治理、可持续迭代的工程能力。

- **账号体系与云端同步**：集成 NextAuth（GitHub/Google/手机验证码），支持用户中心与会话隔离；对话/会话支持云端同步（Postgres + Prisma）。
- **BYOK（自带 Key）治理升级**：支持多凭证管理、模式切换（本地/云端/BYOK）、模型列表自动加载；BYOK 用户可绕过公共配额限制，UI 显示更清晰的模式/配额状态。
- **配额与风控**：匿名用户支持 IP 级别日限/TPM 限流与实时配额展示；配额弹窗对匿名与登录用户一致可用，并提供更细的提示与阈值颜色指示。
- **管理后台（Admin）**：新增 RBAC（角色权限）与审计日志；提供用户/会话/配额/等级/系统配置/IP 管理等页面，支持移动端自适应。
- **AI/绘图可靠性增强**：
  - **A2UI 风格“组件化绘图”**：引入 `display_components` 能力，将组件规范自动转换为 draw.io XML，提升长图与复杂图生成稳定性；兼容**非视觉模型**场景。
  - **结构化编辑与回滚**：`edit_diagram` 强制结构化操作（add/update/delete/组件级 addComponent），并基于会话时间线驱动 undo/redo 与版本统一管理。
  - **XML 自动修复引擎**：集成 23+ 修复策略，显著提升常见 LLM XML 输出错误的自愈能力。
- **输入与效率**：支持 Firecrawl 网页抓取（URL 预处理注入上下文）；图片自动缩放以减少视觉模型 token 消耗。
- **体验与外观**：draw.io UI 切换为 `kennedy/atlas`（完整工具栏）；主题系统升级（tweakcn/shadcn），支持颜色预览与“一键应用主题到图表”。

## 目录

- [本 Fork 的增强功能（相对原项目）](#本-fork-的增强功能相对原项目)
- [快速开始](#快速开始)
- [运行与配置](#运行与配置)
- [示例](#示例)
- [功能特性（继承上游）](#功能特性继承上游)
- [多 Provider 支持](#多-provider-支持)
- [工作原理](#工作原理)
- [项目结构](#项目结构)
- [归属与许可](#归属与许可)

## 快速开始

### 1) 准备环境变量

```bash
cp env.example .env.local
```

至少需要配置：

- `AI_PROVIDER` / `AI_MODEL` + 对应 Provider 的 Key（例如 `OPENAI_API_KEY`）
- `DATABASE_URL`（Postgres）
- `ENCRYPTION_KEY`（用于加密云端存储的用户凭证）
- `NEXTAUTH_URL` / `NEXTAUTH_SECRET`（开启登录/云端能力时必填）
- `ADMIN_EMAILS`（可选，逗号分隔；用于初始化超级管理员角色分配）
- `BOOTSTRAP_ADMIN_ENABLED` / `BOOTSTRAP_ADMIN_ALLOWLIST`（可选：首次安装“开箱可进后台”，见下）

> OAuth 配置参考：`docs/GOOGLE_OAUTH_SETUP.md` 与 NextAuth 相关文档。手机验证码登录依赖短信服务配置（见 `server/services/sms/`）。

### 2) 初始化数据库（Prisma）

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:dev
```

（可选）初始化系统配置/等级/RBAC：

```bash
npx tsx prisma/seed-system-config.ts
npx tsx prisma/seed-tier-config.ts
npx tsx prisma/seed-rbac.ts
```

> 开箱进入后台（推荐做法）：设置 `BOOTSTRAP_ADMIN_ENABLED=true`，并用 `BOOTSTRAP_ADMIN_ALLOWLIST` 指定允许成为“首个 superAdmin”的邮箱或手机号（逗号分隔）。系统在**尚无 superAdmin**时，会将首个成功登录且命中白名单的用户授予 `superAdmin`（并使用数据库锁避免并发抢占）。

### 3) 启动开发环境

```bash
npm run dev
```

打开 `http://localhost:6002`。

## 运行与配置

### Docker（自备 Postgres）

本仓库的增强能力依赖 Postgres。你可以：

- **方案 A（推荐）**：使用你自己的 Postgres（本地/云端），把 `DATABASE_URL` 写入 `.env`/`.env.local`。
- **方案 B**：自行扩展 `docker-compose.yml` 增加 `postgres` 服务。

### Firecrawl（可选）

启用 URL 内容预处理：

- `FIRECRAWL_API_KEY`
- `FIRECRAWL_API_URL`（可选，自定义 Firecrawl API 地址）

## 示例

你可以用自然语言创建/修改 draw.io 图表；并可直接把网页 URL 放进提示词中（若启用 Firecrawl，会自动抓取主内容后注入上下文）。

<div align="center">
<table width="100%">
  <tr>
    <td colspan="2" valign="top" align="center">
      <strong>动画连线：Transformer 结构</strong><br />
      <p><strong>Prompt:</strong> Give me a <strong>animated connector</strong> diagram of transformer's architecture.</p>
      <img src="./public/animated_connectors.svg" alt="Transformer Architecture with Animated Connectors" width="480" />
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>GCP 架构图</strong><br />
      <p><strong>Prompt:</strong> Generate a GCP architecture diagram with <strong>GCP icons</strong>. In this diagram, users connect to a frontend hosted on an instance.</p>
      <img src="./public/gcp_demo.svg" alt="GCP Architecture Diagram" width="480" />
    </td>
    <td width="50%" valign="top">
      <strong>AWS 架构图</strong><br />
      <p><strong>Prompt:</strong> Generate a AWS architecture diagram with <strong>AWS icons</strong>. In this diagram, users connect to a frontend hosted on an instance.</p>
      <img src="./public/aws_demo.svg" alt="AWS Architecture Diagram" width="480" />
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>Azure 架构图</strong><br />
      <p><strong>Prompt:</strong> Generate a Azure architecture diagram with <strong>Azure icons</strong>. In this diagram, users connect to a frontend hosted on an instance.</p>
      <img src="./public/azure_demo.svg" alt="Azure Architecture Diagram" width="480" />
    </td>
    <td width="50%" valign="top">
      <strong>随手画：小猫</strong><br />
      <p><strong>Prompt:</strong> Draw a cute cat for me.</p>
      <img src="./public/cat_demo.svg" alt="Cat Drawing" width="240" />
    </td>
  </tr>
</table>
</div>

## 功能特性（继承上游）

- **LLM 驱动的图表创建与编辑**：通过自然语言生成/修改 draw.io XML
- **基于图片的图表复刻**：上传图片/现有图表，让 AI 复刻并增强
- **PDF & 文本上传**：从文档中抽取内容生成图表
- **AI 推理展示**：对支持的模型展示思考过程（OpenAI o1/o3/gpt-5、Gemini、Claude 等）
- **图表历史**：变更追踪与回滚
- **交互式对话**：通过对话持续迭代图表
- **云架构图支持**：AWS/GCP/Azure 图标/风格增强
- **动画连线**：支持生成动态/动画连接线

## 多 Provider 支持

- AWS Bedrock（默认）
- OpenAI
- Anthropic
- Google AI
- Azure OpenAI
- Ollama
- OpenRouter
- DeepSeek
- SiliconFlow

Provider 详细配置说明见：`docs/ai-providers.md`。

## 工作原理

- **Next.js App Router**：UI 与 API
- **Vercel AI SDK**（`ai` + `@ai-sdk/*`）：流式输出、多 Provider
- **react-drawio**：draw.io 渲染与交互

图表以 draw.io XML 表示，AI 通过工具调用生成/编辑 XML；本 Fork 在此基础上加入组件化绘图、结构化操作、自动修复、云端同步与治理能力。

## 项目结构

```
app/                  # Next.js App Router（含 admin/auth/api）
features/             # Chat 相关模块化实现（会话、云同步、AI 适配）
components/           # 可复用 UI（shadcn/ui + Radix）
contexts/             # 全局状态（diagram/chat）
lib/                  # 工具与 AI 适配（含 A2UI 组件系统、XML 修复等）
server/               # 服务端能力（auth/db/quota/预处理）
prisma/               # 数据模型与迁移
docs/                 # 技术文档（认证/合规/设计）
```

## 归属与许可

- **原项目（Upstream）**：`https://github.com/DayuanJiang/next-ai-draw-io`
- **本仓库（Fork）**：`https://github.com/vmxmy/next-ai-draw-io`
- **许可证**：Apache-2.0（保留原许可；本仓库为衍生作品）
- 合规审计与衍生作品说明：`docs/LICENSE_COMPLIANCE_AUDIT.md`
