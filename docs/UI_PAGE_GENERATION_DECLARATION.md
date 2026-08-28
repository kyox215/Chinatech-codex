# RepairDesk UI 页面生成声明

Status: active
Owner: UX + Documentation / Integration Lead
Scope: current page-generation rules, App Router page bodies, RepairOS UI language, and UI validation expectations.
Last reviewed: 2026-08-07 CEST by `TASK-20260807-005-global-create-dialog-declaration`

> 目标：后续新增页面、重构页面、让 AI 生成页面时，必须复用同一套布局、组件、数据和交互契约，避免页面风格漂移。
>
> 可执行页面声明在 `src/lib/ui-patterns.ts`；组件生成声明见 [`COMPONENT_GENERATION_DECLARATION.md`](./COMPONENT_GENERATION_DECLARATION.md)；视觉令牌唯一来源在 `src/styles.css`；业务组件优先复用 `src/components/*`。
> 涉及业务查询、写入或跨设备刷新时，还必须遵守 [`REALTIME_DATA_CONSISTENCY_DECLARATION.md`](./REALTIME_DATA_CONSISTENCY_DECLARATION.md)。
> 涉及应用启动、全局 Provider、预加载或打印入口时，还必须遵守 [`STARTUP_PERFORMANCE_AND_PRINT_READINESS_DECLARATION.md`](./STARTUP_PERFORMANCE_AND_PRINT_READINESS_DECLARATION.md)。

## 1. 当前 UI 架构分析

### 1.1 技术与渲染层

- 框架：Next.js App Router + React 19。
- 路由：Next.js 文件路由，文件位于 `src/app/`；页面文件导出 `metadata`，交互主体放在 client component。
- 数据：页面通过 `@tanstack/react-query` 调用 `@/lib/repairdesk/api`。服务端 Supabase 逻辑在 `src/server/*`，前端不得直接使用 service role key。
- UI 原子层：`src/components/ui/*` 为 shadcn/Radix 基础组件，默认不改基础结构。
- 动效：framer-motion，只从 `@/lib/motion` 取 `fadeUp`、`stagger`、`scaleIn`、`cardHover`、`pageTransition`、`indicatorSpring`、`overlayTransition`、`sheetTransition`、`floatingBar`、`metricCountDuration`。
- 图标：lucide-react，常用尺寸只用 `size-3`、`size-3.5`、`size-4`、`size-5`。

### 1.2 应用外壳

根布局已在 `src/app/layout.tsx` + `src/app/providers.tsx` 固定：

- `SidebarProvider` + `AppSidebar`
- `SidebarInset`
- 平面 RepairOS 工作台背景
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
11. 新增移动业务页面必须遵守 RepairOS Compact 标准：mobile-first、浅色背景、白色紧凑卡片、科技蓝主色、统一侧边栏抽屉、高密度业务卡片，不做大 Banner 和营销式 hero。详细标准见 [`REPAIROS_COMPACT_ARCHITECTURE.md`](./REPAIROS_COMPACT_ARCHITECTURE.md)。
12. 本地开发环境不得注册或保留 PWA service worker 缓存；预览必须始终读取当前源码，避免旧 shell 干扰 UI 验收。
13. 搜索控件必须遵守“单层边界”：禁止在已有完整边框或阴影的卡片、工具栏、悬浮头中，再放置一个带完整边框或阴影的搜索框。父级无完整外框时使用 `repairOs.searchBar`；父级已拥有外框时使用 `repairOs.searchBarEmbedded`，只保留中性底色和瞬时焦点反馈。搜索 Input 本身不得再绘制第三层边框。该规则同时适用于桌面端与移动端。
14. 新功能不得把状态筛选、分类或页面分组做成“圆点 + 连线”的顶部流程轨道。步骤器只能用于用户正在完成的真实有序多步任务，不能用来切换列表视图。
15. 状态、分类和 Tab 必须在当前 viewport 内完整可达；优先使用固定网格、自动换行、下拉选择或“更多筛选” Sheet。禁止使用 `overflow-x-auto` 的横向拖动栏作为主要导航或筛选方式。
16. 不得用滚动条、细长灰线、轮播位置条或没有真实数值的条形元素伪装业务进度。只有存在真实可计算完成量时才显示进度，并同时提供文本、当前步骤和可访问状态。
17. 列表、概览和模块头部的主“新建 / +”入口必须保留当前页面上下文并打开创建浮层：桌面使用 `Dialog`，紧凑移动端使用 `Sheet` 或接近全屏的 `Dialog`。禁止把裸 `Link href="/.../new"` 或 `router.push("/.../new")` 作为默认创建入口；确需独立创建页时必须按 3.5.1 的例外流程记录并批准。

