# RepairDesk 未提交改动拆包与完善规划

生成时间：2026-07-08

## 当前结论

当前工作区不能直接整体推送。

- 当前分支：`main`
- 与 `origin/main` 关系：远端领先 4 个提交，本地领先 1 个提交
- 暂存区：空
- `git status --porcelain` 行数：485
- 已跟踪修改：95 个文件
- 未跟踪文件：1476 个实际文件
- 代码/数据库统计：`95 files changed, 3706 insertions(+), 861 deletions(-)`

关键风险：

- 本地 `main` 与 `origin/main` 已分叉。远端已有 `a5a47dd Fix auth recovery and onboarding schema drift`，本地还有不同 SHA 的 `5673ee7 Fix auth recovery and onboarding schema drift`。
- 工作区同时混有 UI、订单业务、开户注册、离线同步、数据库迁移、AI Company OS 文档、截图与导出产物。
- 直接 `git add . && git push main` 会把大量无关产物和治理文件一起推上去，风险高。

## 已改但未提交的主要源代码

### 认证 / 注册 / 平台开户注册

- `src/features/auth/model/onboarding-flow.ts`
- `src/features/auth/screens/onboarding-screen.tsx`
- `src/features/platform/model/onboarding-review-policy.ts`
- `src/features/platform/model/onboarding-review-policy.test.ts`
- `src/features/platform/server/platform.repository.ts`
- `src/features/platform/server/platform.repository.test.ts`
- `src/features/stores/server/store.repository.ts`
- `src/features/stores/server/store.repository.test.ts`
- `src/server/auth-context.ts`
- `src/server/tenant-guard.test.ts`

相关未跟踪新文件：

- `src/features/stores/api/tenant-cache.ts`
- `src/features/stores/api/tenant-cache.test.ts`
- `src/features/stores/server/store-provisioning.ts`
- `src/server/api/repairdesk-request-guard.ts`
- `src/server/api/repairdesk-request-guard.test.ts`
- `src/server/repairdesk-source-mode.ts`
- `src/server/repairdesk-source-mode.test.ts`
- `src/server/staff-display-name.ts`
- `src/server/staff-display-name.test.ts`

### 订单 / 新建工单 / 工单列表 / 工单详情相关

- `src/features/orders/forms/new-order-customer-device-section.tsx`
- `src/features/orders/forms/new-order-quotation-section.tsx`
- `src/features/orders/model/new-order-form.ts`
- `src/features/orders/model/order-italian.ts`
- `src/features/orders/screens/new-order-screen.tsx`
- `src/features/orders/screens/order-list-screen.tsx`
- `src/features/orders/server/order.repository.ts`
- `src/features/orders/components/accessory-notes-picker.tsx`
- `src/features/orders/components/order-list-filters.tsx`
- `src/features/orders/components/order-workspace-primitives.tsx`
- `src/features/orders/components/warranty-picker.tsx`
- `src/components/orders/fault-diagnosis-picker.tsx`
- `src/routes/orders.index.tsx`

相关测试：

- `src/features/orders/components/order-option-pickers.test.tsx`
- `src/features/orders/model/order-message-templates.test.ts`
- `src/features/orders/testing/mock-api.test.ts`

相关未跟踪新测试：

- `src/features/orders/model/new-order-form.test.ts`
- `src/features/orders/server/order.repository.test.ts`

### 离线同步 / 数据合同

- `src/features/offline/server/offline-sync-contract.ts`
- `src/features/offline/server/offline-sync-contract.test.ts`
- `src/features/offline/server/offline-sync-service.ts`
- `src/features/offline/server/offline-sync-service.test.ts`

相关未跟踪：

- `src/features/offline/server/offline-sync-rpc-draft.test.ts`

### 客户 / 库存 / 消息 / 回收 / 设置 / 概览

- `src/features/customers/components/customer-list-items.tsx`
- `src/features/customers/server/customer.repository.ts`
- `src/features/customers/server/customer.repository.test.ts`
- `src/features/inventory/server/inventory.repository.ts`
- `src/features/messages/server/message-settings.repository.ts`
- `src/features/buyback/components/buyback-quote-workspace.tsx`
- `src/features/buyback/model/apple-price-guide.test.ts`
- `src/features/settings/screens/settings-screen.tsx`
- `src/features/dashboard/screens/dashboard-screen.tsx`

相关未跟踪测试：

- `src/features/inventory/server/inventory.repository.test.ts`
- `src/features/messages/server/message-settings.repository.test.ts`

### App Shell / 设计系统 / API 层

