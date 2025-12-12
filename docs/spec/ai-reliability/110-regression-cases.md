# 110-典型场景回归集

> 状态：草案  
> 负责人：待定  
> 关联任务：A11

## 1. 背景 / 目的
本回归集用于在变更 system prompt、工具链路（analyze/summary/window/fallback）或 edit 相关逻辑后，快速人工复核关键场景，防止质量回退。  
不引入测试框架（YAGNI），以“可重复的手工场景 + 可量化验收点”为主。

## 2. 使用方式
1. 本地启动：`npm run dev`  
2. 按用例输入文字/上传文件。  
3. 观察：
   - 工具调用顺序是否符合预期；  
   - 图是否渲染成功（无 `output-error`）；  
   - 生成/编辑结果是否满足验收点；  
   - Langfuse 中对应 trace 的 metadata 与工具失败率。

## 3. 回归用例

### Case 01：空白首轮生成（无文件）
- 前置：清空聊天与画布（右下角 trash）。  
- 输入：`画一个三层 Web 架构（浏览器-API-数据库），并加上缓存。`  
- 预期工具：`display_diagram`（不应先 analyze）。  
- 验收点：单页布局、节点不重叠、连线正确、无校验错误。

### Case 02：空白首轮 + 图片
- 前置：空白画布。  
- 输入：上传一张简单流程图截图 + 文本 `按图片复刻并整理成干净的流程图。`  
- 预期工具：`display_diagram`。  
- 验收点：主要结构与图片一致；图片被正确识别为输入；无 `image not supported`。

### Case 03：空白首轮 + PDF
- 前置：空白画布。  
- 输入：上传 1 页 PDF（含系统说明）+ 文本 `从 PDF 提取关键模块画架构图。`  
- 预期工具：`display_diagram`。  
- 验收点：PDF 内容被附加进 user text；图包含主要模块。

### Case 04：增量新增节点（非空图）
- 前置：任意非空架构图（可用 Case 01 的结果）。  
- 输入：`在数据库前增加一个读写分离的 Proxy，并把 API 的连线改到 Proxy。`  
- 预期工具：`analyze_diagram` → `edit_diagram`。  
- 验收点：edit 命中且成功；Proxy 作为新节点加入并正确改线。

### Case 05：增量重命名
- 前置：非空图中存在节点 `API Service`。  
- 输入：`把 API Service 改名为 Backend API，并保持其他不变。`  
- 预期工具：`analyze_diagram` → `edit_diagram`。  
- 验收点：仅文本变化；无多余节点/连线新增。

### Case 06：增量移动与路由
- 前置：非空图（含多个节点）。  
- 输入：`把缓存节点移动到 API 和 DB 之间，并调整连线避免交叉。`  
- 预期工具：`analyze_diagram` → `edit_diagram`。  
- 验收点：节点位置变化；连线清晰不交叉。

### Case 07：多处 edit（2+ edits）
- 前置：非空图。  
- 输入：`新增一个监控模块连接到 API 和 DB，同时把旧的日志模块删除。`  
- 预期工具：`analyze_diagram` → `edit_diagram`（edits 数量 ≥2）。  
- 验收点：两个操作都完成；历史记录新增一版。

### Case 08：故意诱发 pattern 不命中
- 前置：非空图。  
- 输入：`用 edit_diagram 把 id="nonexistent" 的节点改名为 X。`  
- 预期：`edit_diagram` 触发客户端 pattern 预检 `output-error`，**不继续 apply**。  
- 验收点：错误提示包含 change 序号、id 提示与建议复制当前 XML。

### Case 09：故意诱发结构错误
- 前置：非空图。  
- 输入：`新增一个节点，但 id 复用现有 id。`  
- 预期：`display_diagram` 或 `edit_diagram` 失败，校验返回 `Invalid XML [DUPLICATE_ID]`。  
- 验收点：错误信息含 code、具体 id、修复 hint。

### Case 10：edit 连续失败触发降级
- 前置：非空图。  
- 输入：连续两次要求模型用错误 pattern edit（可复用 Case 08）。  
- 预期：第二次失败后自动停止重试，并注入 system fallback 要求下次 display。  
- 验收点：toast 提示出现；messages 中有 `[Auto-recovery] ... display_diagram`。

### Case 11：长会话滑窗
- 前置：连续对话 ≥15 轮（可快速发短指令）。  
- 输入（第 16 轮）：`再新增一个用户中心模块。`  
- 预期：服务端仅保留最近 `MAX_NON_SYSTEM_MESSAGES` 条历史；仍能正确 edit/display。  
- 验收点：无超时/无明显质量断崖；Langfuse 中 metadata 的 `maxNonSystemMessages` 正确。

### Case 12：历史 placeholder 白名单
- 前置：启用非白名单模型（如 minimax 或其他 OpenAI 兼容小模型）。  
- 输入：多轮编辑。  
- 预期：历史 placeholder 默认**不启用**；模型不应输出 placeholder。  
- 验收点：无 “placeholder copied” 症状；如要启用需显式 `ENABLE_HISTORY_XML_REPLACE=true`。

### Case 13：XML 摘要可用性
- 前置：非空图。  
- 输入：`描述当前图里有哪些关键模块，并说明它们的连线关系。`  
- 预期：模型可利用 system 的 summary 进行回答（可能先 analyze）。  
- 验收点：描述与图一致；无需读全量 XML 才能定位。

### Case 14：用户自带 Key 绕过配额
- 前置：设置中填入自有 provider+apiKey+model。  
- 输入：任意生成/编辑指令。  
- 预期：客户端配额检查 bypass；Langfuse metadata `hasClientOverride=true`。  
- 验收点：不弹配额 toast；trace 中标记正确。

## 4. 维护与扩展
- 每次对 system prompt/工具链路的重大修改前后至少跑完 Case 01–10。  
- 新功能加入时补充对应 case，并在标题编号后追加（如 Case 15+）。  
- 若某 case 长期不再适用（需求变更），在该 case 下标注“弃用原因”而非直接删除，保留历史。