## 3. 页面布局声明

优先 import：

```tsx
import { brandGradientStyle, pageShell, repairOs, surfaces } from "@/lib/ui-patterns";
```

### 3.1 RepairOS Compact 移动业务页

用于订单管理、客户管理、回收管理、库存商品、设置等移动优先页面。优先使用 `repairOs.mobilePage`、`repairOs.metricStrip`、`repairOs.businessCard`；`repairOs.chipRow` 只在状态分组确属核心工作队列时使用。

结构固定：

1. 桌面端和移动端都不重复模块标题，不做大 hero；模块名称、面包屑和店铺上下文由 `AppBar` / 移动悬浮头负责。
2. 搜索输入高度控制在 `38px`，扫码/筛选等标准工具入口使用 `36px`；关键主动作使用 `40px`。
3. KPI 使用 2-3 个小卡片，不占满首屏。
4. 新页面默认不增加顶部状态 chips、Tab 或 Stepper；状态筛选收纳进筛选入口。只有经过产品确认、需要员工高频切换的核心工作队列才可显示 2-4 个短状态；订单首页等既有多状态工作队列使用固定或自动换行网格，移动端禁止横向滑动状态栏。
5. 主体使用高密度业务卡片，一屏目标 4-7 条。
6. 桌面端使用固定侧边栏；移动端使用同一套侧边栏抽屉，默认收纳，由 AppBar 左侧菜单按钮打开。
7. 移动端禁止再新增底部模块导航，避免与侧边栏重复；导航项统一来自 `src/shared/config/navigation.ts`。
8. 进入模块后，不再重复显示页面内部大标题区；内容默认从工具条或业务卡片开始，KPI 和 chips 都是有明确业务价值时才使用的可选信息。
9. 扫码和拍照作为全局工具，由悬浮 `+` 或模块工具条触发。
10. 移动端悬浮 `+` 和快捷操作 Sheet 必须复用 `repairOs.floatingAction`、`repairOs.quickSheet`、`repairOs.quickAction*`；第一项展示当前模块主动作，其余才是扫码、拍照、搜索等全局工具。
11. 移动端详情页和高频工作流页面必须使用 RepairOS Floating Card：`repairOs.mobileFloatingPage` + `repairOs.mobileFloatingHeader*` + `repairOs.mobileInfoCard`，顶部是一张圆角悬浮工作卡，不再使用整屏横线分割的固定顶栏。
12. Floating Card 顶部卡必须承载“返回 / 页面标题 / 状态上下文 / 主编号 / 当前步骤或进度”；正文第一张卡与顶部卡保留 6-10px 间距，禁止重叠。
13. 移动订单列表卡片的字号和层级必须以订单详情页“设备信息 / 维修项目与报价 / 支付信息”小卡片为标尺：区块标签 `text-[9px]` 到 `text-[10px]`，正文行 `text-[11px]` 到 `text-xs`，主编号 `text-sm font-semibold`；支付摘要里的主金额可用 `text-base font-semibold`，其他金额仍保持 `text-[9px]` 到 `text-[10px]`。订单列表允许“富摘要模式”，一屏目标 3-4 张，内部最多使用一个维修项目中性色块和一个支付摘要中性色块；禁止把客户、设备、维修、支付都做成独立 bordered panel。颜色只用于状态、异常、下一步、维修主项和支付风险；支付区域不得整块按状态染红/染绿，必须像订单详情页支付卡一样只给状态 pill、尾款等关键值着色。
14. 新增或重构移动详情、任务、报价、收款、扫码、拍照、历史记录页面前必须阅读 [`REPAIROS_MOBILE_DETAIL_STANDARD.md`](./REPAIROS_MOBILE_DETAIL_STANDARD.md)。移动订单详情页是当前项目的设计源头；除非该标准同步更新，否则不得新增另一套顶部、卡片、字号、金额编辑或底部操作语言。

### 3.2 Dashboard / 概览页

概览页也遵守 RepairOS Compact。使用 `pageShell.list` + `repairOs.adminSection`，不要做大 Hero、营销式欢迎区或大面积图表。

结构固定：

