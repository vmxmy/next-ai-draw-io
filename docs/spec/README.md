# Spec 文档索引

本目录用于存放仓库的功能/架构规格说明（spec）。  
每个 spec 面向一个可独立合并的任务或里程碑，建议以小步迭代为目标，便于评审、实现与回滚。

## 规范
- 新 spec 放在对应主题目录下，并使用三位编号排序（如 `010-xxx.md`）。
- 每个 spec 至少包含：背景、目标/非目标、方案选项、详细设计、PR 变更清单、验收标准、风险与回滚。
- 变更实现以 PR 为单位列出，做到“可独立合并、可验证、可回滚”。

## 主题目录

### ai-reliability（方案 A：生成/编辑可靠性）
- `ai-reliability/000-overview.md`：总览、里程碑与指标
- `ai-reliability/010-analyze-tool.md`：新增只读工具 analyze_diagram
- `ai-reliability/020-xml-summary.md`：服务端 XML 摘要系统消息
- `ai-reliability/030-shared-limits.md`：前后端文件限制常量统一
- `ai-reliability/040-edit-fallback.md`：edit_diagram 失败自动降级
- `ai-reliability/050-pattern-precheck.md`：pattern 预检与错误提示
- `ai-reliability/060-validation-hints.md`：结构校验错误可定位提示
- `ai-reliability/070-history-whitelist.md`：历史 placeholder 替换白名单
- `ai-reliability/080-plan-confirm-ui.md`：生成前布局计划确认
- `ai-reliability/090-context-window.md`：历史消息滑窗与截断
- `ai-reliability/100-observability.md`：Langfuse 指标补全
- `ai-reliability/110-regression-cases.md`：典型场景回归集

## 模板
使用 `docs/spec/template.md` 新建 spec。

