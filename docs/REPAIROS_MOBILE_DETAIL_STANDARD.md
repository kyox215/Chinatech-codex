# RepairOS Mobile Detail Standard

Status: active
Owner: UX + Documentation / Integration Lead
Scope: current mobile detail/task/workflow page standards for RepairDesk.
Last reviewed: 2026-07-31 CEST by `TASK-20260731-003-inventory-product-mobile-density`

状态：active
来源页面：`/orders/[id]` 移动端订单详情
适用范围：订单详情、移动任务详情、新建/编辑工单移动流程、客户详情、回收报价详情、库存商品详情、设置子页等高频移动业务详情页。

本标准把当前订单详情页沉淀为 RepairDesk 后续移动业务页面的默认设计语言。新增或重构移动详情页时，必须优先复用 `src/lib/ui-patterns.ts` 的 `repairOs.*` 声明，再按本文约束补充局部布局。

## 0. 强制入口与落地文件

本文件是移动详情、任务、报价、收款、扫码、拍照、历史记录等高频工作流页面的设计源头。任何新页面如果与当前订单详情页同属“单手处理具体业务对象”的场景，都必须默认采用本标准。

必须同时遵守：

- `AGENTS.md`：任务入口和 AI 执行规则。
- `docs/REPAIROS_COMPACT_ARCHITECTURE.md`：RepairOS Compact 总体结构。
- `docs/UI_PAGE_GENERATION_DECLARATION.md`：页面生成契约。
- `docs/COMPONENT_GENERATION_DECLARATION.md`：可复用组件契约。
- `docs/RESPONSIVE_DENSITY_PLAN.md`：响应式和高密度验收。
- `src/lib/ui-patterns.ts`：页面级 class 声明，尤其是 `repairOs.*`。
- `src/lib/component-patterns.ts`：组件级 class 声明。
- `src/styles.css`：唯一设计 token 来源。

禁止在单个业务页里绕过这些文件手写另一套顶部、卡片、字号、状态色、金额编辑或底部操作条。确实需要新模式时，先更新本标准和 pattern 层，再落地页面。

## 1. 页面骨架

移动详情页必须使用 RepairOS Floating Card 结构：

1. 顶部是一张 fixed 悬浮工作卡，不使用整屏白色顶栏、横向分割线或第二个大标题区。
2. 正文使用同半径、同边框、同阴影的信息卡，第一张卡与顶部卡保持 6-10px 间距。
3. 底部固定操作条只放最高频动作，例如 WhatsApp、流转、收款。
4. 页面宽度以 `max-w-[430px]` 为手机基准；`768px-1023px` 使用放宽后的独立平板详情工作区，但继续保留 Floating Card、抽屉导航与移动任务逻辑；`1024px` 起才进入桌面详情模式。

必须复用：

```tsx
repairOs.mobileFloatingPage;
repairOs.mobileFloatingHeaderShell;
repairOs.mobileFloatingHeaderCard;
repairOs.mobileFloatingHeaderNav;
repairOs.mobileFloatingHeaderBody;
repairOs.mobileInfoCard;
repairOs.mobileInfoCardMuted;
```

顶部卡高度是动态内容，不允许用固定 `padding-top` 猜高度。实现时必须测量顶部卡真实高度，并通过 `--repair-os-mobile-floating-offset` 或等价机制给正文让位。

## 2. 顶部悬浮工作卡

顶部卡必须承载：

- 返回入口。
- 页面标题，通常为 `订单详情`、`客户详情`、`回收报价`。
- 当前主状态上下文，例如 `检测 · 检测中`。
- 主编号，例如 `TEST-0016`。
- 下一步动作（如当前对象确实需要）。
- 只有真实线性、不可跳步且不可压缩的多阶段任务，才可选显示当前阶段/进度。
- 辅助状态 badge，例如 `送修单`、`外修中`、`客户审批`，但这些不能混入主流程。

进度使用边界：