1. 移动悬浮头只显示页面名和“按优先级显示下一步”的上下文，不传 Dashboard 状态 chips，不显示“待处理 / 进行中 / 未结清”轨道。
2. 首屏保留“快速接单”和“快速回收报价”；移动端使用双入口卡，桌面端使用页头按钮。
3. 主内容是服务端生成的门店交接优先队列。必须对当前员工有权读取的全部活跃工单排序后再截取，禁止用最近 6 单或列表前 50 条在客户端猜测。
4. 第一优先和后续卡必须显示：为什么优先、工单号、客户与设备、当前步骤、下一步、负责人和最后更新时间。
5. Dashboard 动作只能导航到正式任务页或工单详情页；不得直接执行状态、付款、分配或消息写入。
6. 优先摘要使用专用最小字段投影，不返回或展示电话、IMEI、解锁资料、签名、供应商、金额、未结清汇总或成员 UUID。技术员继续遵守已分配工单范围。
7. 加载、真空、筛选空、硬错误和缓存陈旧必须使用不同文案；硬错误时保留两个快捷入口，禁止回退到部分列表形成假排序。
8. 桌面可在右栏显示超期、可处理、等待等非财务交接数量和业务入口；图表与重复 KPI 不占据概览首屏。

### 3.3 列表 / 管理页

使用 `pageShell.list`，结构固定：

1. 不生成页内模块标题块；不要在正文里重复 `工作台 / ...`、模块名或总数副标题。
2. KPI / 快捷筛选：一行可换行 pill。
3. Toolbar：`surfaces.toolbar`，包含搜索、筛选、导出、分段 Tabs。Toolbar 自身有完整边框或阴影时，内部搜索必须使用 `repairOs.searchBarEmbedded`，不得形成“框中框”。
4. Desktop：表格。
5. Mobile：卡片列表。
6. Batch action：只在选中数据时出现，动作必须由业务工作流校验。

### 3.4 详情页

使用 `pageShell.detail` 或 `pageShell.split`，结构固定：

1. Sticky hero：返回入口、主编号、状态徽章、关键金额。
2. Action chips：主动作使用品牌渐变，次动作用 outline/ghost。
3. Tabs：概览、时间线、消息、附件、库存等。
4. 主内容：信息卡、报价卡、客户/设备卡。
5. 侧栏：操作、历史、元数据。

复杂业务详情以弹窗打开时必须使用沉浸式工作面结构。工单详情弹窗使用固定工作面尺寸，切换 Tab 不改变 Dialog 外壳宽高；Hero 和 Tabs 固定在上方，内容区独立滚动。iPad/桌面概览区使用 `detailWorkspace.orderDetailGrid` 的员工优先两列工作面，DOM/视觉顺序固定为“报价处理 → 客户与设备 → 关键信息与记录”，`768px+` 左侧约 `2fr`、右侧约 `1fr`；手机继续使用既有移动详情结构。不得在业务组件里手写大尺寸 Dialog grid class。

移动端详情页必须遵守 [`REPAIROS_MOBILE_DETAIL_STANDARD.md`](./REPAIROS_MOBILE_DETAIL_STANDARD.md)：顶部悬浮工作卡动态测量高度并给正文让位；正文第一张卡与顶部保持 6-10px 间距；卡片标题、字段、金额和操作按钮字号按订单详情页执行；维修项目与报价、支付信息、历史记录、扫码/拍照入口都必须走同一套数据与交互边界。

### 3.5 新建 / 编辑表单页

使用 `pageShell.form`，结构固定：

1. 返回按钮 + 紧凑标题。
2. `<form className={formLayout.stack}>`。
3. 每个业务段落使用 `formLayout.section`。
4. 字段使用 `FormItem` 模式：小号 Label、必填星号、控件。
5. 底部 sticky action bar，左侧摘要，右侧取消/提交。
6. 提交前本地校验；提交后 invalidate 相关 query key。

#### 3.5.1 全局创建入口与浮层契约

以下规则适用于商品、客户、订单、备忘、回收及后续新增模块。订单管理的入口、受控 `open/session` state、共享创建组件和顺序成功编排是参考基准；其内部现存嵌套确认浮层不是参考实现。

