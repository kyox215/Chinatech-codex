# MEMORY QUICKSTART — 记忆系统快速部署

## 1. 复制目录

把 `runtime-memory/` 复制为项目中的：

```text
.ai-company/memory/
```

把以下规则放入 Agent 可读取位置：

- `MEMORY_SYSTEM_PROMPT.md`
- `CONTEXT_ORCHESTRATOR_PROMPT.md`
- `CONTEXT_MEMORY.md`
- `AGENT_LEARNING_CAPABILITY.md`
- `KNOWLEDGE_GOVERNANCE.md`
- `MEMORY_OPERATIONS_RUNBOOK.md`

## 2. 指定角色

小型项目至少指定：

- CEO / Task Owner。
- CKMO 或 Memory Steward。
- Context Orchestrator。
- QA / Reviewer。

大型项目为每个部门指定 Memory Steward，并独立启用 Capability Development 和 Epistemic QA。

## 3. 初始化项目记忆

填写：

- `COMPANY_MEMORY.md`。
- `PROJECT_MEMORY.md`。
- `GLOSSARY.md`。
- `CAPABILITY_REGISTRY.md`。
- `OPEN_CONFLICTS.md`。

只写已确认内容；未知项保留为 UNKNOWN，不用猜测补齐。

## 4. 为任务建立记忆

```text
memory/tasks/TASK-YYYYMMDD-NNN/
  TASK_MEMORY.md
  EVENT_LOG.md
  CONTEXT_PACKET.md
  EVIDENCE_INDEX.md
  checkpoints/
  handoffs/
```

使用 `templates/` 中对应模板。

## 5. 启动提示词

```text
按照 AI Company OS v2.0 执行项目记忆初始化。
不要把聊天历史视为永久事实。
读取项目权威来源，建立 Company、Project、Department、Agent 和 Task 记忆；所有关键记录标注来源、状态、owner、版本和复审触发。
生成首个 Context Packet，并用一个没有历史聊天的新 Agent 视角验证是否可恢复。
```

## 6. 日常循环

- 开始：Rehydrate + Context Packet。
- 执行：Event Log + Memory Delta。
- 阶段：Checkpoint。
- 交接：Handoff Packet。
- 恢复：Resume Packet。
- 关闭：Consolidation + Capability Review。
- 周期：Audit + Cleanup。

## 7. 最小验收

- 新 Agent 不看聊天也能恢复任务。
- 关键事实和决定能定位来源。
- 旧信息和冲突不会静默进入上下文。
- 部门记忆会随任务变化更新。
- 能力升级必须有评估和批准。
- 无秘密、无跨域泄露、无隐藏思维链存档。
