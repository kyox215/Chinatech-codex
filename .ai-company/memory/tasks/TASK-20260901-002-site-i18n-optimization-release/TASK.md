---
schema_version: 1
task_id: "TASK-20260901-002-site-i18n-optimization-release"
title: "完成 RepairDesk 中意英界面本地化并发布"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "Hexiang Huang / Owner"
departments: ["ARCH", "DOC", "FE", "PRODUCT", "QA", "RELEASE", "SEC", "UX"]
created_at: "2026-09-01T07:54:13Z"
updated_at: "2026-09-04T08:00:00Z"
---

# Task — 完成 RepairDesk 中意英界面本地化并发布

## Current objective

把已经完成并通过直接 i18n 审查的 RepairDesk 员工端中文、意大利语、英语候选，按精确范围提交到 `main`，通过最终发布门禁，部署到现有 Vercel 生产项目，并验证确切 SHA、正式域名和回滚锚点。

## Authority and precedence

- Owner 的最新指令为准：在收到“批准单独发布当前 i18n 候选”的请求后，Owner 于 2026-09-03 回复 `批准`。
- 当前 Registry 绑定：project `repairdesk-chinatech`，task `TASK-20260901-002-site-i18n-optimization-release`，run `RUN-20260901-002-OPT-I18N-REL-001`，window `WINDOW-01A05709-OPT-I18N-REL-20260901`，role `integration_lead`。
- 本文件是当前可执行合同；完整历史正文保存在 `TASK_HISTORY_PRE_RELEASE_20260903.md`，证据索引在 `EVIDENCE.md`，检查点在 `CHECKPOINTS.md`。
- 只有持有有效项目 integration lease 的当前窗口可以暂存、集成、提交、推送、部署或做最终完成声明。

## Superseding lightweight i18n scope

### In scope

- 员工界面的 `zh-CN`、`it-IT`、`en` 文案、语言切换、i18n metadata/output/parity。
- 因本地化文本直接引起的响应式或可访问性问题，以及相应测试。
- 已完成并审查的员工域批次：Orders New/Task、Order Detail、Customers、Inventory、Buyback、Settings、Messages、Finance、Memos、Toolkit、Platform、AI client presentation。
- 客户公开路由的固定意大利语契约及其 CI/浏览器回归门禁。
- 与上述候选直接相关的源码、测试、文档、任务记忆和脱敏截图证据。

### Out of scope

- 新的业务逻辑、权限或能力变更、订单工作流、缓存架构、AI 行为/API/tool contracts、协议幂等性、依赖升级、运行时迁移或广泛重构。
- 数据库/schema/migration、环境变量、secret、生产/客户数据写入、新服务、新域名或 force push。
- `.ai-company/memory/tasks/TASK-20260902-001-project-function-health-audit/` 及其他不属于本任务的用户改动。
- 已删除的实验性 `tests/e2e/i18n-final-four-release-2b6.spec.ts` 和本地 `test-results/` 失败残留。

## Completed implementation and evidence summary

- Release 1 已在生产验收：`7d1b59c5e8e61b654beb329444ec1fef03cda2c3`。
- Release 2A Scanner/Camera 与相邻 Orders 固定文案已在生产验收：`5edab21d75c540cd16b32e87683edb1d72a7a5dd`；hosted run `33560282833`，deployment `dpl_6eEWtvZQAGw1JSkXeX9gDAuyuUdp` 为 green/READY。
- Release 2B 本地候选完成员工端深层 i18n：Orders New/Task、Order Detail、Customers、Inventory、Buyback、Settings、Messages、Finance、Memos、Toolkit、Platform、AI client presentation。
- 动态业务值、标识符和 canonical enum/data 保持不翻译；客户公开路由继续固定意大利语，不覆盖员工 locale Cookie。
- Memos Rome delta 保留为已完成历史本地工作；当前发布不再扩展其业务、安全或幂等性范围。

### Final four verification

- Memos、Toolkit、Platform、AI client 共 13 个目标测试文件、84 个测试通过；stderr/React act warning 为 0。
- TypeScript、scoped ESLint、Prettier 和 diff 检查通过。
- 独立 QA 对直接 i18n 范围复核后 P0/P1 为 0。
- 浏览器证据：Memos、Toolkit 通过；Platform、AI 已覆盖 locale、390/1440、动态值、ARIA 与 overflow，但因非 i18n 的 Escape focus-return P2 停止在后续断言之前。该 P2 已记录到项目 backlog，不是本次直接 i18n 发布阻断项。
- 脱敏截图：
  - `screenshots/release2b6/chromium/memos-it-IT-390.png`
  - `screenshots/release2b6/chromium/toolkit-it-IT-1440.png`
  - `screenshots/release2b6/chromium/platform-it-IT-390.png`
  - `screenshots/release2b6/chromium/ai-trace-zh-CN-390.jpeg`
- 详细证据见 `EVIDENCE.md` E-001 至 E-094、`CEO_REPORT.md` 和 `CAPABILITY_REVIEW.md`。

