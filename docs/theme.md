# 主题与语义化样式（Tailwind v4 + shadcn/ui）

本项目使用 Tailwind CSS v4 的 `@theme` + CSS 变量作为主题系统（见 `app/globals.css`）。为了避免“到处硬编码颜色/尺寸”，请优先使用语义化 token（如 `bg-background`、`text-muted-foreground`、`text-warning` 等），而不是 `text-amber-600`、`#RRGGBB` 这类值。

## 1. 语义 token 的来源

`app/globals.css` 中：
- `:root` / `.dark`：定义实际颜色值（OKLCH）。
- `@theme inline`：把 CSS 变量映射成 Tailwind 可用的颜色名（生成 `text-*` / `bg-*` / `border-*` 等工具类）。

目前除了 shadcn/ui 默认 token 外，还补充了：
- `info` / `info-foreground`
- `success` / `success-foreground`
- `warning` / `warning-foreground`

## 2. 推荐用法

- 成功态：`text-success`、`bg-success`、`text-success-foreground`
- 警告态：`text-warning`、`bg-warning`、`text-warning-foreground`
- 信息态：`text-info`、`bg-info`、`text-info-foreground`
- 强调/交互：优先用 `bg-accent`、`text-accent-foreground`、`ring-ring`、`border-border`

如果只是 hover/弱化，不要再引入一套新的色阶，优先用透明度修饰：
- `hover:text-warning/80`
- `bg-warning/10`

## 3. 如何使用 tweakcn 生成主题

如果你希望整体换一套配色（明暗两套），可以使用 tweakcn（社区常用的 shadcn/ui 主题生成器）生成 `:root` 与 `.dark` 的变量值，然后：

1. 打开 `app/globals.css`
2. 替换 `:root` 和 `.dark` 中对应的基础 token（`--background`、`--foreground`、`--primary`、`--accent`、`--muted`、`--border`、`--ring` 等）
3. 保留 `@theme inline` 的映射结构不变（否则会影响 Tailwind 类名）
4. 视需要同步调整 `--success/--warning/--info` 三个语义 token

## 4. 迁移建议（分阶段）

1. 先新增/完善语义 token（本次已完成基础三态）。
2. 从“最常见的硬编码颜色”开始替换（例如 `text-amber-*`、`text-blue-*`）。
3. 再处理大面积页面（如 About 页）的渐变/装饰色：可新增 `brand-*` 或 `surface-*` token 来承接。

