# ChinaTech RepairDesk 响应式与高密度布局执行计划

## Summary

本计划用于把 ChinaTech RepairDesk 全项目改造成稳定的响应式后台系统：

- 所有页面禁止出现页面级左右横移。
- 桌面端优先高密度信息展示，适合维修店高频扫单、查单、改单。
- 桌面端从列表打开详情优先使用弹窗式详情，减少整页跳转，提高查单和处理响应速度。
- 平板端保持完整业务能力，但自动降列、换行、压缩动作区。
- 移动端放弃桌面表格，统一使用三段式卡片、侧边栏抽屉导航和弹层动作。
- 新页面、新组件、新弹窗必须遵守同一套响应式和密度规则，避免后续继续产生横向溢出。

本计划不重做视觉风格，不改变业务路由，不改变数据库结构。重点是布局边界、信息密度、组件约束、验收机制。

## Design Principles

### 1. 后台系统优先效率

RepairDesk 是维修工单后台，不是营销站点。页面应优先支持：

- 快速扫描大量工单。
- 一屏看到更多关键字段。
- 快速筛选、搜索、进入详情、流转状态。
- 长文本不撑爆布局，但必须能在详情里看到完整信息。

### 2. 页面不能横向滚动

项目红线：

```txt
document.documentElement.scrollWidth <= window.innerWidth
```

任何页面、任何常用 viewport 下失败都视为 Bug。

允许的例外只有两类：

- 打印预览或实际打印介质。
- 明确设计为局部横向滚动的数据比较组件，但滚动必须限制在组件内部，不能撑开页面。

### 3. 数据要“压缩显示”，不是“隐藏”

窄屏下不要简单删掉信息。优先顺序：

1. 合并字段，例如客户名 + 电话放同一单元格。
2. 第二行小字显示次要信息。
3. 截断长文本，保留 tooltip/title 或详情入口。
4. 折叠低频动作到菜单。
5. 最后才隐藏低优先级字段。

### 4. 桌面高密度，移动三段式

- 桌面：表格或 grid table，高密度行，固定列策略。
- 平板：紧凑表格或双列卡片。
- 手机：三段式卡片，左状态，中主体，右金额/时间/动作。

### 5. 桌面详情弹窗优先

桌面端在列表、搜索结果、客户历史工单、库存关联工单等场景打开详情时，应优先使用弹窗式详情，而不是整页跳转。

目标：

- 保持列表上下文，关闭弹窗后仍停留在原筛选、分页、滚动位置。
- 详情数据使用 React Query 预取或按需加载，打开后显示 Skeleton，不阻塞列表交互。
- 高频动作可直接在弹窗内完成，例如编辑、收款、打印、通知、状态流转。
- 弹窗关闭后刷新相关 query，但不强制整页刷新。

推荐行为：

| 场景             | 桌面行为                        | 移动行为                     |
| ---------------- | ------------------------------- | ---------------------------- |
| 工单列表打开详情 | `Dialog` / route intercept 弹窗 | 独立详情页或接近全屏 `Sheet` |
| 客户列表打开详情 | `Dialog` 预览客户档案           | 独立客户详情页               |
| 库存关联工单     | `Dialog` 快速查看工单           | 独立工单详情页               |
| 搜索结果打开详情 | `Dialog`，关闭后回到搜索上下文  | 独立页，保留返回入口         |

桌面详情弹窗必须满足：

```tsx
"w-[min(1120px,calc(100vw-32px))] max-h-[90vh] overflow-y-auto";
```

移动端不强制弹窗。低于 `1024px` 时优先让详情成为独立页面或接近全屏 Sheet，避免窄屏弹窗内再套复杂滚动。

移动端详情页固定采用 RepairOS Floating Card：

- 顶部是一张圆角悬浮工作卡，而不是全宽固定栏。
- 页面正文通过 `repairOs.mobileFloatingPage` 预留顶部空间，首张正文卡不得被置顶卡遮挡。
- 悬浮工作卡和正文卡使用同一边框、圆角、阴影系统，减少层级割裂。
- 390px 验收时必须确认 `scrollWidth <= innerWidth`，并确认顶部卡与正文第一卡之间有 6-10px 间距。
- 具体字号、卡片、颜色重点、金额编辑、扫码/拍照、历史入口和底部操作条必须按 [`REPAIROS_MOBILE_DETAIL_STANDARD.md`](./REPAIROS_MOBILE_DETAIL_STANDARD.md) 执行；当前移动订单详情页是标准样板。

