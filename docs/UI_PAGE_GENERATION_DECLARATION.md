# RepairDesk UI 页面生成声明

> 目标：后续新增页面、重构页面、让 AI 生成页面时，必须复用同一套布局、组件、数据和交互契约，避免页面风格漂移。
>
> 可执行页面声明在 `src/lib/ui-patterns.ts`；组件生成声明见 [`COMPONENT_GENERATION_DECLARATION.md`](./COMPONENT_GENERATION_DECLARATION.md)；视觉令牌唯一来源在 `src/styles.css`；业务组件优先复用 `src/components/*`。

## 1. 当前 UI 架构分析

### 1.1 技术与渲染层

- 框架：Next.js App Router + React 19。
- 路由：Next.js 文件路由，文件位于 `src/app/`；页面文件导出 `metadata`，交互主体放在 client component。
- 数据：页面通过 `@tanstack/react-query` 调用 `@/lib/repairdesk/api`。服务端 Supabase 逻辑在 `src/server/*`，前端不得直接使用 service role key。
- UI 原子层：`src/components/ui/*` 为 shadcn/Radix 基础组件，默认不改基础结构。
- 动效：framer-motion，只从 `@/lib/motion` 取 `fadeUp`、`stagger`、`scaleIn`、`cardHover`、`pageTransition`。
- 图标：lucide-react，常用尺寸只用 `size-3`、`size-3.5`、`size-4`、`size-5`。

### 1.2 应用外壳

根布局已在 `src/app/layout.tsx` + `src/app/providers.tsx` 固定：

- `SidebarProvider` + `AppSidebar`
- `SidebarInset`
- `BackgroundOrbs`
- `AppBar`
- `CommandPalette`
- `Toaster`

新增页面只写 `children` 主内容，不重复创建侧栏、顶栏、背景、Toast 或 QueryClient。

### 1.3 当前组件分层

| 层级     | 位置                                     | 用途                                         | 新页面如何使用              |
| -------- | ---------------------------------------- | -------------------------------------------- | --------------------------- |
| 原子组件 | `src/components/ui/*`                    | Button、Input、Dialog、Sheet、Table、Tabs 等 | 优先 import，不重写同类控件 |
| 应用壳   | `AppSidebar`、`AppBar`、`CommandPalette` | 导航、面包屑、全局搜索                       | 新增导航页时同步注册        |
| 业务显示 | `orders/badges.tsx`                      | 工单状态、类型、金额、电话                   | 工单/客户/财务页面必须复用  |
| 数据视觉 | `AnimatedNumber`、`Sparkline`            | KPI 数字、趋势                               | Dashboard / 统计卡复用      |
| 占位页面 | `ComingSoon`                             | 未完成模块                                   | 暂未实现模块统一使用        |
| 页面声明 | `src/lib/ui-patterns.ts`                 | 布局、表面、表格、表单 class 契约            | 新页面直接 import           |
| 组件声明 | `src/lib/component-patterns.ts`          | 卡片、列表项、表单段、弹层、状态 tone 契约   | 新组件直接 import           |

## 2. 不可违反的硬规则

1. 不写死颜色：禁止 `#hex`、`rgb()`、`rgba()`、`text-white`、`bg-black`。唯一例外是使用 `style={{ background: "var(--gradient-brand)" }}` 的品牌渐变。
2. 业务数据必须通过 `@/lib/repairdesk/api`，不要在页面里直接导入 `src/server/*`。
3. 新路由必须提供 `metadata`，至少包括 `title` 和 `description`。
4. 新导航页必须同步更新 `AppSidebar`、`AppBar` 的 `labels`、`CommandPalette`。
5. 不重新引入 TanStack Router/Start 或 Vite entrypoint。
6. 不在页面内重复创建全局 shell；根布局已经处理。
7. 侧栏和移动 Sheet 保持不透明实色，禁止给侧栏加透明背景或 blur。
8. 数字金额必须用 `MoneyText` 或 `font-mono tabular-nums`。
9. 工单状态、审批状态、类型徽章必须复用 `StatusBadge`、`ApprovalBadge`、`OrderTypeBadge`。
10. Loading 用 `Skeleton`，错误用 `text-status-danger-foreground`，空态用 `glass-card`。