## Owner release approval — 2026-09-03

- **Decision:** Owner 回复 `批准`，批准单独发布当前 i18n 候选。
- **Authorized:** 核对精确候选范围；取得并复核 integration lease；运行相称的最终门禁；创建普通提交；非强制推送 `main`；部署现有 Vercel 生产项目；验证确切 SHA、正式域名并记录回滚证据。
- **Not authorized:** database/schema/migration、环境或 secret 变更、生产或客户数据写入、force push、无关项目体检文件、新产品/业务修复。

## Owner Playwright stability precondition and final release authorization — 2026-09-04

- **Stability scope:** normal Scanner/Camera i18n E2E must not take manual visual-evidence screenshots; evidence capture is allowed only when an explicit environment flag is enabled.
- **Project defaults:** Playwright runs serially with one worker, screenshots only on failure, video off, and trace only on first retry (effectively disabled while retries remain zero).
- **Browser policy:** normal i18n E2E uses Chromium only. WebKit may run once as a bounded final compatibility check after the legal i18n batches are complete; it must not be retried in a loop.
- **Evidence baseline:** all legal employee i18n batches are already complete in this candidate. No new business module is opened merely because the cross-thread instruction referred to “remaining batches”.
- **Final authorization:** after the stability repair, completed i18n/parity/responsive/a11y acceptance, one bounded final build/core-E2E/visual verification, clean canonical-main integration and concise evidence summary, Owner authorizes normal `main` push and the existing production deployment procedure.
- **Still prohibited:** force push, remote SQL, production database migration, production/customer data mutation, or any capability beyond a normal existing-project deploy.

## Owner continuation authorization — 2026-09-04

- The Owner-directed monitoring checkpoint explicitly authorizes continuing the next legal bounded batch through normal deployment instead of idling at the exhausted compatibility packet.
- Reopened scope is exactly one WebKit language-switcher keyboard-activation defect and the minimum paired test/evidence changes needed to prove it. It does not reopen unrelated UI, product, dependency, browser-matrix, security, database or infrastructure work.
- After one evidence-backed correction and one exact WebKit verification, the existing Chromium/full local evidence may be reused when its inputs are unchanged; then the release may proceed through the already-authorized exact-manifest, normal `main` push and existing-project deployment gates.

## Release contract

### Required preflight

1. Registry instruction、Context Packet 和 integration lease 必须有效且与当前窗口完全匹配。
2. 获取并核对 `origin/main`；若远端前进，只允许安全、非破坏性协调，不能覆盖远端或用户改动。
3. 冻结精确候选路径；禁止 `git add -A`。暂存后必须逐路径核对，并确认无关健康审计目录仍未暂存。
4. 识别现有 Vercel 项目、正式域名和前一个 READY deployment 作为回滚锚点，不读取或修改 secret 值。

### Required local gates

- 使用仓库声明的 Node 版本运行：`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`。
- 正常 i18n E2E 只运行 Chromium；Scanner/Camera 手工截图必须由显式环境变量门控。
- 所有已完成批次后只运行一次有界 WebKit 最终兼容检查；失败后允许一次定向根因修复和一次相关复验，不循环重试。
- 不重新引入已删除的实验性失败 spec，也不为范围外 P2/P3 重开验证链。
- `git diff --cached --check`、精确 staged path 审核和 secret/敏感数据扫描必须通过。
- 已完成的直接-i18n 独立 QA 证据仍有效；只有源码/行为范围变化时才重新打开对应产品、UX、架构、安全审查。

### Commit, push and deployment

- 只允许普通 commit 和 non-force push 到 `origin/main`。
- 先发布应用候选并等待 hosted exact-SHA gates 与 Vercel READY；再记录发布结果。若追加纯任务记忆 closeout commit，该 commit 也必须通过 hosted gates，并验证最终生产 SHA。
- 部署目标仅为仓库已绑定的现有 Vercel production project；不新增或修改环境、secret、域名、数据库或外部服务。
- 正式域名目标：`https://www.chinatech.in` 与 `https://chinatech.in`。使用公开、只读、无真实 PII、无 mutation 的 smoke。

### Acceptance

- 精确候选中没有未解决的直接 i18n P0/P1。
- 本地 lint/typecheck/test/build 和必要浏览器回归通过。
- hosted workflow 对被推送的确切 SHA 为 green。
- Vercel deployment 为 READY，正式域名解析到被接受的确切发布，关键公开页面、locale/metadata 和无水平溢出 smoke 通过。
- 回滚锚点已记录且可通过恢复前一个 READY deployment 或 forward revert 实施。
- 工作树中不混入无关项目健康审计或测试失败残留。

### Stop conditions

- 候选所有权或路径范围不能被可靠判定。
- `origin/main` 存在无法安全协调的分叉/冲突。
- 发现直接 i18n P0/P1，或必需本地/hosted exact-SHA gate 失败。
- Vercel deployment 非 READY、正式域名 smoke 失败，或不能识别前一个 READY 回滚锚点。
- 需要 DB/schema/migration、env/secret、生产数据、权限、force push 或范围外业务改动。

