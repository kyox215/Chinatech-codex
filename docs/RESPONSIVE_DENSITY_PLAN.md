# ChinaTech RepairDesk 响应式与高密度布局执行计划

Status: active
Owner: UX + QA + Documentation / Integration Lead
Scope: current responsive density rules, overflow requirements, desktop/mobile behavior, and validation guidance.
Last reviewed: 2026-08-09 CEST by `TASK-20260809-005-global-compact-selector-typography-release`

## Summary

本计划用于把 ChinaTech RepairDesk 全项目改造成稳定的响应式后台系统：

- 所有页面禁止出现页面级左右横移。
- 桌面端优先高密度信息展示，适合维修店高频扫单、查单、改单。
- 桌面端从列表打开详情优先使用弹窗式详情，减少整页跳转，提高查单和处理响应速度。
- 平板端（`768px-1023px`）保持完整业务能力，使用抽屉导航、双列卡片或双列表单，不强塞桌面侧栏和复杂弹窗。
- 移动端放弃桌面表格，统一使用三段式卡片、侧边栏抽屉导航和弹层动作。
- 状态、分类、Tabs 和表单步骤默认必须在当前宽度完整可达，不依赖左右拖动、滚动条或伪进度条。
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

列表筛选、状态分组、类别选择、Tabs 和 Stepper 不属于“数据比较组件”，不能使用这个例外。它们必须通过固定网格、自动换行、Select/Menu 或筛选 Sheet 在当前 viewport 内完整可达。

### 2.1 顶部分组不是流程，滚动条不是进度

- 并列的状态/类别筛选禁止使用“圆点 + 连线”的流程轨道外观。
- 普通列表、新建、编辑和对象详情不显示装饰性进度条。只有真实线性且不可压缩的多步任务才能显示进度。
- 不得用浏览器滚动条、细长灰线、轮播位置条或无实际数据的条形元素表示进度。
- 手机详情默认只允许页面纵向滚动；不在全屏/接近全屏容器内再创建一个长正文纵向滚动区。

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

商品库存的已验证高密度变体：

- 390px 商品列表使用 84–88px 三段式卡片，类别图形 36px，三行主体信息，右侧状态与售价；标准样本中至少第六件商品内容在视口内可见。
- 快速录入的五个类别在 390px 固定五列且每项至少 44px，不使用横向滚动；品牌/型号和常用规格优先双列。
- 新建与编辑的双主动作固定在 safe-area 上方，按钮至少 44px；正文必须预留底部空间，禁止遮挡最后一个字段。
- 430px 商品详情用三列资料格压缩六项核心规格；同一脱敏主标识只在“设备身份”出现一次。
- 商品库存的完整页面与验收合同见 [`INVENTORY_PRODUCT_MOBILE_DENSITY_NEXT_PLAN.md`](./INVENTORY_PRODUCT_MOBILE_DENSITY_NEXT_PLAN.md)。

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

### Mobile Compact Selector Typography

所有品牌/型号/规格选择器遵循以下全局合同（MUST）：

- 移动关闭态只显示短占位：品牌“选择品牌”、有品牌后的型号“选择型号”、未选品牌的型号“先选品牌”。类别示例、可搜索范围和目录外手工入口必须放在 helper 或显式搜索状态，不得用长示例撑开按钮或重复占位。
- 真实可编辑 `input`、`textarea`、`select`、`contenteditable` 在 `<768px` 必须保持 `16px`；全局 `src/styles.css` zoom guard 是最终约束。非编辑 combobox trigger button 可以用 `13px–14px`（推荐 `text-sm`），但不能因此缩小实际触控目标。
- trigger、明确搜索按钮、关闭按钮和移动 option row 的命中区域必须达到 `44px`（`min-h-11`）；焦点 ring、Escape/Tab、focus 回收和无自动键盘行为不能因密度调整而删除。
- 选中长品牌/型号使用 `min-w-0` + `truncate` + `shrink-0` 箭头；选项列表使用 `whitespace-normal`、`break-words` 或 `overflow-wrap:anywhere`，最长两行可用 `line-clamp-2`。选择器不能依赖页面级横向滚动，不能让长文本覆盖箭头、相邻字段或搜索按钮。
- `<360px` 成对的品牌/型号选择器必须单列；`360px–639px` 只有同时满足 `minmax(0,...)`、短关闭态 label、13–14px 非编辑 trigger、44px target 和无横向溢出验收时才允许双列，否则必须单列。`640px–767px` 可按字段语义保持双列或换行；`768px–1023px` 双列可按依赖关系整行降级；`>=1024px` 保留 editable input 与桌面 Popover。游戏机存储和版本属于独立字段，窄屏不得长期挤在半栏并截断。
- option row 主文本采用紧凑 `text-sm`/`leading-4`，年份/系列等辅助信息使用 `text-[11px]` 到 `text-xs`；两者都必须 `min-w-0`，不能通过固定 `min-width` 撑开列表。

