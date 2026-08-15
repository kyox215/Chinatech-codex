# RepairDesk 组件生成声明

Status: active
Owner: Frontend + Documentation / Integration Lead
Scope: current reusable-component generation, naming, placement, styling, and validation rules for RepairDesk.
Last reviewed: 2026-08-09 CEST by `TASK-20260809-005-global-compact-selector-typography-release`

> 本声明专门约束“新增可复用组件如何设计、生成、命名、落盘、验收”。
>
> 页面级规则见 [`UI_PAGE_GENERATION_DECLARATION.md`](./UI_PAGE_GENERATION_DECLARATION.md)。组件级可执行 class 声明见 `src/lib/component-patterns.ts`。
> 会读取或修改业务数据的容器组件还必须遵守 [`REALTIME_DATA_CONSISTENCY_DECLARATION.md`](./REALTIME_DATA_CONSISTENCY_DECLARATION.md)。
> 扫码组件还必须遵守 [`SCANNER_COMPONENT_BOUNDARY_DECLARATION.md`](./SCANNER_COMPONENT_BOUNDARY_DECLARATION.md)：订单二维码查询与 IMEI 设备识别是两个业务组件，只可共享无业务含义的摄像头生命周期和面板外壳。

## 1. 组件生成目标

新组件必须满足四件事：

1. **一致**：视觉、间距、状态、动效与当前 RepairDesk 页面一致。
2. **可复用**：props 清晰，样式可扩展，不绑定单个页面的临时数据结构。
3. **可维护**：业务逻辑、数据获取、展示组件边界清楚。
4. **可验证**：有 loading / empty / error / disabled 等关键状态，能通过 lint/build。

## 2. 生成前决策

新增组件前先按顺序判断：

1. `src/components/ui/*` 已有同类原子组件吗？有则复用，不重写 Button/Input/Dialog/Table。
2. 这个 UI 是否只在一个路由使用？只用一次就先放在路由文件内部。
3. 是否会被同一业务域复用？放 `src/components/<domain>/`，例如 `src/components/orders/`。
4. 是否跨业务域复用？放 `src/components/` 根部，例如 `animated-number.tsx`、`sparkline.tsx`。
5. 是否只是 class/布局片段？优先加入 `src/lib/component-patterns.ts` 或 `src/lib/ui-patterns.ts`，不要创建空壳组件。

## 3. 文件与命名

| 类型                  | 文件位置                           | 文件名           | Export              |
| --------------------- | ---------------------------------- | ---------------- | ------------------- |
| shadcn/Radix 原子扩展 | `src/components/ui/`               | `kebab-case.tsx` | PascalCase          |
| 业务组件              | `src/components/<domain>/`         | `kebab-case.tsx` | PascalCase          |
| 跨域组件              | `src/components/`                  | `kebab-case.tsx` | PascalCase          |
| class 声明            | `src/lib/*-patterns.ts`            | `kebab-case.ts`  | camelCase objects   |
| 类型                  | 就近或 `src/lib/<domain>/types.ts` | `types.ts`       | 明确 type/interface |

命名规则：

- 组件名表达业务对象，不表达样式。例如 `OrderSummaryCard`，不要叫 `GlassPurpleCard`。
- 子组件只在同文件使用时不 export。
- 共享组件支持 `className?: string`，内部使用 `cn()` 合并。
- props 类型命名为 `<ComponentName>Props`。

## 4. 组件分层声明

### 4.1 Presentational Component

只负责展示，不请求数据，不做 mutation。

适合：

- 卡片
- 徽章
- 列表项
- 统计块
- 空态
- 时间线条目

要求：

- props 传入已整理好的数据。
- 不调用 `useQuery` / `useMutation`。
- 不直接 import `@/lib/repairdesk/api`。
- 支持 `className`。

### 4.2 Container Component

负责组合数据和展示，可调用 query/mutation。

适合：

- 页面内复杂模块
- 需要局部刷新和 mutation 的业务块
- 弹窗表单

