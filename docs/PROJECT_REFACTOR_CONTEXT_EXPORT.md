# RepairDesk 全项目重构交接文档

更新时间：2026-06-11  
用途：把当前 ChinaTech RepairDesk 项目的真实业务流程、技术架构、数据库状态、权限模型、重构风险和下一轮规划要求一次性导出，方便交给新的 GPT / 工程师重新规划并执行系统级重构。

> 重要安全说明：本文档不包含任何 Supabase service role key、登录密码、`.env.local` 值或客户明细数据。后续任何 GPT/工程师都不应要求把密码、密钥写入代码、迁移、日志或文档。

## 1. 项目一句话定义

RepairDesk 是一个面向手机维修店/二手电子产品回收售卖业务的多门店后台系统。当前目标不是营销站，而是高频内部工作台：

- 维修工单从收机、报价、审批、维修、付款、通知、取机到售后追踪。
- 客户 CRM 管理客户资料、设备、沟通记录、标签和跟进。
- 二手手机/电子产品回收库存从收机、检测、报价、回收、资料清除、整备、上架、售卖到退回。
- 消息模板与店铺设置用于 WhatsApp/SMS 手动打开链接发送，并保留系统日志。
- 登录、注册、门店加入、平台管理员审批、多门店数据隔离。
- 所有关键写操作都需要记录员工、时间、实体、变更前后，方便追溯。

当前项目已经从早期单店/原型系统逐步迁移到 Next.js App Router + Supabase SSR/Auth + 多店铺模型，但仍有遗留实现、超大文件和数据模型历史包袱，需要系统性重构。

## 2. 给下一位 GPT 的使用方式

新的 GPT/工程师应按这个顺序工作：

1. 先阅读仓库根目录 `AGENTS.md`。
2. 再阅读：
   - `docs/ARCHITECTURE.md`
   - `docs/UI_PAGE_GENERATION_DECLARATION.md`
   - `docs/COMPONENT_GENERATION_DECLARATION.md`
   - `docs/RESPONSIVE_DENSITY_PLAN.md`
   - 本文档 `docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md`
3. 在没有明确要求前，不要直接大面积改代码。先输出可执行重构计划。
4. 重构时必须保护现有业务流程、客户数据、多店铺隔离和审计日志。
5. 任何数据库结构变更都必须通过 Supabase migration，不能只在远端手工改。
6. 不要把 `.env.local`、密码、service role key、客户数据导出到文档或提交。

推荐给 GPT 的开场提示词：

```txt
你现在接手一个 Next.js + Supabase 的 RepairDesk 多门店维修/回收系统。
请先阅读 AGENTS.md、docs/ARCHITECTURE.md、docs/RESPONSIVE_DENSITY_PLAN.md
和 docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md。

目标：在不破坏现有登录、多门店隔离、维修工单、客户 CRM、库存回收售卖、
消息模板、审计日志的前提下，重新规划全项目重构。

请先给出：
1. 当前架构风险盘点。
2. 分阶段重构路线。
3. 每阶段涉及文件、验收标准、测试策略。
4. 哪些地方必须先补 characterization tests。
5. 哪些数据库/RLS/权限点必须先审计。

在计划被确认前，不要开始大面积修改代码。
```

## 3. 本地运行与环境

### 3.1 技术栈

- Next.js `16.2.6`，App Router。
- React `19.2.0`。
- TypeScript `5.8.3`，严格类型检查。
- Node.js 要求：`>=22.12.0`。
- Supabase：
  - `@supabase/supabase-js` `2.105.4`
  - `@supabase/ssr` `0.10.3`
- 数据请求：
  - React Query `5.83.0`
  - 客户端统一走 `@/lib/repairdesk/api`
- UI：
  - Tailwind CSS 4
  - Radix/shadcn UI primitives
  - lucide-react icons
  - framer-motion
  - sonner toast
  - Recharts
- 测试：
  - Vitest + jsdom
  - React Testing Library
  - Playwright
  - Storybook 已配置但业务覆盖不完整

### 3.2 常用命令

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
npm run test:e2e
```

`npm run check` 等价于：

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

数据库相关脚本：

```bash
npm run db:seed
npm run db:ensure-owner-admin
npm run db:import:seatable
```

管理员初始化脚本的正确方式是用一次性环境变量传密码：

```bash
ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> ADMIN_DISPLAY_NAME=<name> npm run db:ensure-owner-admin
```

不要把密码写进 migration、脚本默认值、Git、日志或文档。

### 3.3 环境变量

仓库有：

- `.env.example`
- `.env.local`

`.env.local` 需要包含：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

注意：

- `SUPABASE_SERVICE_ROLE_KEY` 只能在服务端使用。
- 任何 `NEXT_PUBLIC_*` 都会暴露给浏览器。
- 权限判断不能依赖用户可编辑 metadata。

### 3.4 Supabase 本地配置

`supabase/config.toml` 当前关键信息：

- project id：`xluzcoduqsdvjoouqhkc`
- local API port：`54321`
- local DB port：`54322`
- local Studio port：`54323`
- auth `site_url`：`http://127.0.0.1:3000`
- auth signup：enabled
- JWT expiry：3600 秒