- `src/app/api/repairdesk/[...path]/route.ts`
- `src/components/app-bar.tsx`
- `src/components/app-sidebar.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/sidebar.tsx`
- `src/lib/component-patterns.ts`
- `src/lib/repairdesk/types.ts`
- `src/lib/ui-patterns.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/api/repairdesk-router.test.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/server/api/repairdesk-schemas.test.ts`
- `src/server/repairdesk-shared.ts`

## 数据库迁移状态

已跟踪修改：

- `supabase/migrations/20260707090000_repairdesk_offline_operations.sql`

未跟踪新迁移：

- `supabase/migrations/20260707110000_repairdesk_offline_order_sync_rpc_draft.sql`

已存在并已用于修复生产 schema 的迁移：

- `supabase/migrations/20260708140001_repairdesk_onboarding_schema_reconcile.sql`

注意事项：

- `20260707110000_repairdesk_offline_order_sync_rpc_draft.sql` 文件头标注为本地审批草稿，不应直接推到生产。
- 生产 `onboarding_requests.review_scope` 报错已经通过 schema reconcile 修复，但本地迁移历史和远端迁移历史仍要在提交前重新做 dry-run。
- 任何涉及 store 自动创建、会员自动加入、RLS、RPC、离线同步的迁移必须单独验证，不应混在纯 UI 提交里。

## 文档 / 治理 / 产物改动

已跟踪文档和治理文件大量修改，包括：

- `.agents/*`
- `.ai-company/memory/*`
- `AGENTS.md`
- `AI智能部门管理/*`
- `docs/*`
- `scripts/agents/check-agent-config.mjs`
- `.gitignore`

未跟踪产物规模很大：

- `.ai-company/` 下大量新治理文件
- `.agents/skills/` 与 `.agents/runs/`
- `exports/`
- `screenshots/`
- `.codex/`
- `artifacts/`
- `tsconfig 2.tsbuildinfo`

建议：

- 截图、导出报告、运行日志默认不进入产品提交，除非是明确的交付物。
- AI Company OS 和业务代码分开提交，避免一次提交同时改变应用行为和工作制度。

## 建议提交包

### P0-A：分支与工作区保护

目标：先解决本地 `main` 与 `origin/main` 分叉，防止误推。

动作：

- 不在当前脏工作区执行 reset/rebase。
- 新建干净 worktree 或临时分支，从 `origin/main` 拆包挑选改动。
- 对每个包独立验证、独立提交。

验收：

- `git status --short` 可解释。
- 本地待提交文件只包含当前包需要的文件。

### P0-B：认证登录与开户链接自动通过

目标：解决“员工账号不能登录”和“注册店铺无需平台审批，直接可用”的核心业务闭环。

范围：

- Auth 登录错误展示和恢复提示。
- 用户注册后自动创建店铺或自动加入目标店铺。
- 店铺 owner / technician / viewer 显示名统一，例如 `kyox120@gmail.com` 展示为 `Alessio`。
- 平台审批页只保留异常/人工处理场景，不阻塞正常开户注册。

涉及文件：

- `src/features/auth/*`
- `src/features/platform/*`
- `src/features/stores/*`
- `src/server/auth-context.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/staff-display-name.ts`
- `src/features/stores/server/store-provisioning.ts`
- `supabase/migrations/20260708140001_repairdesk_onboarding_schema_reconcile.sql`

需要补充验证：

- 账号存在但密码错误时，显示可操作提示。
- 账号不存在时，注册流程自动创建店铺并进入工作台。
- 已有邀请/申请时，不重复创建店铺和 membership。
- 非 owner 不能访问平台管理员功能。

### P1-C：订单与新建工单前台工作流

目标：把已经做的订单 UI 和业务逻辑整理成一个可上线包。

已覆盖需求：

- 新建订单设备信息移动到客户信息下方，手机密码单独保留。
- 报价金额层级增加配色。
- 品牌/型号/质保/留存/状态等下拉修复可点击。
- Apple 全系列型号选项。
- 空客户姓名不再自动补“客户”。
- 故障与诊断维修项目扩展。
- 工单详情弹窗尺寸向新建订单大工作台统一。
- 订单页阶段队列和搜索工具条合并。
- 顶部风险统计移到概览。

需要补充验证：

- 下拉菜单 z-index、pointer events、键盘选择。
- 新建工单保存后订单列表实时更新。
- 配件供应商选择后无需刷新即可显示。
- 订单详情和列表的 React Query cache 同步。
- 移动端底部提交栏不遮挡表单。

### P1-D：离线同步与草稿

目标：让本地草稿、离线创建和线上同步有明确边界。

范围：

- `offline-sync-contract`
- `offline-sync-service`
- draft RPC 迁移
- offline order 操作迁移