要求：

- Query key 遵循页面声明。
- mutation 成功后 invalidate 相关 query。
- 只在必要时抽出；页面能清晰承载时不强行抽。

### 4.3 Domain Primitive

业务原语组件，跨页面复用。

现有范例：

- `StatusBadge`
- `OrderTypeBadge`
- `ApprovalBadge`
- `MoneyText`
- `PhoneText`

要求：

- 输入必须是业务枚举或明确类型。
- 状态色必须走 `toneClasses` 或现有 meta。
- 不允许页面重复实现同类状态映射。

## 5. 样式生成规则

优先 import：

```tsx
import { cn } from "@/lib/utils";
import { componentShell, componentList, componentForm } from "@/lib/component-patterns";
```

硬规则：

1. 颜色只用 `src/styles.css` 语义 token。
2. 主容器优先 `glass-card` 或 `componentShell.panel`。
3. 弹层优先 `componentOverlay.content`。
4. 状态色使用 `toneClasses` 或 `bg-status-* text-status-*-foreground`。
5. 主操作按钮使用 `<Button>` + `brandGradientStyle`，不要自造按钮。
6. 图标用 lucide-react，尺寸用 `size-3` / `size-3.5` / `size-4` / `size-5`。
7. 数字用 `font-mono tabular-nums` 或 `MoneyText`。
8. 不新增一套圆角、阴影、字体、渐变。

允许使用 `class-variance-authority` 的条件：

- 组件至少有 2 个以上 variant，或 tone/size/intent 组合会明显重复。
- variant 的输出仍必须由 token 组成。
- variant 对外类型使用 `VariantProps<typeof xxxVariants>`。

## 6. Props/API 声明

组件 props 应该遵循：

```tsx
export interface ExampleCardProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}
```

规则：

- 必填字段放前面，可选字段放后面。
- 回调用动词开头：`onCreate`、`onSelect`、`onDismiss`。
- boolean 用语义名：`isLoading`、`isDisabled`、`isSelected`。
- 不把整条数据库 record 传入纯 UI，除非组件就是业务详情卡。
- 不使用 `any`。
- 不把 service role、env、Supabase client 作为 props 传给 UI 组件。

## 7. 状态声明

每个可复用组件必须明确这些状态是否需要支持：

| 状态     | 要求                                         |
| -------- | -------------------------------------------- |
| Default  | 正常数据                                     |
| Loading  | 使用 `<Skeleton />` 或 `aria-busy`           |
| Empty    | `componentList.empty` 或 `surfaces.empty`    |
| Error    | `text-status-danger-foreground` + 可恢复动作 |
| Disabled | 禁止交互并保留原因或 tooltip                 |
| Selected | `bg-accent/40` 或业务选中样式                |
| Pending  | mutation 中禁用按钮，文案变为进行中          |

如果组件不负责某状态，要在组件调用方处理，不能遗漏。

## 8. 无障碍声明

必须满足：

- 图标按钮有 `aria-label`。
- `Dialog` / `Sheet` 有 `DialogTitle` / `SheetTitle`，隐藏标题用 `sr-only`。
- 表单字段有 `Label`，错误文案能被屏幕阅读器发现。
- 可点击非 button 元素必须改成 `<button>` 或 `<Link>`。
- Hover 信息不能是唯一信息来源。
- 状态不能只靠颜色表达，至少有文本、图标或圆点。
- 焦点态不能被移除。

### 8.1 Dialog / Sheet / Popover 生成标准