### 3.5 当前本地预览

当前开发服务器可通过：

```txt
http://localhost:3000
```

登录页通常是：

```txt
http://localhost:3000/login?next=%2F
```

如果本地端口被占用，Next.js 会提示选择其他端口；重构计划里应避免硬编码 localhost 端口。

## 4. 仓库结构

### 4.1 App Router 路由

当前 `src/app` 文件：

```txt
src/app/layout.tsx
src/app/providers.tsx
src/app/page.tsx
src/app/login/page.tsx
src/app/onboarding/page.tsx
src/app/platform/page.tsx
src/app/orders/page.tsx
src/app/orders/[id]/page.tsx
src/app/orders/new/page.tsx
src/app/customers/page.tsx
src/app/customers/[id]/page.tsx
src/app/inventory/page.tsx
src/app/messages/page.tsx
src/app/settings/page.tsx
src/app/not-found.tsx
src/app/api/repairdesk/[...path]/route.ts
```

设计原则：

- `src/app/*` 应保持很薄，只做 metadata、layout、route handler 和导入 feature screen。
- 业务 UI 应放在 `src/features/*/screens`、`components`、`forms`。
- 客户端不能直接导入 `src/server/*`。

当前问题：

- `/` 和 `/orders` 虽然是 App Router 页面，但仍间接使用旧 `src/routes` 实现：
  - `src/features/dashboard/screens/dashboard-screen.tsx` 导入 `@/routes/index`
  - `src/features/orders/screens/order-list-screen.tsx` 导入 `@/routes/orders.index`
- 这两个旧文件不是纯死代码，不能直接删除。
- 其他 `src/routes/*` 文件需要逐个确认是否还被引用。

### 4.2 Feature 模块

当前 `src/features` 主要模块：

```txt
auth
customers
dashboard
inventory
messages
orders
platform
settings
stores
```

推荐目标边界：

- `features/*/screens`：页面级组合。
- `features/*/components`：该业务域专用展示组件。
- `features/*/forms`：表单和弹窗。
- `features/*/api`：React Query key factories 和 client hook。
- `features/*/server`：repository/service，只能服务端导入。
- `features/*/model`：纯规则、schema、计算、状态机。
- `features/*/testing`：mock API、builders、测试夹具。

### 4.3 Shared / entities / server

当前相关目录：

```txt
src/components
src/components/ui
src/entities
src/shared
src/lib
src/server
```

职责建议：

- `src/components/ui/*`：shadcn/Radix primitive 层，不放业务规则。
- `src/components/orders/*`：当前存在订单 badge、展示组件，后续应评估迁移到 `features/orders/components` 或 `entities/order`。
- `src/entities/*`：跨 feature 的业务实体规则，例如订单状态格式化、客户/设备展示规则。
- `src/shared/lib`：纯函数，不能 import feature。
- `src/server/*`：API dispatch、auth context、audit、Supabase server client。

## 5. 当前业务路线图

### 5.1 登录、注册、门店加入、平台审批

当前目标流程：

1. 用户访问业务页。
2. 未登录则进入 `/login?next=...`。
3. 登录成功后调用 `getOnboardingStatus()`。
4. 跳转规则：
   - 有 active store：默认进入 `/` 店铺工作台。
   - 有 active store 且也是 platform admin：仍默认进入 `/`，同时显示平台管理入口。
   - 无 active store 但是 platform admin：进入 `/platform`。
   - 无 active store 且不是 platform admin：进入 `/onboarding`。
5. 新注册账号进入 onboarding：
   - 创建新店铺申请。
   - 加入已有店铺申请。
6. 平台管理员在 `/platform` 审批。
7. 审批通过后：
   - 创建或绑定 store。
   - 创建 `store_memberships`。
   - 更新当前 active store。
   - 写入平台审计日志。

关键文件：

```txt
src/features/auth/screens/login-screen.tsx
src/features/auth/screens/onboarding-screen.tsx
src/features/auth/model/post-login-redirect.ts
src/features/platform/screens/platform-admin-screen.tsx
src/features/platform/server/platform.repository.ts
src/features/platform/server/platform.service.ts
src/features/stores/server/store.repository.ts
src/features/stores/server/store.service.ts
src/features/stores/api/use-store-shell-context.ts
src/server/auth-context.ts
```

关键原则：

- 店铺业务权限来自 `store_memberships`。
- 平台管理员权限来自 `platform_admins`。
- 不用 email 硬编码权限。
- 不用 user-editable metadata 做权限。
- 平台管理员不自动拥有其他店铺业务数据权限。

### 5.2 应用壳与导航

当前 App Shell 在 `src/app/providers.tsx`，包括：

- React Query provider
- Sidebar provider
- `AppSidebar`
- `SidebarInset`
- `BackgroundOrbs`
- `AppBar`
- main content
- `CommandPalette`
- `Toaster`

登录和 onboarding 页面会跳过业务 shell。

关键文件：

```txt
src/app/providers.tsx
src/components/app-sidebar.tsx
src/components/app-bar.tsx
src/components/command-palette.tsx
src/components/top-nav.tsx
src/features/stores/api/use-store-shell-context.ts
```

