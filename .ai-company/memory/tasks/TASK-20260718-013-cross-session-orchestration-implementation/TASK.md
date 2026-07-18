---
schema_version: 1
task_id: "TASK-20260718-013-cross-session-orchestration-implementation"
title: "实施并发布 RepairDesk 多窗口强隔离调度 Phase 0A"
status: "in_progress"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["INT", "Architecture", "QA", "SEC", "DOC", "Release"]
created_at: "2026-07-18T19:07:41Z"
updated_at: "2026-07-18T20:29:00Z"
---
# Task — 实施并发布 RepairDesk 多窗口强隔离调度 Phase 0A

## Owner request

按照已批准的 V3 多窗口强隔离规划设定正式目标、生成完整实施计划、开始实施、验证后推送，并为项目建立以后可直接调用的声明与 Skill。

## Business result

RepairDesk 获得一个不依赖聊天历史或单一 ACTIVE_CONTEXT 猜测任务身份的本地调度基础：多个顶层窗口可以先登记、绑定并读取各自不可变 Context Packet；后台任务创建和 checkpoint 不再切换前台任务；项目存在机器可验证声明与可复用 Skill。

## Scope in

- Python 标准库 SQLite/WAL 项目级 registry。
- project/task/run/window/worker/work-package 身份和最小 schema。
- 顶层窗口 UNBOUND、绑定、状态和 fail-closed 检查。
- 不可变、带 hash 的 task/run/window Context Packet。
- tools/ai_company.py 的 Phase 0A 兼容入口。
- 修复 allow-parallel new-task、后台 checkpoint 和多活动任务 context 的 ACTIVE_CONTEXT 漂移。
- 项目级人类可读声明、机器配置、ADR 和可复用 cross-session-orchestration Skill。
- 并发创建、CAS、身份、指针漂移、重启和 secret/PII 最小化测试。
- 治理验证、非强制 Git push 和发布证据。

## Scope out

- 不修改 src、tests/e2e、Supabase、Vercel 或生产配置。
- 不自动创建、删除或清理现有 worktree。
- 不自动操控任意顶层 Codex GUI 会话。
- 不启用自动 Writer 转移、自动 integration、自动 commit/push/deploy/migration。
- 不修改、合并或发布 TASK-012 的 release worktree。
- 不读取或保存 secrets、客户 PII、完整 prompt、完整 diff 或完整 stdout。

## Hard constraints

- 唯一业务写入者为本主线程；所有子 Agent 只读。
- 实施在 /private/tmp/repairdesk-orchestration-v3-20260718 独立 worktree 完成。
- ACTIVE_CONTEXT 继续属于 TASK-012；本任务不得改写该指针。
- Git 发布使用非强制 push；推送前重新 fetch 并处理远端漂移。
- Runtime 故障、身份不完整或多个活动任务未明确 task_id 时 fail closed。
- Phase 0A 只建立 Shadow/身份/登记能力，不扩大生产或业务授权。

## Facts, assumptions, unknowns and conflicts

| Item | Type | Evidence | Resolution |
|---|---|---|---|
| 当前根 checkout 高度脏 | verified fact | git status 2026-07-18 | 使用独立 worktree |
| TASK-012 有独立 release worktree 和 4 个本地提交 | verified fact | /private/tmp/repairdesk-workspace-release-20260718 | 不触碰；推送前 re-fetch |
| allow-parallel new-task 仍更新 ACTIVE_CONTEXT | verified fact | tools/ai_company.py cmd_new_task | Phase 0A 修复 |
| checkpoint --task 仍更新 ACTIVE_CONTEXT | verified fact | tools/ai_company.py cmd_checkpoint | Phase 0A 修复 |
| 官方任意顶层聊天控制 API 未作为稳定合同 | bounded unknown | V3 planning evidence | 只实现共享本地控制面 |
| 共享 runtime 必须被所有 worktree 访问 | assumption to verify | V3 architecture | doctor + temp/runtime tests |

## Risk and autonomy

- 总体 R3 / L2：项目治理与本地任务状态核心改变，可逆但错误会造成跨任务串线。
- D1/D2：标准库实现、文档、schema、测试、Shadow runtime。
- D3：修改根治理声明、启用项目 Skill、Git push；Owner 已在本条消息明确批准。
- D4：生产、数据库、权限、秘密、破坏性操作仍未授权且不在范围。
- 强制独立审查：Architecture、QA/Security、Documentation/Skill。

## Acceptance criteria

- [x] Registry 使用 SQLite/WAL、事务、外键、唯一约束和 0700/0600 权限。
- [x] 每个窗口必须显式绑定 project/task/run/window/role；错误身份事件 100% 拒绝。
- [x] 同一 task/run 或 WP 的并发创建/claim 每轮恰好一个 winner。
- [x] new-task --allow-parallel 默认不改变 ACTIVE_CONTEXT；只有 --activate 可改变。
- [x] 后台 checkpoint 默认不改变 ACTIVE_CONTEXT；只有 --activate 可改变。
- [x] 多个活动任务存在时，缺少 task_id 的 checkpoint/context 写入或编译 fail closed。
- [x] Context Packet 不可变、按 instruction version 命名并包含内容 hash。
- [x] 项目声明明确触发语、边界、运行命令、恢复和 No-Go。
- [x] cross-session-orchestration Skill 可被项目发现、通过 quick_validate 并完成独立 forward-test。
- [x] Python 单元/并发测试、agent rules、AI Company validate 和 secret scan 通过。
- [ ] 仅本任务文件被提交；非强制推送到最新 origin/main。

## Work packages

### WP-01 Intake, architecture and collision review

- Owner: IntegrationLead
- Reviewers: Architecture, QA/Security, Documentation
- Exit: implementation contract frozen; TASK-012 collision ruled out.

### WP-02 Registry and identity core

- Owner: IntegrationLead
- Files: tools/orchestration, schema/config
- Exit: unit/concurrency tests pass.

### WP-03 AI Company compatibility

- Owner: IntegrationLead
- Files: tools/ai_company.py and focused tests
- Exit: ACTIVE_CONTEXT drift tests pass.

### WP-04 Declaration and reusable Skill

- Owner: IntegrationLead
- Files: AGENTS.md, docs, .agents/skills, ADR
- Exit: project trigger and Skill validation/forward-test pass.

### WP-05 Quality, release and closeout

- Owner: IntegrationLead
- Reviewers: QA/Security/Architecture
- Exit: scoped gates pass; latest remote integrated; commit pushed; task memory closed.

## Rollback

- Before push: discard only this isolated branch/worktree after preserving evidence.
- After push: create a normal git revert of the scoped commit; do not force-push.
- Runtime: disable orchestration in machine config and keep legacy single-task flow; never delete dirty task/worktree evidence automatically.
- Compatibility: --activate preserves explicit legacy foreground behavior.

## Visual evidence

Pure Python tooling, governance, documentation and Skill task. There is no RepairDesk feature page to screenshot. Alternate evidence: CLI output, test reports, task memory, commit and remote SHA.

## Definition of done

All acceptance criteria have evidence, independent reviewers return no blocker, documentation and Skill are validated, remote main contains the scoped commit, and residual Phase 0B/Phase 1 work is explicitly deferred rather than represented as complete.