组件实现必须复用 [`componentDensity.compactSelector`](../src/lib/component-patterns.ts)。禁止在业务页面重新定义选择器字号、触控高度、长文本或窄屏降级 class；新增变体先更新共享声明和窄屏/桌面回归测试。

### Actions

操作按钮必须按优先级降级：

1. 主动作保留按钮，例如“新建”“推进至下一状态”。
2. 次动作保留 outline 小按钮。
3. 低频动作折叠到 `MoreHorizontal` 菜单。
4. 移动端主要动作可放到底部 sticky action 或 Sheet。
5. 桌面列表行点击直接打开详情弹窗，三个点菜单只保留低频动作，不作为唯一详情入口。

手机和平板业务页面（`< 1024px`）采用语义化触控密度，不再对所有控件强制 `44×44px`：

| 等级             | 规格                    | 适用场景                                       |
| ---------------- | ----------------------- | ---------------------------------------------- |
| Micro            | `24-28px`               | 低风险、相邻目标有充分留白的清除/展开/内嵌图标 |
| Dense            | `32px`                  | 高频筛选、状态切换、分页等紧凑操作             |
| Standard         | `36px`                  | 普通工具栏与图标入口                           |
| Input            | `38px`，字号至少 `16px` | 输入、选择与搜索，避免 iOS 自动缩放            |
| Primary / Danger | `40-44px`               | 新建、保存、推进、付款、删除等关键或危险动作   |

所有目标仍须满足 WCAG 2.2 AA 的 `24×24 CSS px` 最小尺寸或等价间距例外。相邻密集目标优先使用 `32px` 以上；关键动作不得降到 Micro。

### 列表页关系级间距

备忘录列表是共享管理页的视觉节奏基准，但不是控件尺寸模板。订单、客户、库存、回收、消息与设置保留各自已经验证的控件密度，元素之间统一使用以下关系级间距：

| 关系     | 间距   | 用途                           |
| -------- | ------ | ------------------------------ |
| 行内     | `4px`  | 图标与文字、数字与单位         |
| 控件簇   | `6px`  | 搜索与相邻图标操作、同一行按钮 |
| 内容行   | `8px`  | 独立列表卡、卡内主要内容行     |
| 业务组   | `12px` | 标题与结果区、状态组与正文     |
| 移动模块 | `16px` | 独立业务模块、分页与结果区     |
| 桌面模块 | `24px` | 桌面工具栏、表格、侧栏模块     |

- 共享列表 Floating Card 使用两层留白：头部壳自带 `8px` 底部缓冲，正文再保留 `16px` 模块间距；按卡片外框测量时总视觉间距约为 `24px`。详情/任务/工作流 Floating Card 仍遵守 `6-10px` 标准，不与列表页混用。
- 不得为了“统一”把 `36px` 普通工具按钮、`38px` 输入或 `40px` 主动作全部改成同一高度。
- 高密度订单队列只采用外层模块节奏；流程条、金额摘要等卡内信息继续使用紧凑密度。

### Sync Status

