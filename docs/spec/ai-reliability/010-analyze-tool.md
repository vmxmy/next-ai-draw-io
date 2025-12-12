# 010-新增只读工具 analyze_diagram

> 状态：草案  
> 负责人：待定  
> 关联任务：A1

## 1. 背景 / 问题
- 当前行为：模型直接依据 system 中的 `Current diagram XML` 选择 `edit_diagram` 或 `display_diagram`。  
- 痛点：在复杂图或多轮会话里，模型常“未读懂图就改图”，导致：
  - `edit_diagram` 的 search pattern 不命中；
  - 修改引入结构错误（重复 id、无效 parent/source/target）；
  - 自动重试消耗 token 与时延。  
- 影响范围：所有需要在既有图上增量编辑的场景。

## 2. 目标与非目标
**目标（可量化）**
- 复杂编辑场景中 `edit_diagram output-error` 占比下降 ≥30%。  
- 同一用户意图下平均自动重试次数下降 ≥0.5 次。  

**非目标**
- 不改变最终图形能力或布局策略。  
- 不在本任务引入新的可写工具（保持只读）。

## 3. 用户故事 / 使用场景
1. 用户：“在现有架构图里增加一个缓存层并连线。”  
   预期：模型先调用 `analyze_diagram` 总结当前节点/容器，再用 `edit_diagram` 精确插入。  
2. 用户：“把‘支付服务’移动到右侧并调整连线。”  
   预期：先 analyze 获取目标节点 id 与连线，再 edit。  

## 4. 方案选项与取舍（至少两种）
### 方案 A（推荐）：服务端新增只读工具
- 做法：在 `/api/chat` 工具列表增加 `analyze_diagram`，输入 current XML（字符串），输出结构化摘要（文本或 JSON 字符串）。客户端仅展示，不触发画布变更。  
- 优点：  
  - 对现有链路侵入最小（KISS）；  
  - 摘要由模型按需调用，易于观察采用率。  
- 缺点：  
  - 模型仍需解析大 XML 来生成摘要（但仅在需要时发生）。  

### 方案 B：客户端本地生成摘要并注入 system
- 做法：客户端解析 XML → 生成摘要 → 每次请求都作为 system message 发送。  
- 优点：  
  - 摘要稳定、token 更省；  
  - 通过本地解析可做更强校验/索引。  
- 缺点：  
  - 实现与维护成本更高；  
  - 每次请求都生成/发送，可能违反 YAGNI（对简单场景无收益）。  

**选择与理由**
- 选择方案 A。先用最小改动验证“先读再改”的收益；若采用率与收益稳定，再考虑方案 B 作为二期优化。

## 5. 详细设计
- 工具 schema：  
  - name: `analyze_diagram`  
  - input: `{ xml: string }`（从 system current XML 透传）  
  - output: 结构化摘要文本，建议格式：  
    - `Nodes:` 列表（id、value、类型 vertex/edge、parent、粗略位置/尺寸）  
    - `Edges:` 列表（id、source、target、label）  
    - `Containers/Swimlanes:` 列表  
    - `Warnings:`（重复 id、缺失 parent、孤儿 edge 等）  
- 服务端实现：新增 `lib/xml-analyzer.ts`，只解析与归纳，不做修改。解析可复用 `jsdom`/`xmldom`（当前依赖已存在）。  
- Prompt 调整：在 `lib/system-prompts.ts` 增加规则：  
  - 当用户意图为“在既有图上增量修改”且图非空时，**先 analyze 再 edit**。  
- Feature flag：env `ENABLE_ANALYZE_TOOL=true` 控制 prompt 强制性；默认开启但可回滚。  

## 6. 变更清单（按 PR 粒度）
### PR 010-1：服务端工具与 analyzer 实现
- 范围：新增 `analyze_diagram` 工具定义与执行分支。  
- 实现步骤：  
  1. `app/api/chat/route.ts` 工具列表加入 schema；  
  2. 新增 `lib/xml-analyzer.ts`（解析并输出摘要）；  
  3. 在 `streamText` 调用中注册工具执行器。  
- 影响文件：  
  - 修改：`app/api/chat/route.ts`  
  - 新增：`lib/xml-analyzer.ts`  
- 风险点：解析性能；需对超大 XML 做长度/节点数上限保护。  

### PR 010-2：客户端展示 analyze 输出
- 范围：支持渲染 analyze tool part。  
- 实现步骤：  
  1. `components/chat-message-display.tsx` 识别 `toolName==="analyze_diagram"`；  
  2. 以折叠块展示摘要（默认折叠）。  
- 影响文件：  
  - 修改：`components/chat-message-display.tsx`  

### PR 010-3：Prompt 规则更新（可合入 010-1 或独立）
- 修改：`lib/system-prompts.ts`

## 7. 验收标准
**功能**
- 模型可调用 `analyze_diagram` 并返回可读摘要；客户端可展示。  
- 在复杂编辑指令下，模型调用顺序为 analyze → edit。  

**性能 / 成本**
- analyze 执行时间 P95 < 300ms（本地解析）。  

**质量**
- edit 的 pattern-not-found 与结构错误比例下降（以 Langfuse 统计）。  

## 8. 风险与回滚
- 风险：模型过度调用 analyze 导致额外 token/时延。  
- 缓解：prompt 仅对“非空图 + 增量编辑意图”触发；必要时限制每轮最多一次。  
- 回滚：关闭 `ENABLE_ANALYZE_TOOL` 或移除工具注册即可恢复原行为。

## 9. 里程碑与依赖
- 前置依赖：无。  
- 可并行：与 020 XML 摘要生成器并行，但共享解析逻辑时需对齐。  
- 计划时间：PR 010-1/2 约 2–3 天。
