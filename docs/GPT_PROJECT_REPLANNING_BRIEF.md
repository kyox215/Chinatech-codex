# RepairDesk 项目重规划 GPT Brief

更新时间：2026-06-11

用途：把这份文档直接交给 GPT / Codex / 工程师，用来重新规划 ChinaTech RepairDesk 整个项目。本文档不是执行计划本身，而是“规划输入材料”和“提示词模板”。新的规划者必须先理解业务、架构、风险和边界，再输出分阶段可执行方案。

> 安全规则：不要把 `.env.local`、Supabase service role key、登录密码、真实客户数据、短信/WhatsApp 账号凭据写入任何回复、文档、日志或提交。

## 1. 可直接复制给 GPT 的提示词

```txt
你现在接手一个名为 ChinaTech RepairDesk 的 Next.js + Supabase 多门店维修/回收后台项目。

请先阅读并以这些文件为准：
- AGENTS.md
- docs/ARCHITECTURE.md
- docs/UI_PAGE_GENERATION_DECLARATION.md
- docs/COMPONENT_GENERATION_DECLARATION.md
- docs/RESPONSIVE_DENSITY_PLAN.md
- docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md
- docs/GPT_PROJECT_REPLANNING_BRIEF.md

你的任务不是立刻改代码，而是重新规划整个项目。

请输出一份 decision-complete 的全项目重规划方案，必须包含：
1. 当前项目真实状态和主要风险。
2. 目标架构和模块边界。
3. 分阶段实施路线，每阶段包含目标、涉及模块、不可破坏的业务流程、验收标准和测试策略。
4. 哪些地方必须先补 characterization tests。
5. 哪些数据库、RLS、多门店权限、审计日志风险必须先审计。
6. 哪些大文件需要拆分，拆分后的目标目录结构。
7. 性能优化路线：客户、工单、库存列表/详情/API/数据库查询。
8. UI/交互统一路线：沉浸式工作面、弹窗、列表高密度、响应式、动画标准。
9. 后续新增功能路线：标签打印、扫码、库存标签、工单标签、客户设备标签。

在计划被确认前，不要进行大面积代码修改。
如果发现需求含糊，先通过仓库事实排除可发现问题，再问关键产品问题。
```

## 2. 项目一句话定义

RepairDesk 是一个面向手机维修店和二手电子产品回收售卖业务的多门店后台系统。它不是营销网站，而是高频内部工作台，用来处理：

- 维修工单：收机、报价、审批、维修、付款、通知、取机、返修。
- 客户 CRM：客户资料、电话、备用电话、设备、历史工单、标签、跟进、沟通记录。
- 回收库存：收机、检测、报价、回收、资料清除、整备、上架、售卖。
- 消息模板：WhatsApp/SMS 手动发送文本模板、预览和日志记录。
- 店铺与权限：登录、注册、门店加入、平台审批、多门店数据隔离。
- 审计：关键写操作记录 actor、store、entity、before/after、时间。

## 3. 当前技术栈

- Next.js App Router `16.2.6`
- React `19.2.0`
- TypeScript `5.8.3`
- Node.js `>=22.12.0`
- Supabase JS `2.105.4`
- Supabase SSR `0.10.3`
- TanStack React Query `5.83.0`
- Tailwind CSS 4
- Radix / shadcn UI primitives
- framer-motion
- lucide-react
- sonner
- Vitest + jsdom
- Playwright
- Storybook 已配置，但业务覆盖不足

常用门禁：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## 4. 必须遵守的仓库规则

- 新路由放 `src/app/*`，但 route 文件保持薄，只导入 `features/*/screens`。
- 客户端数据调用走 `@/lib/repairdesk/api` 或 feature api facade，不直接 import `src/server/*`。
- 服务端业务逻辑放 `features/*/server`。
- 纯业务规则放 `features/*/model` 或 `entities/*`。
- 通用纯函数放 `src/shared/lib`。
- UI primitive 使用 `src/components/ui/*`。
- 页面布局 class 使用 `src/lib/ui-patterns.ts`。
- 组件布局/弹层 class 使用 `src/lib/component-patterns.ts`。
- 动效只能复用 `src/lib/motion.ts` 中的共享声明。
- 颜色只能来自 `src/styles.css` token，不新增散落 hardcoded color。
- 新导航页必须同步 `AppSidebar`、`AppBar` breadcrumb、`CommandPalette`。
- 不重新引入 TanStack Router/Start 或 Vite entrypoint。

## 5. 当前重要业务事实

### 5.1 工单 Orders

当前工单流程已经覆盖：

- 列表、分页、搜索、筛选、统计。
- 新建工单。
- 工单详情沉浸式弹窗。
- 状态推进。
- 基本信息编辑。
- 报价/押金/尾款处理。
- 收款。
- 通知客户。
- 审批请求。
- 打印维修单。
- 事件时间线。

近期已经完成的重要标准：

- 工单详情弹窗改为固定尺寸沉浸式工作面。
- 概览恢复桌面三列：客户信息 / 设备与故障 / 报价与处理。
- 技师字段锁定：新建订单由当前账号写入，详情和编辑不允许修改。
- 报价编辑改为 string draft，避免清空金额后变成 `0` 或输入变 `012`。

