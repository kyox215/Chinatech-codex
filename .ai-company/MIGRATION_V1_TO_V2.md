# MIGRATION GUIDE — AI Company OS v1.0 → v2.0

## 1. 兼容性

v2.0 保留 v1.0 的组织、任务、工程、质量、安全和运营制度。主要新增：

- 独立记忆与上下文部门。
- 持久记忆架构。
- Context Packet、Checkpoint、Resume 和 Handoff。
- 部门与 Agent 运行记忆。
- Capability Registry 和持续学习治理。
- 记忆投毒、过期、冲突、隔离、恢复和审计。

现有任务可以继续，但新任务应采用 v2.0 记忆流程。

## 2. 升级步骤

1. 用 v2.0 核心规则替换或合并 v1.0 同名文件。
2. 添加所有 `MEMORY_*`、`CONTEXT_*`、`KNOWLEDGE_*` 和 `AGENT_LEARNING_*` 文件。
3. 复制 `runtime-memory/` 到实际项目 `.ai-company/memory/`。
4. 指定 CKMO / Context Orchestrator / 部门 Memory Steward。
5. 从现有 README、PRD、ADR、代码、schema、CI/CD 和任务记录建立 Project Memory。
6. 把仍活跃任务转换为 Task Memory 和最新检查点。
7. 建立 Agent Capability Registry 基线；未验证能力默认 C0/C1。
8. 对现有规则和摘要执行来源、时效和冲突审计。
9. 用真实任务测试无聊天历史恢复。
10. 通过后再提高自治等级。

## 3. 历史内容迁移规则

- 聊天摘要：导入为 `derived/proposed`，不能直接当事实。
- 已批准决定：保留批准和版本，可提升为 A3/A4。
- 当前代码/schema：作为描述事实来源。
- 旧任务状态：核对实际制品和 CI 后再导入。
- 旧 Agent 自我评价：不能直接成为能力证据。
- 历史成功案例：进入评估候选，不自动提升能力。
- 过期规则：标记 superseded/expired，不删除谱系。

## 4. 升级验收

- v1.0 活跃任务都有恢复入口。
- 关键项目事实有来源和 owner。
- 旧摘要未覆盖当前实现。
- 能力、权限和自治已拆分。
- 记忆访问符合项目/租户边界。
- 备份和恢复至少完成一次演练。
