# RepairDesk — Codex 1:1 复刻指南

本包用于让 Codex 完整复刻当前项目。包含全部源码、UI 组件、路由、mock 数据、设计文档与 .cursor 规则。

## 技术栈（必须严格一致）

- **框架**: TanStack Start v1 + React 19 + Vite 7
- **样式**: Tailwind CSS v4（通过 `src/styles.css` 的 `@import "tailwindcss"` + `@theme` 配置，**不要**用 tailwind.config.js）
- **UI 组件**: shadcn/ui (new-york style, Radix + Tailwind)，位于 `src/components/ui/*`
- **动效**: framer-motion，全部 variants 从 `@/lib/motion` 导入
- **数据**: @tanstack/react-query（mock 在 `src/lib/mock/api.ts`）
- **路由**: 扁平点号命名，如 `orders.$id.tsx` → `/orders/:id`
- **图标**: lucide-react

## 安装

```bash
bun install
# 或
npm install
bun dev
```

关键依赖（见 package.json）：
`@tanstack/react-router @tanstack/react-start @tanstack/react-query framer-motion lucide-react clsx tailwind-merge class-variance-authority @radix-ui/react-* sonner cmdk date-fns zod`

## 目录结构

```
src/
├── routes/                # TanStack 文件路由
│   ├── __root.tsx         # 唯一根布局（含 QueryClient/Theme/Sidebar）
│   ├── index.tsx          # 首页 Dashboard
│   ├── orders.tsx         # /orders 布局（Outlet）
│   ├── orders.index.tsx   # 工单列表
│   ├── orders.$id.tsx     # 工单详情
│   ├── orders.new.tsx     # 新建工单
│   ├── customers/inventory/messages/settings.tsx
├── components/
│   ├── ui/                # shadcn 组件（勿改基础结构）
│   ├── orders/badges.tsx  # 15 态工单状态徽章
│   ├── app-sidebar.tsx    # 桌面侧栏 260px
│   ├── app-header.tsx     # 顶部栏（含 ⌘K）
│   ├── bottom-tab-bar.tsx # 移动底栏
│   ├── animated-number.tsx / sparkline.tsx / background-orbs.tsx
├── lib/
│   ├── motion.ts          # fadeUp/scaleIn/stagger/cardHover/pageTransition/ease
│   ├── utils.ts           # cn()
│   └── mock/              # api.ts / fixtures.ts / enums.ts / workflow.ts
├── styles.css             # ★ 设计 token 唯一来源（oklch）
└── router.tsx
.cursor/rules/             # 6 份硬性规则（Codex 也读取）
docs/                      # 设计文档
```

## UI 设计规范（强制）

### 1. 颜色 — 只用语义 token

**禁止** 在组件里写 `text-white`、`bg-black`、`#hex`、`rgba()`。
所有颜色来自 `src/styles.css` 的 oklch 变量：

- 表面：`bg-background` / `bg-card` / `bg-muted` / `bg-popover`
- 文字：`text-foreground` / `text-muted-foreground`
- 主色：`bg-primary text-primary-foreground`
- 边框：`border-border` / `border-border/60`
- 状态：`--status-pending|inProgress|repaired|delivered|cancelled|warning`
- 渐变：`bg-[image:var(--gradient-brand)]`（violet→cyan）
- 阴影：`shadow-[var(--shadow-elegant)]`、玻璃高光用 `inset` 写法

### 2. 字体

- 标题：Space Grotesk
- 正文：Inter
- 等宽：JetBrains Mono
（已在 styles.css 引入；勿换 Poppins/Roboto）

### 3. 圆角与间距

- 基础半径 14px（`--radius`）；卡片 `rounded-2xl`，控件 `rounded-xl`
- 卡片边框 `border-border/60`，hover `hover:-translate-y-0.5 transition`
- 容器 padding：桌面 `p-6`，移动 `p-4`

### 4. 布局骨架

- 桌面 `grid-cols-[260px_1fr]`；移动 fallback 单列 + 底部 Tab
- 全局背景使用 `<BackgroundOrbs />` 渐隐光斑
- 路由切换 `RouteTransition` 统一处理，**不要** 在页面内再套 `AnimatePresence`

### 5. 动效（≤400ms enter / ≤200ms hover）

```ts
import { fadeUp, stagger, cardHover, pageTransition, ease } from "@/lib/motion";
```
- 列表 `stagger(0.04~0.06) + fadeUp`
- 卡片 `whileHover={{ y: -2 }}`
- 尊重 `prefers-reduced-motion`

### 6. 无障碍

- 所有图标按钮带 `aria-label`
- 焦点环 `focus-visible:ring-2 focus-visible:ring-ring`
- 对比度 ≥ WCAG AA；`*-foreground` 必须配对

### 7. SEO

每个路由必须 `head() { meta: [{title<60}, {description<160}, og:* ] }`。

## 工单工作流（15 态状态机）

见 `src/lib/mock/workflow.ts`：
- `getNextActions(status)` → 当前合法的下一步
- `validateOrderTransition(from, to)` → 校验
- `isOverdueApproval` / `isOverdueDelivery` → KPI 倒计时
- 列表/详情/新建均消费此引擎，不在 UI 重复硬编码状态

## 新增组件应如何设计

1. **位置**：通用 → `src/components/ui/`；业务 → `src/components/<domain>/`
2. **样式**：必须只用 token；`rounded-2xl border border-border/60 bg-card`
3. **交互**：复用 `cardHover` / `fadeUp`，不自造 variants
4. **状态色**：复用 `--status-*` 或在 `orders/badges.tsx` 模式上扩展
5. **a11y**：Label + aria-* + 键盘可达
6. **响应式**：默认移动优先，桌面用 `md: / lg:`

## 验收清单

- [ ] 亮 + 暗主题切换正常
- [ ] 402px / 768px / 1280px 三档无溢出
- [ ] 无硬编码颜色 / 字体
- [ ] 所有路由含 `head()` meta
- [ ] 工单列表 KPI 可点击过滤、批量转态合法、详情主按钮根据状态变化
- [ ] 新建工单：客户搜索自动填充、故障价目动态算总价/定金/尾款
- [ ] `prefers-reduced-motion` 下动画收敛

## Codex 复刻流程

1. 解压本 zip 到空目录
2. `bun install && bun dev`
3. 让 Codex 读取 `.cursor/rules/*.mdc` 与 `docs/*.md` 作为系统提示
4. 严禁修改 `src/routeTree.gen.ts`（自动生成）
5. 新页面遵循"扁平点号 + head() + Outlet 父布局"约定

