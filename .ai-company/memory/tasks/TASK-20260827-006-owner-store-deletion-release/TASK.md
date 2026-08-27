---
schema_version: 1
task_id: "TASK-20260827-006-owner-store-deletion-release"
title: "发布店主专属店铺删除确认界面"
status: "active"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "Hexiang Huang / Owner"
departments: ["DATA", "FRONTEND", "PLATFORM", "QA", "RELEASE", "SEC"]
created_at: "2026-08-27T18:31:22Z"
updated_at: "2026-08-27T19:34:44Z"
---
# Task — 发布店主专属店铺删除确认界面

## Owner request

发布店主专属店铺删除确认界面

## Business value

在隔离候选中复核已完成的主店主分阶段删除控制，形成可审计的 release-candidate 证据；真实永久删除保持完全关闭。是否进入 main 或 Vercel Production 由后续持有集成租约且具备 D4 批准的窗口决定，本任务不执行发布。

## Scope in

- 以 `origin/main` 的固定基线建立 `/private/tmp/repairdesk-store-delete-release-20260827` 隔离 worktree 和本地分支 `codex/store-delete-release-20260827`。
- 仅重建 TASK-20260827-005 店主删除确认功能所需的应用、API、服务端权限/状态机、定向测试和生命周期 runbook；从共享脏工作区逐 hunk 选择，排除账号注册修复及其他任务改动。
- 覆盖 active 店主入口只能进入可恢复 close preflight、archived 的页面提示词确认、primary-owner/UUID 服务端校验、查询与 mutation capability 分离、contract>=4 fail-closed worker/adapter 保护及显式本地 mock 测试行为。
- 在隔离候选执行 13-file/79-test 定向套件、相关文件 scoped lint、typecheck、full test（若基线允许）、build 和 `git diff --check`，记录精确改动文件、基线差异和回滚候选；稳定候选还需完成 Node24 `npm ci --include=optional` 后的干净依赖复核。
- 只更新本任务目录的 Task Memory 和证据；不改 `.ai-company/memory/ACTIVE_CONTEXT.md`、Registry、其他任务记忆或共享根业务文件。

## Scope out

- 账号注册/登录修复、客户状态缺失模块及其他混入共享根的无关改动。
- 本执行窗口的 `main` 合并、commit、push、Vercel 部署、官方域名 smoke、生产日志操作及任何外部通知；Owner 后续已明确授权合格集成/发布窗口进行 scoped commit、push、deploy，但不因此授权本 worker 越权执行。
- migration、RPC 签名、生产 flag、Supabase 连接/数据访问、真实 purge、Storage/DB 删除和 worker scheduling 启用。
- 抢占当前属于 `WINDOW-01A03AC9-ACCOUNT-REPAIR-INTEGRATION-V2` 的 integration lease，或替代集成负责人做最终产品/发布决定。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Risk is `R4`; execution autonomy is `L2` controlled and reversible. D4 decisions remain forbidden to this worker: production deletion, migration/retention change, worker or scheduling activation, production publish, and integration/close on behalf of the lease holder.
- All production purge scheduling/worker/mutation/migration flags remain unchanged and disabled; no `.env*` edits or production credentials are read or written.
- The candidate must remain uncommitted and unpushed in this worker window. The Owner has explicitly authorized a later scoped commit/push/deploy by the integration/release owner, but has not authorized migration, production-flag changes, or real deletion. The rollback candidate is the exact verified `origin/main` baseline, not a destructive reset of the shared root.
- Every status, request, cancel, and final-confirm path must retain primary-owner, target-store, authoritative UUID/name and contract>=4 fail-closed checks; `scheduled` is not completion and only `completed` may be described as done.

## Acceptance criteria

