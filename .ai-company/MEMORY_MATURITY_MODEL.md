# MEMORY MATURITY MODEL — 组织记忆成熟度模型

## N0 — 易失

- 主要依赖单次聊天。
- 没有稳定 Task ID、来源或检查点。
- Agent 更换后需要重新解释。

**目标**：建立 Markdown + Git 最小持久化。

## N1 — 可恢复

- 有 Project Memory、Task Memory、Context Packet 和 Checkpoint。
- 新 Agent 可以恢复主要任务。
- 仍依赖人工维护索引。

**升级条件**：恢复测试稳定，关键事实有来源。

## N2 — 受控

- 有部门 Memory Steward、权威等级、版本、冲突和复审。
- 交接和关闭流程强制更新记忆。
- 能力与权限开始登记。

**升级条件**：过期和冲突可被发现，权限隔离有效。

## N3 — 可检索与可衡量

- 有结构化存储、全文/语义检索和角色化 Context Compiler。
- 有记忆健康指标和周期审计。
- Capability Registry 有代表性评估。

**升级条件**：上下文遗漏、摘要漂移和恢复时间持续下降。

## N4 — 自适应但有边界

- 任务结果自动产生 Memory Candidate 和 Capability Candidate。
- 低风险记忆可在策略内自动更新。
- 受影响 Context Packet 自动失效并刷新。
- 能力可自动降级，升级仍需治理。

**升级条件**：写入、检索、权限和回退长期可靠。

## N5 — 有界自治组织记忆

- 多项目、多部门记忆统一治理。
- 高质量事件、快照、关系、评估和恢复自动化。
- Agent 在明确政策、预算、SLO 和 kill switch 下持续运作。
- 人类主要处理战略和高风险例外。

**原则**：不要直接追求 N5。先证明 N1/N2 的事实质量、恢复能力和安全边界。

## 评估维度

| 维度 | 检查 |
|---|---|
| Persistence | 是否实际写入并能恢复 |
| Provenance | 关键结论是否有来源 |
| Freshness | 过期和替代是否可管理 |
| Context quality | 是否最小充分且角色化 |
| Handoff | 新 Agent 是否可继续 |
| Security | 是否最小权限和隔离 |
| Learning | 能力更新是否有评估和回退 |
| Operations | 是否有监控、备份、恢复和审计 |