- 单个商品、客户、设置对象的详情页不是流程，默认禁止进度条。
- 普通新建/编辑能在单页完成时，不得为了展示进度而拆成多步。
- 状态筛选、页面分类和 Tabs 不得渲染为连线步骤器。
- 滚动条、细长灰线或轮播位置条不得伪装业务进度。

尺寸规则：

| 元素               | 默认规格                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| 顶部卡外壳         | `max-w-[430px]`、`rounded-xl`、`border-[var(--border-panel)]`、`bg-card/95`、`shadow-[var(--shadow-card)]` |
| 导航列             | 左侧 `36px`，中间 `minmax(0,1fr)`，右侧 `auto`                                                             |
| 返回/打印/更多按钮 | 普通入口 `size-9 rounded-lg`；主动作 `size-10`，图标 `size-4` 到 `size-[18px]`                             |
| 页面标题           | `text-xs font-semibold leading-4`                                                                          |
| 状态上下文         | `text-[9px] leading-3 text-muted-foreground`                                                               |
| 主编号             | `font-mono text-[12px] font-semibold leading-4 text-primary`                                               |
| 辅助 badge         | `text-[10px]`，最多 3 个，超长必须截断                                                                     |

主流程只表达 `接单 / 检测报价 / 维修处理 / 通知取机 / 收款完成`。底层 `workflow_status` 可以继续保留收机、检测、报价、配件、维修、取机、结案等兼容状态，移动 UI 通过 `order-simple-flow.ts` 聚合展示。邮寄中、外修、通知状态、审批状态、异常状态都属于辅助状态标签或独立处理面板。

### 2.1 订单详情紧凑状态区

订单详情的悬浮卡在同一行提供创建时间、当前状态变更时间和当前门店。时间必须使用带 `dateTime` 的 `<time>`，可视文本保持紧凑（至少包含月/日和时分），无障碍名称必须区分创建与状态变更并包含完整时间。门店显示当前 shell 的真实门店名称；缺失时使用明确的“未配置”占位，不使用供应商名称替代。

设备保管在正常状态下使用单行图标、状态和操作条，移动端高度控制在 44px 内。取消、退回待确认、状态冲突、缺失保管状态等异常才展开说明和最近交接信息；权限、确认弹层和焦点回收保持原有行为。

订单详情的 MINI 进度复用订单列表的五段 `h-1` 轨道。详情轨道不显示阶段文字或数字，当前和终态语义通过本地化的无障碍名称提供；订单列表可以继续显示自己的阶段标签。顶部高度变化必须通过 `ResizeObserver` 更新 `--repair-os-mobile-floating-offset`，正文第一张卡与悬浮卡外框保持 6–10px 间距。

## 3. 信息卡形态

移动详情页正文卡片统一使用白色紧凑卡：

```txt
rounded-xl
border border-[var(--border-panel)]
bg-card
p-2
shadow-[var(--shadow-card)]
min-w-0 overflow-hidden
```

规则：

- 不把页面区块做成大 glass-card。
- 不在卡片里再套多个 bordered card；需要分组时使用中性行、`bg-[var(--surface-panel-muted)]` 或轻量分隔。
- 同一业务层级使用同一卡片半径、边框和阴影。
- 卡片间距默认 `space-y-1.5` 或 `gap-1.5`。
- 两列小卡可用于客户/设备、维修/支付等并列摘要；窄屏不足时必须单列或保持 `min-w-0` 截断。
- 颜色只服务关键状态、异常、下一步和主动作，不做大面积色块背景。

订单详情的“详情”分组采用 Owner 已选 A 的紧凑摘要布局（2026-09-06）：

