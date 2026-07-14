# Checkpoints — TASK-20260714-002-buyback-supabase-schema-staging

## 2026-07-14T17:08:02Z — Dormant staging pre-release gates satisfied

- Owner explicitly requested applying the Supabase change.
- Scope is exactly buyback migration `20260712150000`; Settings/Kiosk remains excluded.
- Original migration was NO-GO; DATA/SEC/REL findings drove payment-preflight ordering, bounded
  timeouts and complete runtime ACL revocation.
- Production read-only checks are green and current target objects are absent.
- PG17 UUID/Text fixtures, fail-before-write fixture and official CLI runner rollback proof pass.
- Production history source `20260714004500` is restored byte-for-byte from its applied commit.
- Official CLI 2.109.1 dry-run lists exactly one migration: `20260712150000`.
- Eight completed physical backups are visible; latest is 2026-07-14T06:44:53.792Z; PITR is off.
- Next: freeze exact files in a scoped commit, push main, rerun immediate linked gates from that
  commit, apply only the target, then execute catalog/ACL/storage/feature-off observation.

## 2026-07-14T17:10:06Z — Dormant buyback schema staging pre-release gates pass: production preflight, UUID/text PG17 fixtures, fail-before-write, official runner rollback, backup evidence and single-migration dry-run verified; runtime grants and feature remain off.

- **Phase:** implementation
- **Completed/current state:** Dormant buyback schema staging pre-release gates pass: production preflight, UUID/text PG17 fixtures, fail-before-write, official runner rollback, backup evidence and single-migration dry-run verified; runtime grants and feature remain off.
- **Next:** Freeze scoped files in a commit and push main; from that commit rerun immediate preflight and exact dry-run, then apply only 20260712150000 and execute catalog/ACL/storage/feature-off postchecks.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator

## 2026-07-14T17:29:00Z — Production dormant schema staging applied and observed

- Frozen source commit `66aa468e` was pushed to `origin/main` before the production write.
- The immediate release gate and official CLI dry-run still selected only `20260712150000`.
- Official CLI 2.109.1 applied exactly that migration; final dry-run reports remote up to date.
- Agreement table, RPC, fields, constraints, indexes and private bucket match the reviewed contract.
- Agreement rows and evidence objects remain zero; anon/authenticated/service_role have no table DML or RPC EXECUTE.
- Delayed observation remained feature-off and empty, with no API/Storage failure.
- One operator-generated read-only catalog query used the wrong historical table name, produced no write and was corrected successfully.
- Next: synchronize durable memory, run governance closeout checks, commit/push closeout records and close the task.
## 2026-07-14T17:33:09Z — 生产迁移 20260712150000 已从冻结 main 提交按官方 CLI 单独应用；即时与延迟后检证明对象为空、runtime ACL/RPC 全关闭、feature-off 未变，目标 slice PASS。

- **Phase:** closeout
- **Completed/current state:** 生产迁移 20260712150000 已从冻结 main 提交按官方 CLI 单独应用；即时与延迟后检证明对象为空、runtime ACL/RPC 全关闭、feature-off 未变，目标 slice PASS。
- **Next:** 完成 governance close-task，提交并推送仅收尾文档到 main，清理本任务的临时 Docker fixture。
- **Decision:** 关闭本次 dormant schema staging；任何敏感功能启用必须新建 Owner-approved enable task。
- **Evidence:**
  - E-021..E-031；commit 66aa468e；post-apply dry-run up to date；2026-07-14T17:28:37Z delayed ACL/empty-state observation。
- **Recorded by:** CEO-Orchestrator
## 2026-07-14T17:35:54Z — 最终差异与 agent rules 通过；生产 delayed observation、治理证据、部门记忆和临时 fixture 清理均已归档。

- **Phase:** closeout
- **Completed/current state:** 最终差异与 agent rules 通过；生产 delayed observation、治理证据、部门记忆和临时 fixture 清理均已归档。
- **Next:** 执行 close-task，将 ACTIVE_CONTEXT 置 idle，然后提交并推送 closeout records 到 main。
- **Decision:** Scoped migration staging PASS；runtime enable 继续 NO-GO。
- **Evidence:**
  - E-021..E-033；git diff --check PASS；agents:check PASS；memory-audit exit 0。
- **Recorded by:** CEO-Orchestrator
## 2026-07-14T17:39:39Z — Task closeout

- **Status:** closed
- **Outcome:** 生产 Supabase 已从冻结 main 提交按官方 CLI 单独应用 dormant migration 20260712150000；对象为空，runtime ACL/RPC 全关闭，feature-off 保持，目标 migration slice PASS。
- **Residual risks:** PITR 关闭且未做恢复演练；完整迁移历史 reset 仍在 20260611102805 失败；retention/legal/cleanup/immutable-access/tenant-FK/file-security/concurrency 仍是 enable 硬门禁。
- **Follow-up:** 任何证件/签名上传、协议/付款/finalize 或六步敏感流程启用必须新建 Owner-approved DATA/SEC/REL task；另行修复恢复基线和全历史迁移链。
- **Closed by:** CEO-Orchestrator