规划风险：

- `src/features/orders/components/order-overview-tab.tsx` 仍偏大。
- `src/features/orders/server/order.repository.ts` 仍偏大。
- `/orders` 列表仍和旧 `src/routes/orders.index.tsx` 有耦合。
- 工单打印、标签打印、维修单、收据应统一输出模型。

### 5.2 客户 Customers

当前客户功能覆盖：

- 客户列表。
- 搜索、标签筛选、营销状态筛选、回访筛选。
- 客户详情。
- 设备、历史工单、消息、营销、跟进、时间线。
- 客户创建/编辑/标签/设备/跟进/消息。

近期已经完成的重要优化：

- 新增 `customers/list-page` 分页 API。
- 新增 `CustomerListPageInput` / `CustomerListPageResult`。
- 客户列表改为 50 条服务端分页。
- 搜索输入增加 debounce。
- 使用 TanStack Query `placeholderData: keepPreviousData`。
- 列表 hover/focus 预取当前客户详情。
- 客户详情 query key 和列表预取统一为 `customersKeys.detail(id)`。
- Supabase migration 新增客户搜索索引和 `repairdesk_customer_list_page` RPC。
- 客户详情不再全店拉订单后过滤，改为只查当前客户订单。

规划风险：

- 客户和设备、订单、消息、回访高度耦合。
- 备用电话、标准电话、原始电话字段必须兼容。
- 标签管理目前仍有默认标签 fallback，后续要与 DB 标签管理统一。

### 5.3 库存 Inventory

库存业务覆盖：

- 回收/二手库存列表。
- 状态流转。
- 检测、交易、销售、质量检查。
- SeaTable electronics import。

规划风险：

- `inventory-screen.tsx` 偏大，含列表、筛选、详情、弹窗、状态操作。
- `inventory.repository.ts` 偏大。
- 状态机、利润计算、付款金额、买卖客户关联必须先补测试。

### 5.4 消息 Messages

当前消息是手动 WhatsApp/SMS 模板，不直接接第三方发送 API。

规划风险：

- 模板变量渲染、预览、发送日志必须复用同一个 renderer。
- 默认模板、DB 模板、远端 legacy 字段同步要保持兼容。

### 5.5 权限 / 多门店 / 平台审批

核心原则：

- 店铺业务权限来自 `store_memberships`。
- 平台管理员权限来自 `platform_admins`。
- 平台管理员不自动拥有所有店铺业务数据权限。
- 权限不能依赖 user-editable metadata。
- active store 由 cookie 和 membership 一起决定。

规划风险：

- 远端 migration history 与本地 migration 不完全一一对应。
- legacy public 表仍需安全审计。
- RLS、service role repository、平台权限边界要单独审查。

## 6. 当前架构风险清单

规划者应优先评估这些风险：

- 大文件过多：screen、repository、复杂表单/详情组件超过预算。
- `@/lib/repairdesk/api.ts` 和 `types.ts` 承载过多 domain。
- `server/api/repairdesk-router.ts` 和 `repairdesk-schemas.ts` 过大，应按 domain 拆。
- App Router 已使用，但部分页面仍间接依赖旧 `src/routes/*`。
- mock API 与真实 repository 需要统一契约测试。
- Supabase migration 与远端历史存在漂移，不能只凭本地 migration 假设远端状态。
- public schema legacy 表可能存在 RLS 风险。
- 打印、标签、收据、维修单输出模型还没有统一。
- 部分 UI 历史上存在卡片套卡片、弹窗被重壳框住、过度玻璃化、响应式断点漏洞。

## 7. 推荐重规划阶段

### Phase 0：冻结事实与补保护测试

目标：

- 不做大重构，先补 characterization tests。
- 锁定当前业务行为。

必须覆盖：

- 登录后跳转和 onboarding。
- 店铺权限与 platform admin 边界。
- 工单创建、状态推进、技师锁定、报价保存、收款。
- 客户分页、搜索、标签、回访筛选、详情数据。
- 库存状态机、报价、回收、销售、利润。
- 消息模板渲染。
- API schema 对非法字段的拒绝。

验收：

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Phase 1：数据/API 分层

目标：

- 把巨型 API facade、router、schemas 按 domain 拆分。
- 保持外部 API URL 契约不变。

建议：

- `features/orders/api/client.ts`
- `features/customers/api/client.ts`
- `features/inventory/api/client.ts`
- `features/messages/api/client.ts`
- `server/api/domains/orders-router.ts`
- `server/api/domains/customers-router.ts`
- `server/api/domains/inventory-router.ts`
- `server/api/domains/messages-router.ts`
- `server/api/schemas/*`

验收：

- 外部路径不变。
- mock 和 Supabase source 都通过同一 contract 测试。
- 客户端仍不 import server code。

### Phase 2：Orders 模块拆分

目标：

- 拆分工单列表、详情、报价、通知、打印、事件流。
- 移除 `/orders` 对旧 `src/routes/orders.index.tsx` 的依赖。