## Breakpoints

| Viewport          | 命名         | 行为                             |
| ----------------- | ------------ | -------------------------------- |
| `< 640px`         | mobile       | 单列卡片、动作折叠、弹窗接近全屏 |
| `640px - 767px`   | large mobile | 单列或双列表单、卡片列表         |
| `768px - 1023px`  | tablet       | 双列布局、隐藏低优先级表格列     |
| `1024px - 1279px` | laptop       | 紧凑桌面，表格保留主字段         |
| `>= 1280px`       | desktop      | 高密度表格，完整工具栏           |
| `>= 1536px`       | wide desktop | 保持最大宽度，不无限拉伸内容     |

## Global Rules

### Page Shell

所有页面最外层主容器必须满足：

```tsx
"w-full min-w-0 max-w-full overflow-x-hidden";
```

所有参与 flex/grid 的业务内容容器必须满足：

```tsx
"min-w-0";
```

原因：很多横向溢出不是来自宽度，而是 flex/grid 子项默认 `min-width: auto`，长文本会强行撑开容器。

### Text Rules

列表、表格、卡片中的可变文本必须明确策略：

| 字段          | 默认策略                            |
| ------------- | ----------------------------------- |
| 工单号        | 单行，不换行，允许截断              |
| 客户名        | 单行截断                            |
| 电话          | `PhoneText`，单行截断               |
| 设备          | 单行截断；详情显示完整              |
| 故障          | 单行截断；详情显示完整              |
| 留存备注      | 列表中一行小字；详情中完整显示      |
| IMEI / 序列号 | 等宽字体，截断                      |
| 金额          | `MoneyText`，不换行                 |
| 状态          | `StatusBadge`，不换行但允许缩小字号 |

禁止让长文本使用默认宽度撑开页面。

### Mobile Input Zoom Guard

iOS Safari / Chrome 会在聚焦字号小于 `16px` 的可编辑控件时自动放大页面。移动端可以继续使用高密度标签、说明文案和卡片字号，但真实可编辑控件必须保持 `16px` 以上：

- `input`、`textarea`、`select`、`contenteditable` 在 `< 768px` 下由 `src/styles.css` 全局保证 `font-size: 16px`。
- 新增移动端表单时不要用 `!text-xs`、`!text-[11px]` 等方式覆盖可编辑控件字号。
- 高密度金额、报价、IMEI 等移动输入如果视觉上需要小字号，必须使用局部外层缩放或等价组件模式，真实可编辑元素仍保持 `16px` 以上。
- 不通过 `user-scalable=no` 或 `maximum-scale=1` 禁止用户手动缩放；项目只阻止键盘触发的自动放大。

### Actions

操作按钮必须按优先级降级：

1. 主动作保留按钮，例如“新建”“推进至下一状态”。
2. 次动作保留 outline 小按钮。
3. 低频动作折叠到 `MoreHorizontal` 菜单。
4. 移动端主要动作可放到底部 sticky action 或 Sheet。
5. 桌面列表行点击直接打开详情弹窗，三个点菜单只保留低频动作，不作为唯一详情入口。

### Overlays

所有弹窗、Popover、Dropdown、Sheet 必须限制 viewport 宽度：

```tsx
"max-w-[calc(100vw-24px)]";
```

详情弹窗桌面建议：

```tsx
"w-[min(1120px,calc(100vw-32px))] max-h-[90vh] overflow-y-auto";
```

工单详情弹窗属于沉浸式工作面，外壳必须固定为 viewport-safe 高度，切换概览、记录、附件库存时不改变 Dialog 尺寸；桌面概览区必须使用 `detailWorkspace.orderDetailGrid`：客户信息、设备故障、报价处理三列同屏；低于桌面宽度时自动降为两列或单列，不能产生页面级横向滚动。

编辑/新建弹窗桌面建议：

```tsx
"w-[min(860px,calc(100vw-32px))] max-h-[90vh] overflow-y-auto";
```

移动端弹窗接近全屏：

```tsx
"h-[calc(100svh-16px)] w-[calc(100vw-16px)]";
```

桌面详情弹窗性能规则：

- 打开弹窗不得触发整页 navigation loading。
- 详情 query 使用独立 key，例如 `["order", id]` / `customersKeys.detail(id)`。
- 列表 hover 或首屏可见行允许预取详情数据，但不能一次性预取整页所有详情。
- 弹窗内 mutation 成功后 invalidate 当前详情、列表和统计 query。
- 弹窗内容使用 compact density，避免在弹窗内出现二级横向滚动。