1. **默认入口必须是浮层。** 列表页、概览页、模块 Header、空态和移动快捷操作中的主“新建 / +”动作，必须通过按钮更新 `open` state，在当前上下文挂载同一个创建组件；`RepairOsListScaffold` 等壳层只接收触发器，不拥有业务表单状态。
2. **桌面与移动保持同一业务控制器。** 桌面使用 `Dialog`；紧凑移动端使用 `Sheet` 或接近全屏的 `Dialog`。两种表面必须复用同一份校验、权限、mutation、幂等键和成功回调，不得复制两套创建逻辑。
3. **路由只能作为兼容入口，不得取代默认浮层。** `/module/new` 可保留给直接链接、恢复草稿或明确批准的沉浸式长流程，但列表“+”不得直接跳转过去。可分享入口优先使用 query/workspace intent 打开列表页上的创建浮层。新增独立创建页必须在任务记录中说明浮层不可行的原因，并取得 Owner 或 Integration Lead 明确批准。
4. **表单必须与页面外壳解耦。** 可复用创建工作区应接收 `surface`、`onCancel`、`onCreated` 等接口；路由页和浮层只负责外壳、返回/关闭与成功去向。不得把包含独立 Header、返回按钮和 `router.push` 的完整页面直接塞进 `Dialog`。
5. **成功后先结束创建，再刷新上下文。** mutation 必须防重复提交并沿用服务端权限/幂等保护；成功后关闭创建浮层，invalidate 当前门店的列表、统计和必要详情 query，再按模块契约打开 canonical 详情或聚焦新记录。不得在创建 `Dialog` 尚未卸载时叠放第二个详情 `Dialog`。
6. **关闭不得丢失草稿。** 有未保存内容时，关闭按钮、Escape、点击遮罩和移动返回手势必须走同一确认逻辑，并在当前浮层内使用 inline confirm/step，不得再叠加 `AlertDialog`；mutation pending 时禁用重复提交，并明确允许安全取消还是必须等待。关闭后焦点回到原触发器，列表筛选、搜索、滚动位置和已选门店保持不变。
7. **权限和门店上下文保持 fail-closed。** 触发器按创建权限隐藏或禁用，服务端继续做最终授权；浮层打开期间如门店、账号或权限指纹变化，必须关闭或清空旧草稿并提示用户，不得把旧门店草稿提交到新上下文。
8. **错误必须保留现场。** 校验、网络、超时或服务端错误不得关闭浮层或清空草稿；使用 inline error/summary，聚焦首个错误并允许重试。超时和结果未知必须复用同一幂等键进入确认/恢复流程，不得重新创建重复对象。
9. **单一模态根，禁止浮层嵌套。** 已位于 `Dialog`、`AlertDialog` 或 modal `Sheet` 内的子级创建/确认动作，必须在当前工作面内展开 inline panel/step；移动端需要改用 `Sheet` 时，应让它替换当前表面，或先关闭/暂停父浮层后再打开，禁止两个模态根同时存在。子级完成后回写当前工作面并刷新相关数据。
10. **浮层必须可访问且不溢出。** 必须提供 title、description、初始焦点、键盘导航、可预测的 Escape 行为和焦点恢复；外壳尺寸稳定，长内容仅由 body 滚动，提交区使用 sticky footer，并至少验证 390px、768px、1024px、1280px、1440px。

代码审查时，凡发现列表主创建入口使用裸 `/new` 导航，默认视为违反本声明；除非同一任务内存在已批准的例外记录。

本声明自 `TASK-20260807-005-global-create-dialog-declaration` 起约束所有新增和被修改的创建流程。`NewOrderScreen` 内现存的嵌套 `AlertDialog` 与 `SupplierEditorSheet` 的弃稿 `AlertDialog` 登记为既有技术债，不得作为新实现范例；后续触碰这些流程时必须优先迁移到同表面 inline confirm/step，并补单一模态根回归测试。

工单录入人 / 技师属于服务端归属字段。新建、编辑、详情弹窗不得生成可编辑技师输入框或选择器；新建工单只可显示当前账号提示，最终写入必须由 API actor 决定。

金额编辑必须使用 string draft 管理输入框，再通过纯 helper 统一转换为 number。禁止直接用 `Number(event.target.value)` 绑定可清空的金额输入，避免空值被强制显示为 `0`。

工单状态流转不得只提供一个立即执行按钮。移动端和高频详情页必须先展示可用流转分支；取消、未修取机、返修等需要追溯的分支必须提供预设原因选择和可编辑说明，并把原因写入时间线。

工单日常主流程只表达“接单 / 检测报价 / 维修处理 / 通知取机 / 收款完成”。底层 `workflow_status` 仍保留收机、检测、报价、配件、维修、取机、结案等兼容状态；UI 通过 `order-simple-flow.ts` 聚合展示。邮寄中、外修、通知状态、配件状态、客户审批状态、异常状态必须作为辅助状态标签或独立处理面板展示，禁止把这些沟通/物流/异常状态混成主流程节点。

报价审批必须使用正式的客户审批处理面板：客户同意后选择进入维修或订件，客户拒绝后选择未修取机或取消，并强制填写拒绝原因。审批处理只记录结果和推进状态，不自动发送 WhatsApp；发送消息仍走通知/审批消息入口。

设备照片、签名和取件凭证不得只作为本地草稿存在。生产功能必须通过 `@/lib/repairdesk/api` 写入订单附件，并在订单详情中从 `OrderDetail.attachments` 渲染；服务端负责私有存储、签名地址和时间线记录。