- Realtime 状态属于工作台元数据，不新增 Banner 或独立卡片。
- 桌面端使用工具栏单图标和 tooltip；移动订单列表把紧凑图标放在悬浮标题副行。
- 状态必须使用 `role="status"` 与 `aria-live="polite"`，禁用时不占空间。
- 390px 下状态变化不得改变悬浮标题、搜索栏或流程分组的尺寸。

### Overlays

所有弹窗、Popover、Dropdown、Sheet 必须限制 viewport 宽度：

```tsx
"max-w-[calc(100vw-24px)]";
```

详情弹窗桌面建议：

```tsx
"w-[min(1120px,calc(100vw-32px))] max-h-[90vh] overflow-y-auto";
```

工作台型弹窗（新建工单、工单详情、客户详情预览等）使用共享 workspace shell，
桌面端与新建工单保持同一宽度逻辑：

```tsx
"sm:h-[calc(100svh-32px)] sm:w-[min(1400px,calc(100vw-32px))]";
```

小型表单、付款、通知、确认类 Dialog 继续使用 `modalSm` / `modalMd` / `formContent`，
不要被提升成全屏工作台。

工单详情弹窗属于沉浸式工作面，外壳必须固定为 viewport-safe 高度，切换概览、记录、附件库存时不改变 Dialog 尺寸；iPad/桌面概览区必须使用 `detailWorkspace.orderDetailGrid`：左栏堆叠客户与设备，中栏报价处理，右栏工单信息与最近记录；768–1023px 自动使用与新建订单一致的两列落位。手机详情保持独立移动结构，任何断点都不能产生页面级横向滚动。

新建工单工作区采用“客户设备 + 报价处理”的稳定布局：

- `>= 768px` 使用两栏：客户、设备和手机密码在左，报价处理在右并跨越左栏内容高度；`< 768px` 保持客户、设备、报价、手机密码的 DOM/键盘顺序并降为单栏。
- 新建流程不显示“客户报障 / 问题明确 / 需检测确认”，也不通过报障模式暂停报价、清空项目或归零定金。历史本机草稿中的 `pausedRepairItems` 与 `pausedDepositAmountCents` 只做读取兼容，恢复后按普通报价和定金处理；新草稿不再写这些字段。
- 设备保管状态是新建时必须确认的独立记录标签。切换“门店保管 / 客户保管”不得修改或过滤手机密码、报价项目、定金、随附物品和初始状态。
- 手机密码始终显示并可填写，与保管状态无关；普通本机草稿仍不得保存密码、PIN 或图案明文。
- 定金输入必须位于报价草稿的“总额 / 定金 / 尾款”金额组内，同一区域只能有一个可编辑定金控件。
- 响应式门禁至少覆盖 `390 / 430 / 768 / 834 / 1024 / 1280 / 1440`，断言页面无横向溢出、无客户报障节点、密码编辑器可见且报价区只有一个定金输入。

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

| Density     | 场景                         | 行高 / 间距                             |
| ----------- | ---------------------------- | --------------------------------------- |
| Comfortable | 仪表盘、设置、低频页面       | 卡片 `p-4/p-5`，行高正常                |
| Compact     | 表单、详情、客户页           | 卡片 `p-3/p-4`，控件 `h-9`              |
| Dense       | 工单列表、库存列表、客户列表 | 行高 `h-8~h-11`，字号 `text-xs/text-sm` |

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
- 列表 / 管理模块正文不得再显示重复 AppBar 的大标题块，例如 `工作台 / 客户`、`客户管理`、`全部 · 共 ...`；首屏默认直接进入工具条或业务列表。KPI、chips、Tab 和 Stepper 不得因新功能存在多个状态而自动加入，状态筛选默认收纳到筛选入口。

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

## Mobile Dashboard `/`

移动端概览是门店交接入口，不按物理 PPI 缩放整页。浏览器已通过 CSS pixel
归一化屏幕密度；布局以 viewport 宽度、可用高度和安全区为准，PPI/devicePixelRatio
只影响图标、二维码、照片等栅格内容的清晰度。

移动端固定信息顺序：