生成标准：

- 桌面详情、确认、新建/编辑优先 `Dialog`；移动筛选、侧向辅助面板和接近全屏流程优先 `Sheet`；轻量菜单、筛选和选择器使用 `Popover`。
- `Dialog` / `Sheet` 必须有 title 和 description；`Popover` 触发器必须有可访问名称。
- 所有浮层内容使用 `componentOverlay.*` 或 `surfaces.popover`，不在页面内临时拼接一套浮层 class。
- framer-motion 浮层动效从 `@/lib/motion` 取：`overlayTransition` 用于 `Dialog` / `Popover`，`sheetTransition` 用于 `Sheet`，`floatingBar` 用于底部批量操作条。
- 激活指示器统一使用 `indicatorSpring`，不要写散落的 `stiffness` / `damping`。

## Density System

项目需要三个密度等级，默认策略按页面类型选择。

| Density     | 场景                         | 行高 / 间距                              |
| ----------- | ---------------------------- | ---------------------------------------- |
| Comfortable | 仪表盘、设置、低频页面       | 卡片 `p-4/p-5`，行高正常                 |
| Compact     | 表单、详情、客户页           | 卡片 `p-3/p-4`，控件 `h-9`               |
| Dense       | 工单列表、库存列表、客户列表 | 行高 `h-11~h-13`，字号 `text-xs/text-sm` |

### Dense Table Rules

桌面数据表应该采用：

- `table-fixed` 或 CSS grid table。
- 每列有明确 `minmax(0, ...)`。
- 单元格内部必须 `min-w-0`。
- 文本使用 `truncate`。
- 行内次要信息用第二行 `text-[11px] text-muted-foreground`。
- 金额列右对齐，等宽数字。
- 状态列固定宽度。
- 更多操作固定宽度，不参与伸缩。

### Dense Card Rules

移动端数据卡片统一三段式：

```txt
左：状态 / 类型 / 优先级
中：主编号 / 客户 / 设备 / 故障 / 留存备注
右：金额 / 结清状态 / 日期 / 更多
```

卡片必须满足：

- `grid-cols-[auto_minmax(0,1fr)_auto]`
- 中间列 `min-w-0`
- 每个文本字段 `truncate`
- 右侧数字不换行
- 移动订单列表卡片采用订单详情小卡片密度：紧凑模式一屏 4-7 张，富摘要模式一屏 3-4 张。富摘要模式可使用 `p-2.5/p-3`、`gap-2`、`space-y-2`，标签 9-10px，正文 11-12px，主编号 14px，支付摘要主金额 16px；金额集中在支付信息区域右对齐、等宽数字、不换行。列表卡内部最多一个维修项目淡色块和一个支付摘要淡色块，不得把客户、设备、维修、支付都做成独立 bordered panel。
- 移动详情页的卡片密度以 [`REPAIROS_MOBILE_DETAIL_STANDARD.md`](./REPAIROS_MOBILE_DETAIL_STANDARD.md) 为准；列表卡可以更压缩，但字号、金额层级和语义色不得与详情页冲突。

## Shared Pattern Updates

第一阶段需要扩展可复用声明，后续页面只能复用这些声明，不再手写散落 class。

### `src/lib/motion.ts`

计划新增或统一复用：

```ts
indicatorSpring = { type: "spring", stiffness: 400, damping: 32 };
overlayTransition = { duration: 0.2, ease };
sheetTransition = { type: "spring", stiffness: 380, damping: 30 };
floatingBar = { hidden, show, exit };
metricCountDuration = 1.1;
```

### `src/lib/ui-patterns.ts`

计划新增或调整：

```ts
pageShell.safe = "w-full min-w-0 max-w-full overflow-x-hidden";
pageShell.list = "... w-full min-w-0 max-w-full overflow-x-hidden";
pageShell.detail = "... w-full min-w-0 max-w-full overflow-x-hidden";

layoutGuards = {
  noPageOverflow: "w-full min-w-0 max-w-full overflow-x-hidden",
  flexChild: "min-w-0",
  truncateCell: "min-w-0 truncate",
};

density = {
  toolbarCompact: "flex min-w-0 flex-wrap items-center gap-2",
  tableDense: "w-full table-fixed text-xs",
  rowDense: "h-12 border-b border-border/30",
  cardDense: "rounded-lg border bg-card px-3 py-2",
};
```