移动订单详情必须提供明确的“历史记录 / 操作记录”入口，展示最近一次操作并可打开完整时间线 Sheet。桌面详情继续使用“记录”Tab；新增流程不能把状态、收款、通知、附件上传等追溯信息隐藏在菜单深处。

### 3.6 沉浸式工作区

用于排班、看板、报价、诊断、库存盘点等高频操作页。首屏必须直接呈现可操作工作区，不做营销式 hero、说明卡或装饰性分屏。

结构固定：

1. 外层使用 `pageShell.safe` 或 `pageShell.wide`，业务画布必须 `min-w-0 max-w-full overflow-hidden`。
2. 顶部只保留紧凑上下文、筛选和主动作；工具条可 sticky，但不要重复 AppBar。
3. 主区域优先是表格、看板、时间轴、画布或分栏工作台，不把整个工作区包进一张大卡片。
4. 浮动批量操作条使用 `floatingBar`，指标数字使用 `metricCountDuration`。
5. 移动端保留核心操作能力，低频面板改为 Sheet 或独立页面，不隐藏关键业务状态。

## 4. 可复用 class 声明

`src/lib/ui-patterns.ts` 已提供以下声明：

| 导出                 | 用途                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `pageShell`          | 页面最大宽度、padding、详情/表单/列表容器                            |
| `pageHeader`         | 对象详情、表单或特殊工作区标题；列表/管理模块正文禁止用它重复 AppBar |
| `surfaces`           | `glass-card`、toolbar、sticky action、empty、popover                 |
| `controls`           | 品牌按钮、搜索框、分段按钮                                           |
| `dataDisplay`        | KPI grid、chart grid、table、mobile cards、number                    |
| `formLayout`         | form stack、section、grid、field、label                              |
| `repairOs`           | RepairOS Compact 移动页、Floating Card、KPI、chips、高密度业务卡片   |
| `stateBlocks`        | skeleton/error/empty/muted help                                      |
| `iconSizes`          | 统一图标尺寸                                                         |
| `brandGradientStyle` | 品牌渐变 style 对象                                                  |

搜索容器只能二选一：

- 独立式：父容器没有完整卡片边框/阴影，使用 `repairOs.searchBar` 承担唯一边界。
- 嵌入式：父容器已经承担边界，使用 `repairOs.searchBarEmbedded`；不得再加 `border`、卡片阴影或第二个白色卡片面。

两种模式都必须使用无边框的 `repairOs.searchInput`，焦点环只在交互时短暂出现，不算持久第二层边框。

列表 / 管理页示例：

```tsx
<div className={pageShell.list}>
  <div className={surfaces.toolbar}>...</div>
  <section className={repairOs.cardList}>...</section>
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

新建工单成功后，列表内入口必须先关闭创建 `Dialog`，再顺序进入 route-backed 详情工作区 `/orders?workspace=order-detail&orderId=...`；独立 `/orders/new` 兼容页则进入 canonical `/orders/{id}`。两种入口都不得叠放创建与详情浮层，也不得同时触发两个成功目的地。

## 6. 新页面生成流程

1. 选择页面类型：Dashboard、List、Detail、Form、Workspace、Placeholder。
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
import { Button } from "@/components/ui/button";
import { brandGradientStyle, pageShell, repairOs, surfaces } from "@/lib/ui-patterns";

export const metadata: Metadata = {
  title: "示例",
  description: "示例页面说明",
};

export default function ExamplePage() {
  return (
    <div className={pageShell.wide}>
      <div className={surfaces.toolbar}>
        <Button style={brandGradientStyle}>主要操作</Button>
      </div>
      <section className={surfaces.section}>...</section>
      <section className={repairOs.cardList}>...</section>
    </div>
  );
}
```

## 9. 视觉验收清单

- 页面容器是否使用 `pageShell.*`。
- 列表/管理模块正文是否没有重复 AppBar 的模块标题、面包屑和总数副标题。
- 主 CTA 是否使用 `brandGradientStyle`。
- 是否没有新硬编码颜色。
- 是否复用 `StatusBadge`、`MoneyText`、`PhoneText`。
- 是否有 loading / empty / error。
- 是否没有将状态筛选/分类做成顶部连线流程轨道。
- 是否没有装饰性进度条、伪滚动指示条或没有真实进度数据的长条。
- 状态、分类和 Tab 是否不需要左右拖动才能访问。
- 是否按响应式计划的 viewport 矩阵验证，至少覆盖 390px、768px、1024px、1280px、1440px。
- 是否暗色默认可读，亮色主题不丢边框和层级。
- 是否同步导航和命令面板。
- 是否通过 lint/build。
