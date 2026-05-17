# UI 颜色 / 配色 / 组件着色 规范声明

> 单一可信来源：`src/styles.css`。所有组件**禁止**写死颜色（hex / rgb / `text-white` / `bg-black` 等），一律使用本规范中的语义令牌。
>
> 主题：双主题（亮 `:root` / 暗 `.dark`）。色彩空间：`oklch`。
> 品牌叙事：玻璃拟态深色基底 + 紫(violet)→青(cyan) 品牌渐变。

---

## 1. 设计令牌总览（Design Tokens）

### 1.1 表面与文本

| 令牌 | 暗色（默认） | 亮色 | 用途 |
|---|---|---|---|
| `--background` | `oklch(0.16 0.03 270)` | `oklch(0.985 0.003 247)` | 页面最底层（叠加 orbs 渐变） |
| `--foreground` | `oklch(0.96 0.01 247)` | `oklch(0.205 0.025 265)` | 主文本 |
| `--surface` | `oklch(1 0 0 / 0.04)` | `oklch(1 0 0)` | 通用次级表面 |
| `--surface-muted` | `oklch(1 0 0 / 0.06)` | `oklch(0.97 0.005 247)` | 次级表面（弱化） |
| `--card` / `--card-foreground` | `oklch(1 0 0 / 0.04)` / `oklch(0.96 0.01 247)` | `oklch(1 0 0)` / `oklch(0.205 0.025 265)` | 卡片容器（≈ `glass-card`） |
| `--popover` / `--popover-foreground` | `oklch(0.22 0.03 270)` / `oklch(0.96 0.01 247)` | `oklch(0.99 0.003 247)` / `oklch(0.205 0.025 265)` | 弹层 / 下拉 |
| `--muted` / `--muted-foreground` | `oklch(1 0 0 / 0.05)` / `oklch(0.7 0.025 257)` | `oklch(0.965 0.008 247)` / `oklch(0.5 0.02 257)` | 次级文本与底色 |

### 1.2 主色 / 强调 / 描边

| 令牌 | 暗色 | 亮色 | 备注 |
|---|---|---|---|
| `--primary` | `oklch(0.74 0.18 285)` | `oklch(0.55 0.2 285)` | 主操作色（紫） |
| `--primary-foreground` | `oklch(0.16 0.03 270)` | `oklch(0.99 0.005 247)` | 配对文本 |
| `--secondary` | `oklch(1 0 0 / 0.06)` | `oklch(0.965 0.008 247)` | 次级按钮 |
| `--accent` | `oklch(0.74 0.18 285 / 0.18)` | `oklch(0.95 0.02 285)` | 选中/高亮 |
| `--accent-foreground` | `oklch(0.92 0.06 285)` | `oklch(0.28 0.06 285)` | 配对 |
| `--destructive` | `oklch(0.68 0.2 22)` | `oklch(0.6 0.21 22)` | 危险操作 |
| `--border` | `oklch(1 0 0 / 0.08)` | `oklch(0.92 0.008 255)` | 描边 |
| `--input` | `oklch(1 0 0 / 0.1)` | `oklch(0.94 0.008 255)` | 输入框边/底 |
| `--ring` | `oklch(0.74 0.18 285)` | `oklch(0.55 0.2 285)` | 焦点环 |

### 1.3 品牌色与渐变

| 令牌 | 值 | 用途 |
|---|---|---|
| `--color-brand-violet` | `oklch(0.7 0.2 285)` | 图表/自定义渐变端点 |
| `--color-brand-cyan` | `oklch(0.82 0.13 200)` | 图表/自定义渐变端点 |
| `--gradient-brand` | `linear-gradient(135deg, violet, cyan)` | 主 CTA、品牌图标背景、强调指示条、`gradient-text` |
| `--gradient-brand-soft` | 同上 18% alpha | 低饱和品牌底色 |
| `--gradient-surface` | `linear-gradient(180deg, oklch(1 0 0/.06), .02)` | 玻璃面默认渐变 |

### 1.4 状态色（必须成对使用）

> 用法：`bg-status-{X} text-status-{X}-foreground`

| 状态 | 暗色 bg / fg | 亮色 bg / fg | 语义 |
|---|---|---|---|
| `neutral` | `oklch(1 0 0/.06)` / `oklch(0.78 0.02 257)` | `oklch(0.95 0.005 257)` / `oklch(0.36 0.02 257)` | 草稿、未分类 |
| `info` | `oklch(0.55 0.18 245/.2)` / `oklch(0.85 0.12 240)` | `oklch(0.94 0.04 240)` / `oklch(0.38 0.16 250)` | 已确认、已支付 |
| `progress` | `oklch(0.7 0.2 285/.2)` / `oklch(0.88 0.12 285)` | `oklch(0.93 0.06 285)` / `oklch(0.38 0.18 285)` | 处理中、配送中 |
| `warn` | `oklch(0.7 0.18 70/.22)` / `oklch(0.88 0.14 75)` | `oklch(0.95 0.07 80)` / `oklch(0.42 0.14 60)` | 待支付、风险 |
| `success` | `oklch(0.7 0.16 160/.2)` / `oklch(0.86 0.13 160)` | `oklch(0.94 0.06 160)` / `oklch(0.38 0.13 160)` | 已完成、达成 |
| `danger` | `oklch(0.65 0.2 22/.22)` / `oklch(0.88 0.13 22)` | `oklch(0.94 0.05 22)` / `oklch(0.45 0.18 22)` | 取消、退款、失败 |