## 3. 页面布局声明

优先 import：

```tsx
import { brandGradientStyle, pageHeader, pageShell, surfaces } from "@/lib/ui-patterns";
```

### 3.1 Dashboard / 概览页

使用 `pageShell.wide`，结构固定：

1. Hero：左侧日期/标题/说明，右侧主 CTA。
2. KPI：`dataDisplay.kpiGrid`，数字用 `AnimatedNumber`。
3. 图表：`dataDisplay.chartGrid`，主图占两列。
4. 最近列表：`glass-card` + `divide-y` 或 Table。

### 3.2 列表 / 管理页

使用 `pageShell.list`，结构固定：

1. Header：`pageHeader.root`。
2. KPI / 快捷筛选：一行可换行 pill。
3. Toolbar：`surfaces.toolbar`，包含搜索、筛选、导出、分段 Tabs。
4. Desktop：表格。
5. Mobile：卡片列表。
6. Batch action：只在选中数据时出现，动作必须由业务工作流校验。

### 3.3 详情页

使用 `pageShell.detail` 或 `pageShell.split`，结构固定：

1. Sticky hero：返回入口、主编号、状态徽章、关键金额。
2. Action chips：主动作使用品牌渐变，次动作用 outline/ghost。
3. Tabs：概览、时间线、消息、附件、库存等。
4. 主内容：信息卡、报价卡、客户/设备卡。
5. 侧栏：操作、历史、元数据。

### 3.4 新建 / 编辑表单页

使用 `pageShell.form`，结构固定：

1. 返回按钮 + 紧凑标题。
2. `<form className={formLayout.stack}>`。
3. 每个业务段落使用 `formLayout.section`。
4. 字段使用 `FormItem` 模式：小号 Label、必填星号、控件。
5. 底部 sticky action bar，左侧摘要，右侧取消/提交。
6. 提交前本地校验；提交后 invalidate 相关 query key。

## 4. 可复用 class 声明

`src/lib/ui-patterns.ts` 已提供以下声明：

| 导出                 | 用途                                                 |
| -------------------- | ---------------------------------------------------- |
| `pageShell`          | 页面最大宽度、padding、详情/表单/列表容器            |
| `pageHeader`         | 页面标题区、eyebrow、title、subtitle、actions        |
| `surfaces`           | `glass-card`、toolbar、sticky action、empty、popover |
| `controls`           | 品牌按钮、搜索框、分段按钮                           |
| `dataDisplay`        | KPI grid、chart grid、table、mobile cards、number    |
| `formLayout`         | form stack、section、grid、field、label              |
| `stateBlocks`        | skeleton/error/empty/muted help                      |
| `iconSizes`          | 统一图标尺寸                                         |
| `brandGradientStyle` | 品牌渐变 style 对象                                  |

示例：

```tsx
<div className={pageShell.list}>
  <header className={pageHeader.root}>
    <div>
      <p className={pageHeader.eyebrow}>工作台 / 客户</p>
      <h1 className={pageHeader.title}>
        <span className="gradient-text">客户</span>
      </h1>
      <p className={pageHeader.subtitle}>客户资料、设备和历史工单。</p>
    </div>
    <div className={pageHeader.actions}>
      <Button style={brandGradientStyle}>新建客户</Button>
    </div>
  </header>
  <div className={surfaces.toolbar}>...</div>
</div>
```

## 5. 数据与 Query Key 约定

