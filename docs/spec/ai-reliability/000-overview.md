# 000-方案A总览：AI 生成与编辑可靠性

> 状态：草案  
> 目标周期：3–4 周  
> 成功指标：edit/display 工具失败率下降、平均 token/时延下降、编辑过程可控可回退

## 背景
当前应用依赖 LLM 生成/编辑 draw.io XML。主要痛点集中在：
- `edit_diagram` pattern 不命中或结构错误导致多次自动重试；
- 长会话下 XML 体积过大，token 成本与时延上升；
- 错误提示不够可定位，模型自修复效率低；
- 前端限额与校验存在可绕过风险（方案A不做安全闭环，但需注意成本）。

## 里程碑目标
1. **读懂图再编辑**：引入只读 analyze + XML 摘要，减少“盲改”。  
2. **编辑链路更稳**：pattern 预检、结构错误定位、失败自动降级。  
3. **成本与稳定性**：历史压缩白名单、上下文滑窗。  
4. **闭环度量**：Langfuse 指标补全 + 回归用例集。

## 任务拆分与顺序
P0：
- 010 analyze_diagram 工具（A1）
- 020 XML 摘要系统消息（A2）
- 030 前后端限制常量统一（A3）

P1：
- 040 edit 失败降级（A4）
- 050 pattern 预检（A5）
- 060 校验错误定位（A6）

P2：
- 070 历史 placeholder 白名单（A7）
- 090 上下文滑窗（A9）
- 080 生成计划确认 UI（A8，放后）

P3：
- 100 Langfuse 指标补全（A10）
- 110 回归用例集（A11）

## 指标与观测
建议在 Langfuse 中跟踪：
- tool error 类型与占比（pattern-not-found / invalid-xml / api-error）
- 自动重试次数分布与最终成功率
- input/output tokens、cached tokens、命中缓存比例
- 端到端时延（P50/P95）