1. 客户审批、异常、取消、退回等必要提示保持原行为和前置条件。
2. 客户与设备合并为一张信息卡：两条可点摘要，IMEI、质保、随附物品和密码查看使用紧凑辅助行。电话、iPad、扫码和密码编辑是摘要旁独立入口，禁止在摘要按钮内嵌套链接或按钮。
3. 正常保管状态及确认收机等原动作放在设备组的小状态条；未知、冲突、取消及待退回仍完整显示提示、原因和交接信息，不因密度目标隐藏。
4. 故障与诊断为独立紧凑卡，内容直达现有编辑面板，完整长文在面板读取。
5. 人员与供应商并排显示当前值，长名称换行；继续使用原成功关闭、失败留存和权限语义。
6. 维修报价与金额同卡：报价名称/价格列表，下方总额、已收定金、待付金额三列同排。取消说明和 finance_redacted 保持原分支，不增加重复支付大卡。
7. 设备照片、历史记录仅在顶部三个等宽分组切换；照片沿用追加上传和独立查看语义。

顶部沿用测量后的浮卡 offset、导航、编号状态、创建/状态时间/门店一行和五段无文字 mini 进度；阶段上下文移入导航标题下方，compact Tabs 为中性底色的平整等宽分段。正常 390px 合成样本头部目标不超过 168px，长文本/异常可自然增长，不设固定高度裁剪。390×844 的两条报价普通样本应在底栏上方完整显示金额；320×568 使用页面正常滚动触达末尾，不增加内嵌正文滚动区。桌面自有工作区不套用此手机排版。

验证证据归属 `TASK-20260906-003-order-detail-a-layout`。页面高度、滚动和回焦在打开编辑器前后保持；所有权限、dirty/error/pending、版本、保存载荷与财务校验以现有实现为准，布局变更不新增业务协议。

### 3.1 商品库存详情变体

商品库存属于“快速识别单个经营对象”，允许在上述骨架内使用更高密度的图标工作台：

- 首卡展示类别、品牌型号、SKU、状态、售价、按权限可见的成本、库位和更新时间，不重复脱敏主标识。
- 六项核心设备资料使用三列、两行的小格布局；每格仍须 `min-w-0`，空值不伪造业务结果。
- IMEI、序列号、EID 和 EAN/GTIN 集中在“设备身份”卡；普通详情只显示脱敏值。
- 430px 标准样本应尽量在单页呈现核心资料，不通过内嵌正文滚动区制造“伪一页”。
- 具体尺寸、访问状态和测试门禁见 [`INVENTORY_PRODUCT_MOBILE_DENSITY_NEXT_PLAN.md`](./INVENTORY_PRODUCT_MOBILE_DENSITY_NEXT_PLAN.md)。

## 4. 字号与密度

订单详情页的字体密度是后续移动详情页的基准。

| 用途                 | 字号 / 行高                                               |
| -------------------- | --------------------------------------------------------- |
| 顶部标题             | `text-xs leading-4`                                       |
| 顶部上下文、辅助说明 | `text-[9px] leading-3`                                    |
| 顶部主编号           | `font-mono text-[12px] leading-4`                         |
| 卡片标题             | `text-[11px] font-semibold leading-4`                     |
| 字段标签             | `text-[9px]` 到 `text-[10px]`                             |
| 字段值               | `text-[11px] font-medium leading-4`                       |
| 普通正文             | `text-xs leading-4`                                       |
| 备注/说明            | `text-[10px] leading-3/4`                                 |
| 小 pill/badge        | `text-[9px]` 到 `text-[10px]`                             |
| 金额行               | `text-[10px]` 到 `text-[11px]` + `font-mono tabular-nums` |
| 底部主动作           | `text-xs`、按钮高度 `h-9`                                 |

图标尺寸：

- 卡片标题图标：`size-3`。
- 行内图标：`size-3` 到 `size-3.5`。
- 卡片动作按钮图标：`size-3.5` 到 `size-4`。
- 顶部打印/更多图标：`size-4` 到 `size-[18px]`。

可变文本必须使用 `min-w-0`、`truncate`、`line-clamp-*` 或 `break-words`，禁止撑开页面。

### 订单报价编辑紧凑变体（2026-09-05）