当前期望：

- 店铺名称从 `getStoreContext()` 读取。
- 当前默认店铺显示 `ChinaTech`。
- active platform admin 显示“平台管理/平台审批”入口。
- 普通店铺员工不显示平台入口。
- 切换店铺后刷新 store context 和相关 query。

当前风险：

- `TopNav` 可能已不再是主 shell，但仍存在，需要确认引用。
- 旧 `src/routes/*` 内可能仍有硬编码店铺名、颜色和布局。
- 新增导航页必须同步更新 `AppSidebar`、`AppBar` breadcrumb、`CommandPalette`。

### 5.3 维修工单 Orders

业务目标：

1. 新建工单，登记客户、手机、故障、报价、押金、是否留机、配件。
2. 工单列表支持搜索、筛选、分页、统计。
3. 工单详情支持：
   - 状态推进
   - 编辑基本信息
   - 财务修改
   - 收款
   - 取消
   - 通知客户
   - 发送审批请求
   - 打印维修单
   - 查看事件时间线
4. 通知方式当前保持手动打开 WhatsApp/SMS 链接，系统记录日志。
5. 所有写操作写 `audit_logs`，并尽量同步写 `order_events`。

关键文件：

```txt
src/features/orders/screens/order-list-screen.tsx
src/features/orders/screens/order-detail-screen.tsx
src/features/orders/screens/new-order-screen.tsx
src/features/orders/components/order-hero.tsx
src/features/orders/components/order-detail-tabs.tsx
src/features/orders/components/order-overview-tab.tsx
src/features/orders/forms/*
src/features/orders/server/order.repository.ts
src/features/orders/server/order.service.ts
src/features/orders/model/*
src/features/orders/import/seatable-riparazione.ts
src/features/orders/testing/mock-api.ts
```

当前问题：

- `order-list-screen.tsx` 只是包了一层旧 `@/routes/orders.index`。
- `order.repository.ts` 约 1369 行，超过项目建议的 repository 450 行预算。
- `order-overview-tab.tsx` 约 1255 行，远超组件预算。
- 订单相关编辑、财务、通知、审批、打印、事件流混在较大的 UI 文件中。
- mock API 与真实 repository 需要长期保持契约一致，目前维护成本较高。

### 5.4 客户 CRM Customers

业务目标：

1. 客户列表、搜索、筛选。
2. 客户详情：
   - 基本资料
   - 电话/备用电话
   - 设备列表
   - 工单历史
   - 沟通记录
   - 标签
   - 跟进任务
3. 客户消息发送仍走手动链接/记录日志。
4. 客户数据必须按 store 隔离。

关键文件：

```txt
src/features/customers/screens/customer-list-screen.tsx
src/features/customers/screens/customer-detail-screen.tsx
src/features/customers/components/*
src/features/customers/forms/*
src/features/customers/model/customer-list.ts
src/features/customers/server/customer.repository.ts
src/features/customers/server/customer.service.ts
src/features/customers/testing/mock-api.ts
```

当前风险：

- 客户与设备、工单、消息、跟进高度耦合，重构时必须先补集成测试。
- 客户联系人字段经历过迁移：`contact_phones`、`phone_raw`、`phone_e164` 都需要保留兼容。

### 5.5 回收库存 / 二手售卖 Inventory

第一版业务闭环：

```txt
intake 收机登记
-> evaluating 检测估价
-> offer_made 已报价
-> purchased 已回收
-> data_wipe 资料清除
-> refurbishing 整备中
-> ready_for_sale 待上架
-> listed 售卖中
-> reserved 已预订
-> sold 已售
```

异常出口：

```txt
cancelled
returned
recycled
```

业务字段：

- 类别、品牌、型号、颜色、容量
- IMEI/序列号
- 回收价、挂牌价、成交价、订金
- 付款方式
- 整备成本、利润
- 外观等级、功能等级、电池健康
- IMEI 检查状态、激活锁状态
- 资料清除状态
- 卖家客户、买家客户
- 保修到期日
- 备注

关键文件：

```txt
src/features/inventory/screens/inventory-screen.tsx
src/features/inventory/model/inventory-workflow.ts
src/features/inventory/model/inventory-workflow.test.ts
src/features/inventory/import/seatable-electronics.ts
src/features/inventory/import/seatable-electronics.test.ts
src/features/inventory/server/inventory.repository.ts
src/features/inventory/server/inventory.service.ts
src/features/inventory/testing/mock-api.ts
```

当前问题：

- `inventory-screen.tsx` 约 1080 行，包含列表、KPI、筛选、弹窗、详情、状态操作，必须拆分。
- `inventory.repository.ts` 约 973 行，需要拆成 mapper、query、command、transaction/audit 部分。
- 回收库存是新业务，必须重点保护状态机合法性和利润计算。
- 第一版不自动对接 eBay/Back Market/Facebook，只记录内部渠道和备注。

### 5.6 消息模板 Messages

当前设计：