### 1.5 图表色板

| 令牌 | 值 | 推荐用途 |
|---|---|---|
| `--color-chart-1` | `oklch(0.7 0.2 285)` 紫 | 主序列 |
| `--color-chart-2` | `oklch(0.82 0.13 200)` 青 | 对比序列 |
| `--color-chart-3` | `oklch(0.78 0.16 320)` 品红 | 第三序列 |
| `--color-chart-4` | `oklch(0.78 0.18 145)` 绿 | 正向 |
| `--color-chart-5` | `oklch(0.76 0.18 60)` 琥珀 | 警示 |

### 1.6 侧栏（实色，不透明）

| 令牌 | 暗色 | 亮色 |
|---|---|---|
| `--sidebar` | `oklch(0.16 0.03 270)` | `oklch(0.99 0.004 265)` |
| `--sidebar-foreground` | `oklch(0.92 0.01 247)` | `oklch(0.28 0.03 265)` |
| `--sidebar-primary` | `oklch(0.74 0.18 285)` | `oklch(0.55 0.2 285)` |
| `--sidebar-accent` | `oklch(0.26 0.07 280)` | `oklch(0.95 0.04 285)` |
| `--sidebar-accent-foreground` | `oklch(0.96 0.04 285)` | `oklch(0.32 0.14 285)` |
| `--sidebar-border` | `oklch(0.28 0.04 270)` | `oklch(0.9 0.01 265)` |
| `--sidebar-ring` | `oklch(0.74 0.18 285)` | `oklch(0.55 0.2 285)` |

> ⚠️ 侧栏**禁止** `backdrop-blur` / 透明背景，必须保持实色以避免内容透出。

### 1.7 阴影 / 光晕

| 令牌 | 用途 |
|---|---|
| `--shadow-glass` | 标准玻璃卡片 |
| `--shadow-elevated` | 浮层（Popover/Dialog） |
| `--shadow-card` | 轻量卡片 |
| `--glow-brand` | 主 CTA hover/focus |
| `--glow-soft` | 柔光强调 |

### 1.8 圆角 / 字体 / 动效

- 圆角：`--radius` = `0.625rem`，阶梯 `sm/md/lg/xl/2xl`。圆形头像/状态点 → `rounded-full`。
- 字体：`--font-sans` Inter（正文） / `--font-display` Space Grotesk（标题） / `--font-mono` JetBrains Mono（数字）。数字必须 `tabular-nums` 或 `font-mono`。
- 动效：`fade-up` / `scale-in` / `shimmer` / `pulse-glow` / `gradient-shift` / `float`。遵循 `prefers-reduced-motion`。

---

## 2. 工具类（utilities）

| 类名 | 作用 |
|---|---|
| `glass-card` | 标准玻璃卡片（自带描边、阴影、内高光） |
| `glass-strong` | 强玻璃（Popover/Sheet 顶层） |
| `gradient-text` | 文字使用品牌渐变 |
| `gradient-border` | 1px 渐变描边（卡片/按钮强调） |
| `glow-brand` | 品牌光晕 |
| `shine` | hover 高光扫过 |

---

## 3. 组件配色（Component Color Map）

> 所有组件均默认遵循 shadcn/ui 变体；以下为本项目的着色契约。

### 3.1 Button

| variant | 背景 | 文本 | 边框 | hover/focus |
|---|---|---|---|---|
| `default`（主） | `var(--gradient-brand)` | `text-primary-foreground` | — | `shadow: var(--glow-brand)` |
| `secondary` | `bg-secondary` | `text-secondary-foreground` | `border-border` | `bg-secondary/80` |
| `outline` | `transparent` | `text-foreground` | `border-border` | `bg-accent` |
| `ghost` | `transparent` | `text-foreground` | — | `bg-accent` |
| `destructive` | `bg-destructive` | `text-destructive-foreground` | — | brightness ↑ |
| `link` | `transparent` | `text-primary` | — | underline |

焦点环统一：`ring-2 ring-ring ring-offset-2 ring-offset-background`。

### 3.2 Card / Glass Card

- 容器：`bg-card text-card-foreground` 或 `glass-card`
- 描边：`border-border`（玻璃卡片自带 1px alpha 描边）
- 阴影：`shadow-[var(--shadow-glass)]`
- 标题：`font-display`；副标题：`text-muted-foreground`

### 3.3 Input / Textarea / Select

- 背景：`bg-input`
- 文本：`text-foreground`，placeholder：`text-muted-foreground`
- 边框：`border-border`，focus：`ring-2 ring-ring border-transparent`
- 错误态：`border-destructive text-destructive-foreground`

