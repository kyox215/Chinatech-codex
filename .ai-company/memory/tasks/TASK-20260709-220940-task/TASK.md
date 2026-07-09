---
schema_version: 1
task_id: "TASK-20260709-220940-task"
title: "残留事项与数据库迁移历史收敛"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["INT", "DATA", "SEC", "QA", "DOC"]
created_at: "2026-07-09T22:09:40Z"
updated_at: "2026-07-09T22:28:43Z"
closed_at: "2026-07-09T22:28:43Z"
---
# Task — 残留事项与数据库迁移历史收敛

## Owner request

按照推荐设置目标，逐项处理权限任务后的残留事项，并解决数据库残留历史记录等问题。

## Business value

把权限执行后的仓库、迁移历史、数据库状态和后续权限脱敏工作收敛到可恢复、可验证、不会污染 main 的状态，减少后续开发误用旧文件、旧任务记忆或迁移历史的风险。

## Scope in

- 使用干净 worktree 基于最新 `origin/main` 做审计和可逆收敛。
- 核查远端 `main` 是否已包含角色权限运行时拦截、任务记忆和 Phase D 相关提交。
- 核查 linked Supabase migration 状态、migration history、pending migration 和权限授权表状态。
- 盘点原工作区 dirty/ahead/behind 状态，区分可自动归档、需要保留、需要 Owner 决策的项。
- 对可逆、安全的残留项做记录或修复；对 destructive / production data / reset / delete 类操作先生成批准点。
- 更新任务记忆、证据和下一步处理顺序。

## Scope out

- 不直接删除生产数据库记录或重写 Supabase migration history。
- 不直接 `git reset --hard`、删除原工作区未提交改动、清理历史 worktree，除非获得明确批准。
- 不把原工作区旧版计划文档覆盖到远端新版。
- 不在本任务里大范围实现 UI 设置页权限说明，除非先完成仓库/数据库收敛并重新确认范围。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 最新 `origin/main` 权限/Phase D 状态已核查并记录。
- [x] Linked Supabase dry-run / migration list 已核查；迁移历史残留当前为 no-op/up to date；权限授权表级二次查询已串行复查通过。
- [x] 原工作区 dirty/ahead/behind/untracked 风险已分类，并已用保护分支 + stash 保存后同步到最新 `origin/main`。
- [x] 不可逆清理动作没有被擅自执行。
- [x] 任务记忆包含证据、风险、下一步和 no-spawn reason。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Clean worktree was used for isolated audit and push | observed | `/private/tmp/repairdesk-role-permissions`; pushed `961e186b` | close task from original synced checkout |
| Original workspace was dirty and divergent, then preserved and synced | observed | E-003, E-012 | current original `main` is clean at `961e186b`; old state recoverable from branch/stash |
| Latest remote contains role permission closeout | observed | `origin/main` includes `3db8dacf`, `baca8d16` | verify exact residual scope |
| Latest remote also contains permission projections | observed | `origin/main` includes `bf5d9610 Add order permission projections` | inspect coverage before more Phase D work |
| Supabase migration history is now aligned | observed | `supabase migration list --linked`, `supabase db push --linked --dry-run --include-all` | documentation updated; no apply needed |
| Permission grant table live posture is scoped-verified | observed | serial linked query | `store_member_permission_grants` exists, RLS enabled, table grants restricted to `postgres` and `service_role` |
| Original workspace local commit `19e22798` was not equivalent upstream | observed | `git cherry -v origin/main HEAD`; E-012 | preserved in `preserve/original-main-before-sync-20260710-0030` before reset |

## Decision and approval points

- R3/L2: read-only audits, docs/memory updates, dry-runs, and reversible snapshots may proceed.
- D3/D4 approval required before: deleting/stashing owner work if not reversible, `git reset --hard`, dropping/repairing production migration history, deleting database rows, removing worktrees with unmerged work, or pushing new behavior changes.
- Owner-visible checkout sync was executed with recoverability: preservation branch plus stash were created before resetting local `main` to `origin/main`.
- No sub-agents spawned: multi-agent tool policy requires explicit user request for sub-agents/delegation/parallel agent work; owner asked for direct execution. Departments are considered and handled by main thread unless a later explicit sub-agent request is made.

## Work packages

- WP1 Remote/permission state audit.
- WP2 Supabase migration history audit.
- WP3 Original dirty worktree preservation and sync plan.
- WP4 Safe residual cleanup or approval package for unsafe cleanup.
- WP5 Evidence/checkpoint/closeout.

## Closeout summary

- Main pushed: `961e186b Resolve migration history residual status`.
- Database residual history resolved for this task: linked migration list aligned through `20260709235000`, dry-run up to date, migration history count/latest verified.
- Permission grant table residual verified: `store_member_permission_grants` has RLS enabled and only `postgres`/`service_role` table grants in the serial linked query.
- Original checkout residual resolved: local `main` is clean at `d2e3cff1`; old local HEAD is recoverable from branch `preserve/original-main-before-sync-20260710-0030`; original pre-sync dirty/untracked work is now `stash@{1}`; post-closeout external mobile-performance residual is `stash@{0}`.
- Phase D2/UI redaction and broader live parity audits remain separate follow-up work, not blockers for this residual cleanup.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