- `/messages` 是模板管理页面。
- 第一版只做手动 WhatsApp/SMS 模板，不接第三方 API。
- 模板变量统一双大括号语法，例如：
  - `{{customer_name}}`
  - `{{order_no}}`
  - `{{device_label}}`
  - `{{balance}}`
  - `{{store_name}}`
  - `{{store_address}}`
  - `{{order_url}}`

关键文件：

```txt
src/features/messages/screens/messages-screen.tsx
src/features/messages/model/message-template-defaults.ts
src/features/messages/model/template-renderer.ts
src/features/messages/server/message-settings.repository.ts
src/features/messages/server/message-settings.service.ts
src/features/messages/testing/mock-api.ts
```

相关弹窗：

```txt
src/features/orders/forms/notify-dialog.tsx
src/features/orders/forms/approval-request-dialog.tsx
src/features/customers/forms/customer-message-dialog.tsx
```

重构重点：

- 默认模板与 DB 模板 fallback 必须一致。
- 预览渲染、发送渲染、日志记录应复用同一 renderer。
- 移动端变量列表不能横向溢出。

### 5.7 系统设置 Settings

当前设计：

- `/settings` 管理单店配置：
  - 店铺名称
  - 地址
  - 电话
  - WhatsApp
  - 邮箱
  - 维修默认保修文本
  - 二手库存默认保修月数
  - 打印页脚
  - 客户消息签名

关键文件：

```txt
src/features/settings/screens/settings-screen.tsx
src/features/messages/server/message-settings.repository.ts
src/features/messages/server/message-settings.service.ts
```

当前问题：

- `settings-screen.tsx` 约 635 行，建议拆为 StoreProfilePanel、DefaultRulesPanel、OutputConfigPanel、MemberManagementPanel 等。
- 设置保存必须写 `audit_logs`。
- viewer 角色不能保存设置。

### 5.8 SeaTable 导入

已有两个导入方向：

1. 维修工单：`src/features/orders/import/seatable-riparazione.ts`
2. 电子产品/回收库存：`src/features/inventory/import/seatable-electronics.ts`

电子产品字段映射：

- `PREZZO` -> 销售/挂牌价
- `PREZZO PAGATO` -> 回收成本
- `ACCONTO` -> 订金
- `BATTERIA` -> 电池健康
- `DATA RITIRO` -> 售出/取走时间
- `DATA` -> 创建时间

状态推断：

- 有取走日期优先 `sold`
- 有售价但未售出为 `listed`
- 有回收价为 `purchased`
- 否则 `intake` / `evaluating`

要求：

- import preview 和 apply 分开。
- 原始行保存到 import event payload。
- 导入操作写 audit。
- 导入逻辑必须有单元测试覆盖金额、日期、电池、IMEI、状态推断。

## 6. API 与数据流

### 6.1 客户端到数据库的数据链路

标准链路：

```txt
Client component / feature screen
-> @/lib/repairdesk/api
-> /api/repairdesk/[...path]
-> src/server/api/repairdesk-router.ts
-> zod schema validation
-> getRequestActor()
-> feature service
-> feature repository
-> Supabase service role server client
-> audit_logs / domain events
```

原则：

- 客户端只调用 `@/lib/repairdesk/api` 或 feature api hooks。
- 客户端不直接导入 `src/server/*`。
- API route 统一做 auth、zod、错误转换。
- repository 不应返回数据库 raw row 给 UI，应映射到 domain DTO。
- 所有 mutation 都应能定位 actor、store、entity、before/after。

### 6.2 当前 API facade

`src/lib/repairdesk/api.ts` 当前导出大量函数，覆盖：

- inventory
- store settings
- onboarding/platform/stores
- message templates
- orders
- customers

风险：

- 单文件约 467 行，仍可工作，但长期会成为跨域耦合中心。
- 类型全部依赖 `src/lib/repairdesk/types.ts`，后者约 922 行。
- 建议下一阶段按 domain 拆：
  - `src/features/orders/api/client.ts`
  - `src/features/customers/api/client.ts`
  - `src/features/inventory/api/client.ts`
  - `src/features/messages/api/client.ts`
  - `src/features/stores/api/client.ts`
  - 保留 `@/lib/repairdesk/api` 作为兼容 re-export，逐步迁移。

### 6.3 当前 router endpoints

`src/server/api/repairdesk-router.ts` 当前支持这些 path：

```txt
onboarding/status
platform/onboarding/requests
platform/onboarding/approve
platform/onboarding/reject
order-stats
options
inventory/stats
settings/store
settings/store/update
message-templates
message-template/update
message-template/reset
message-template/preview
stores/context
stores/members
stores/create
stores/switch
stores/invite-member
onboarding/request
orders/list
orders/list-page
orders/create
order/get
order/update
order/patch
order/finance
order/transition
order/batch-transition
order/payment
order/notification
order/whatsapp-notification
order/approval-request
customers/list
customers/search
customers/devices
customer/get
customer/create
customer/update
customer/device/upsert
customer/device/delete
customer/tags/update
customer/followup/create
customer/followup/complete
customer/message
inventory/list
inventory/list-page
inventory/get
inventory/intake/create
inventory/update
inventory/transition
inventory/check
inventory/transaction
inventory/sell
inventory/import/electronics/preview
inventory/import/electronics/apply
```