订单详情与新建报价共用12类四列三行选择器：左侧2/3直接选择，右侧1/3展开完整类别名称及细项，选中显示主色与勾选。Instruction14将分类保持固定36px单行与4px间距，长语言不自动增高；主要保存/取消44px，真实手机输入至少16px，卡内8–10px间距。

报价金额与定金复用 `MoneyKeypadInput`，桌面电脑在任何窗口宽度均使用原生输入，旧桌面虚拟键盘偏好不再生效。iPhone/iPod、Android 手机和平板、iPad 保留按需虚拟键盘；iPadOS 桌面标识须同时具备 `MacIntel`、多点触控及 coarse/any-coarse 证据，即使外接触控板也保留触控输入。其他 Windows/macOS/Linux/ChromeOS 桌面保持原生输入；未知平台仅在紧凑视口、触控点与主 coarse 指针一致时使用虚拟键盘。SSR 初始使用原生输入，视口、指针和方向变化后重新判断。Instruction15 的名称和规格始终单行，点击后复用共享报价弹窗，不增加原行高度。各入口保留原有编辑能力，包括原可编辑的目录名称与桌面规格；仅原展示型内容只读。弹窗使用本地草稿，取消不改父草稿，无改动保存仅关闭；实际修改后的保存或非输入法Enter只更新父报价草稿，不提交外层表单。手机使用底部弹窗、桌面使用居中弹窗，均先聚焦容器，不自动打开键盘。Escape只关闭内层并回到原触发器，回焦不重开；正文可滚动，关闭/保存44px始终可达。金额三列、完整数字、16px编辑、计价载荷、空值和显式0规则保持。

详情点击报价内容打开稳定底部编辑器，草稿与保存/取消保留；人员/供应商从当前值直接打开选择面板，成功才关闭。移动详情底部核心动作至少 44px，并沿用原底部避让；历史记录继续使用顶部页签，不增加重复入口。

报价数字保持整串单行，不能拆开小数位。小于390px三列摘要可分开货币符号并使用紧凑只读金额字号；真实编辑输入仍16px，名称和规格只有在显式打开的弹窗内换行，原报价行保持单行。

## 5. 颜色与层级

颜色来源只能是 `src/styles.css` 语义 token 和现有状态组件。

允许：

- 主编号、当前阶段、主动作使用 `text-primary` 或品牌渐变。
- 成功、警告、危险状态使用 `bg-status-*` 和 `text-status-*-foreground`。
- 次级说明使用 `text-muted-foreground`。
- 中性分组使用 `bg-[var(--surface-panel-muted)]`。
- 金额使用 `MoneyText` 或 `font-mono tabular-nums`。

禁止：

- 新增 `#hex`、`rgb()`、`rgba()`、`text-white`、`bg-black` 等硬编码颜色。
- 把支付信息整块染红/染绿。
- 把每个字段都放进彩色框。
- 在可编辑报价项目上使用蓝色底色表达可编辑状态。

重点色只标注重点：当前状态、异常、下一步、尾款风险、主动作。

### 5.1 语义色使用边界

| 语义            | 用法                                             |
| --------------- | ------------------------------------------------ |
| Primary / brand | 当前主流程、选中状态、主编号、主 CTA、下一步链接 |
| Success         | WhatsApp、已完成、已收款、可继续的正向状态       |
| Warn            | 待审批、未收款、超时、需要确认                   |
| Danger          | 取消、错误、尾款风险、拒绝、 destructive action  |
| Muted           | 普通字段、历史说明、次级分组、空值               |

卡片本身保持中性。不要用大面积蓝、绿、红去表达业务对象；颜色只落在小 badge、关键金额、当前节点、主按钮和风险提示上。

## 6. 报价与金额编辑

金额编辑必须遵守以下规则：

