---
schema_version: 1
task_id: "TASK-20260831-002-i18n-deep-ui-release-a"
title: "深层员工界面中意英未翻译审计与 Release A"
status: "completed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "Hexiang Huang / 鹤祥"
departments: ["Documentation", "Frontend", "Product", "QA", "Release", "Security", "UX"]
created_at: "2026-08-31T15:45:25Z"
updated_at: "2026-08-31T19:46:04Z"
---
# Task — 深层员工界面中意英未翻译审计与 Release A

## Owner request

继续检查未翻译界面，整理报告并按报告规划、设置目标、实施、推送和部署。

## Business value

降低员工界面混合语言风险，形成可重复审计基线并发布首批高价值深层界面中意英覆盖。

## Scope in

- 生成可重复的未翻译员工 UI 审计报告，记录基线、生产可达性、误报/漏报、优先级和后续批次。
- Release A：Dashboard 快捷/优先区与 `/orders` 工单列表工作台的 UI-owned 文案、ARIA、Toast、加载/空/错/离线/回滚/权限/批量反馈和 locale-aware 列表日期。
- 同一展示范围内，从业务模型导入的默认系统标签、队列提示、任务指导、财务状态和 Dashboard 优先级指导必须通过稳定 code/已知系统文案做 display-only 本地化；店铺自定义标签与动态业务数据保留原文。
- 仅在展示层翻译默认系统状态；URL、状态码、查询值、权限、API payload 和持久化值保持不变。
- 三语定向测试、Chromium/WebKit 受控 mock 浏览器验证、响应式截图、全量 lint/typecheck/test/build。
- 经门禁通过后，正常提交、非强制推送 `main`，并部署既有 `chinatech-codex` Vercel 生产项目。

## Scope out

- `/orders/new`、`/orders/[id]`、`/orders/[id]/task` 的正文和交互。
- Customers、Inventory、Buyback、Settings 及其他深层领域页面。
- 客户固定意大利语 `/r`、`/kiosk`，以及打印/PDF/通知/票据/保修/协议/法律文案。
- 店铺名、客户名、备注、设备、维修项目、供应商、自定义流程名等动态业务数据。
- API、数据库、schema、migration、认证、权限、租户、依赖、环境变量、部署配置、生产数据写入。
- force push、新 Vercel 项目或生产域切换；这些均不在本合同内。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 单一 `gpt-5.6-luna` 写入者拥有冻结 allowlist；其他部门只读，主线程保留集成、提交、推送和部署权。
- 运行时审查发现源码扫描无法捕获 model/config 导入的固定中文后，allowlist 仅扩充 `src/features/orders/model/order-i18n.ts`、一个最小 Dashboard priority display adapter、相应测试，以及 `src/components/orders/badges.tsx` 与 `DeviceUnlockListBadge` 的向后兼容 optional label 接口；业务 model 及解锁编辑/查看正文仍禁止修改。
- Chromium 坐标证据证明 Orders 页滚动后语言 trigger 位于视口外（`y=-234.5`），`locator.click()` 在 pointer 事件前自动滚回顶部。这是测试驱动器行为，不支持扩大共享组件修改；`src/components/language-switcher.tsx` 及其测试从本批新增 allowlist 中撤回。Orders 状态 E2E 直接派发 Radix 使用的 pointer 事件，仍严格证明切换后恢复原始滚动位置。
- 语言切换不得 reload、重挂载列表、改变 URL、搜索、非默认筛选、页码、视图、选中项或滚动位置。移动筛选 modal 打开时外部切换器不可达，不为构造无效路径改变 focus trap。
- 仅使用受控 mock workspace 做 mutation 状态展示；不得执行真实创建、批量流转、打印或客户通知。

## Acceptance criteria