重构建议：

- 保持 URL 契约不变，先拆内部 dispatcher。
- 按 domain 建 `orders-router.ts`、`customers-router.ts`、`inventory-router.ts`、`settings-router.ts`、`platform-router.ts`。
- `repairdesk-router.ts` 只做 path 分派、auth context、统一错误。
- `repairdesk-schemas.ts` 也应按 domain 拆。

## 7. Supabase 数据库现状

### 7.1 迁移文件

当前 migration：

```txt
20260213234620_remote_baseline.sql
20260517143000_repairdesk_schema.sql
20260518150000_add_eur_currency.sql
20260518170000_customer_crm.sql
20260610120648_order_accessory_notes.sql
20260610234427_buyback_resale_inventory.sql
20260610234705_add_customer_contact_phones.sql
20260611001527_message_templates_settings.sql
20260611002831_enterprise_multi_store_foundation.sql
20260611005916_harden_store_tenant_constraints.sql
20260611074644_repairdesk_auth_multistore_bootstrap_safe.sql
20260611080254_platform_onboarding_approvals.sql
```

迁移主题：

- 初始维修系统：customers、devices、suppliers、repair_orders、order_events、message_logs。
- EUR currency。
- Customer CRM。
- 工单配件备注。
- 回收售卖库存。
- 客户备用电话。
- 消息模板与店铺设置。
- 多店铺 foundation。
- tenant constraints hardening。
- auth/multistore safe bootstrap。
- platform onboarding approvals。

### 7.2 核心业务表与迁移漂移风险

本地 migration 目标模型中的核心业务表：

```txt
stores
store_memberships
store_invitations
staff_profiles
platform_admins
platform_audit_logs
onboarding_requests
audit_logs
customers
devices
suppliers
repair_orders
order_events
message_logs
customer_tags
customer_tag_assignments
customer_interactions
customer_followups
inventory_items
inventory_quality_checks
inventory_transactions
inventory_events
message_templates
store_settings
```

远端当前已确认存在且启用 RLS 的核心表包括：

```txt
stores
store_memberships
store_invitations
staff_profiles
platform_admins
platform_audit_logs
onboarding_requests
audit_logs
customers
devices
suppliers
repair_orders
order_events
message_logs
customer_tags
customer_tag_assignments
customer_interactions
customer_followups
inventory_items
inventory_quality_checks
inventory_transactions
inventory_events
message_templates
store_settings
```

2026-06-11 已应用两个远端兼容 migration：

```txt
repairdesk_remote_schema_compatibility
repairdesk_message_template_legacy_sync
```

这两个 migration 解决了当时确认到的运行时 schema 问题：

- 创建 `store_settings`，并为远端当前 ChinaTech 店铺创建默认设置。
- 创建 `inventory_quality_checks` 和 `inventory_transactions`。
- 给远端已有的 `inventory_items`、`inventory_events`、`message_templates` 补齐当前代码需要的兼容列。
- 为 `message_templates` 增加旧列同步 trigger，避免远端历史 `code/type/body/is_active` NOT NULL 列阻止当前代码写入模板。

仍需在大重构前审计：

- 远端 migration history 与本地 migration 文件并非完全一一对应，存在历史漂移。
- 远端 `stores.id` 当前不是旧计划里的固定 UUID `00000000-0000-0000-0000-000000000001`，代码不能硬编码这个值。
- 旧 public 表的 RLS 和归档策略仍需单独处理。

远端查询确认的部分行数估算：

```txt
customers: approx 3550
devices: approx 6071
repair_orders: approx 6071
order_events: approx 6071
message_logs: approx 17
stores: approx 1
repair_quotes: approx 4820
```

### 7.3 远端遗留表风险

远端 public schema 仍存在一批历史/旧系统表，其中部分未启用 RLS，例如：

```txt
Part
Ticket
TicketPart
User
customers_legacy
repair_orders_legacy
order_logs_legacy
quotes
quote_headers
quote_items
products
price_history
recycle_models
recycle_orders
import_batches
sync_logs
```

风险：

- public schema 暴露给 Supabase Data API 时，未启用 RLS 的表可能成为安全隐患。
- 不能盲目启用 RLS，因为旧工具/导入脚本可能依赖这些表。
- 重构前必须做表级审计：
  - 是否仍被应用代码引用。
  - 是否仍被导入脚本/外部工具引用。
  - 是否包含客户隐私。
  - 是否需要迁移到 private schema。
  - 是否需要启用 RLS + 明确 policies。
  - 是否可以归档或删除。

### 7.4 多店铺数据隔离

核心模型：

- `stores`：店铺。
- `store_memberships`：用户属于哪些店铺，角色和状态。
- `staff_profiles`：全局员工档案。
- `platform_admins`：平台管理员。
- 业务表通过 `store_id` 隔离。
- 当前 active store 由 cookie `repairdesk-store-id` 和 membership 共同决定。

权限原则：

- 普通用户只能看自己 active store 的业务数据。
- 店铺 owner/admin/manager/staff/viewer 按角色授权。
- 平台管理员只处理平台审批和平台审计，不自动获得所有店铺业务数据。
- 如果未来要“跨店铺平台数据总览”，必须新增独立权限模型和只读聚合接口，不能复用店铺业务 repository。

