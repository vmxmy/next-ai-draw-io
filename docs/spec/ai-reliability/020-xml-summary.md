# 020-服务端 XML 摘要系统消息

> 状态：草案  
> 负责人：待定  
> 关联任务：A2

## 1. 背景 / 问题
- 当前行为：每轮请求都把完整 `Current diagram XML` 放入 system。  
- 痛点：  
  - XML 体积随会话增长，模型每次都要“从零读全量 XML”；  
  - token 成本高、时延上升；  
  - 模型更容易遗漏关键 id/结构，导致 edit 不精确。  
- 影响范围：中大型图、多轮增量编辑。

## 2. 目标与非目标
**目标（可量化）**
- 在不降低质量前提下，平均 inputTokens 下降 ≥10–20%。  
- 长会话（≥8 轮）下 edit 失败率不升反降。  

**非目标**
- 不替代原始 XML（原 XML 仍是权威真相源）。  
- 不在此任务实现历史裁剪（见 090）。

## 3. 用户故事 / 使用场景
1. 用户连续 10 轮逐步完善系统架构图。  
   预期：模型优先读“摘要 + 当前 XML”，保持 edit 精确且 token 增长缓慢。  
2. 用户在复杂泳道/容器图中调整某个节点连线。  
   预期：摘要能快速定位目标 cell id 与 parent/container。

## 4. 方案选项与取舍（至少两种）
### 方案 A（推荐）：服务端生成轻量摘要 system message
- 做法：服务端解析 current XML，生成结构化摘要字符串，插入 system messages（与原 XML 并列）。  
- 优点：  
  - 改动集中在服务端（KISS）；  
  - 摘要可与 analyze 复用解析逻辑（DRY）。  
- 缺点：  
  - 每轮都要解析一次 XML（需注意性能）。  

### 方案 B：客户端生成摘要并随 user message 发送
- 做法：客户端本地解析，摘要作为 user message 附加段发送。  
- 优点：服务端无额外 CPU；摘要可做 UI 预览。  
- 缺点：客户端解析复杂度更高；摘要混在 user role 可能被模型当作需求而非上下文。  

**选择与理由**
- 选择方案 A：保持上下文一致性与角色语义正确，且复用服务端解析更易控。

## 5. 详细设计
- 新增 `lib/xml-summary.ts`：  
  - 输入：完整 current XML（`<mxfile>` 级或 `<root>` 级）  
  - 输出：摘要文本，建议长度控制在 300–600 tokens：  
    - `Summary Nodes:` 只列关键节点（value 非空、vertex=1），包含 id/value/parent/粗略 bbox；  
    - `Summary Edges:` id/source/target/label；  
    - `Containers:` swimlane/container 节点；  
    - `Warnings:` 结构异常（可复用 `validateMxCellStructure` 的结果）。  
- 服务端注入位置：`app/api/chat/route.ts` 的 systemMessages 中，在“静态指令”之后、“原始 XML”之前插入：  
  - `Current diagram summary (non-authoritative): ...`  
- 失败降级：若解析失败或超过上限，跳过摘要，不影响主链路。  
- 上限保护：对 cell 数量或 XML 长度设阈值（如 >10k cells 直接给“摘要省略”）。  

## 6. 变更清单（按 PR 粒度）
### PR 020-1：XML 摘要生成器
- 范围：新增摘要模块。  
- 实现步骤：  
  1. 解析 `<mxCell>`；  
  2. 过滤与采样；  
  3. 输出稳定格式。  
- 影响文件：  
  - 新增：`lib/xml-summary.ts`  
- 风险点：解析兼容性（mxfile/mxGraphModel/root 多形态）。  

### PR 020-2：chat route 注入摘要
- 范围：systemMessages 增加摘要段。  
- 影响文件：  
  - 修改：`app/api/chat/route.ts`

## 7. 验收标准
**功能**
- 每轮请求 system 中包含摘要段；解析失败时主链路不受影响。  

**性能 / 成本**
- inputTokens 对比基线下降 ≥10%。  
- 解析耗时 P95 < 200ms。  

**质量**
- 长会话 edit 失败率下降或持平。  

## 8. 风险与回滚
- 风险：摘要与原 XML 不一致导致模型误判。  
- 缓解：摘要明确标注“非权威，仅供快速定位”，原 XML 仍是单一真相源。  
- 回滚：注释/删除 system 摘要插入即可。

## 9. 里程碑与依赖
- 前置依赖：无，但可复用 010 的解析器（如先合 010-1）。  
- 可并行：与 010 并行开发。  
- 计划时间：PR 020-1/2 约 2 天。
