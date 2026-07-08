# RepairDesk 设计系统

> 本文档面向视觉系统；AI/页面生成约束见 [`UI_PAGE_GENERATION_DECLARATION.md`](./UI_PAGE_GENERATION_DECLARATION.md)，组件生成约束见 [`COMPONENT_GENERATION_DECLARATION.md`](./COMPONENT_GENERATION_DECLARATION.md)，移动详情页标准见 [`REPAIROS_MOBILE_DETAIL_STANDARD.md`](./REPAIROS_MOBILE_DETAIL_STANDARD.md)，仓库根目录的 `AGENTS.md` 会给 Codex 读取。
> **修改 UI 风格请同步更新本文档、`src/lib/ui-patterns.ts`、`src/lib/component-patterns.ts` 与声明文档**，避免漂移。

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

- **定位**：维修工单后台，高频操作 + 单手移动操作。
- **风格**：RepairOS Compact，浅色 SaaS 工具面、白色紧凑卡片、弱边框、轻阴影。
- **移动详情源头**：当前订单详情页 `/orders/[id]`。新增移动详情、任务、报价、收款、扫码、拍照和历史记录页面必须沿用它的 Floating Card 顶部、白色高密度卡片、轻状态色和底部高频操作条。
- **字体**：`Space Grotesk`（display）/ `Inter`（body）/ `JetBrains Mono`（数字、代码）。
- **色调**：科技蓝 `#315CFF` 是品牌主色，`var(--gradient-brand)` 只用于主 CTA、品牌图标和强调指示条。

## 2. 红线约束

> 违反任意一条都视为 Bug，必须修复。

1. 不写死颜色。所有颜色必须经由 `src/styles.css` 中的语义 token。
2. 侧栏与移动导航抽屉 **完全不透明**：禁止 `backdrop-blur*` 与带 alpha 的背景。阴影必须走 token。
3. 品牌渐变只用 `var(--gradient-brand)`。
4. 字体只用三套（display / sans / mono）。
5. 默认浅色 RepairOS Compact，暗色主题只作为辅助可切换模式。
6. `src/components/ui/*` 保持 Radix/shadcn 语义结构，样式必须使用 token 和共享声明。
7. 路由统一 Next.js App Router，禁止重新引入 TanStack Router/Start 或 `react-router-dom`。
8. 不新增 Vite/TanStack 启动入口。

## 3. 设计令牌

唯一来源：`src/styles.css`。

### 3.1 表面层级

| Token                                    | 场景                        |
| ---------------------------------------- | --------------------------- |
| `bg-background`                          | 页面底层（平面浅色背景） |
| `bg-surface` / `bg-surface-muted`        | 通用次级表面                |
| `bg-card` + `text-card-foreground`       | 卡片                        |
| `bg-popover` + `text-popover-foreground` | 弹层                        |
| `bg-sidebar` + `text-sidebar-foreground` | 侧栏（实色）                |

### 3.2 状态色（成对使用）

`bg-status-{neutral|info|progress|warn|success|danger}` ↔ `text-status-*-foreground`。

### 3.3 品牌

| Token                                         | 用途                                          |
| --------------------------------------------- | --------------------------------------------- |
| `var(--gradient-brand)`                       | 主 CTA、品牌图标、强调指示条、`gradient-text` |
| `var(--gradient-brand-soft)`                  | 低饱和品牌底色                                |
| `--color-brand-violet` / `--color-brand-cyan` | 图表色（主序列当前映射为科技蓝）             |
| `gradient-text` 工具类                        | 文本品牌渐变                                  |
| `gradient-border` 工具类                      | 渐变描边                                      |

### 3.4 阴影 / 圆角 / 动画

- Shadow：`--shadow-glass` / `--shadow-elevated` / `--shadow-card` / `--glow-brand` / `--glow-soft`
- Radius：`--radius-sm/md/lg/xl/2xl`
- Animate：`fade-up` / `scale-in` / `shimmer` / `pulse-glow` / `gradient-shift` / `float`

### 3.5 Do / Don't

| ❌ Don't                         | ✅ Do                                              |
| -------------------------------- | -------------------------------------------------- |
| `bg-white text-black`            | `bg-card text-card-foreground`                     |
| `bg-[#7c3aed]`                   | `style={{background: "var(--gradient-brand)"}}`    |
| `text-gray-500`                  | `text-muted-foreground`                            |
| `bg-green-500/10 text-green-400` | `bg-status-success text-status-success-foreground` |

## 4. 应用外壳

`src/app/layout.tsx` 与 `src/app/providers.tsx` 已固定，新页面只写主内容。

```
SidebarProvider
├─ AppSidebar              侧栏（实色，桌面常驻 / 移动 Sheet）
└─ SidebarInset
   ├─ AppBar               sticky top-0 z-30
   ├─ MobileWorkspaceDock  移动悬浮快捷操作
   └─ main / children
```

**内容容器统一**：

```tsx
<div className={pageShell.list}>…</div>
```

**响应式断点**：

| 断点               | 行为                              |
| ------------------ | --------------------------------- |
| `< sm` (640)       | 单列；侧栏 Sheet；面包屑隐藏      |
| `sm – lg`          | 双列；紧凑表格                    |
| `≥ lg` (1024)      | 三列图表；侧栏常驻；显示门店 chip |
| `max-w-7xl` (1280) | 内容最大宽度                      |

## 5. 组件库

### 5.1 工具类

| 类                | 用途             |
| ----------------- | ---------------- |
| `glass-card`      | 默认卡片容器     |
| `glass-strong`    | 更强玻璃质感弹层 |
| `gradient-text`   | 文本品牌渐变     |
| `gradient-border` | 渐变描边         |
| `glow-brand`      | 品牌光晕         |
| `shine`           | 悬停扫光         |