### 7.5 审计日志

业务审计：

```txt
audit_logs
```

字段包括：

- actor id/email/name
- store_id
- action
- entity_type
- entity_id
- before_data
- after_data
- metadata
- created_at

平台审计：

```txt
platform_audit_logs
```

要求：

- 所有 create/update/delete/transition/payment/sale/import/settings/template/member 操作都要审计。
- 审计写入失败应如何处理需要明确策略：
  - 高风险业务建议 mutation 失败。
  - 低风险日志可记录 server error 并告警。
- 审计 payload 不应写入密码、token、service key。

## 8. 认证与权限细节

关键文件：

```txt
src/server/auth-context.ts
src/utils/supabase/server.ts
src/utils/supabase/client.ts
src/features/auth/screens/login-screen.tsx
src/features/auth/model/post-login-redirect.ts
```

当前 server auth 方式：

- 使用 Supabase SSR server client。
- 使用 `supabase.auth.getClaims()` 校验 session。
- 根据 auth user 查/补 `staff_profiles`。
- 查 `platform_admins` 判断平台管理员。
- 查 `store_memberships` 判断店铺权限。
- 未登录返回 401。
- 无店铺且路径不允许 pending store 时返回 forbidden。

权限重构注意：

- 不要用 `raw_user_meta_data` / user metadata 做权限判断。
- service role 只能在 server route/repository 使用。
- `allowPendingStore` 只应开放 onboarding/status、onboarding/request、platform 审批等必要路径。
- 低权限 viewer 不能保存设置、模板、导入、删除、员工管理。
- 店铺 owner 是店铺最高权限，不等于 platform admin。

## 9. UI / 设计系统规则

项目已有设计约束，重构必须遵守：

- 新页面先读 `docs/UI_PAGE_GENERATION_DECLARATION.md`。
- 新 reusable component 先读 `docs/COMPONENT_GENERATION_DECLARATION.md`。
- 改 layout/table/dialog/mobile 先读 `docs/RESPONSIVE_DENSITY_PLAN.md`。
- 颜色来源应集中在 `src/styles.css` token。
- 新 UI 优先使用 `src/lib/ui-patterns.ts` 和 `src/lib/component-patterns.ts` 的声明。
- 使用 lucide icons，不要手写常见图标 SVG。
- 后台系统优先高密度、高效率，不做营销 landing page。
- 页面级不能横向滚动。

响应式红线：

```txt
document.documentElement.scrollWidth <= window.innerWidth
```

桌面端：

- 高密度 table / grid table。
- 详情优先弹窗，不丢失列表上下文。
- 低频动作折叠到菜单。

移动端：

- 不强行塞桌面表格。
- 用三段式卡片。
- 弹窗接近全屏或独立详情页。
- 所有长文本必须 truncate 或 wrap，不能撑破 viewport。

当前 UI 风险：

- 旧 `src/routes/*` 内可能有硬编码颜色、旧布局、旧店铺名称。
- `src/styles.css` 之外仍可能存在 hardcoded `oklch()` 或主题色。
- 大屏/移动端都需要 Playwright screenshot 验证，不能只靠肉眼。

## 10. 当前最大技术债

### 10.1 超大文件

当前明显超过 `docs/ARCHITECTURE.md` 文件预算的文件：

```txt
src/features/orders/server/order.repository.ts              1369 lines
src/features/orders/components/order-overview-tab.tsx       1255 lines
src/features/inventory/screens/inventory-screen.tsx         1080 lines
src/features/inventory/server/inventory.repository.ts        973 lines
src/lib/repairdesk/types.ts                                  922 lines
src/server/api/repairdesk-schemas.ts                         576 lines
src/server/api/repairdesk-router.ts                          537 lines
src/features/settings/screens/settings-screen.tsx            635 lines
src/features/platform/server/platform.repository.ts          454 lines
src/routes/orders.index.tsx                                 1031 lines
```

项目目标预算：

- screen：最多 350 行
- form/dialog：最多 300 行
- presentational component：最多 220 行
- service/repository：最多 450 行

### 10.2 遗留 route 层

`src/routes/index.tsx` 和 `src/routes/orders.index.tsx` 仍被 App Router 间接使用。它们不是 Next.js App Router 文件，但承载了真实业务页面。

重构策略：

1. 先为当前 dashboard/orders list 补 characterization tests 或 Playwright smoke。
2. 把 `src/routes/index.tsx` 迁移到 `src/features/dashboard/screens/dashboard-screen.tsx` 的真实实现。
3. 把 `src/routes/orders.index.tsx` 拆到 `src/features/orders/screens`、`components`、`forms`。
4. 确认无引用后删除对应 legacy routes。
5. 其他 `src/routes/inventory.tsx`、`messages.tsx`、`settings.tsx` 等逐个确认是否死代码。

### 10.3 类型与 API 过度集中

问题：

- `src/lib/repairdesk/types.ts` 过大。
- `src/lib/repairdesk/api.ts` 覆盖所有 domain。
- `src/server/api/repairdesk-router.ts` 和 schema 文件持续增长。

