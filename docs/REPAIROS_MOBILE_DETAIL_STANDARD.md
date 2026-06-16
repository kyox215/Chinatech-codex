# RepairOS Mobile Detail Standard

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
4. 页面宽度以 `max-w-[430px]` 为移动基准；`md` 以上才能放宽为桌面详情宽度。

必须复用：

```tsx
repairOs.mobileFloatingPage
repairOs.mobileFloatingHeaderShell
repairOs.mobileFloatingHeaderCard
repairOs.mobileFloatingHeaderNav
repairOs.mobileFloatingHeaderBody
repairOs.mobileInfoCard
repairOs.mobileInfoCardMuted
```

顶部卡高度是动态内容，不允许用固定 `padding-top` 猜高度。实现时必须测量顶部卡真实高度，并通过 `--repair-os-mobile-floating-offset` 或等价机制给正文让位。

## 2. 顶部悬浮工作卡

顶部卡必须承载：

- 返回入口。
- 页面标题，通常为 `订单详情`、`客户详情`、`回收报价`。
- 当前主状态上下文，例如 `检测 · 检测中`。
- 主编号，例如 `TEST-0016`。
- 当前阶段、下一步动作。
- 主流程进度条。
- 辅助状态 badge，例如 `送修单`、`外修中`、`客户审批`，但这些不能混入主流程。

尺寸规则：

| 元素 | 默认规格 |
| --- | --- |
| 顶部卡外壳 | `max-w-[430px]`、`rounded-xl`、`border-[var(--border-panel)]`、`bg-card/95`、`shadow-[var(--shadow-card)]` |
| 导航列 | 左侧 `32px`，中间 `minmax(0,1fr)`，右侧 `auto` |
| 返回/打印/更多按钮 | `size-8 rounded-lg`，图标 `size-4` 到 `size-[18px]` |
| 页面标题 | `text-xs font-semibold leading-4` |
| 状态上下文 | `text-[9px] leading-3 text-muted-foreground` |
| 主编号 | `font-mono text-[12px] font-semibold leading-4 text-primary` |
| 辅助 badge | `text-[10px]`，最多 3 个，超长必须截断 |

主流程只表达 `收机 / 检测 / 报价 / 配件 / 维修 / 取机 / 结案`。邮寄中、外修、通知状态、审批状态、异常状态都属于辅助状态标签或独立处理面板。

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

推荐正文顺序：

1. 客户审批处理卡，可选。
2. 基础信息卡，放创建时间、负责人、门店，不重复大号主编号。
3. 历史记录卡，展示最近一次操作并可打开完整时间线。
4. 客户信息卡。
5. 设备信息卡。
6. 故障描述卡。
7. 维修项目与报价卡。
8. 支付信息卡。
9. 设备照片卡。

## 4. 字号与密度

订单详情页的字体密度是后续移动详情页的基准。

| 用途 | 字号 / 行高 |
| --- | --- |
| 顶部标题 | `text-xs leading-4` |
| 顶部上下文、辅助说明 | `text-[9px] leading-3` |
| 顶部主编号 | `font-mono text-[12px] leading-4` |
| 卡片标题 | `text-[11px] font-semibold leading-4` |
| 字段标签 | `text-[9px]` 到 `text-[10px]` |
| 字段值 | `text-[11px] font-medium leading-4` |
| 普通正文 | `text-xs leading-4` |
| 备注/说明 | `text-[10px] leading-3/4` |
| 小 pill/badge | `text-[9px]` 到 `text-[10px]` |
| 金额行 | `text-[10px]` 到 `text-[11px]` + `font-mono tabular-nums` |
| 底部主动作 | `text-xs`、按钮高度 `h-9` |

图标尺寸：

- 卡片标题图标：`size-3`。
- 行内图标：`size-3` 到 `size-3.5`。
- 卡片动作按钮图标：`size-3.5` 到 `size-4`。
- 顶部打印/更多图标：`size-4` 到 `size-[18px]`。

可变文本必须使用 `min-w-0`、`truncate`、`line-clamp-*` 或 `break-words`，禁止撑开页面。

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