1. 三列快捷操作：快速接单、扫码查单、回收估价。
2. 三列交接指标：已超期、可立即处理、等待跟进。
3. 单行四项优先筛选。
4. 高密度优先工单卡。
5. 两列业务入口。

断点规则：

- `320px-359px`：快捷入口只显示图标和单行标题，卡片间距为 `6px`。
- `360px-399px`：保持三列快捷入口和四列筛选；紧凑操作使用 `32-36px`，主动作使用 `40px`。
- `400px-430px`：快捷入口可显示一行辅助说明。
- `431px-639px`：内容最大宽度保持 `430px` 并居中，不按屏幕物理尺寸无限放大。
- 短屏和横屏优先压缩装饰性上下间距；输入字号保持 `16px`，操作按语义等级缩放。

扫码查单必须复用 `features/capture` 的订单范围扫码能力；有效系统工单码可打开工单，
普通编号/IMEI 可进入订单搜索。摄像头不可用或权限被拒绝时，必须保留手动输入和粘贴。
前端入口不扩大订单权限，最终读取仍由既有服务端门店和角色授权决定。

验收至少覆盖 `320x568`、`360x780`、`390x844`、`430x932`，并检查：

- `scrollWidth <= innerWidth`。
- 三个快捷入口和四个筛选均可见、可聚焦、可点击。
- 主要操作触控区不小于 `40px`；普通目标不小于 `24px` 并满足相邻间距。
- 加载、空、错误、权限和长文本状态不改变页面宽度。
- `1024px+` 桌面概览布局和业务行为不回归。

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

- 顶部常用分组固定为 `全部 / 处理中 / 待收款 / 要跟进`；有设备、老客户、联系许可和标签放入“更多筛选”。
- 搜索、分组、更多筛选和页码进入详情后必须可恢复；客户电话、姓名等潜在个人数据不得写入 URL，使用按店铺与用户隔离、带过期时间的同标签页状态。URL 只允许携带不含个人数据的返回来源标记。
- `>= 1024px` 使用无横向滚动的五列表格：客户、设备、金额、现在要做什么、查看。
- `< 1024px` 使用紧凑客户卡；右侧只保留一个金额或工单焦点，主区显示客户、设备和下一步动作。

### Detail

- Hero 不撑宽，主动作固定为新建工单、发消息、加待办；编辑使用图标入口。
- 五个分组固定为 `总览 / 工单 / 设备 / 跟进 / 资料`，同排压缩且支持标准键盘 Tab 导航。
- 移动端五分组放入悬浮详情头，三个主动作固定在底部；客户详情隐藏会遮挡操作的全局快捷浮钮。
- 消息发送采用“打开通道”与“我已发送，记录联系”两步确认，不把仅打开 WhatsApp/SMS 误记为已发送。

### Acceptance

- 搜索长电话、长姓名时布局不变形。
- 列表和详情在 `390 / 430 / 768 / 1024 / 1440 / 1920` 都无横向滚动。
- 客户列表浏览器响应不包含备注、备用号码、营销备注或设备搜索明文等列表不需要的字段。

## Step 6: 库存、消息模板、设置

### Inventory

- 库存列表不使用顶部连线状态轨道；手机以一个“筛选”入口打开 Sheet，桌面使用可换行控件或 Select。
- `>= 1280px` 使用不超过 6 个主列的 dense table；`1024-1279px` 使用 5 列压缩表格或双列卡片；`< 1024px` 使用卡片。
- 库存表格禁止依赖固定 `min-width` + `overflow-x-auto` 实现窄宽度兼容；宽度不足时先隐藏低优先级列或切换卡片。
- 供应商、备注、设备型号长文本截断或在详情换行，不撑开列表。

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