### 3.4 Badge（状态徽章 — 与 1.4 状态色一一对应）

| 业务语义 | 类名 |
|---|---|
| 草稿 / 未指派 | `bg-status-neutral text-status-neutral-foreground` |
| 已确认 / 已支付 | `bg-status-info text-status-info-foreground` |
| 处理中 / 配送中 | `bg-status-progress text-status-progress-foreground` |
| 待支付 / 待审核 | `bg-status-warn text-status-warn-foreground` |
| 已完成 / 已签收 | `bg-status-success text-status-success-foreground` |
| 已取消 / 退款 / 失败 | `bg-status-danger text-status-danger-foreground` |

形状：`rounded-md px-2 py-0.5 text-xs`，圆点指示用 `rounded-full size-1.5 bg-current`。

### 3.5 Table

- 表头：`bg-surface-muted text-muted-foreground text-xs uppercase tracking-wide`
- 行分隔：`border-b border-border`
- 行 hover：`bg-accent/40`
- 选中行：`bg-accent text-accent-foreground`
- 数字列：`font-mono tabular-nums text-right`

### 3.6 Tabs

- TabsList：`bg-surface-muted p-1 rounded-lg`
- TabsTrigger inactive：`text-muted-foreground`
- TabsTrigger active：`bg-card text-foreground shadow-[var(--shadow-card)]`
- 强调下划线（可选）：`bg-[image:var(--gradient-brand)] h-0.5`

### 3.7 Dialog / Sheet / Popover / Dropdown

- 容器：`bg-popover text-popover-foreground` + `glass-strong`
- 描边：`border-border`
- 阴影：`shadow-[var(--shadow-elevated)]`
- 遮罩：`bg-background/60 backdrop-blur-sm`

### 3.8 Sidebar

- 背景：`bg-sidebar text-sidebar-foreground`（**实色**）
- 选中项：`bg-sidebar-accent text-sidebar-accent-foreground`
- 主操作：`bg-sidebar-primary text-sidebar-primary-foreground`
- 分隔：`border-sidebar-border`
- 焦点：`ring-sidebar-ring`

### 3.9 Tooltip

- `bg-popover text-popover-foreground border border-border`
- `text-xs px-2 py-1 rounded-md shadow-[var(--shadow-elevated)]`

### 3.10 AppBar / TopNav

- 背景：`bg-background/70 backdrop-blur-xl border-b border-border`
- Logo / 品牌字：`gradient-text font-display`
- 面包屑当前项：`text-foreground`，其它：`text-muted-foreground`

### 3.11 Skeleton / Loading

- `bg-muted` + `animate-[shimmer_2.4s_linear_infinite]`
- 渐变条：`linear-gradient(90deg, transparent, oklch(1 0 0/.08), transparent)`

### 3.12 Charts / Sparkline

- 主线：`stroke="var(--color-chart-1)"`
- 渐变填充：`from var(--color-brand-violet)/.4 to transparent`
- 网格：`stroke-border opacity-40`
- 轴文字：`text-muted-foreground text-xs`

### 3.13 AnimatedNumber / KPI

- 数值：`font-display font-semibold tabular-nums text-foreground`
- 涨幅 +：`text-status-success-foreground bg-status-success`
- 跌幅 −：`text-status-danger-foreground bg-status-danger`
- 单位：`text-muted-foreground text-sm`

### 3.14 BackgroundOrbs

- 径向渐变：紫 28% / 青 22% / 品红 18%（见 `body` 背景规则）
- 亮色减弱至 12% / 10%

---

## 4. ✅ Do / ❌ Don't

| ❌ Don't | ✅ Do |
|---|---|
| `bg-white text-black` | `bg-card text-card-foreground` |
| `bg-[#7c3aed]` | `style={{ background: "var(--gradient-brand)" }}` |
| `text-gray-500` | `text-muted-foreground` |
| `bg-green-500/10 text-green-400` | `bg-status-success text-status-success-foreground` |
| 在侧栏上 `backdrop-blur-xl` | 让侧栏继承 `bg-sidebar`（实色） |
| `text-red-500` | `text-destructive` 或 `text-status-danger-foreground` |
| 自造 hex 渐变 | `var(--gradient-brand)` / `gradient-text` |

---

## 5. 可访问性

- 所有 `bg-*` + `text-*-foreground` 对均通过 WCAG AA（≥ 4.5:1 正文，≥ 3:1 大字）。
- 焦点环必须可见：`ring-2 ring-ring ring-offset-2 ring-offset-background`。
- 状态信息**不能**仅靠颜色传递，必须配合图标 / 文本 / 圆点。
- 减弱动画：自动遵循 `prefers-reduced-motion: reduce`。

---

## 6. 主题切换

```tsx
// 切换：在 <html> 上添加/移除 .dark
document.documentElement.classList.toggle("dark");
```

亮 / 暗主题所有令牌对齐，组件代码无需分支判断。
