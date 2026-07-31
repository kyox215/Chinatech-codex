---
schema_version: 1
task_id: "TASK-20260731-004-sitewide-mobile-density-main-release"
title: "全站移动端密度分支集成 main 并发布 Vercel Production"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["INT", "QA", "REL", "UX"]
created_at: "2026-07-31T08:21:48Z"
updated_at: "2026-07-31T08:34:00Z"
---
# Task — 全站移动端密度分支集成 main 并发布 Vercel Production

## Owner request

老板明确要求把 `codex/sitewide-mobile-density-20260731` 部署到 `main`。解释为：在保留最新主线变更的前提下，将该分支 fast-forward 发布到远程 `main`，由 Vercel Git Integration 生成 Production deployment。

## Business value

将已验证的全站移动端紧凑布局安全集成到 main 并发布生产，保持可回滚与可观测。

## Scope in

- 核对 `origin/main` 与移动密度分支的提交拓扑、重叠文件与合并冲突。
- 将最新 `origin/main` 合并进入移动密度分支，保留双方已批准内容；禁止覆盖主线。
- 在合并结果上运行 lint、typecheck、Vitest、production build 与风险导向响应式浏览器测试。
- 先验证更新后的 Vercel Preview，再用非强制 fast-forward push 更新 `origin/main`。
- 验证 Vercel Production 的 commit、READY 状态、HTTP/启动状态、运行错误与移动端视觉证据。
- 记录发布前 main SHA、生产 deployment、回滚步骤、残余风险和 Owner 批准。

## Scope out

- Any work not required by the acceptance criteria.
- 不集成并行 Buyback、Inventory 或其他未进入 `origin/main` 的分支。
- 不修改数据库、环境变量、权限、依赖、域名、Production alias 配置或客户数据。
- 不 force-push、不重写 `main` 历史、不把 Preview 直接 promote 为与 `main` 不一致的 artifact。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 目标环境明确为 Vercel Production；Owner 当前指令是本次 D4 发布批准，但不授权任何数据迁移或凭据变更。
- 每个 merge、push、Production 验证物质边界前后必须核对 integration lease holder/version/expiry。
- 当前根工作区存在其他任务改动，只允许在隔离 worktree `/private/tmp/repairdesk-sitewide-mobile-density-20260731` 写入。

## Acceptance criteria

- [ ] origin/main 包含已验证的移动密度实现且不丢失并行主线变更
- [ ] 合并后 lint、typecheck、test、build 通过
- [ ] Vercel Production 对应最终 main 提交并处于 READY
- [ ] 生产登录页与代表性移动端路径无启动错误或横向溢出
- [ ] 记录回滚提交、部署 URL、截图和运行证据

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 发布源分支 | verified | remote SHA `cf5948623cd5a04690c8c17772d008cfc13ad90d` | 作为待集成源 |
| 当前远程 main | verified | remote SHA `a9e6db44f1ebccbf53fa8e3b9120e0ee2eaf0a3e` | 必须保留；比源分支共同基线 `dd03f778` 前进 1 个提交 |
| Preview 证据 | verified | deployment `dpl_angQUx3d62NzYzbNrTqKNggBsLDk` READY、HTTP 200、390px smoke | 仅证明 pre-merge branch artifact |
| 既有质量证据 | verified | TASK-20260731-002 EVIDENCE | 376/2462 tests、build、Chromium/WebKit route matrix；合并后必须重跑 |
| 当前 integration lease | verified | Registry holder `WINDOW-019FB58E-SITEWIDE-MAIN-RELEASE` v1，expires `2026-07-31T09:25:07Z` | merge 前已核验；每个 push 前后继续复核 |
| 数据/API/权限/依赖变化 | verified absent in source task | branch diff + TASK-20260731-002 | 无迁移或配置改变 |

## Risk and autonomy

- **R3**：写入远程 `main` 并触发客户可见 Production；最大风险是覆盖主线、共享 primitive 回归或错误 artifact 上线。
- **L2**：Owner 已明确批准发布到 main；允许有界、非强制、可回滚的 merge/push/deploy 验证。数据库、环境变量、域名、权限和 secret 操作仍禁止。
- **D1/D2**：合并方法、测试组合、Preview/Production smoke 与文档由 Integration Lead 决定。
- **D4 已批准**：本次把已验证分支集成到 `main` 并由 Git Integration 部署 Production。
- **重新批准触发**：需要丢弃主线/分支内容、force push、迁移、环境变量变化、Production alias 手工切换或测试失败后风险接受。

## Work packages

1. **WP-01 Release diff review** — read-only Release Reviewer；提交拓扑、冲突、回滚、观测。
2. **WP-02 QA release matrix** — read-only QA Reviewer；合并后门禁、浏览器与生产 smoke。
3. **WP-03 Controlled integration** — Integration Lead single writer；merge `origin/main` into feature branch and resolve only evidence-backed conflicts.
4. **WP-04 Pre-production gates** — full quality gates plus responsive browser checks and refreshed Preview.
5. **WP-05 Main/Production release** — verify lease, fast-forward push `HEAD:main`, wait for matching Vercel Production READY.
6. **WP-06 Post-deploy verification/closeout** — HTTP/mobile screenshot/runtime errors, rollback record, checkpoint and Registry close.

## Release and rollback contract

- **Strategy:** Preview-validated Git push release. Update feature branch with current main, verify, then non-force fast-forward push the exact tested SHA to `main`.
- **Freeze:** no business-code changes beyond conflict reconciliation required to combine `a9e6db44` and the mobile-density commits.
- **Stop conditions:** merge conflict changes business semantics; any gate failure; remote main moves after final fetch; lease mismatch/expiry; Vercel build ERROR; login/public smoke non-200; new blocking runtime errors.
- **Rollback:** preserve pre-release main SHA and production deployment ID. Prefer an explicit `git revert` of the release merge on main and a new production deployment; use Vercel rollback only for immediate availability recovery while Git history is reconciled. No force reset.
- **Observation:** deployment/commit match, READY, build errors=0, production HTTP 200, mobile width 390 with style-ready/no console errors/no horizontal overflow, runtime error scan after deployment.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