| Viewport    | 用途              | 必验内容                            |
| ----------- | ----------------- | ----------------------------------- |
| 390 x 844   | iPhone 常用宽度   | 单列卡片、底部动作、接近全屏 Sheet  |
| 430 x 932   | 大屏手机          | 长文本截断、表单键盘安全区          |
| 768 x 1024  | iPad / 小平板     | 双列降级、工具栏换行、弹层宽度      |
| 834 x 1194  | iPad 竖屏         | 抽屉导航、双列卡片/表单、独立详情页 |
| 1024 x 768  | 窄桌面 / 平板横屏 | dense 表格、桌面详情 Dialog         |
| 1280 x 800  | 常见笔记本        | 高密度列表、批量操作条              |
| 1440 x 900  | 标准桌面          | 完整工具栏、详情分栏                |
| 1600 x 1000 | 高分辨率桌面      | 最大宽度约束，不无限拉伸            |

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
- 正文没有重复 AppBar 的模块标题、面包屑或总数副标题。
- 390、768、1024、1440 viewport 下无页面横向滚动。
- 数据加载、空态、错误态不撑宽。
- 弹窗、Dropdown、Popover 不超出 viewport。
- lint、typecheck、test、build 通过。
- 截图保存到 `screenshots/responsive-density/<page>/` 用于对比。

## TASK-20260814-001 — Inventory Device Form Responsive Intake Contract

Status: `proposed` / intake only · Owner: Integration Lead · Risk: `R2` · Autonomy: `L2`

This section records the approved boundary for the new inventory device form work. It is a
planning contract, not an implementation claim. The current development worktree is
`/private/tmp/repairdesk-inventory-design-system-20260811`; it contains preserved M16 and
other dirty changes that must not be reverted or folded into this task.

### Shared data, separate responsive surfaces

Brand, model, storage, memory, color, condition, and category option values may be shared as
neutral data. Desktop and mobile must not share a responsive shell, DOM order, layout model,
or interaction implementation merely because their option values are the same. Each surface
must keep its own accessible focus order, scrolling boundary, and state presentation.

### Desktop workbench contract

At `1024`, `1280`, and `1440` CSS pixels, the form remains a desktop workbench with its
multi-column information hierarchy, independent workspace/dialog sizing, mouse-oriented
dropdowns, and wheel scrolling inside long option lists. The desktop surface must not be
converted to a mobile single-column layout, mobile bottom Sheet, or tap-only interaction.
Long labels and option rows must wrap or truncate within their own bounded region without
creating page-level horizontal overflow.

### Mobile/tablet compact contract

At `390`, `430`, and `768` CSS pixels, the form uses compact sections, short labels, and
logical two-column pairs only for short fields that still meet the existing target and input
contracts. Brand/model and other selectors are opened by touch/click, remain searchable and
scrollable to the last option, and preserve keyboard-safe input behavior. The mobile surface
must not be treated as a shrunken desktop workbench; fields may become single-column when
labels, validation, or available width require it.

### Intake acceptance for the next implementation packet

- Verify desktop and mobile independently at all six widths above; record viewport width,
  page overflow, selector scroll completion, search, focus/Escape recovery, and long-option
  wrapping.
- Preserve the existing manual-entry path for an uncatalogued model. Do not claim that a
  manually entered model is persisted or searchable on a later visit until the current
  same-store/same-brand data path is audited and proven.
- Keep maintenance-oriented device options bounded and explicit: phone/tablet/game-console
  storage `8GB` through `8TB`, RAM `2/4/8/16GB`, and computer `32/64GB` extensions; colors
  remain preset-first with manual completion; condition remains a clear percentage or common
  grade.
- Keep real inventory, customer-device, customer, production, external Figma, database,
  migration, and destructive writes outside this packet. A schema/API/permission/tenant or
  migration requirement stops the batch and requires a new Owner-approved scope.
- Preserve M16 UI component governance as paused historical work; do not alter its source,
  tools, catalog, Registry state, or evidence in this intake batch.

### Candidate files and verification boundary

The next implementation packet may audit (and only then allowlist) the existing form/workspace
and catalog surfaces and focused tests: `inventory-product-form.tsx`,
`inventory-product-form-workspace.tsx`, `inventory-phone-catalog-fields.tsx`,
`inventory-device-catalog-fields.tsx`, `inventory-product-intake-screen.tsx`,
`inventory-product-edit-screen.tsx`, and their corresponding tests. Shared data helpers may
be reused, but desktop/mobile DOM and interaction ownership must remain explicit. Expected
focused evidence is scoped unit/source-contract coverage followed by the six-width browser
matrix; full gates belong to a later approved packet.