风险：

- 目前有一个 draft migration 明确标注不要直接应用生产。
- 离线同步要验证幂等、冲突、重复提交、权限和失败重试。

建议：

- 先保留为实验包。
- 通过测试和本地 Supabase 验证后再转正式迁移。

### P1-E：客户 / 库存 / 消息 / 回收报价

目标：合并较小但面向前台效率的改动。

范围：

- 客户列表姓名/电话层级优化。
- 回收报价 Apple 系列从新到旧排序。
- 库存、消息设置 repository 测试补齐。
- 概览页承接订单风险统计。

验收：

- 客户列表在桌面和移动端信息层级清楚。
- 回收报价 iPhone 系列顺序从新到旧，从左到右。
- 对应 repository tests 通过。

### P2-F：App Shell 与设计系统

目标：把公共布局控件稳定下来。

范围：

- 桌面侧边栏可折叠。
- `AppBar` / `AppSidebar` / `ui-patterns` / `component-patterns`。
- `Select` / `DropdownMenu` 交互底层修复。

建议：

- 作为公共 UI 包单独提交。
- 提交前跑订单页、新建工单、客户页、平台页的浏览器截图验证。

### P2-G：AI Company OS / 文档治理

目标：整理项目规则、部门化管理、任务记忆和文档漂移。

建议：

- 与业务代码分开提交。
- 优先只提交确实会影响后续执行的规则文件。
- 大量历史任务记忆、截图、导出文件不要默认进入 main。

## 项目还需要完善的逻辑

### 数据库

1. 建立迁移发布 SOP：每次上线前固定执行 migration dry-run、生产 schema 对照、迁移历史修复记录。
2. `onboarding_requests` 继续收敛为两类：自动通过开户注册、人工异常审批。
3. 自动建店流程需要数据库级唯一约束：同一 owner email 不应重复产生多家默认店。
4. 离线同步需要正式 RPC 合同：幂等 key、冲突策略、失败记录、重放窗口、权限边界。
5. 订单配件供应商字段要确保有单一真源：列表、详情、新建、编辑和实时更新全部读写同一字段。

### 认证与权限

1. 登录失败要区分：账号不存在、密码错误、邮箱未确认、账号未加入店铺、店铺未完成初始化。
2. 注册店铺默认自动通过，但平台管理员仍要能看到审计记录。
3. staff display name 独立于角色显示：面向客户打印时显示 `Alessio` 这类意大利语姓名，不显示“最高管理员”。
4. 每个 API route 统一走 request guard，避免 mock/source mode 和真实 Supabase 混用。

### 订单功能

1. 配件供应商选择要做 optimistic update，并在成功后 invalidate/list/detail cache。
2. 新建工单的设备、故障、报价、质保、留存、状态要统一走表单模型，避免 UI 有值但提交丢失。
3. 工单详情、编辑、新建使用同一组选项数据源：品牌型号、服务项目、质保、留存、员工名。
4. 报价变化后审批状态需要明确重置规则。
5. WhatsApp / 打印模板要使用客户可读的员工显示名和意大利语服务名。

### 前台效率

1. 客户电话搜索后，如果没有姓名，姓名字段保持空，不自动生成“客户 + 电话”。
2. Apple 型号库需要持续维护，并支持常见别名大小写。
3. 故障项目细分建议按门店常用语整理：屏幕、电池、尾插、摄像头、进水、主板、系统解锁、后盖、面容/指纹、扬声器、麦克风、按键。
4. 桌面端弹窗统一为大工作台，移动端保持底部安全区和可滚动区域。

### 质量与发布

推荐每个提交包执行：

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

涉及 UI 的包额外执行：

- 本地预览订单页、新建工单、工单详情、客户页、回收报价、平台页。
- 截图留证。

涉及数据库的包额外执行：

- `supabase db push --linked --dry-run`
- 生产 schema 精确查询验证。
- 回滚说明。

## 建议下一步

第一步不要直接推当前工作区。

推荐执行顺序：

1. 从 `origin/main` 创建干净 worktree。
2. 先合并 P0-B 认证/开户注册/平台 schema 包。
3. 跑认证、平台、店铺相关测试和构建。
4. 推送 main。
5. 再按 P1-C 订单 UI 业务包、P1-E 客户/回收小包、P1-D 离线同步包依次处理。

需要老板确认的审批点：

- 是否允许我在干净 worktree 中按上述 P0-B 包挑选文件、验证、提交并推送 main。
- `20260707110000_repairdesk_offline_order_sync_rpc_draft.sql` 是否继续保持本地草稿，不进入生产。