### `src/lib/component-patterns.ts`

计划新增：

```ts
componentDensity = {
  compactPanel: "glass-card p-3 sm:p-4",
  denseRow: "grid min-w-0 items-center gap-2 px-3 py-2",
  denseMeta: "truncate text-[11px] text-muted-foreground",
  denseValue: "truncate text-xs font-medium",
};

componentOverlay.responsiveDialog = "w-[min(960px,calc(100vw-24px))] max-h-[90vh] overflow-y-auto";
```

## Page-by-Page Execution

## Step 1: Global Guardrails

### Goal

建立全项目防横向溢出的底层规则。

### Changes

- 检查 `src/app/layout.tsx`、`AppBar`、`SidebarInset`、页面主容器是否有 `min-w-0`。
- 扩展 `src/lib/ui-patterns.ts` 和 `src/lib/component-patterns.ts` 的响应式声明。
- 检查 `src/styles.css` 中是否已有全局 `overflow-x` 兜底；如果没有，加在最小范围。

### Acceptance

- `/`、`/orders`、`/orders/new`、`/customers`、`/inventory` 在 390、768、1024、1440 宽度不产生页面横向滚动。
- 桌面端列表行点击打开详情弹窗，关闭后保留列表筛选、分页和滚动位置。

## Step 2: 工单列表 `/orders`

### Current Problem

当前 `/orders` 在桌面窄宽度会横向撑开，主要来源：

- KPI 和工具栏不充分换行。
- 表格列宽没有统一压缩策略。
- 长故障、电话、备注撑宽单元格。
- 某些按钮和标签固定宽度但父级没有 `min-w-0`。

### Target Layout

桌面高密度表格列：

| 列     | 策略                            |
| ------ | ------------------------------- |
| 选择   | 40px 固定                       |
| 工单号 | 170px，含类型和留存备注第二行   |
| 客户   | minmax(150px, 1fr)，姓名 + 电话 |
| 设备   | minmax(150px, 1fr)，设备 + IMEI |
| 故障   | minmax(180px, 1.2fr)，截断      |
| 状态   | 96px 固定                       |
| 金额   | 110px 固定，右对齐              |
| 时间   | 96px 固定                       |
| 更多   | 44px 固定                       |

中等宽度时合并：

- 技师合并到金额或时间第二行。
- 留存备注只显示图标或短文本。
- 故障只保留一行。

移动端：

- 隐藏表格。
- 使用三段式卡片。
- 整卡点击进入详情。
- 更多动作在右侧菜单。

### Acceptance

- 1440、1280、1024 下无横向滚动。
- 390 下显示卡片而不是表格。
- 点击桌面行打开详情弹窗。
- 行内 `SCHEDA MADRE`、超长电话、超长设备名不撑宽页面。

## Step 3: 工单详情弹窗和详情页

### Target

- 桌面详情页居中，最大宽度稳定。
- 详情弹窗永远不超过 viewport。
- 操作按钮行自动换行，Tabs 独立一行，不被 hero 压住。
- 报价、客户设备、故障诊断等卡片使用紧凑密度。

### Changes

- `OrderDetailScreen` 支持 `surface="page" | "dialog"` 的响应式 class。
- `OrderHero` 操作区使用 flex wrap。
- Tabs 容器增加 `max-w-full overflow-hidden`。
- 弹窗概览 grid 使用 `detailWorkspace.orderDetailGrid`：移动单列、平板两列、桌面三列，每列 `min-w-0`。
- 技师 / 录入人只读展示，新建与编辑入口不得提供选择器或 inline edit。
- 报价金额编辑使用 string draft + shared normalizer，空金额不自动显示为 `0`，总报价、尾款和保存 payload 必须同源计算。

### Acceptance

- 详情弹窗在 1024 宽度内不横向滚动。
- 详情弹窗在 1024、1280、1440 宽度下客户、设备、报价三列同屏。
- 详情弹窗切换到附件库存等短内容 Tab 后，Dialog 外壳宽高不变。
- 独立详情页在 390 宽度下单列。
- 所有金额保持 `€` 在前。

## Step 4: 新建/编辑工单

### Target

维修店高频录入时要紧凑，但移动端不能挤爆。

### Desktop

- 客户设备、故障诊断、报价服务三栏或两栏。
- 故障选项网格使用 3 列。
- 输入控件高度 `h-9`。
- sticky 提交栏显示总价、押金、余额。

### Tablet