1. 输入状态使用 string draft，例如 `priceText`、`depositText`。
2. 显示总额、尾款、保存 payload 必须从同一个 normalizer 读取。
3. 清空金额时输入框保持空字符串，不能自动变成 `0`。
4. 空行忽略；只填名称或只填金额必须提示错误。
5. 金额支持 `.` 和 `,` 小数输入。
6. 保存时走 `patchOrderFinance` 或对应 API facade，不绕过服务端。
7. 编辑报价时底部 WhatsApp、流转、收款等外部动作必须禁用，避免未保存草稿造成版本冲突。
8. 保存按钮在 `!normalized.canSave` 时禁用。

移动端总览点击报价摘要进入现有底部编辑面板；进入报价编辑器后，项目行直接呈现白色可编辑格子，项目名和金额可以直接编辑，不再增加摘要到输入态的中间步骤。

移动端真实可编辑控件字号必须保持 `16px` 以上，避免 iOS/Chrome 键盘触发页面自动放大；如果需要视觉小字号，只能用受控的缩放容器，例如订单详情里的 `MobileDenseFinanceInput` 模式：真实 `text-base`，视觉 `scale-75`，外层保持 `h-7` 白色输入格。

## 7. 客户、设备、附件与扫码

客户信息：

- 客户姓名、电话、首字母头像保持紧凑。
- 订单详情 A 的电话和 iPad 入口放在客户摘要旁，使用独立图标按钮；WhatsApp 沿用底部主操作，禁止把这些入口嵌套在客户摘要按钮中。
- 颜色只在 WhatsApp 或偏好渠道上使用成功色，不把整个客户卡染色。

设备信息：

- 设备品牌型号为主值，IMEI、质保、留存为紧凑字段行。
- 扫码按钮必须足够可点击，至少 `h-8`，图标 `size-4`。
- 扫码入口使用 Sheet/弹窗选择二维码/条码或 OCR，不在卡片内展开长表单。

附件照片：

- 设备照片、签名、取件凭证必须通过 `@/lib/repairdesk/api` 上传并从 `OrderDetail.attachments` 渲染。
- 上传成功后必须 invalidate 当前详情，并写入时间线。
- 不允许把生产照片长期留在本地 state 里当业务结果。
- 订单详情照片固定分为“正面、背面、其他”三组：`device_front` 归正面，`device_back` 归背面，`screen_on`、`fault_photo` 和 `other` 归其他；签名永不进入设备照片组。
- 每组保留空槽标签和现有权限边界；有多张照片时每张都必须可从组内入口到达。每个上传槽使用独立的可访问名称，并把正面、背面或其他映射到现有 `CameraCaptureSheet` 的对应 `attachmentKind`。缺失或失败的图片地址保留文件信息并显示不可用状态。

## 8. 数据与业务逻辑边界

设计风格不能脱离业务逻辑。新增移动详情页面时必须按以下边界实现：

1. 页面组件只通过 `@/lib/repairdesk/api` 或 feature API facade 读写数据，不直接导入 `src/server/*`。
2. 创建、编辑、上传、流转、收款、通知等 mutation 成功后必须 invalidate 当前详情、相关列表和统计 query。
3. 录入人、技师、创建人、门店归属等字段只读展示，由服务端 actor 或数据源决定，前端不得提供可编辑控件。
4. 主流程和辅助状态必须分开：主流程只表示维修阶段；物流、外修、审批、通知、异常作为辅助状态或处理面板。
5. 会产生外部副作用的动作，例如 WhatsApp、收款、状态推进、打印，必须在草稿编辑中禁用或要求先保存。
6. 历史记录和时间线是业务追溯入口，不是装饰信息；状态、金额、附件、通知、审批都必须能回看。

## 9. 历史记录与状态流转

订单详情页必须使用清晰且一致的顶部历史入口：

- 移动浮动页头、桌面页面和桌面工作区统一提供“详情 / 历史记录”两个分组。
- “历史记录”完整展示时间线事件与通知记录；该分组替代订单旧有的正文最近操作卡和完整时间线 Sheet，不重新添加重复入口。
- 若桌面保留最近操作快捷入口，激活后切换到顶部“历史记录”分组并将键盘焦点移到对应 tab。
- 状态流转、报价、收款、通知、附件上传都必须可追溯。