### Stop and approval conditions

Stop immediately if the implementation would change API payloads, schema, permissions,
tenant boundaries, query/mutation behavior, dependencies, production data, or database
structure; if the actual persistence path for hand-entered models cannot be proven; if a
desktop/mobile merge is proposed; or if preserved dirty worktree/M16 ownership is ambiguous.
No commit, push, deploy, migration, CAS, external Figma action, or production action is
authorized by this intake section.

## TASK-20260814-001 Instruction 3 — shared desktop return and search reuse

Entity detail/edit pages use one shared desktop context-back pattern: a visual-only
`ArrowLeft` with deterministic destination, exact accessible name, keyboard access, and visible
hover/focus treatment. The route resolver maps inventory entities to `/inventory` (`返回商品库存`),
orders to `/orders` (`返回工单列表`), and customers to `/customers` (`返回客户列表`). This
control belongs in the AppBar layer for desktop 1024/1280/1440; normal non-entity breadcrumbs
remain intact, and UUID/internal IDs are not promoted into the top chrome. Existing mobile
RepairOS headers/docks remain separate at 390/430/768, so a desktop control must not replace or
duplicate their mobile interaction.

The AppSidebar brand area is the single desktop global-search entry. It receives the existing
command-palette callback, keeps the accessible name `打开全局搜索` and ⌘K behavior, and must be
reachable in both expanded and collapsed sidebar states without horizontal overflow. Remove
duplicate AppBar search UI rather than adding a second command trigger. Future detail/edit pages
should reuse the route resolver and context-back control before introducing local navigation.

The instruction-3 acceptance matrix is desktop 1024/1280/1440 and mobile 390/430/768: one
desktop search trigger, exact href/name, no UUID chrome, visible focus/hover states, deterministic
route behavior, and unchanged mobile RepairOS behavior. Any API, schema, permission, tenant,
dependency, persistence, production-data, CAS, commit, push, or deploy coupling is a stop
condition requiring a new packet.

### Release-candidate closure — Instructions 2–3

The release candidate includes the implemented store-scoped read-only catalog facade and the
shared responsive/navigation source contract above. The candidate preserves separate desktop and
mobile compositions and keeps navigation/search ownership in the shared shell. This is a local
candidate record only: it introduces no migration, database write, schema, environment,
dependency, production-data import, CAS, commit, push, or deploy behavior.

## TASK-20260814-001 — Quick Entry disclosure-first responsive contract (design-only, 2026-08-15)

The current release is terminal-blocked: staged `dpl_CMHAYXQw65hJtxhiGtAyFRqrsaHr` is READY but
not promoted, while formal `chinatech.in/www` remains `dpl_3LVoLSqBKr9gJJLPYLjJDv6dhtU5`. A
protected staged session showing two save buttons conflicts with the expected `device-data-v2=0`
shell. No save, POST, production data, or cutover is allowed. Verify only the effective
`INVENTORY_PRODUCT_DEVICE_DATA_V2` control-plane value after refresh/re-auth in a later gate.

### Layout and field visibility

- `1024/1280/1440`: use a separate desktop workbench with exactly three top-level columns at
  every listed width, placing identity, device option, identifier, and commercial groups in a
  compact mouse-first order. Desktop uses anchored Popover/listbox surfaces and one bounded
  wheel-scroll owner per long list. It must not render a mobile Sheet or a shrunken mobile DOM.
- `390/430/768`: render a separate mobile/tablet DOM with compact semantic sections. Enum fields
  open a mobile Sheet/listbox; the sheet/listbox has a bounded scroll owner, safe-area padding,
  last-option reachability, Escape close, focus restoration, and accurate `aria-expanded` and
  mounted `aria-controls`. IMEI1 is an explicit required field; IMEI2 is a visible adjacent
  field, never hidden. Planned sale and acquisition cost remain visible in the main Quick Entry
  flow, subject to permission-safe rendering.
