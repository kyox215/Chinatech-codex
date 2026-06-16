# RepairOS Compact 架构与 UI 标准

更新时间：2026-06-12

## 目标

RepairDesk 后续升级为 RepairOS Compact：移动优先的维修、客户、回收、库存、设置工作台。它不是营销网站，也不是桌面后台缩小版，而是门店员工单手操作的高密度业务 App。

## 信息架构

全端导航统一使用同一组业务模块：

```txt
订单管理
客户管理
回收管理
库存商品
设置
```

桌面端显示固定侧边栏，支持折叠为纯图标模式；移动端不再显示底部导航，而是使用同一套侧边栏抽屉，默认收纳，由 AppBar 左侧菜单按钮打开。进入模块后，页面内部不再重复显示大号“订单管理 / 回收管理 / 库存商品”等标题区，首屏直接进入指标、筛选和业务卡片。扫码是全局工具，不进入导航。悬浮 `+` 根据当前模块显示高频动作，例如新建工单、新建回收、库存入库、客户操作、扫码读取、拍照采集。

## 视觉标准

- Mobile-first。
- iOS 操作感 + SaaS 工具型界面。
- 浅色背景，白色紧凑卡片。
- 主色：`#315CFF`，通过 `src/styles.css` 的 `--primary` 和 `--gradient-brand` 输出。
- 小状态 Badge、紧凑 Chips、紧凑列表卡片。
- 不使用大 banner、大面积空白、营销式 hero、过度玻璃拟态或大装饰背景。
- 每个列表页手机一屏尽量显示 4-7 条业务卡片。
- 页面首屏必须直接出现可操作业务数据。

## RepairOS Floating Card 设计语言

移动端详情页、任务页、报价页和高频工作流页面统一使用 Floating Card 语言：

```txt
页面背景：浅色、轻透明，不画整屏横向切割线
顶部：一张圆角悬浮工作卡，包含返回、标题、状态、编号和当前进度
主体：同半径、同边框、同阴影的信息卡，保持高密度字段
底部：固定操作条，只放当前页面最高频动作
```

当前移动订单详情页 `/orders/[id]` 是 Floating Card 的设计源头。新增或重构移动详情、任务、报价、收款、扫码、拍照、历史记录等页面时，必须先阅读 [`REPAIROS_MOBILE_DETAIL_STANDARD.md`](./REPAIROS_MOBILE_DETAIL_STANDARD.md)，并按其中的字号、卡片、颜色、状态流转和数据边界执行。

执行标准：

- 顶部不得再拆成“系统顶栏 + 另一块状态区 + 横向分割线”，必须是一张完整悬浮卡。
- 顶部悬浮卡使用 `repairOs.mobileFloatingHeaderShell`、`repairOs.mobileFloatingHeaderCard`、`repairOs.mobileFloatingHeaderNav`、`repairOs.mobileFloatingHeaderBody`。
- 页面正文使用 `repairOs.mobileFloatingPage` 预留顶部固定卡空间，不手写 `safe-area` / `pt-[calc(...)]`。
- 业务信息卡使用 `repairOs.mobileInfoCard` 或 `repairOs.mobileInfoCardMuted`，避免每个页面手写圆角、边框和阴影。
- 顶部卡和第一张正文卡之间保留 6-10px 视觉间距，不允许重叠或贴边。
- 适用页面：工单详情、移动任务详情、新建工单移动布局、客户详情、回收报价、库存商品详情、设置子页。
- 字号、颜色重点、卡片密度和底部操作条必须以移动订单详情页的“基础信息 / 客户信息 / 设备信息 / 维修项目与报价 / 支付信息”卡片为基准，不在单个页面重新发明一套小卡片语言。
- 不适用：桌面列表页、普通确认弹窗、轻量 Popover。

## 页面结构

每个移动业务页统一结构：

```txt
顶部：AppBar 店铺上下文 + 搜索；页面内不重复模块标题
状态：横向 chips 或小 KPI
主体：高密度业务卡片列表
导航：桌面固定侧边栏 / 移动侧边栏抽屉
右下：模块化快捷 +
```

桌面端保留侧栏、模块标题和高密度表格；移动端保留顶部菜单入口、搜索/店铺上下文和模块化 `+`，页面内容从指标/工具条开始。新增页面必须先保证 390px 宽度可用。

## 架构标准

- `src/app/*` 只放路由、metadata 和薄入口。
- 业务页面进入 `src/features/*/screens`。
- 共享导航在 `src/shared/config/navigation.ts`。
- 页面级 class 从 `src/lib/ui-patterns.ts` 读取。
- 组件级 class 从 `src/lib/component-patterns.ts` 读取。
- 扫码、拍照、附件属于 `src/features/capture`。
- 后续打印标签属于 `src/features/print`。
- WhatsApp/沟通时间线属于 `src/features/communication`。

## 第一阶段验收

- 桌面侧边栏展开/折叠稳定，折叠时图标不被压缩。
- 移动端没有底部导航，菜单通过侧边栏抽屉进入。
- `/buyback` 有独立回收管理入口。
- 移动端没有横向溢出。
- 主色切换为 `#315CFF`。
- 新页面使用 RepairOS Compact 卡片和 chips。
