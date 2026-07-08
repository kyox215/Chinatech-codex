# CODEX OPERATING MODEL — Codex 原生运行制度

## 1. 目的

把公司治理转换为 Codex 可以稳定执行的运行模型。角色、流程、记忆和权限必须映射到真实的 Codex 机制，不得仅靠角色扮演文字。

## 2. 五层结构

### Layer 1 — Constitution

载体：根 `AGENTS.md` 和子目录覆盖文件。

内容：不可跳过的行为边界、风险、证据、写入和记忆规则。

要求：根指令保持精炼；详细制度使用链接按需读取。

### Layer 2 — Orchestration

载体：Codex 主线程。

职责：目标理解、风险分级、团队选择、工作包、合并、审批和最终验收。

主线程不能把整合责任推给某个子 Agent。

### Layer 3 — Specialists

载体：`.codex/agents/*.toml`。

职责：在窄领域提供证据、审查或实施。每个 Agent 必须有清晰边界和默认沙箱。

### Layer 4 — Capabilities

载体：`.agents/skills/*/SKILL.md`。

职责：提供可重复、可评估的流程。Skill 不是人格，不拥有决策权。

### Layer 5 — Organizational Memory

载体：`.ai-company/memory/`。

职责：保存跨会话事实、决定、任务状态、部门知识和能力证据。

## 3. 任务状态机

```text
received
→ classified
→ context_ready
→ planned
→ approved_when_required
→ implementing
→ reviewing
→ validating
→ memory_sync
→ closed
```

异常状态：

```text
blocked | paused | rejected | rolled_back | incident
```

任何状态变化都要有 owner、时间、原因和下一动作。

## 4. 动态组队

### 最小团队原则

| 任务 | 默认团队 |
|---|---|
| T0 文档/格式 | 主线程 |
| T1 局部修复 | explorer（可选）+ implementer + qa（按风险） |
| T2 跨模块功能 | explorer + architect/product + implementer + qa |
| 数据变更 | explorer + architect + data + implementer + qa |
| 权限/敏感数据 | explorer + architect + security + implementer + qa |
| 发布 | release + qa + security（按风险） |
| 长上下文恢复 | 主线程 + memory_steward（必要时） |

不允许无理由启动全部 Agent。

## 5. 工作包契约

每个子 Agent 必须收到：

- 任务 ID。
- 具体问题。
- 可读取范围。
- 禁止事项。
- 已知事实和来源。
- 待验证假设。
- 输出格式。
- 证据要求。
- 截止/停止条件。

示例：

```text
Spawn solution_architect for TASK-... .
Scope: analyze quote state transition and API compatibility only.
Do not edit files.
Return: current facts, options, recommendation, migration risk, rollback, evidence paths.
Stop when the decision package is complete; do not expand into UI implementation.
```

## 6. 结果合并

主线程必须：

1. 去重。
2. 区分共识与分歧。
3. 检查证据质量。
4. 解决接口冲突。
5. 明确最终决定和未决项。
6. 生成给 implementer 的单一方案。

禁止把多个互相矛盾的 Agent 报告原样交给实施者。

## 7. 执行控制

- 默认一个写入型 Agent。
- 修改前保存当前 Git 状态和相关文件证据。
- 大任务按可独立验证的切片实施。
- 每个切片后运行最相关验证，不等到最后一次性发现问题。
- 超出范围的发现进入 backlog，不顺手修复。
- 变更失败时优先恢复稳定状态，再分析。

## 8. 审查独立性

- 设计者可以解释，但不能替 Reviewer 宣布通过。
- implementer 不给自己的工作做最终独立验收。
- Reviewer 的发现必须有严重级别、证据、影响和复现/验证方法。
- 审查结论可以是通过、带条件通过、阻断或证据不足。

## 9. 运行模式

### Plan mode

只读调查、方案和批准包。用于 L0/L1、R3/R4 或老板明确要求。

### Execute mode

在批准范围内实施和测试。默认 L2。

### Audit mode

只读检查，不改变事实源。用于项目体检、安全审计和能力评估。

### Incident mode

先止损、保全证据、稳定服务，再做根因和修复。禁止为追求“干净方案”扩大故障。

## 10. 关闭

主线程对完成声明负责。Hook、脚本或子 Agent 都不能单独宣布任务完成。
