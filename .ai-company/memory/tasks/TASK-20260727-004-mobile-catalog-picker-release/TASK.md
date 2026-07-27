---
schema_version: 1
task_id: "TASK-20260727-004-mobile-catalog-picker-release"
title: "移动端库存目录选择器无键盘稳定滚动与生产发布"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["UX", "FE", "QA", "INT"]
created_at: "2026-07-27T02:12:08Z"
updated_at: "2026-07-27T02:31:35Z"
---
# Task — 移动端库存目录选择器无键盘稳定滚动与生产发布

## Owner request

在手机端库存入库的品牌/型号选择器中，点击字段后不要自动弹出键盘，先直接展示可滑动目录列表；顶部保留搜索和手动输入，只有主动点击输入框才打开键盘。修复相关滚动、键盘和响应式问题，完成后推送 `main` 并部署生产。

## Business value

让门店员工在 iPhone、Android 和触摸平板上可以稳定浏览、搜索并手动录入手机品牌/型号，避免键盘抢焦点、列表无法滑动、页面跳动和误选，且不破坏桌面库存录入。

## Scope in

- 在既有固定移动选择面板上阻止打开时自动聚焦搜索输入。
- 打开后立即展示完整目录列表；顶部保留搜索/手动输入。
- 修复列表与抽屉拖拽、背景页面和软件键盘之间的触摸滚动冲突。
- 保持品牌、型号、内存、容量、颜色、手动值和级联清理逻辑不变。
- 保持桌面端锚定 Popover 行为不变。
- 增加焦点、真实滚动、响应式、手动输入和桌面回归证据。
- 推送到 `main`，部署生产并执行只读冒烟验证。

## Scope out

- Any work not required by the acceptance criteria.
- 不修改欧洲手机目录内容、库存业务规则、数据库、API、权限或依赖。
- 不重构全局 Drawer/Popover，除非局部实现无法满足验收且需记录 Plan Delta。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 移动端真实输入控件字号保持至少 16px；触控目标至少 44px。
- 使用隔离工作树 `/private/tmp/repairdesk-mobile-catalog-popover-scroll-20260727`，不得覆盖主工作区未提交改动。
- Owner 已在 2026-07-27 明确批准推送 `main` 与生产部署。

## Acceptance criteria

- [x] 手机/触摸平板点击品牌或型号字段后，固定选择面板打开，搜索输入未获得焦点，软件键盘不应被网页主动唤起。
- [x] 面板打开后立即显示完整目录列表；顶部搜索/手动输入始终可见，只有主动点击输入才获得焦点。
- [x] 目录列表可真实纵向滚动且滚动归列表所有；背景页面不滚动，面板位置不跳动，最后一个选项可到达并选择。
- [x] 搜索、清空、无结果、使用手动输入、选择现有目录项、关闭/返回均保持现有业务语义。
- [x] 手机 390/430、iPad/触摸平板和桌面 1440 关键路径无横向溢出；桌面继续使用 Popover。
- [x] 相关单元/E2E、lint、typecheck、完整 test、build 与 `git diff --check` 通过。
- [x] 生成移动端可视截图；推送 `main` 后生产部署 Ready，并完成生产只读页面冒烟。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 线上截图仍呈现锚定下拉选择器 | observed | Owner 提供的 `chinatech.in` 手机截图 | 旧交互仍影响真实设备 |
| 本地分支已有固定 Drawer 实施 | observed | commits `bd8573b0`, `89e2b1f8` | 作为本任务基线继续修正 |
| 当前移动 Drawer 内第一个可聚焦控件是 `CommandInput` | observed | `inventory-phone-catalog-fields.tsx` | 需显式阻止打开自动聚焦 |
| 旧 E2E 通过脚本设置 `scrollTop` | observed | `tests/e2e/inventory-mobile-catalog-scroll.spec.ts` | 不足以证明真实指针/触摸滚动，需补强 |
| 真机系统键盘无法由桌面 Playwright 完整模拟 | observed | 浏览器自动化能力边界 | 自动证据加生产后 Owner 真机 smoke |

## Decision and approval points

- **Classification:** T2 / R2 / L2。实现是局部、可逆的 UI 修复，无数据/API/权限变化；生产发布提升了用户影响，需要完整门禁、集成 lease、可执行回滚和上线冒烟。
- **D1/D2:** 组件焦点、滚动容器、局部样式和测试实现由 Integration Lead 在批准方案内决定。
- **D3:** 推送 `main` 与生产部署为保留动作，Owner 已在当前指令明确批准。
- **Rollback:** 回退本任务发布提交并重新部署前一生产版本；无数据库或数据恢复步骤。
- **No-spawn reason:** 本任务集中在单一组件和同一测试切片，多个写入者会增加冲突；用户本轮未要求子代理，UX/FE/QA 由主线程按独立阶段复核。

## Work packages

- WP1：补齐手机/触摸平板固定选择面板的无自动焦点和单一滚动所有权。
- WP2：补充焦点、手动输入、真实滚动、平板和桌面回归测试与截图。
- WP3：运行完整质量门禁、检查最终 diff、同步任务记忆。
- WP4：获取集成 lease，推送 `main`，部署生产，执行只读冒烟与回滚准备。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
