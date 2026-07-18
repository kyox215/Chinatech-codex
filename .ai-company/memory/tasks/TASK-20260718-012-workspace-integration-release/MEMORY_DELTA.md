# Memory Delta — TASK-20260718-012

## Durable outcomes

- 混合 dirty/diverged checkout 不能直接作为发布源；本次用 latest-main 隔离重构、逐 release-unit 验证和 scoped commits 成功发布，同时保留用户工作区。
- linked migration 发布必须从完整 dry-run 停止并拆出精确数据库 worktree；本次只应用 `20260718150000`，未使用 `--include-all`，也未夹带两份 Inventory V2 migration。
- Inventory V2 已以 additive、fail-closed 形式进入 Web 主线，但生产 schema、RPC、allowlist 和 flags 是独立 D4 激活链；V1 必须保留。
- Lifecycle purge retry-baseline 缺陷继续阻止 worker/scheduler 激活，不能因 schema 已存在而推断可安全启用。

这些结论已写入任务 handoff 和 release evidence；不包含秘密、客户 PII 或生产凭据。

## Consolidation result

- 已提升到 `PROJECT_MEMORY.md` 与 `MEMORY_INDEX.md`：两个任务的真实发布/默认关闭状态和生产激活边界。
- 已同步 DATA、SEC、QA、Operations、Documentation 部门：精确 migration SOP、Inventory V2 D4 边界、purge retry-baseline 阻塞、基线 E2E 债务、exact-SHA 发布与文档权威。
- Capability Registry 只增加第二次受控发布证据；`CAP-TASK009-RELEASE-20260710` 仍为 C1/restricted，没有权限或自治升级。
- 未提升临时部署等待日志、完整 worktree 清单、合成记录内容或分支噪声；它们只保留在任务证据中。