### 5.2 业务复用组件

| 组件                             | 用途                         |
| -------------------------------- | ---------------------------- |
| `<AnimatedNumber value/>`        | 所有数字滚动                 |
| `<Sparkline data color height/>` | KPI 卡迷你趋势图             |
| `<StatusBadge status/>`          | 工单状态徽标                 |
| `<MoneyText amount/>`            | 金额渲染                     |
| `<CommandPalette/>`              | 全局 ⌘K（新增页面需注册）    |
| `<ThemeToggle/>`                 | 亮/暗切换                    |
| `<ComingSoon title/>`            | 占位页                       |
| `<MobileWorkspaceDock/>`         | 移动端悬浮快捷操作（全局只挂一次） |

### 5.3 数据 & 图标

- 数据：`@tanstack/react-query`，页面调用 `@/lib/repairdesk/api`；服务端 Supabase repository 在 `src/server/*`，缺少环境变量时才回退到 mock。
- 图标：`lucide-react`，规范尺寸 `size-3.5 / size-4 / size-5`。

## 6. 页面骨架配方

### 6.1 路由模板

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "报表",
  description: "门店经营报表与趋势分析",
  openGraph: {
    title: "报表 — RepairDesk",
    description: "门店经营报表与趋势分析",
  },
};

export default function ReportsPage() {
  return <ReportsClient />;
}
```

### 6.2 配方 A · Dashboard

参考 `src/routes/index.tsx`：

```
紧凑上下文          日期 / 班次 / 主 CTA
KPI strip           移动 2-3 个小指标，桌面 4 个紧凑卡
业务区              今日任务 / 快捷模块 / 最新工单
列表卡片            RepairOS Compact 高密度业务卡片
```

### 6.3 配方 B · 列表 / 表格

```tsx
<div className={pageShell.list}>
  <header className={pageHeader.root}>
    <h1 className="font-display text-2xl">客户</h1>
    <Button style={{ background: "var(--gradient-brand)" }}>新建</Button>
  </header>
  <div className={surfaces.toolbar}>…筛选…</div>
  <div className={dataDisplay.denseTableWrap}>
    <Table>…</Table>
  </div>
</div>
```

### 6.4 配方 C · 详情 / 表单

```tsx
<div className={pageShell.split}>
  <section className={surfaces.section}>…主信息…</section>
  <aside className="space-y-4">
    <div className="glass-card p-4">…操作…</div>
    <div className="glass-card p-4">…历史…</div>
  </aside>
</div>
```

### 6.5 加载 / 错误 / 空态

```tsx
{
  isLoading && <Skeleton className="h-32 w-full" />;
}
{
  isError && <p className="text-status-danger-foreground">{error.message}</p>;
}
{
  empty && <div className="glass-card p-8 text-center text-muted-foreground">暂无数据</div>;
}
```

## 7. 动效与无障碍

- 所有 framer-motion variants 从 `@/lib/motion` 导入：`fadeUp` / `scaleIn` / `stagger(gap)` / `cardHover` / `pageTransition`。
- 入场 ≤ 400ms，hover ≤ 200ms。
- 列表用 `stagger(0.04~0.06)` + `fadeUp`；卡片 `whileHover={{ y: -2 }}`。
- 页面内只为局部内容使用 `AnimatePresence`，不要重复创建全局 shell。
- 全局已处理 `prefers-reduced-motion`。
- 文本对比度 ≥ WCAG AA；图标按钮带 `aria-label`；侧栏菜单带 `tooltip`；图片 `alt` 必填。

## 8. 技术栈约定

- Next.js App Router + React 19 + Tailwind v4。
- 路由：`src/app/`，根布局唯一 `layout.tsx`，客户端 shell 在 `providers.tsx`。
- 服务端：通过 Next Route Handlers / Server Components 暴露安全 facade，Supabase service role 只允许在 `src/server/*` 使用。
- 公共 API：如新增 `src/app/api/public/*`，必须验签并显式限流。
- 后端能力（DB / Auth / Storage）默认走 Supabase；前端只使用 publishable key 或 server function，不暴露 service role key。

## 9. 截图基线

> 每次大幅 UI 调整后请更新此处截图，作为视觉回归基准。

| 主题  | 设备           | 状态       | 截图                                            |
| ----- | -------------- | ---------- | ----------------------------------------------- |
| Dark  | Desktop ≥ 1280 | 侧栏展开   | _TODO: docs/screens/dark-desktop-expanded.png_  |
| Dark  | Desktop ≥ 1280 | 侧栏 icon  | _TODO: docs/screens/dark-desktop-icon.png_      |
| Dark  | Mobile 750     | Sheet 关闭 | _TODO: docs/screens/dark-mobile-closed.png_     |
| Dark  | Mobile 750     | Sheet 打开 | _TODO: docs/screens/dark-mobile-open.png_       |
| Light | Desktop ≥ 1280 | 侧栏展开   | _TODO: docs/screens/light-desktop-expanded.png_ |
| Light | Mobile 750     | Sheet 打开 | _TODO: docs/screens/light-mobile-open.png_      |

---

## 维护

- 新增 token / 工具类 → 同步 `src/styles.css` + 本文档第 3 节 + `docs/UI_PAGE_GENERATION_DECLARATION.md`。
- 新增页面配方 → 同步 `src/lib/ui-patterns.ts` + 本文档第 6 节 + `docs/UI_PAGE_GENERATION_DECLARATION.md`。
- 新增组件配方 → 同步 `src/lib/component-patterns.ts` + `docs/COMPONENT_GENERATION_DECLARATION.md`。
- 提交 PR 前过 [`docs/UI_CHECKLIST.md`](./UI_CHECKLIST.md)。