- [x] 基于最新 origin/main 建立隔离候选，只包含 TASK-20260827-005 的明确应用与测试文件，不带入共享脏工作区其他改动。
- [x] 生产永久删除 scheduling、worker、migration 和真实数据清除保持关闭；不新增或修改生产环境变量。
- [x] 候选完成 13-file/79-test 定向套件、scoped lint、typecheck、full test 和 `git diff --check`；build 已执行并仅剩离线 Google Fonts 环境阻塞，基线/环境结果已精确归因且未用无关修复掩盖。
- [x] 候选的权限、提示词、状态机、fail-closed 和无横向影响证据由当前实现/质量检查记录；production release/security gate 仅作为未授权的后续门禁，不在本任务宣称通过。
- [x] 无 commit/push/deploy；记录 exact origin SHA、worktree/branch、changed-file list、diff/stat/status 和可恢复 rollback candidate。

Candidate gate result: **PREVIEW GO / FLAGS-OFF PROD GO / REAL PURGE NO-GO**. After clean Node24 `npm ci --include=optional`, the 13-file/79-test lifecycle suite, split 17/17 tests, full Vitest (460 files / 3048 tests), typecheck, scoped ESLint, and diff check passed. Build reached only the offline Google Fonts fetch blocker. The independent release reviewer marked the exact-SHA Preview GO and production flags-off GO; real permanent deletion remains NO-GO. Owner authorization covers only later scoped commit/push/deploy, not migration, flag changes, or real deletion.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request and task frontmatter | retained |
| Shared root is dirty and contains multiple task changes | observed | `git status --short` in shared root | isolate; never restore/clean root |
| Latest release baseline | observed | `git fetch --no-tags origin main`; `origin/main` = `e80099b2c36e89a484acf4430f3fddb4a9f199ad` | build candidate from this SHA |
| Integration lease | observed | Registry status/doctor | held by `WINDOW-01A03AC9-ACCOUNT-REPAIR-INTEGRATION-V2`; do not acquire |
| TASK-005 implementation | candidate source | scoped files in shared root and prior evidence | select only deletion feature hunks; verify in candidate |
| Production purge readiness | constraint | release/security contract | NO-GO: no v4 forward migration, D4 approval, runner/sink/independent background approval, or production flag activation |

## Decision and approval points

- `R4/L2` controlled execution is recorded for this candidate. No D4 approval is present or requested for production real deletion, migration, worker/scheduling/flag activation. The Owner has authorized this qualified integration/release window to perform scoped commit/push/deploy.
- Integration and final release decisions remain with the active lease holder; this worker may only return candidate evidence and a rollback point.
- A failed baseline gate is evidence of a conditional/blocked candidate, not permission to modify unrelated modules or loosen fail-closed protections.

## Work packages

1. **Rehydrate and bind (read-only):** verify Registry identity/context packet, active lease owner, current task memory, latest `origin/main`, and shared-root dirty boundary.
2. **Isolated reconstruction (write only in temp worktree):** create the local branch from the exact origin SHA; copy/apply only TASK-005 deletion feature hunks and required tests/runbook; leave account and unrelated hunks out.
3. **Candidate verification:** run targeted 13-file/79-test suite, scoped lint, typecheck, full test/build where possible, and diff-check; preserve exact command output and baseline attribution.
4. **Security/release evidence:** verify no env/migration/production writes, contract>=4 destructive guard, owner/target/phrase/state-machine coverage, changed-file list, rollback candidate, and no lease takeover.
5. **Memory handoff:** update this task’s evidence/checkpoints only; call `wp-complete` with expected version 2; return candidate path and residual gates to the Integration Lead.

## Definition of done

- Candidate worktree is isolated, uncommitted, unpushed, and reproducible from the exact origin SHA.
- Every attempted verification has a recorded PASS/FAIL and baseline attribution; no unsupported release or production claim is made.
- Required TASK-005 runbook and this task’s memory are synchronized without changing ACTIVE_CONTEXT or unrelated task files.
- Residual production gates (v4 migration, D4 approval, runner/sink/independent background approval, integration lease and release approval) remain explicitly owned by the later Integration Lead/Owner decision.