- 默认复用 `src/components/ui/*` 的 `Dialog`、`Sheet`、`Popover`，不要自造 Portal、Overlay 或关闭按钮。
- `Dialog` / `Sheet` 内嵌 `DropdownMenu` 时，如果菜单动作会导航、卸载或同批关闭外层浮层，内层菜单必须使用 `modal={false}`，由外层浮层统一管理焦点和 pointer lock；回归测试必须确认最终 `document.body.style.pointerEvents !== "none"`。
- `Dialog` 用于桌面详情、确认、新建/编辑；`Sheet` 用于移动筛选、接近全屏流程或侧向辅助面板；`Popover` 只承载轻量菜单、筛选、日期/状态选择，不放长表单或详情页。
- 列表、概览和模块 Header 的主创建入口必须由所属 feature 页面持有 `open` state，并渲染受控创建 `Dialog`；移动端可以渲染同一控制器的 `Sheet`/近全屏表面。触发器不得默认使用裸 `/new` 路由跳转，完整规则见 [`UI_PAGE_GENERATION_DECLARATION.md`](./UI_PAGE_GENERATION_DECLARATION.md#351-全局创建入口与浮层契约)。
- 任一时刻只能存在一个模态根；禁止 `Dialog`、`AlertDialog` 与 modal `Sheet` 相互嵌套。已有详情/编辑浮层内的子级创建或确认使用当前工作面 inline panel/step；移动端确需 `Sheet` 时让它替换父表面，或先关闭/暂停父浮层后再打开。完成后回写并刷新外层，不叠加第二层 overlay、scroll lock 或焦点陷阱。
- 创建组件必须让表单/控制器与浮层外壳解耦，复用同一份校验、权限、mutation、幂等和 dirty-draft 逻辑；不得复制“页面版”和“弹窗版”两套业务实现。
- `Dialog` / `Sheet` 必须包含 title 和 description；视觉隐藏时使用 `sr-only`。`PopoverTrigger` 必须有可访问名称，内容无可见标题时补 `aria-label` 或 `aria-labelledby`。
- 紧凑/移动端创建 `Dialog` 打开时不得自动聚焦 `input`、`textarea`、`select` 或 combobox，以免用户尚未选择字段就弹出软键盘；初始焦点应停在 Dialog 容器或非文本操作上并保留焦点陷阱。桌面端可显式聚焦首个高频字段。回归测试必须同时断言移动端 `document.activeElement` 不是文本控件、桌面快捷焦点（如保留）以及关闭后触发器焦点恢复。
- 内容 class 复用 `componentOverlay.content`、`componentOverlay.responsiveContent` 或 `surfaces.popover`；所有浮层限制在 `max-w-[calc(100vw-24px)]` 内，移动 Sheet 接近全屏时使用 `h-[calc(100svh-16px)]`。
- 底部表单 Sheet 使用 `componentOverlay.bottomSheet`，表单 body 自己负责 `overflow-y-auto`，不要在业务页面手写 `max-h` / safe-area padding。
- 弹层内部使用 compact density，长表单 footer 可 sticky；mutation pending 时禁用主操作并保留关闭/取消路径。
- 额外使用 framer-motion 包裹浮层时，`Dialog` / `Popover` 使用 `overlayTransition`，`Sheet` 使用 `sheetTransition`，不要写散落 spring。
- 工单详情这类复杂业务 Dialog 使用 `componentOverlay.detailWorkspace` + `detailWorkspace.orderDetailGrid`，外壳必须固定工作面尺寸，Tab 内容不得改变 Dialog 宽高；小表单 Dialog 保持单层容器，不把工作面三列 pattern 用到确认框。
- 录入人、技师、创建人等归属字段只能只读展示，组件不得新增输入框、Select、inline edit 或 patch payload 来修改它们。
- 金额输入组件必须以 string draft 驱动输入框，保存前通过共享 helper 转为 number；不要用 `Number(event.target.value)` 直接控制金额输入。
- 工单状态流转入口必须先读取工作流配置；涉及取消、未修取机、返修等异常/结束分支时，必须复用 `OrderTransitionReasonSelector` 和 `order-transition-reasons.ts` 的预设原因，禁止新增裸 textarea 或让用户完全手写原因。
- 订单附件组件只能通过 `@/lib/repairdesk/api` 的附件接口上传和读取，不直接在客户端创建 Supabase client、不暴露 service role、不把照片长期保存在本地 state 作为业务结果；上传成功后必须 invalidate 当前详情并在 UI 中显示已保存状态。

### 8.2 RepairOS Compact 业务卡片密度

- 移动列表默认使用 `repairOs.businessCardDense` 或 `RepairOsBusinessCard` 搭配该 class；只有详情预览或低频设置项可以使用更宽松的 `repairOs.businessCard`。
- 标准业务卡、快捷入口、动作行和紧凑选择行优先使用 `RepairOsBusinessCard` 的 `leading` / `children` / `trailing` slots；可点击动作行可用 `as="button"` 保持原生 button 语义，表单选择行和文件/拍照采集行可用 `as="label"` 搭配原生 input 保留整行点击语义，重选/删除动作必须放在 label 外部；不要在页面里重复手写 `grid-cols-[auto_minmax(0,1fr)_auto]` 的图标、正文、尾部数值/箭头结构。
- 配置页、权限页、工作流页等后台管理的勾选/推荐/启用动作行也应优先使用 `RepairOsBusinessCard` 的 slot 结构；如果同一行里存在 checkbox 和 button，不要使用 `as="label"` 包裹按钮，改用 `as="div"` 并保持 checkbox/button 的原生交互。
- 设置开关、模板启用、健康检查和状态反馈这类短行提示优先使用 `RepairOsBusinessCard as="div"` 搭配 `leading` / `trailing`；含 Switch 的行用 `Label htmlFor` 关联开关，避免把 button/switch 嵌套进 label。
- 列表刷新失败、空结果、加载失败和分页控制这类列表状态面板优先使用 `RepairOsBusinessCard as="div"`；右侧重试/分页按钮放在 `trailing` slot，正文保留 `min-w-0` / `truncate`，不要回退到手写 `flex justify-between rounded-* border bg-*` 外壳。
- KPI 小卡优先使用 `repairOs.metricCard` / `repairOs.metricCardDense`，指标内容优先交给 `RepairOsInfoTile` 的 `leading` / `trailing` / `meta` slots；不要在业务页面继续手写 `glass-card p-4` 或重复的 label/value/icon 三段结构。
- 导入预览、批量操作预览、审计摘要等“确认前检查”面板优先使用 `RepairOsBusinessCard` 承载标题/说明/状态，再用 `RepairOsInfoTile` 展示数量和金额；warning 只展示行号、字段和原因，不展示原始敏感值。
- 状态、标签、数量和风险提示 chip 优先使用 `RepairOsBadge` 或已有业务 badge；不要在业务页面重复手写 `inline-flex rounded-full px-* text-[9px]` 的 pill 结构，长文本必须保留 `min-w-0` / `truncate`。
- `RepairOsListScaffold` 的 `chips` 是可选能力，不是新列表页默认组成。新功能默认使用搜索、单一筛选入口和主动作；只有产品确认的核心工作队列才传入顶部 chips，不能把所有状态自动平铺。
- 搜索组件必须是单层边界。无外框父级使用独立式 `repairOs.searchBar`；放在已有完整边框/阴影的工具栏、卡片或 Floating Card 中时，必须显式使用 `repairOs.searchBarEmbedded`（`RepairOsListScaffold` 传 `searchFrame="embedded"`）。禁止“父容器完整外框 + 搜索容器完整外框”，也禁止搜索容器内的 Input 再画一层边框；焦点态可以使用瞬时 ring。
- 仅展示数量、进度或状态的 chip 不得渲染为无处理逻辑的 `<button>`；只有存在真实动作时才使用按钮语义，并提供键盘、触摸和状态变化反馈。
- 状态筛选、类别选择、Tab 和页面分组不得使用“圆点 + 连线”的 stepper 外观；连线步骤器只服务真实、线性、有序的任务流。`RepairOsHeaderStepper` 不得用于新列表页。
- Header / Filter / Tab / Stepper 组件禁止用 `overflow-x-auto`、`snap-x` 或动态 `minWidth` 强制横向拖动。选项过多时使用自动换行、固定网格、Select 或筛选 Sheet。
- 滚动条、灰色长线或 carousel indicator 不得用作业务进度装饰。进度组件必须接收真实的完成量/阶段数据，并同时输出文本与可访问状态。
- 移动详情和任务页面默认使用 RepairOS Floating Card 组件语言：顶部使用 `repairOs.mobileFloatingHeader*`，正文信息块使用 `repairOs.mobileInfoCard`。
- 移动详情、任务、报价、收款、扫码、拍照和历史记录组件必须遵守 [`REPAIROS_MOBILE_DETAIL_STANDARD.md`](./REPAIROS_MOBILE_DETAIL_STANDARD.md)。订单详情页的“客户信息 / 设备信息 / 维修项目与报价 / 支付信息”是移动卡片字号、间距、色彩强调和信息层级的基准。
- 新增移动详情组件不得手写固定顶部的 `border-b`、整屏白色顶栏或散落 `pt-[calc(env(safe-area-inset-top)...)]`；这些必须来自 `repairOs.mobileFloatingPage` 和 `repairOs.mobileFloatingHeaderShell`。
- Floating Card 内部保持高密度：标题 `text-xs` 到 `text-sm`，辅助信息 `text-[9px]` 到 `text-[11px]`，图标尺寸优先 `size-3` / `size-3.5` / `size-4`。
- 移动金额/报价输入必须从一开始就是白色高密度可编辑格，不允许先显示蓝色或灰色摘要行再切换成另一个输入态；真实 input 字号保持 `16px` 以上，视觉密度通过局部缩放和固定高度处理。
- 状态色只用于当前流程、异常、风险金额、主动作和关键 badge；支付、维修、客户、设备等普通信息卡保持中性背景。
- 新增或调整 `OrderMobileCard`、`RepairOsBusinessCard` 等移动订单列表组件时，必须复用或镜像订单详情页小卡片的层级契约：`MobileSectionTitle` 式标签、`PaymentLine` 式左右行、`MoneyText` 金额、`min-w-0/truncate/shrink-0` 溢出控制；重复超过两处时先沉淀到 `src/lib/ui-patterns.ts` 或 `src/lib/component-patterns.ts`。订单列表富摘要卡允许一屏 3-4 张，支付主金额可用 `text-base`，但客户、设备、维修、支付不得全部拆成 bordered panel；支付摘要必须是中性分组 + 行式金额，不能整块按状态染色；重点色只服务于状态、异常、下一步、维修主项和支付风险。

### 8.3 移动紧凑选择器排版

品牌、型号、容量和版本这类高频字段必须同时满足紧凑密度、完整可达和 iOS 键盘安全。实现时 MUST 使用 `componentDensity.compactSelector`（或与其等价的共享声明），禁止在业务页面重新拼一套选择器字号和溢出规则。

- **MUST** 将移动关闭态占位控制在短语级别：品牌使用“选择品牌”，已有品牌后的型号使用“选择型号”，未选品牌时使用“先选品牌”。类别示例、目录范围和手工 fallback 放在 helper/search 说明中，不得把长示例重复塞进关闭态按钮。
- **MUST** 保持真实 `input`、`textarea`、`select` 和 `contenteditable` 在 `<768px` 下 `16px`；不得用 `text-xs`、`text-sm` 或 `!text-*` 覆盖全局 zoom guard。只有不承载文本编辑的 combobox trigger button 可以使用 `13px–14px`（默认 `text-sm`），但实际命中区域仍 **MUST** 至少 `44px`（`min-h-11`）。
- **MUST** 给选择器 trigger、搜索按钮和移动 option row 保留 `44px` 触控高度；字号变小只能压缩视觉文字，不能压缩按钮命中区、箭头或关闭动作。
- **MUST** 对选中值保留 `min-w-0`、独立的 `shrink-0` 箭头和 `truncate`，保证长品牌/型号不覆盖箭头或相邻字段。列表中的长品牌/型号优先完整展示，必要时允许最多两行，使用 `whitespace-normal`、`break-words`/`overflow-wrap:anywhere` 和 `line-clamp-2`；禁止让列表通过页面级横向滚动兜底。
- **MUST** 在 `<360px` 将成对的品牌/型号选择器降为单列；`360px–639px` 只有同时满足 `minmax(0,...)`、短关闭态 label、13–14px 非编辑 trigger、44px target 和无横向溢出验收时才允许双列，否则必须单列。`640px–767px` 可按字段语义保持双列或换行；`768px–1023px` 保持双列但允许依赖字段（游戏机存储、版本等）降为整行；`>=1024px` 保留 editable input + anchored Popover。任何降级不能破坏显式搜索、Escape、Tab、focus 恢复、visualViewport 适配和手动录入。
- **MUST** 让 option row 的主文本使用 `text-sm`/`leading-4`，辅助年份/系列使用 `text-[11px]` 到 `text-xs`，两者都带 `min-w-0`；禁止只显示首字、让中文字竖排或用固定 `min-width` 撑开页面。
- **禁止** 以 placeholder 代替 helper，禁止在类别示例和占位之间重复同一长句；禁止把 editable input 改成小于 `16px` 的真实控件；禁止为了“紧凑”移除 44px target、focus ring、可访问名称或手动 fallback。

共享 class 入口：`src/lib/component-patterns.ts` 的 `componentDensity.compactSelector`，包括 `trigger`、`triggerValue`、`editableInput`、`option`、`optionValue`、`optionDescription` 和 `helper`。新增 selector 变体须先扩展该声明并补组件测试，不得散落页面级 magic class。

## 9. 动效声明

- 入场动画用 `fadeUp` / `scaleIn` / `stagger`。
- 卡片 hover 用 `whileHover={{ y: -2 }}` 或 `cardHover`。
- Tab、segmented control、导航激活指示器使用 `indicatorSpring`。
- 批量操作条、底部浮动操作条使用 `floatingBar`。
- KPI / metric 数字计数默认使用 `metricCountDuration`。
- 不在组件内部包全局路由 `AnimatePresence`。
- 列表条目 stagger 间隔 `0.025` 到 `0.06`。
- 动效不影响布局尺寸，不制造文本重排。

## 10. 数据边界声明

组件不得直接访问数据库。边界如下：

| 层                          | 可以做什么                                        |
| --------------------------- | ------------------------------------------------- |
| `src/server/*`              | Supabase service role、数据库 join、业务校验      |
| `src/lib/repairdesk/api.ts` | Next Route Handler facade、client/server 同构入口 |
| route page                  | `useQuery` / `useMutation` / invalidate           |
| container component         | 局部 query/mutation，必须清楚 query key           |
| presentational component    | 只展示 props                                      |

新增业务能力时，先扩展 `src/lib/repairdesk/types.ts` 和 API facade，再接 UI。

## 11. 组件模板

### 11.1 展示卡片

```tsx
import { cn } from "@/lib/utils";
import { componentShell } from "@/lib/component-patterns";

export interface ExampleSummaryCardProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function ExampleSummaryCard({
  title,
  description,
  className,
  children,
}: ExampleSummaryCardProps) {
  return (
    <section className={cn(componentShell.panel, componentShell.panelPadding, className)}>
      <header className={componentShell.header}>
        <div className={componentShell.titleGroup}>
          <h2 className={componentShell.title}>{title}</h2>
          {description && <p className={componentShell.description}>{description}</p>}
        </div>
      </header>
      {children && <div className={componentShell.body}>{children}</div>}
    </section>
  );
}
```

### 11.2 业务列表项

```tsx
import Link from "next/link";
import { componentList } from "@/lib/component-patterns";
import { MoneyText, StatusBadge } from "@/components/orders/badges";

export interface OrderResultItemProps {
  id: string;
  publicNo: string;
  customerName: string;
  amount: number;
  status: Parameters<typeof StatusBadge>[0]["status"];
}

export function OrderResultItem({
  id,
  publicNo,
  customerName,
  amount,
  status,
}: OrderResultItemProps) {
  return (
    <Link href={`/orders/${id}`} className={componentList.itemInteractive}>
      <div className="min-w-0">
        <div className={componentList.itemTitle}>{publicNo}</div>
        <div className={componentList.itemMeta}>{customerName}</div>
      </div>
      <div className={componentList.itemTrailing}>
        <MoneyText amount={amount} />
        <StatusBadge status={status} />
      </div>
    </Link>
  );
}
```

### 11.3 弹窗表单

```tsx
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { componentOverlay } from "@/lib/component-patterns";

export interface ExampleDialogProps {
  open: boolean;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}

export function ExampleDialog({ open, isPending, onOpenChange, onSubmit }: ExampleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={componentOverlay.content}>
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>操作标题</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            说明这个操作会影响什么业务对象。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className={componentOverlay.footer}>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={isPending} onClick={onSubmit}>
            {isPending ? "处理中..." : "确认"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## 12. 生成流程清单

每次生成新组件按这个顺序执行：

1. 搜索现有组件：`rg "ComponentName|相似业务词" src/components src/features`。
2. 判断组件类型：Presentational / Container / Domain Primitive。
3. 选择落盘目录。
4. 定义 props 类型和状态支持范围。
5. 从 `component-patterns.ts`、`ui-patterns.ts`、`components/ui/*` 复用结构。
6. 接入业务组件，如 `StatusBadge`、`MoneyText`。
7. 补齐 a11y：label、title、aria、键盘路径。
8. 在调用页面中处理 query/mutation，不把数据库逻辑塞进展示组件。
9. 运行 `npm run lint`。
10. 涉及页面展示时运行 `npm run build`，必要时做浏览器截图验证。

## 13. 禁止清单

- 禁止为一个按钮新建自定义 button 组件，除非它承载明确业务语义。
- 禁止复制粘贴整段 Table/Card 样式后只改文字。
- 禁止组件内部读取 `process.env`。
- 禁止组件内部创建 Supabase service client。
- 禁止用颜色名表达业务状态。
- 禁止在可复用组件里写页面路由专属布局宽度。
- 禁止把 Dialog/Sheet 标题省略。
- 禁止新增与 `StatusBadge` / `MoneyText` 重复的业务渲染组件。
- 禁止搜索框“框中框”：有框父容器内不得再使用带完整边框或卡片阴影的搜索容器。
- 禁止新增需要左右拖动才能访问全部选项的状态栏、分类栏或 Tab 栏。

## 14. 验收标准

新组件合格标准：

- 能说明它属于哪一类组件。
- 文件路径符合分层。
- props 类型明确，无 `any`。
- class 使用 token 和声明对象。
- 支持必要状态。
- 移动端不溢出。
- 亮/暗主题都可读。
- 图标、按钮、弹窗符合 a11y。
- 未引入新的数据访问越界。
- `npm run lint` 通过；涉及构建面时 `npm run build` 通过。

## TASK-20260814-001 — Quick Entry disclosure primitive reuse audit (design-only, 2026-08-15)

The bounded Quick Entry packet starts from the clean release commit
`d33bad91a5e1d7ed5e56a73849536e875f61db76` in the isolated worktree
`/private/tmp/repairdesk-quick-entry-ui-20260815`. It is documentation/setup only; no source,
test, Storybook, package, config, Registry, production-data, commit, push, or deploy change is
authorized.

### Audited reusable sources

- `InventoryProductFormWorkspace` already resolves pending/compact/desktop modes and renders one
  explicit shell. Keep this controller/body boundary rather than cloning Intake and Edit forms.
- `InventoryProductForm`, `InventoryProductIdentifierSection`, and the existing details fields
  provide category, condition, identifiers, prices/cost, location, warranty, notes, and a manual
  identifier presenter. IMEI1/IMEI2 visibility and required-state semantics should be extended at
  this domain boundary, not by a generic `Input` change.
- `CatalogCombobox` already owns editable/non-editable brand/model search, mobile fixed picker,
  desktop anchored Popover, mounted listbox-id capture, Escape, and focus restoration.
  `CatalogSpecificationChoices` and `CatalogColorChoices` already separate desktop option groups
  from mobile button/listbox choices. Reuse their ARIA and focus contracts before adding a domain
  disclosure adapter.
- `componentDensity.compactSelector`, `componentOverlay`, `src/components/ui/popover.tsx`,
  `src/components/ui/sheet.tsx`, and `device-form-options.ts` are the current style/primitive/
  option authorities. `eu-phone-catalog.ts` is searchable input data only: its broad Apple color
  arrays are not an exact approval overlay. Without a per-model official source and review receipt,
  Apple colors must remain pending-official-color; a later local approval manifest/validator is a
  separate data gate. The `memoQuickEntry` object is a memo-specific surface and is not a
  device-form implementation.
- The pending color state preserves an existing draft/edit value read-only but offers no new
  generic/custom color choice. It omits newly selected Apple color from the save payload and shows
  an inline pending-mapping explanation. Because Quick Entry color is optional, pending mapping
  alone does not block save; only an independently required category/device color may block save.

### Proposed component decision

Prefer extending the existing inventory-domain fields/workspace. Only if a single disclosure-first
contract cannot be expressed without duplicated markup may a small inventory-domain adapter be
introduced under `src/features/inventory/products/components/`; it must compose existing
Popover/Sheet/listbox primitives, have explicit props, no `any`, no data access, and preserve
separate desktop/mobile DOM and interaction. Do not create a generic button, color source, or
global responsive primitive for this task.

### Candidate source/test/story allowlist (not yet authorized)

The next packet may re-audit and narrowly allow the existing files under
`src/features/inventory/products/components/`, `src/features/inventory/components/`,
`src/features/inventory/products/model/`, and their paired `*.test.*` and existing inventory
stories. `src/lib/component-patterns.ts` or `src/components/ui/*` may be touched only if a
demonstrated shared contract gap cannot be handled in the inventory domain. The candidate must
prove: desktop exactly three top-level columns at 1024/1280/1440; mobile separate sections/Sheet;
category-aware IMEI1
requiredness (phone only) and IMEI2 visible; planned sale exposed and acquisition cost only when
the existing permission allows it; disclosure selection close/Escape/focus/
ARIA; direct free text; Apple official-color gate and unknown/manual pending state; non-Apple
generic color priority; and six-width/a11y/overflow evidence.

### Required states and stop/rollback rules

Support default, pending/loading, disabled/permission-limited, empty, invalid, read-failure
fallback, Apple known, Apple unknown/manual, and save-pending/success/error states. Stop for any
API/query/payload/permission/tenant/dependency/AppShell/schema/migration/production-data need,
unclear ownership in the preserved dirty worktree, or a proposed merge of desktop and mobile
interaction. Rollback is limited to reverting this design section or discarding the isolated
uncommitted worktree; prior release candidates and other worktrees remain untouched.

### Implementation preview candidate status (current update, 2026-08-15)

The Owner has authorized the completed 20-path candidate for intentional commit/push and a
protected Preview. Existing implementation evidence records Node22 full lint/typecheck/test
`453/453` + `2993/2993`, build `30/30`, and browser `20/20`. Independent UX audit still has two
P1 gaps: disclosure-first coverage is incomplete for network/version, warranty, and manual
supplements; and complete save/error/permission/offline/conflict/success Story/evidence coverage
is not yet complete. Formal production domains therefore remain blocked and must not be cut over.
No production data, schema/migration, or bulk catalog import is included. The Owner has authorized
autonomous design → Preview → implementation → validation → follow-up Preview; future work does
not require a separate per-design Owner-approval gate. This is appended current status and does
not alter the historical design-only facts above.
