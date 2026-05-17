# RepairDesk 设计系统

> 本文档与 `.cursor/rules/*.mdc` 同源；前者给人类阅读，后者会被 Cursor 自动注入。
> **修改 UI 风格请同步更新两边**，避免漂移。

## 目录

1. [设计哲学](#1-设计哲学)
2. [红线约束](#2-红线约束)
3. [设计令牌](#3-设计令牌)
4. [应用外壳](#4-应用外壳)
5. [组件库](#5-组件库)
6. [页面骨架配方](#6-页面骨架配方)
7. [动效与无障碍](#7-动效与无障碍)
8. [技术栈约定](#8-技术栈约定)
9. [截图基线](#9-截图基线)

---

## 1. 设计哲学

- **定位**：维修工单后台，高频操作 + 富微交互。
- **风格**：深色玻璃拟物（默认）+ 紫青品牌渐变 + 大量微动效。亮色主题为辅。
- **字体**：`Space Grotesk`（display）/ `Inter`（body）/ `JetBrains Mono`（数字、代码）。
- **色调**：紫 `oklch(0.7 0.2 285)` → 青 `oklch(0.82 0.13 200)` 的线性渐变是品牌身份的唯一来源。

## 2. 红线约束

> 违反任意一条都视为 Bug，必须修复。

1. 不写死颜色。所有颜色必须经由 `src/styles.css` 中的语义 token。
2. 侧栏与移动 Sheet **完全不透明**：禁止 `backdrop-blur*` 与带 alpha 的背景。`box-shadow` 可带 alpha。
3. 品牌渐变只用 `var(--gradient-brand)`。
4. 字体只用三套（display / sans / mono）。
5. 默认深色，不新增第三套主题。
6. 不修改 `src/components/ui/*` shadcn 原子组件源文件（除非新增 variant）。
7. 路由统一 `@tanstack/react-router`，禁止 `react-router-dom`、`next/*`。
8. 不编辑 `src/routeTree.gen.ts`。

## 3. 设计令牌

唯一来源：`src/styles.css`。

### 3.1 表面层级

| Token | 场景 |
|---|---|
| `bg-background` | 页面底层（含全局渐变 orbs） |
| `bg-surface` / `bg-surface-muted` | 通用次级表面 |
| `bg-card` + `text-card-foreground` | 卡片 |
| `bg-popover` + `text-popover-foreground` | 弹层 |
| `bg-sidebar` + `text-sidebar-foreground` | 侧栏（实色） |

### 3.2 状态色（成对使用）

`bg-status-{neutral|info|progress|warn|success|danger}` ↔ `text-status-*-foreground`。

### 3.3 品牌

| Token | 用途 |
|---|---|
| `var(--gradient-brand)` | 主 CTA、品牌图标、强调指示条、`gradient-text` |
| `var(--gradient-brand-soft)` | 低饱和品牌底色 |
| `--color-brand-violet` / `--color-brand-cyan` | 图表色 |
| `gradient-text` 工具类 | 文本品牌渐变 |
| `gradient-border` 工具类 | 渐变描边 |

### 3.4 阴影 / 圆角 / 动画

- Shadow：`--shadow-glass` / `--shadow-elevated` / `--shadow-card` / `--glow-brand` / `--glow-soft`
- Radius：`--radius-sm/md/lg/xl/2xl`
- Animate：`fade-up` / `scale-in` / `shimmer` / `pulse-glow` / `gradient-shift` / `float`

### 3.5 Do / Don't

| ❌ Don't | ✅ Do |
|---|---|
| `bg-white text-black` | `bg-card text-card-foreground` |
| `bg-[#7c3aed]` | `style={{background: "var(--gradient-brand)"}}` |
| `text-gray-500` | `text-muted-foreground` |
| `bg-green-500/10 text-green-400` | `bg-status-success text-status-success-foreground` |

## 4. 应用外壳

`src/routes/__root.tsx` 已固定，新页面只写 `<main>` 内的内容。

```
SidebarProvider
├─ AppSidebar              侧栏（实色，桌面常驻 / 移动 Sheet）
└─ SidebarInset
   ├─ BackgroundOrbs       z-index -1
   ├─ AppBar               sticky top-0 z-30
   └─ main / RouteTransition / Outlet
```

**内容容器统一**：

```tsx
<div className="mx-auto max-w-7xl space-y-6 px-3 py-6 sm:px-6">…</div>
```

**响应式断点**：

| 断点 | 行为 |
|---|---|
| `< sm` (640) | 单列；侧栏 Sheet；面包屑隐藏 |
| `sm – lg` | 双列；紧凑表格 |
| `≥ lg` (1024) | 三列图表；侧栏常驻；显示门店 chip |
| `max-w-7xl` (1280) | 内容最大宽度 |

## 5. 组件库

### 5.1 工具类

| 类 | 用途 |
|---|---|
| `glass-card` | 默认卡片容器 |
| `glass-strong` | 更强玻璃质感弹层 |
| `gradient-text` | 文本品牌渐变 |
| `gradient-border` | 渐变描边 |
| `glow-brand` | 品牌光晕 |
| `shine` | 悬停扫光 |

### 5.2 业务复用组件

| 组件 | 用途 |
|---|---|
| `<AnimatedNumber value/>` | 所有数字滚动 |
| `<Sparkline data color height/>` | KPI 卡迷你趋势图 |
| `<StatusBadge status/>` | 工单状态徽标 |
| `<MoneyText amount/>` | 金额渲染 |
| `<CommandPalette/>` | 全局 ⌘K（新增页面需注册） |
| `<ThemeToggle/>` | 亮/暗切换 |
| `<ComingSoon title/>` | 占位页 |
| `<BackgroundOrbs/>` | 背景渐变球（仅 root 用一次） |

### 5.3 数据 & 图标

- 数据：`@tanstack/react-query`，mock 在 `src/lib/mock/api.ts`。
- 图标：`lucide-react`，规范尺寸 `size-3.5 / size-4 / size-5`。

## 6. 页面骨架配方

### 6.1 路由模板

```tsx
export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "报表 — RepairDesk" },
      { name: "description", content: "门店经营报表与趋势分析" },
      { property: "og:title", content: "报表 — RepairDesk" },
      { property: "og:description", content: "门店经营报表与趋势分析" },
    ],
  }),
  component: ReportsPage,
});
```

### 6.2 配方 A · Dashboard

参考 `src/routes/index.tsx`：

```
Hero greeting       左标题 + 右主 CTA（var(--gradient-brand)）
KPI grid            sm:grid-cols-2 lg:grid-cols-4，glass-card + AnimatedNumber + Sparkline
图表行              grid lg:grid-cols-3，主图占 2 列
列表卡片            glass-card + divide-y
```

### 6.3 配方 B · 列表 / 表格

```tsx
<div className="mx-auto max-w-7xl space-y-6 px-3 py-6 sm:px-6">
  <header className="flex items-end justify-between">
    <h1 className="font-display text-2xl">客户</h1>
    <Button style={{ background: "var(--gradient-brand)" }}>新建</Button>
  </header>
  <div className="glass-card flex flex-wrap items-center gap-2 p-3">…筛选…</div>
  <div className="glass-card overflow-hidden"><Table>…</Table></div>
</div>
```

### 6.4 配方 C · 详情 / 表单

```tsx
<div className="mx-auto max-w-7xl grid gap-6 px-3 py-6 sm:px-6 lg:grid-cols-[1fr_320px]">
  <section className="glass-card p-6 space-y-6">…主信息…</section>
  <aside className="space-y-4">
    <div className="glass-card p-4">…操作…</div>
    <div className="glass-card p-4">…历史…</div>
  </aside>
</div>
```

### 6.5 加载 / 错误 / 空态

```tsx
{isLoading && <Skeleton className="h-32 w-full"/>}
{isError   && <p className="text-status-danger-foreground">{error.message}</p>}
{empty     && <div className="glass-card p-8 text-center text-muted-foreground">暂无数据</div>}
```

## 7. 动效与无障碍

- 所有 framer-motion variants 从 `@/lib/motion` 导入：`fadeUp` / `scaleIn` / `stagger(gap)` / `cardHover` / `pageTransition`。
- 入场 ≤ 400ms，hover ≤ 200ms。
- 列表用 `stagger(0.04~0.06)` + `fadeUp`；卡片 `whileHover={{ y: -2 }}`。
- 路由切换由 `RouteTransition` 统一管，不要在页面内再加 `AnimatePresence`。
- 全局已处理 `prefers-reduced-motion`。
- 文本对比度 ≥ WCAG AA；图标按钮带 `aria-label`；侧栏菜单带 `tooltip`；图片 `alt` 必填。

## 8. 技术栈约定

- TanStack Start v1 + React 19 + Vite 7 + Tailwind v4。
- 路由：`src/routes/`，扁平点号命名，根布局唯一 `__root.tsx`。
- 服务端：`createServerFn`，文件命名 `*.functions.ts`，放 `src/lib/`。
- 公共 API：`src/routes/api/public/*`，必须验签。
- 后端能力（DB / Auth / Storage / Email / AI）默认走 **Lovable Cloud**。

## 9. 截图基线

> 每次大幅 UI 调整后请更新此处截图，作为视觉回归基准。

| 主题 | 设备 | 状态 | 截图 |
|---|---|---|---|
| Dark | Desktop ≥ 1280 | 侧栏展开 | _TODO: docs/screens/dark-desktop-expanded.png_ |
| Dark | Desktop ≥ 1280 | 侧栏 icon | _TODO: docs/screens/dark-desktop-icon.png_ |
| Dark | Mobile 750 | Sheet 关闭 | _TODO: docs/screens/dark-mobile-closed.png_ |
| Dark | Mobile 750 | Sheet 打开 | _TODO: docs/screens/dark-mobile-open.png_ |
| Light | Desktop ≥ 1280 | 侧栏展开 | _TODO: docs/screens/light-desktop-expanded.png_ |
| Light | Mobile 750 | Sheet 打开 | _TODO: docs/screens/light-mobile-open.png_ |

---

## 维护

- 新增 token / 工具类 → 同步 `src/styles.css` + `10-design-tokens.mdc` + 本文档第 3 节。
- 新增页面配方 → 同步 `40-page-recipes.mdc` + 本文档第 6 节。
- 提交 PR 前过 [`docs/UI_CHECKLIST.md`](./UI_CHECKLIST.md)。