建议：

- 按 domain 拆 type：
  - `features/orders/model/types.ts`
  - `features/customers/model/types.ts`
  - `features/inventory/model/types.ts`
  - `features/messages/model/types.ts`
  - `features/stores/model/types.ts`
- `src/lib/repairdesk/types.ts` 变成兼容 re-export，逐步清空。
- router/schema/service 也按 domain 拆。

### 10.4 Repository 混合职责

当前 repository 容易同时承担：

- SQL 查询
- row mapping
- DTO 拼装
- 业务校验
- audit payload
- event 写入
- transaction orchestration

建议分层：

```txt
repository queries: 只负责 DB 读写
mapper: DB row <-> domain DTO
service: 权限后的业务流程、状态机、事务
model: 纯规则和计算
audit helper: 统一 before/after/action/entity
```

### 10.5 测试缺口

已有单元测试包括：

- 登录后跳转规则。
- inventory 状态机。
- SeaTable electronics mapper。
- SeaTable repair mapper。
- order message templates。
- order tags。
- mock API 部分测试。

还需要补：

- API auth tests：未登录 401、viewer forbidden、owner/admin allowed。
- 多店铺隔离 tests：用户 A 不可读用户 B 店铺数据。
- platform admin tests：可审批 onboarding，但不可读其他店铺业务数据。
- audit tests：关键 mutation 必写 actor/store/entity/before/after。
- E2E：登录、创建工单、状态推进、收款、通知、创建库存、售出、设置模板。
- 视觉/响应式：主要页面 desktop/tablet/mobile 不横向溢出。

## 11. 推荐重构路线

### Phase 0：冻结行为与安全基线

目标：在改结构前，先把当前行为固定住。

任务：

- 跑完整质量门：
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
- 为当前核心页面加 Playwright smoke：
  - `/login`
  - `/`
  - `/orders`
  - `/orders/new`
  - `/customers`
  - `/inventory`
  - `/messages`
  - `/settings`
  - `/platform`
- 为当前 auth redirect 和 store shell 加集成测试。
- 盘点远端 public 表 RLS 状态，输出安全报告。
- 确认 `.env.local` 不进 Git。

验收：

- 所有现有测试通过。
- 有一份页面 smoke 报告。
- 有一份 DB/RLS 风险清单。

### Phase 1：清理 App Router 与 legacy routes

目标：让 `src/app` -> `features/*/screens` 真正成立。

任务：

- 迁移 `src/routes/index.tsx` 到 dashboard feature。
- 迁移 `src/routes/orders.index.tsx` 到 orders feature。
- 确认其他 `src/routes/*` 是否引用。
- 删除无引用旧 routes。
- 移除旧硬编码店铺名和旧颜色。

验收：

- `rg "from \"@/routes"` 无结果。
- `src/routes` 可删除或只保留明确标记的临时兼容文件。
- Dashboard/orders 页面行为不变。

### Phase 2：拆 API facade、router、schemas

目标：降低跨域耦合，不改变外部 API URL。

任务：

- 新建 domain router：
  - `src/server/api/orders-router.ts`
  - `customers-router.ts`
  - `inventory-router.ts`
  - `messages-router.ts`
  - `stores-router.ts`
  - `platform-router.ts`
- schema 按 domain 拆。
- `repairdesk-router.ts` 保持兼容入口。
- client api 按 domain 拆，`@/lib/repairdesk/api` 保留 re-export。

验收：

- 前端 import 不需要一次性大改。
- API path 契约不变。
- TypeScript 无循环依赖。

### Phase 3：拆类型与模型

目标：把 `src/lib/repairdesk/types.ts` 从万能类型桶变成兼容层。

任务：

- 按业务域移动类型。
- 状态机、金额、日期、标签、模板变量等纯逻辑放 model/shared。
- 增加 domain index exports。
- 限制跨 feature deep import。

验收：

- `types.ts` 明显变小。
- 新代码从 feature/entity/shared 引入类型。
- 测试覆盖纯 model。

### Phase 4：拆订单大文件

目标：让订单模块可维护。

任务：

- 拆 `order-overview-tab.tsx`：
  - financial summary
  - customer/device panel
  - approval panel
  - timeline panel
  - notification panel
  - print panel
- 拆 `order.repository.ts`：
  - order queries
  - order mutations
  - order event writer
  - order mapper
  - finance helpers
- 把 `src/routes/orders.index.tsx` 迁移为真正的 `order-list-screen`。

验收：

- 单文件行数接近架构预算。
- 创建、编辑、状态推进、收款、通知、打印不回归。

### Phase 5：拆库存回收大文件

目标：把新业务闭环变成稳定域模型。

任务：

- 拆 `inventory-screen.tsx`：
  - KPI strip
  - filter bar
  - status tabs
  - dense table
  - mobile cards
  - item detail
  - intake dialog
  - check dialog
  - transition dialog
  - listing/sell dialogs
- 拆 `inventory.repository.ts`：
  - item queries
  - item commands
  - quality check commands
  - transaction commands
  - import persistence
  - mapper/profit helpers
- 强化状态机和利润计算测试。