| 场景     | Query Key                          | API                              |
| -------- | ---------------------------------- | -------------------------------- |
| 工单列表 | `["orders", filters]`              | `listOrders(filters)`            |
| 工单详情 | `["order", id]`                    | `getOrder(id)`                   |
| 工单统计 | `["order-stats"]`                  | `getOrderStats()`                |
| 选项数据 | `["repairdesk-options"]`           | `getRepairDeskOptions()`         |
| 客户搜索 | `["customer-suggest", q]`          | `searchCustomers(q)`             |
| 客户设备 | `["customer-devices", customerId]` | `getCustomerDevices(customerId)` |

Mutation 成功后至少 invalidate 当前资源和相关统计。例如创建/流转/付款工单后，应 invalidate `orders`、`order-stats`，详情页还要 invalidate `["order", id]`。

## 6. 新页面生成流程

1. 选择页面类型：Dashboard、List、Detail、Form、Placeholder。
2. 从 `src/lib/ui-patterns.ts` import 对应声明。
3. 从 `src/components/ui/*` 选择原子组件，不自造按钮/输入/弹层。
4. 需要业务徽章/金额/电话时复用 `orders/badges.tsx`。
5. 写 `metadata`。
6. 如页面进入主导航，同步三处：`AppSidebar`、`AppBar.labels`、`CommandPalette`。
7. 数据通过 `@/lib/repairdesk/api` 或新增同风格 facade，不在组件里放服务端密钥逻辑。
8. 加 loading、empty、error 三态。
9. 检查移动端单列、桌面表格/网格、亮暗主题。
10. 运行 `npm run lint` 和 `npm run build`。

## 7. 组件新增规则

完整组件生成流程见 [`COMPONENT_GENERATION_DECLARATION.md`](./COMPONENT_GENERATION_DECLARATION.md)。

新增组件放置：

- 通用 UI 原子：`src/components/ui/*`
- 业务组件：`src/components/<domain>/*`
- 页面内只使用一次且强绑定该页面的组件：先放在路由文件内部；复用超过两处再抽出。

组件 API：

- 接收明确业务 props，避免传整包未使用对象。
- 支持 `className` 时用 `cn()` 合并。
- 图标按钮必须有 `aria-label`。
- 弹窗/Sheet 必须有 title；视觉隐藏时使用 `sr-only`。
- 表格数字列右对齐并使用 `font-mono tabular-nums`。

## 8. 新页面模板

```tsx
import type { Metadata } from "next";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { brandGradientStyle, pageHeader, pageShell, surfaces } from "@/lib/ui-patterns";
import { fadeUp, stagger } from "@/lib/motion";

export const metadata: Metadata = {
  title: "示例",
  description: "示例页面说明",
};

export default function ExamplePage() {
  return (
    <div className={pageShell.wide}>
      <motion.header
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className={pageHeader.root}
      >
        <motion.div variants={fadeUp}>
          <p className={pageHeader.eyebrow}>工作台 / 示例</p>
          <h1 className={pageHeader.title}>
            <span className="gradient-text">示例</span>
          </h1>
          <p className={pageHeader.subtitle}>页面说明写业务价值，不写使用教程。</p>
        </motion.div>
        <motion.div variants={fadeUp} className={pageHeader.actions}>
          <Button style={brandGradientStyle}>主要操作</Button>
        </motion.div>
      </motion.header>

      <section className={surfaces.section}>...</section>
    </div>
  );
}
```

## 9. 视觉验收清单

- 页面容器是否使用 `pageShell.*`。
- 主标题是否使用 `font-display` 或 `pageHeader.title`。
- 主 CTA 是否使用 `brandGradientStyle`。
- 是否没有新硬编码颜色。
- 是否复用 `StatusBadge`、`MoneyText`、`PhoneText`。
- 是否有 loading / empty / error。
- 是否在 390px、768px、1280px 宽度不溢出。
- 是否暗色默认可读，亮色主题不丢边框和层级。
- 是否同步导航和命令面板。
- 是否通过 lint/build。