| 语义 | 用法 |
| --- | --- |
| Primary / brand | 当前主流程、选中状态、主编号、主 CTA、下一步链接 |
| Success | WhatsApp、已完成、已收款、可继续的正向状态 |
| Warn | 待审批、未收款、超时、需要确认 |
| Danger | 取消、错误、尾款风险、拒绝、 destructive action |
| Muted | 普通字段、历史说明、次级分组、空值 |

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

移动报价项目行必须一开始就是白色可编辑格子，不允许先显示蓝色/灰色摘要行再切换成输入态。项目名和金额点击后应直接编辑。

移动端真实可编辑控件字号必须保持 `16px` 以上，避免 iOS/Chrome 键盘触发页面自动放大；如果需要视觉小字号，只能用受控的缩放容器，例如订单详情里的 `MobileDenseFinanceInput` 模式：真实 `text-base`，视觉 `scale-75`，外层保持 `h-7` 白色输入格。

## 7. 客户、设备、附件与扫码

客户信息：

- 客户姓名、电话、首字母头像保持紧凑。
- 电话和 WhatsApp 按钮放在卡片底部，两列并排，按钮高度 `h-9`。
- 颜色只在 WhatsApp 或偏好渠道上使用成功色，不把整个客户卡染色。

设备信息：

- 设备品牌型号为主值，IMEI、质保、留存为紧凑字段行。
- 扫码按钮必须足够可点击，至少 `h-8`，图标 `size-4`。
- 扫码入口使用 Sheet/弹窗选择二维码/条码或 OCR，不在卡片内展开长表单。

附件照片：

- 设备照片、签名、取件凭证必须通过 `@/lib/repairdesk/api` 上传并从 `OrderDetail.attachments` 渲染。
- 上传成功后必须 invalidate 当前详情，并写入时间线。
- 不允许把生产照片长期留在本地 state 里当业务结果。

## 8. 数据与业务逻辑边界

设计风格不能脱离业务逻辑。新增移动详情页面时必须按以下边界实现：

1. 页面组件只通过 `@/lib/repairdesk/api` 或 feature API facade 读写数据，不直接导入 `src/server/*`。
2. 创建、编辑、上传、流转、收款、通知等 mutation 成功后必须 invalidate 当前详情、相关列表和统计 query。
3. 录入人、技师、创建人、门店归属等字段只读展示，由服务端 actor 或数据源决定，前端不得提供可编辑控件。
4. 主流程和辅助状态必须分开：主流程只表示维修阶段；物流、外修、审批、通知、异常作为辅助状态或处理面板。
5. 会产生外部副作用的动作，例如 WhatsApp、收款、状态推进、打印，必须在草稿编辑中禁用或要求先保存。
6. 历史记录和时间线是业务追溯入口，不是装饰信息；状态、金额、附件、通知、审批都必须能回看。

## 9. 历史记录与状态流转

移动详情页必须有清晰的历史入口：

- 正文靠前展示最近一次操作。
- 点击打开完整时间线 Sheet。
- 状态流转、报价、收款、通知、附件上传都必须可追溯。

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

- 按钮高度 `h-9`，字号 `text-xs`，图标 `size-3.5`。
- 低频动作放顶部更多菜单或对应卡片内。
- 打印属于顶部独立图标按钮，不放在更多菜单里。
- 编辑某个关键草稿时，底部会产生外部副作用的动作必须禁用。

## 11. 验收矩阵

新增或改动移动详情页时至少检查：

| Viewport | 验收 |
| --- | --- |
| 390px | 无横向溢出，顶部卡不遮挡第一张正文卡，底部操作条不盖住主要内容 |
| 430px | 顶部卡和正文卡左右边缘对齐，间距 6-10px |
| 640px-767px | 仍使用移动宽度体系，不出现顶部窄、正文宽的割裂 |
| 768px+ | 按页面声明进入平板/桌面布局，不保留移动 fixed 顶部 |

必须满足：

```txt
document.documentElement.scrollWidth <= window.innerWidth
```

交互验收：

- 顶部打印按钮可点击，触控区不小于 `32px`。
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
10. 390px、430px、768px 是否无横向溢出，且没有卡片遮挡。