分组状态、滚动位置和故障编辑规则见本文件末尾 Orders workspace grouping。其他实体详情可按自己的页面合同保留历史卡或 Sheet，本节不修改那些变体。

状态流转规则：

- 主流程和辅助状态语义拆分。
- 流转入口必须先读取工作流配置。
- 取消、未修取机、返修等异常/结束分支必须使用预设原因选择和可编辑说明。
- 客户审批必须走审批处理面板：同意后进入维修/订件，拒绝后进入未修取机/取消，并记录原因；不自动发送 WhatsApp。

## 10. 底部操作条

移动详情页底部操作条只放高频动作：

- 主通知动作：WhatsApp 或当前模块主 CTA。
- 状态流转。
- 收款或当前财务动作。

规则：

- 主按钮高度 `h-10`，字号 `text-xs`，图标 `size-3.5`；低风险次动作可使用 `h-9`。
- 低频动作放顶部更多菜单或对应卡片内。
- 打印属于顶部独立图标按钮，不放在更多菜单里。
- 编辑某个关键草稿时，底部会产生外部副作用的动作必须禁用。

## 11. 验收矩阵

新增或改动移动详情页时至少检查：

| Viewport     | 验收                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| 390px        | 无横向溢出，顶部卡不遮挡第一张正文卡，底部操作条不盖住主要内容                            |
| 430px        | 顶部卡和正文卡左右边缘对齐，间距 6-10px                                                   |
| 640px-767px  | 仍使用移动宽度体系，不出现顶部窄、正文宽的割裂                                            |
| 768px-1023px | 使用独立平板详情工作区；保留 Floating Card 顶部、抽屉导航与完整业务能力，可把正文扩为双列 |
| 1024px+      | 按页面声明进入紧凑桌面布局，不保留移动 fixed 顶部                                         |

必须满足：

```txt
document.documentElement.scrollWidth <= window.innerWidth
```

交互验收：

- 顶部和卡片内普通操作不小于 `24px` 且保持足够间距，标准工具按钮使用 `36px`；底部主动作不小于 `40px`。
- 流转、审批、收款、通知在 pending 时禁用并保留反馈。
- 金额编辑可清空、可输入小数、不出现 `012`。
- 输入框聚焦不会触发手机页面自动放大。
- 附件上传成功后能在当前详情和历史记录中看到结果。

## 12. 新增页面执行清单

开始实现前检查：

1. 页面是否属于移动详情 / 任务 / 报价 / 收款 / 扫码 / 拍照 / 历史记录场景；是则使用本标准。
2. 是否复用 `repairOs.mobileFloatingPage`、`repairOs.mobileFloatingHeader*`、`repairOs.mobileInfoCard`。
3. 顶部卡高度是否动态让位，而不是固定猜测。
4. 首张正文卡是否和顶部卡间距 6-10px。
5. 字号是否按第 4 节执行，真实输入控件是否保持 16px 以上。
6. 卡片是否是中性白色高密度结构，重点色是否只用于关键状态。
7. 金额是否集中用 `MoneyText` / `font-mono tabular-nums`，编辑是否用 string draft。
8. 扫码、拍照、附件、状态流转、历史记录是否通过 API 和时间线闭环。
9. 底部操作条是否只保留当前页面最高频动作。
10. 390px、430px、768px、834px、1024px 是否无横向溢出，且没有卡片遮挡。
11. 该页是否只在真实有序流程中才显示进度；普通商品等对象详情必须无进度条。
12. 顶部和正文是否无装饰性滚动条、无横向拖动分组，手机长正文是否避免嵌套纵向滚动区。

### Orders workspace grouping (TASK-20260905-004)

