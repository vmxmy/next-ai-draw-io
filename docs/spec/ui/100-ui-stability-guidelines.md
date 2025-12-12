# UI 稳定性规约（避免无限渲染/水合不一致）

本项目使用 Radix UI（Tooltip/Select/ScrollArea 等）与 `asChild` 模式较多。为避免再次出现 `Maximum update depth exceeded` 或 hydration mismatch，请遵循以下硬规则。

## 1) `asChild` 子节点必须可接收 `ref`
- **规则**：凡是被 Radix 的 `Trigger/Anchor` 以 `asChild` 包裹的组件，必须 `React.forwardRef` 并把 `ref` 透传到真实 DOM 元素。
- **原因**：Radix 依赖 ref 做定位与可见性管理；ref 不可用会导致内部状态反复更新甚至无限循环。
- **示例**：`components/ui/button.tsx` 已实现 `forwardRef`，其它基础交互组件（如后续新增的 `IconButton/LinkButton`）也必须同样处理。

## 2) Trigger 下禁止“嵌套第二个可聚焦元素”
- **规则**：`TooltipTrigger asChild` 的子树应当只有一个交互焦点（不要 `span + button`、`div + button`）。
- **原因**：嵌套焦点会触发 focus/blur/hover 事件抖动，Radix 状态可能来回切换形成更新环。
- **建议**：`TooltipTrigger asChild` 直接包裹最终可交互节点（例如 `<Button />`）。

## 3) Provider 单例化
- **规则**：`TooltipProvider` 只在 `app/layout.tsx` 挂载一次；业务组件内不再创建 Provider。
- **原因**：Provider 嵌套/反复挂载可能引发内部状态重置与循环更新。

## 4) `useEffect` 内 setState 必须幂等
- **规则**：effect 里写 state 前先判断是否真的变化，使用形如：
  - `setX(prev => prev === next ? prev : next)`
  - 对对象：仅在需要时拷贝并返回新对象
- **原因**：effect 每次 render 都 setState 会形成“渲染→effect→setState→渲染”的环。
- **示例**：`components/chat-message-display.tsx` 对 `expandedTools` 的默认折叠已做幂等更新与批量合并。

## 5) SSR/CSR 一致性
- **规则**：避免在 SSR 渲染路径里使用 `Math.random()/Date.now()` 生成 DOM 属性（如 `id`），或在服务端/客户端生成不同结构。
- **建议**：需要稳定 `id` 时由调用方显式传入（例如 `ResizableHandle id=...`），或用可预测值。