重点：

- 保护工单详情沉浸式工作面。
- 保持技师锁定。
- 保持报价 string draft 标准。
- 统一维修单、收据、标签打印输出数据模型。

### Phase 3：Customers 模块拆分与性能收敛

目标：

- 稳定客户分页 API。
- 拆分客户详情 tabs、表单、消息、标签、设备。
- 为客户列表/详情增加更明确的加载态和预取策略。

重点：

- 不回退到全量客户/设备/订单拉取。
- 不破坏备用电话搜索。
- 标签管理统一 DB 来源。

### Phase 4：Inventory 模块拆分

目标：

- 拆 `inventory-screen.tsx` 和 repository。
- 强化状态机和利润计算。

重点：

- 状态流转必须只通过 model。
- 所有交易和质检写 audit/events。
- 二手库存标签和销售标签输出模型预留。

### Phase 5：输出与硬件集成

目标：

- 统一打印/标签/二维码/条码能力。

建议：

- 新增 print/label domain model。
- 工单标签、设备标签、库存标签、客户取件标签统一模板。
- 先支持浏览器打印 PDF/HTML。
- 后续支持 QZ Tray 本地直连标签机。
- 推荐硬件优先考虑 Brother QL-820NWB；快递/大面单可考虑 Rollo 或 Zebra。

## 8. 标签打印规划输入

未来要支持：

- 工单标签：工单号、客户、电话、设备、IMEI、故障、技师、日期、二维码。
- 设备标签：客户、设备型号、IMEI、入库/收机日期、二维码。
- 库存标签：库存编号、品牌型号、容量/颜色、回收价/售价可选、IMEI、状态、二维码。
- 取件标签：工单号、客户、尾款、取件状态。

推荐实现顺序：

1. 浏览器打印版：生成 HTML/PDF label，系统按钮打开打印。
2. 模板配置版：允许选择 29x90、62x100、4x6 等标签尺寸。
3. QZ Tray 直连版：本地电脑安装 QZ Tray，系统直接发送 print job。
4. 硬件设置页：配置默认标签机、标签尺寸、二维码 URL 前缀。

注意：

- 不要在浏览器直接暴露打印机内网密码。
- 不要假设所有员工电脑都安装同一驱动。
- 标签二维码应使用系统公开可访问或内网可访问的工单详情 URL。

## 9. UI/响应式重规划要求

必须保持：

- 后台高密度，不做营销式 landing page。
- 列表桌面 dense table，移动三段式 card。
- 页面不能横向溢出。
- 复杂详情弹窗使用沉浸式工作面。
- 小表单 Dialog 使用单层容器，不卡片套卡片。
- Hero/Tabs 固定，内容区滚动。
- overlay 轻遮罩，避免黑压。
- 动效统一来自 `src/lib/motion.ts`。

必须验证 viewport：

- 390
- 768
- 1024
- 1280
- 1440

验收标准：

```txt
document.documentElement.scrollWidth <= window.innerWidth
```

## 10. 数据库/安全重规划要求

必须审计：

- 所有 public tables 的 RLS 状态。
- legacy public tables 是否仍被使用。
- service role repository 是否总是使用 actor store_id 过滤。
- platform admin 是否能越权访问店铺业务数据。
- audit_logs 是否覆盖所有关键 mutation。
- RPC/function 是否避免不必要的 security definer。
- 新表是否需要显式 grant 与 RLS。

原则：

- 能用普通 service role repository 的地方，不要滥用 security definer RPC。
- 如果必须用 RPC，明确参数、权限、search_path、返回 shape。
- 每个 migration 必须可重复、安全、带 `if not exists` 或兼容旧远端 schema。

## 11. 性能重规划要求

优先优化：

- 客户列表：已完成分页/RPC/索引，后续补 explain 和真实远端指标。
- 工单列表：继续稳定 `orders/list-page`，减少全量 fallback。
- 库存列表：检查 1024 断点、分页、局部滚动和 server filtering。
- 详情页：避免为了单个详情拉全店数据。
- Query cache：使用 domain key factory，mutation 精确 invalidate。
- 搜索：输入 debounce；服务端搜索；不要每个 keypress 触发全量聚合。

性能验收建议：

- 真实 3k+ 客户、6k+ 设备/工单下，客户列表首屏不超过一页数据。
- 搜索请求数量随 debounce 降低。
- 详情页不调用全店订单读取。
- 列表切页不闪空。

## 12. 最终规划输出格式要求

新的 GPT 应输出一份完整规划，建议结构：

```txt
# RepairDesk 全项目重规划方案

## Summary
## Current State And Risks
## Target Architecture
## Phase Plan
## Data/API Plan
## UI/UX Plan
## Database/Security Plan
## Performance Plan
## Print/Label Plan
## Test And Acceptance Plan
## Assumptions
```

每个 phase 必须包含：

- 目标。
- 涉及模块。
- 具体文件/目录。
- 不可破坏的业务行为。
- 测试。
- 完成定义。

不要只输出愿景型建议，必须可交给工程 agent 分阶段执行。