Order detail uses three top-level groups: Overview, Photos and Records. Compact tabs are inside the measured floating header. Overview retains device/customer, responsibility and finance; Photos has its own attachment workspace; Records shows complete timeline events and notification bodies. Panels retain local state and individual scroll positions; switching order resets the selected group, while locale switching preserves it.

A14 notes editing uses one visible issue_description textbox and the existing intake permission. Historical diagnosis_result stays read-only in detail and is omitted from note saves. The repair reference panel is removed; desktop keeps its independent Dialog shell. The opening version is the save baseline; remote changes never replace dirty text. Save errors retain drafts; conflict reload explicitly confirms discarding the draft. Every close path is guarded while pending and confirms dirty discard. Existing diagnosis data is preserved by note edits.

### 单备注编辑面板（A14，2026-09-06）

单一issue_description文本域沿用接单编辑权限；历史diagnosis_result只读展示、不进入备注保存载荷。手机文本域16px、104px高；桌面独立Dialog提供200px文本域和右对齐按钮。主体单滚动，关闭与保存保持44px。旧双字段/参考项目追加方案已由A14替代。放弃及重载保留原浮层确认步骤，默认继续编辑，Escape/X返回草稿；pending禁止退出，错误与冲突保留草稿。

当前全局复用规则与有限覆盖/例外清单见 [GLOBAL_CONTENT_EDITING_STANDARD.md](GLOBAL_CONTENT_EDITING_STANDARD.md)。

## Compact status actions (2026-09-06)

Inside an existing status strip, custody receive/deliver, unknown backfill, cancelled return and terminal correction entry actions use `Button variant="ghost"` with the opt-in `componentAction.status` family. Place state at the start and the wrapping action group at the end. Entry actions have no permanent shadow or raised border; retain visible hover, pressed, keyboard focus and disabled states. Mobile targets are at least 36 px tall (ordinary embedded row approximately 40 px); desktop uses an independent 28 px minimum. Long labels wrap naturally, including at 320 px, without fixed heights or clipping. Warning/correction entries retain warning text and contextual explanation; compact terminal menus keep destructive items distinct.

This presentation contract does not change the confirmation Sheet/Dialog, final confirmation button hierarchy, permissions, pending guard, reason validation, version, payload or custody transitions. Dedicated terminal workflow banners and final confirmation footers retain their stronger hierarchy. Read-only custody badges and next-action guidance remain non-interactive. Finite audit and synthetic screenshots belong to TASK-20260906-004.


### A14 compact order editors (2026-09-06)

Name/price/delete share a 36px visual row with separate specification/error tracks; Add custom is 36px. Money summary labels and value baselines align across equal tiles, with one subtle deposit edit boundary. Inputs remain 16px on mobile and final Save/Cancel remain 44px. Identity/finance/unlock editors opt into a non-scrolling header/close and footer with one scrolling body. Brand/model suggestions precede IMEI capture, accessories and device notes. Notes editing preserves legacy diagnosis without merging or clearing it. Customer matches display phone first, preserve the current customer identity and only warn on duplicate numbers; new orders retain explicit selection. Refer to GLOBAL_CONTENT_EDITING_STANDARD.md for the finite consumer and evidence boundary.


### A14 手机新建工单摘要编辑（2026-09-06）

新建页面在手机宽度复用Floating Card令牌，顶部52px导航、手机号优先摘要、显式保管及附物/解锁短入口。报价维持12组4×3、固定36px单行、4px间距和左右选择语义；长名称/规格点击弹窗展示，沿用各入口原有可编辑性；原可编辑目录名称及桌面规格仍可编辑，仅原展示型内容只读，金额三列。照片三槽、单备注、设置及唯一创建入口保留。客户/设备/补充编辑使用一个活动Sheet，历史、新客户及IMEI扫描返回保留草稿。关闭/完成44px、输入16px；320×350正文和键盘各有有界滚动。弹窗打开不聚焦文本，关闭并回焦；电话Enter不重开键盘。桌面独立工作台，创建后主体只读，上传遵循canUploadPhoto，部分成功只恢复未成功照片.