- [x] `docs/I18N_UNTRANSLATED_UI_AUDIT.md` 含方法、5,839/4,213 基线、可达性、误报/漏报、Top 10、优先级、排除项和 Release B+ 路线图。
- [x] Release A allowlist 内所有 UI-owned 文案接入 typed catalog；残留汉字逐项列入有理由的例外清单。
- [x] `zh-CN` 基线不变；`it-IT`/`en` 的 Dashboard 与 Orders Queue 无未登记中文混杂，默认系统状态为 display-only 本地化。
- [x] 切换语言后 URL、搜索、非默认筛选、第 2 页、选中项和滚动保持；请求参数、状态码、权限和业务数据不变。
- [x] Loading、empty、搜索无结果、首次失败、后台刷新失败、离线有/无缓存、权限受限、批量成功/部分失败均有自动化或受控 mock 证据。
- [x] `390 / 768 / 1440` 无横向溢出；Chromium/WebKit 目标 E2E 通过并保存至少意大利语桌面、英语移动、中文中尺寸三张截图。
- [x] lint、typecheck、全量 test、build、diff 检查及独立 QA/安全/架构复核通过。
- [x] 最终应用提交 SHA = `origin/main` SHA = Vercel 部署 Git SHA；正式别名 2xx、READY、错误日志和回滚锚点已验证。关闭证据提交仅含任务记忆，并在 Registry/Goal 关闭前单独复核其 Git deployment。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Git baseline | observed | `git rev-parse HEAD`; `git status --short --branch` | `fdeb7b13`, clean before task memory |
| Existing audit baseline | observed | `node scripts/audit-i18n-ui-text.mjs --summary` | 5,839 occurrences / 4,213 unique |
| Audit is not a defect count | observed | script AST semantics + two independent reviews | report must classify false positives and reachability |
| Release A boundary | decided | Product/UX and code-audit cross-question consensus | Dashboard + Orders Queue only |
| External research | decided | repository-local current implementation is authoritative | not required |
| Production release authority | observed | latest Owner request: push and deploy after completion | existing project only; quality gates retained |

## Decision and approval points

- T3 / R3 / L2: cross-module user-visible localization with authorized production release.
- Owner has approved normal commit, non-force push and deployment to the existing Vercel project after gates pass.
- Stop and request a new packet for API/schema/auth/permission/tenant/persistence/dependency/env/config/secret/customer-output coupling.
- D3/D4 retained: no force push, destructive action, production data change, new deployment target or legal/customer-content translation.

## Work packages

- WP-1 complete: independent code inventory and production reachability audit.
- WP-2 complete: independent Product/UX/QA prioritization and state matrix.
- WP-3 complete: one bounded cross-question pass; both reviewers converged on Dashboard + Orders Queue.
- WP-4 complete: single Luna writer — report, catalog, frozen application allowlist and focused tests.
- WP-5 complete: independent QA, security and fresh current-candidate architecture/UX reviews plus full local/browser gates passed; stable no-dev-overlay screenshot evidence was refreshed after dual-engine 10/10 reruns.
- WP-6 complete: Integration Lead committed and non-force pushed the reviewed application candidate; the existing Vercel Git integration deployed the exact SHA to READY production aliases; HTTP, auth redirect, runtime error log and rollback checks passed; closeout memory is synchronized.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
- Registry run/task and Goal are closed only after remote/deployment evidence is recorded.

## Closure

- Application commit: `cb13b7125fad9ab7c507f6a15f5a46f259a4780f`.
- Production deployment: `dpl_8MT1dcNE2TD3qQYZ8uS49NzxRoDv` (`READY`).
- Production URL: `https://www.chinatech.in`.
- Rollback anchor: `dpl_3RdXnkLLsoH1S8hJZZT1GGGBGvkf` at `fdeb7b13e8c9757911bd4e21f37c34497ed6941e`.
- The final closeout commit contains task memory only. Its automatic Git deployment must be observed at the exact final SHA before Registry and Goal closure; no further source or evidence-file edit is required after that external verification.