验收：

- 回收到售卖完整流程通过单元测试和手动流程。
- 状态非法流转有明确错误。
- 利润计算一致。

### Phase 6：设置、消息、员工/门店管理

目标：把后台配置做成可扩展管理中心。

任务：

- 拆 `settings-screen.tsx`。
- 确认 store settings 与 message templates repository 边界。
- 增加成员管理 UI：
  - 店铺成员列表
  - 邀请员工
  - 改角色
  - 停用成员
- viewer 只读。
- platform admin 只看平台审批，不进入其他店铺成员管理。

验收：

- owner 可以管理当前店铺设置/成员。
- 普通员工只看到自己权限范围。
- 所有设置变更写 audit。

### Phase 7：DB/RLS hardening

目标：解决远端旧表和 RLS 风险。

任务：

- 对所有 public 表分类：
  - active app table
  - legacy read-only table
  - import staging table
  - unused table
- 对 active app table 检查：
  - RLS enabled
  - store_id not null
  - foreign key
  - select/update/insert/delete policies
- 对 legacy 表决定：
  - 迁移到 private schema
  - 启用 RLS
  - 归档
  - 删除
- 检查 views 是否需要 `security_invoker = true`。

验收：

- public schema 无未知未保护客户数据表。
- 多店铺隔离有自动测试。

### Phase 8：E2E、视觉验证与 CI

目标：让后续重构不会靠人工祈祷。

任务：

- Playwright 覆盖关键用户流：
  - 登录
  - onboarding 申请
  - platform 审批
  - 创建工单
  - 工单状态推进/收款/通知
  - 客户详情
  - 创建库存回收记录
  - 库存检测/上架/售出
  - 修改模板和设置
- 加响应式无横向溢出断言。
- CI 跑 lint/typecheck/test/build/e2e smoke。

验收：

- 主分支每次合并前自动验证。
- 主要页面桌面/移动截图不崩。

## 12. 角色与权限建议表

| 角色 | 范围 | 可以做什么 | 不可以做什么 |
| --- | --- | --- | --- |
| platform_admin | 平台 | 审批创建/加入店铺申请，查看平台审计 | 默认不能看所有店铺业务数据 |
| owner | 单店 | 当前店铺最高权限，设置、成员、业务全部管理 | 不能管理其他店铺，除非另有 membership |
| admin | 单店 | 大多数业务管理，可能含员工管理 | 不能转移 owner |
| manager | 单店 | 工单、客户、库存、设置部分管理 | 不能高危成员/权限操作 |
| staff | 单店 | 日常工单、客户、库存操作 | 不能管理权限/高级设置 |
| viewer | 单店 | 只读查看 | 不能保存、导入、删除、改设置 |

后续必须明确每个 API endpoint 的最低角色，并写成测试。

## 13. 当前工作区注意事项

截至本文档创建时，工作区存在一批未提交变更，主要来自最近的登录/平台入口/店铺显示功能：

```txt
src/components/app-bar.tsx
src/components/app-sidebar.tsx
src/components/command-palette.tsx
src/components/top-nav.tsx
src/features/auth/screens/login-screen.tsx
src/features/auth/model/post-login-redirect.ts
src/features/auth/model/post-login-redirect.test.ts
src/features/stores/api/use-store-shell-context.ts
screenshots/
```

这些变更此前已经通过：

```txt
npm run lint
npm run typecheck
npm run test
npm run build
```

其中 build 在受限沙箱下可能需要非沙箱执行，因为 Next/Turbopack 会绑定本地端口。

重构前建议先决定：

- 是否提交这些变更。
- 是否把 `screenshots/` 加入或忽略。
- 是否把当前分支推送后再开新重构分支。

## 14. 重构验收总标准

任意阶段完成都必须满足：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

涉及 UI 或流程的阶段还必须：

```bash
npm run test:e2e
```

涉及数据库/权限的阶段还必须验证：

- 未登录请求返回 401。
- 无店铺用户只能进入 onboarding 或允许的 platform route。
- 普通员工不能访问平台审批。
- 平台管理员不能默认读取其他店铺业务数据。
- viewer 不能写设置、模板、导入、删除、成员管理。
- 所有核心 mutation 写审计。
- 不同 store 的客户、工单、库存不可串数据。

涉及响应式的阶段还必须验证：

- 375px mobile
- 768px tablet
- 1280px desktop
- 1440px+ desktop
- 无页面级横向滚动
- 弹窗不超出 viewport
- 长文本不撑破卡片/table

## 15. 最重要的重构原则

1. 先保护行为，再移动代码。
2. 先补 characterization tests，再拆大文件。
3. 保持 API path 和数据库语义稳定，逐步迁移内部结构。
4. 权限只信数据库里的 membership/platform_admin，不信前端状态。
5. 平台管理员和店铺 owner 是两个不同概念。
6. service role key 永远只在服务端。
7. 多店铺隔离是底线，不是 UI 功能。
8. 审计日志是业务能力，不是可选日志。
9. 新 UI 必须服务维修店高频操作，不做装饰性 landing page。
10. 删除旧代码前先证明无引用、无数据依赖、无业务依赖。