## Release candidate path policy

- Include only task-owned i18n application source, paired tests, registered browser specs, workflow changes required for those specs, task-owned documentation, task memory, and task screenshots.
- Exclude `.ai-company/memory/tasks/TASK-20260902-001-project-function-health-audit/`.
- Exclude `test-results/`, transient caches, logs, `.env*`, secrets, production exports, and any unresolved user-owned change.
- Exclude bulk `screenshots/release2b1-5/` generated by normal E2E. Only explicitly captured, reviewed final visual evidence may enter the release candidate.
- Build the exact manifest from repository status plus `EVIDENCE.md`/historical allowlists; stage from the reviewed manifest only.

## Rollback

- Source rollback: create a normal forward revert of the release commit(s); never rewrite history or force push.
- Production rollback: promote/redeploy the recorded previous READY deployment if smoke or observation fails.
- Data rollback is not applicable because this release does not authorize or perform DB/schema/migration/production-data changes.

## Evidence and recovery pointers

- Full pre-release history: `TASK_HISTORY_PRE_RELEASE_20260903.md`.
- Evidence ledger: `EVIDENCE.md`.
- Resume checkpoints: `CHECKPOINTS.md`.
- Executive handoff: `CEO_REPORT.md`.
- Capability review: `CAPABILITY_REVIEW.md`.
- Project backlog: `.ai-company/memory/BACKLOG.md`.
- Active foreground hint: `.ai-company/memory/ACTIVE_CONTEXT.md`.

## Current state

- **Done:** all planned direct employee i18n implementation; direct-i18n P0/P1 review; full local/static/browser release gates; exact release commit `a274f756b46b017e9560e948cc3fcd51cc78d2d8` pushed to `origin/main`; matching Vercel production deployment READY.
- **Remaining:** repair the five deterministic hosted Chromium i18n test races shared by runs `33863005646` and `33864592446`; run the exact five-test verification; push the final test/memory correction; require a new exact-SHA hosted green run and final evidence closeout.
- **Blocked:** the final CI gate is red even though verify, dual-engine print E2E, Vercel READY, canonical smoke and production error/5xx observation are green. Four Inventory tests read the pending request array before the debounced route begins; one Order Detail test closes while a final read-only route callback is still settling.
- **Next:** advance the Registry instruction, issue/verify Context Packet v8, add request-aware polling at the two Inventory interception points and wait for Order Detail route callbacks before teardown, then run only the five affected Chromium cases.

## Hosted print-locator corrective packet — 2026-09-04

- **Trigger:** exact-SHA hosted E2E run `33863005589` failed the 390px and 430px mobile fixed-PDF flows in both browsers at the same locator before any print action occurred.
- **Root cause:** the production mobile print control now correctly uses `orders2b2.hero.print`, whose accessible names are `打印`, `Stampa` and `Print`; the historical spec still queried only `打印工单` at two call sites.
- **Allowlist:** `tests/e2e/print-safari-reliability.spec.ts` plus this task's memory/evidence/closeout files. No application source, workflow, dependency, environment, data or infrastructure change is authorized.
- **Acceptance:** both stale call sites use the same exact tri-locale accessible-name locator; scoped formatting/lint passes; the two mobile widths pass in Chromium and WebKit with retries zero; a normal corrective commit is pushed and the new exact SHA passes hosted CI/E2E and production READY/canonical smoke.
- **Verification budget:** one targeted local correction and one related dual-browser verification. Do not rerun broad local application gates because no product/build input changes.
- **Rollback:** normal forward revert of the corrective commit. No data rollback applies.

## Hosted i18n deterministic-race corrective packet — 2026-09-04

- **Trigger:** both the original release run `33863005646` and print-corrective run `33864592446` completed with the same five Chromium i18n failures; all other 156 stories passed in the latter run.
- **Root cause:** Inventory's visible loading state precedes its debounced customer-search request, but four assertions synchronously inspected the intercepted-route array. Order Detail completed every business assertion, then a query-invalidation `order/get` read remained inside `route.fetch()` when Playwright closed the page.
- **Allowlist:** `tests/e2e/i18n-inventory-release-2b4.spec.ts`, `tests/e2e/i18n-order-detail-release-2b2.spec.ts` and this task's memory/evidence/closeout files only.
- **Implementation contract:** replace only the two immediate pending-search assumptions with assertion-preserving polling for exactly one intercepted request; wait for installed Order Detail route callbacks before the heavy test teardown. Do not change application source, assertions, retry, timeout, workflow, dependencies, environment, data or infrastructure.
- **Acceptance:** scoped lint/format/diff checks pass; the three 430px locale cases, heavy Inventory reservation case and heavy Order Detail transition case pass together in Chromium with one worker and retries zero; the next exact SHA passes hosted verify, Chromium i18n, dual-engine print E2E, Vercel READY and canonical smoke.
- **Rollback:** normal forward revert of the final corrective commit. No data rollback applies.