- Free text is directly visible. Do not hide a required or frequently edited field behind
  “more information”. The six-width matrix must assert one active responsive shell, no page
  overflow, stable focus order, and no duplicate IDs or controls.

### Disclosure and option policy

All enum fields use the existing shared selector contracts first (`componentDensity.compactSelector`,
`Popover`, `Sheet`, and the current catalog/listbox code). Selection closes the disclosure; Escape
closes it; focus returns to the trigger; the trigger exposes an accessible name and truthful
expanded/controls state. New disclosure code is allowed only as a small inventory-domain adapter
when existing primitives cannot express these rules.

Existing EU catalog searchability is separate from Apple exact-color approval. Because
`eu-phone-catalog.ts` contains broad shared arrays for some older Apple models, an Apple model is
`pending-official-color` unless a per-model official source and review receipt bind the exact
colors. Apple unknown/manual models keep their draft, display the pending mapping notice, and block
generic/custom selection. A future local approval manifest/validator is a separate data gate and
must not batch-approve the current arrays. Non-Apple generic color order is black, gray, dark blue,
green, white. IMEI1 requiredness is category-aware (phone only); non-IMEI categories do not invent
an IMEI. Acquisition cost is shown only when the existing cost permission allows it, while planned
sale remains explicit. No bulk import, schema/migration, production-data write, or unapproved
catalog mutation is implied.

- `pending-official-color` is not itself a save failure: preserve any existing draft/edit color as
  read-only, offer no new generic/custom color choice, omit any newly selected Apple color from the
  payload, and show an inline pending-mapping status. Quick Entry color is optional today, so save
  remains allowed unless the applicable category/device flow independently requires a color; that
  separate validation must state the reason explicitly.

### State and validation matrix

Later implementation evidence must cover default, loading/disabled, empty, invalid, read-failure
fallback to static/manual, permission-limited, Apple-known, Apple-unknown/manual, and save-pending/
success/error states. For each state and viewport record overflow, target sizes, input font size,
selector scroll completion, keyboard and touch behavior, Escape/focus restoration, accessible
names, and whether the active shell is desktop or mobile. Critical defects stop the batch; they
cannot be masked by `requiresRoot200`, stale screenshots, or broad exceptions.

### Reuse-first candidate boundary

The audited reusable sources are `InventoryProductFormWorkspace`, `InventoryProductForm`,
`InventoryProductIdentifierSection`, `CatalogCombobox`, existing specification/color choices,
`device-form-options.ts`, `eu-phone-catalog.ts`, `componentDensity.compactSelector`,
`componentOverlay`, and the existing UI `Popover`/`Sheet`. Candidate implementation paths are
the current inventory form/workspace/catalog fields and their existing tests/stories only; a
new domain disclosure adapter is a bounded exception requiring an explicit packet. Do not create
a generic UI primitive or alter `src/styles.css` merely to satisfy this contract.

The sequence is design → implementation → browser/a11y validation → evidence iteration → clean RC /
release. Stop for API/query/payload/permission/tenant/dependency/AppShell/schema/migration or
production-data coupling, unresolved dirty ownership, or unprovable rollback. This section is a
design contract and authorizes no source, test, Storybook, config, Registry, CAS, commit, push, or
deploy write.

### Implementation preview candidate status (current update, 2026-08-15)

The Owner has authorized the completed 20-path candidate for intentional commit/push and a
protected Preview. Existing implementation evidence records Node22 full lint/typecheck/test
`453/453` + `2993/2993`, build `30/30`, and browser `20/20`. Independent UX audit still has two
P1 gaps: disclosure-first coverage is incomplete for network/version, warranty, and manual
supplements; and complete save/error/permission/offline/conflict/success Story/evidence coverage
is not yet complete. Formal production domains remain blocked and must not be cut over. No
production data, schema/migration, or bulk catalog import is included. The Owner has authorized
autonomous design → Preview → implementation → validation → follow-up Preview; do not require a
separate per-design Owner-approval gate. This appended status does not alter the historical
design-only contract above.
