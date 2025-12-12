# 030-前后端文件限制常量统一

> 状态：草案  
> 负责人：待定  
> 关联任务：A3

## 1. 背景 / 问题
- 当前行为：  
  - 客户端 `components/chat-input.tsx` 定义 `MAX_IMAGE_SIZE=2MB`、`MAX_FILES=5`；  
  - 服务端 `app/api/chat/route.ts` 定义 `MAX_FILE_SIZE=2MB`、`MAX_FILES=5`。  
- 痛点：常量重复且命名不同，未来调整时易漂移，造成一端放行另一端拒绝。  
- 影响范围：文件上传与 AI 输入链路。

## 2. 目标与非目标
**目标**
- 将文件限制抽为单一来源（DRY），两端复用。  
- 任何未来调整只改一处。  

**非目标**
- 不改变当前限制值与 UI 行为。

## 3. 用户故事 / 使用场景
1. 调整最大文件数到 10 时，前后端无需分别修改且行为一致。  
2. 引入新文件类型时，限制逻辑仍保持统一。

## 4. 方案选项与取舍（至少两种）
### 方案 A（推荐）：抽 `lib/limits.ts` 共享常量
- 做法：新增 `lib/limits.ts` 导出 `MAX_FILE_SIZE_BYTES`、`MAX_FILES`；两端直接 import。  
- 优点：最小改动、清晰直观（KISS/DRY）。  
- 缺点：服务端与客户端共享模块需确保无浏览器专属依赖（当前 lib 为纯 TS，无问题）。  

### 方案 B：通过 `/api/config` 下发限制
- 做法：服务端配置为单一真相源，客户端启动时拉取。  
- 优点：可动态配置；适合未来多环境差异。  
- 缺点：增加一次请求与状态复杂度，当前需求不成立（YAGNI）。  

**选择与理由**
- 选择方案 A，满足当前一致性需求且不引入额外复杂度。

## 5. 详细设计
- 新文件：`lib/limits.ts`  
  - `export const MAX_FILES = 5`  
  - `export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024`  
  - 可补充派生值（如 `MAX_FILE_SIZE_MB`）供 UI 展示。  
- 客户端引用：替换 `MAX_IMAGE_SIZE/MAX_FILES` 为 import。  
- 服务端引用：替换 `MAX_FILE_SIZE/MAX_FILES` 为 import。  

## 6. 变更清单（按 PR 粒度）
### PR 030-1：抽共享常量并替换引用
- 范围：常量抽取与两端替换。  
- 实现步骤：  
  1. 新增 `lib/limits.ts`；  
  2. 更新 `components/chat-input.tsx`；  
  3. 更新 `app/api/chat/route.ts`。  
- 影响文件：  
  - 新增：`lib/limits.ts`  
  - 修改：`components/chat-input.tsx`  
  - 修改：`app/api/chat/route.ts`  

## 7. 验收标准
- 上传限制行为与文案不变；两端使用同一常量。  
- 通过 `npm run lint` 与 `npm run build`。

## 8. 风险与回滚
- 风险：共享模块若未来引入浏览器依赖会影响服务端。  
- 缓解：`lib/limits.ts` 保持纯常量文件。  
- 回滚：恢复各自常量即可（无数据迁移）。  

## 9. 里程碑与依赖
- 前置依赖：无。  
- 计划时间：PR 030-1 0.5 天。
