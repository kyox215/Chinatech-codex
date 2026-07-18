# Agent Packages — TASK-20260718-012

## Architecture / Explorer

- `codex_agent`: explorer
- `spawn_required`: true
- `spawn_status`: spawned (`/root/release_inventory_architecture`)
- `department`: INT / Architecture
- `mode`: read_only
- `goal`: 将当前 Git diff、untracked 文件、本地提交、工作树和任务记忆映射为可发布单元，识别远端重复、冲突和遗漏。
- `must_read`: `AGENTS.md`, 本任务 `TASK.md`, `.ai-company/memory/ACTIVE_CONTEXT.md`, 各候选任务 `TASK.md/EVIDENCE.md/CHECKPOINTS.md`
- `allowed_files`: 全仓只读
- `forbidden`: 编辑、stage、commit、push、deploy、数据库、秘密、创建子代理
- `expected_output`: 按任务列出路径/提交/状态/是否发布/理由/集成顺序/冲突。
- `acceptance`: 所有 tracked/untracked 路径有归属或明确 unknown；结论附文件和 Git 证据。

## Data + Security

- `codex_agent`: security_reviewer
- `spawn_required`: true
- `spawn_status`: spawned (`/root/release_data_security`)
- `department`: DATA / SEC
- `mode`: read_only
- `goal`: 审查六份 migration 及其服务端调用链、feature flags、RLS/grant/SECURITY DEFINER、purge/export/recovery 风险和生产 apply 门禁。
- `must_read`: `AGENTS.md`, 本任务 `TASK.md`, data migration/security/release rules, store lifecycle task/runbook/migrations
- `allowed_files`: 全仓只读
- `forbidden`: 编辑、SQL 执行、linked apply、秘密、stage/commit/push/deploy、创建子代理
- `expected_output`: 迁移依赖图、严重性发现、可/不可 apply 结论、精确 post-check 与回滚要求。
- `acceptance`: 客户端隐藏不算权限；每份迁移单独结论；未证实项明确标注。

## QA + Release

- `codex_agent`: qa_reviewer
- `spawn_required`: true
- `spawn_status`: spawned (`/root/release_qa_governance`)
- `department`: QA / Release
- `mode`: read_only
- `goal`: 将候选任务验收证据映射到测试、浏览器截图、production smoke、观察和 rollback 门禁，提出安全发布批次。
- `must_read`: `AGENTS.md`, 本任务 `TASK.md`, 候选任务 Evidence/CEO report, package scripts, e2e tests, deployment docs
- `allowed_files`: 全仓只读
- `forbidden`: 编辑、stage、commit、push、deploy、数据库、秘密、创建子代理
- `expected_output`: PASS/CONDITIONAL/FAIL 矩阵、需重跑命令、关键页面/视口、部署顺序和残余风险。
- `acceptance`: 每个发布批次有自动/人工/运行时/回滚证据；高风险缺口不得 PASS。