- 表单变两列。
- 报价区下移。

### Mobile

- 单列。
- 故障选项 2 列或 1 列。
- 底部提交栏只显示关键金额 + 提交按钮。

### Acceptance

- IMEI 扫码控件不撑宽。
- 故障菜单不超出屏幕。
- 编辑弹窗最大宽度受控。
- 输入法打开时底部按钮仍可操作。

## Step 5: 客户管理

### List

- 桌面高密度表格：客户、电话、设备数、历史工单、最近联系、标签、操作。
- 移动三段式卡片：左标签/状态，中客户和电话，右最近日期/动作。

### Detail

- Hero 不撑宽。
- Tabs 支持横向内容压缩，不产生页面横移。
- 设备、工单、消息、营销、回访按卡片密度统一。

### Acceptance

- 搜索长电话、长姓名时布局不变形。
- 客户详情从 390 到 1440 都无横向滚动。

## Step 6: 库存、消息模板、设置

### Inventory

- 库存表格使用与工单列表同一 dense table 规则。
- 供应商、备注、设备型号长文本截断。

### Messages

- 模板列表桌面双栏，移动单栏。
- 预览区域限制宽度，不撑开页面。

### Settings

- 设置项使用紧凑卡片。
- 表单字段移动端单列。

## Data & Database Considerations

本计划不新增数据库结构，但会要求 UI 字段语义一致：

- `internal_tag` 只作为优先级标签，例如 VIP、加急。
- `accessory_notes` 作为客户留存备注，例如 SIM 卡、手机壳、卡托。
- 列表只展示 `accessory_notes` 短文本，详情展示完整。
- 工单、客户、库存相关页面都从 Supabase/API 返回同一字段，不做页面内临时拼接。

## Testing Plan

### Commands

每一阶段必须通过：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

### Viewport Verification Matrix

使用 Playwright 或手动截图验证：

| Viewport    | 用途              | 必验内容                           |
| ----------- | ----------------- | ---------------------------------- |
| 390 x 844   | iPhone 常用宽度   | 单列卡片、底部动作、接近全屏 Sheet |
| 430 x 932   | 大屏手机          | 长文本截断、表单键盘安全区         |
| 768 x 1024  | iPad / 小平板     | 双列降级、工具栏换行、弹层宽度     |
| 1024 x 768  | 窄桌面 / 平板横屏 | dense 表格、桌面详情 Dialog        |
| 1280 x 800  | 常见笔记本        | 高密度列表、批量操作条             |
| 1440 x 900  | 标准桌面          | 完整工具栏、详情分栏               |
| 1600 x 1000 | 高分辨率桌面      | 最大宽度约束，不无限拉伸           |

### Automatic Overflow Check

每个关键页面执行：

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
  await page.evaluate(() => window.innerWidth),
);
```

关键页面：

- `/`
- `/orders`
- `/orders/new`
- `/orders/[id]`
- `/customers`
- `/customers/[id]`
- `/inventory`
- `/messages`
- `/settings`

### Visual Acceptance

- 不出现页面级横向滚动条。
- 没有按钮文本竖排。
- 没有标签被挤成两三个字一行。
- 没有弹窗超出屏幕。
- 长字段截断但不遮挡相邻字段。
- 移动端表格替换为卡片。
- 桌面端每屏显示足够多数据，不退化成大卡片堆叠。

## Implementation Order

建议按小提交推进：

1. `docs`: 新增本计划。
2. `patterns`: 增加响应式和密度 class 声明。
3. `orders-list`: 修 `/orders` 页面横向溢出和桌面 dense table。
4. `orders-detail`: 修详情弹窗和详情页。
5. `orders-form`: 修新建/编辑工单。
6. `customers`: 修客户列表和详情。
7. `inventory-messages-settings`: 修剩余模块。
8. `tests`: 增加 Playwright overflow smoke test。

每一步单独提交，失败可以单独回滚。

## Definition of Done

一个页面完成响应式改造，必须同时满足：

- 代码复用 `src/lib/ui-patterns.ts` / `src/lib/component-patterns.ts` 中的响应式声明。
- 没有新增硬编码颜色或临时布局 hack。
- 390、768、1024、1440 viewport 下无页面横向滚动。
- 数据加载、空态、错误态不撑宽。
- 弹窗、Dropdown、Popover 不超出 viewport。
- lint、typecheck、test、build 通过。
- 截图保存到 `screenshots/responsive-density/<page>/` 用于对比。
