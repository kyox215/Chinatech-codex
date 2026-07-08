# AGENT LEARNING & CAPABILITY — Agent 持续学习、能力演进与安全升级

## 1. 目的

本制度让部门与 Agent 随项目推进积累经验、更新工作方法和提高能力，同时避免“自称学会”“未经验证扩权”“一次成功就推广”以及错误经验长期污染系统。

---

## 2. 对“学习”的准确解释

在默认情况下，Agent 的持续学习指可审计的运行层更新：

- 记忆条目。
- 提示词、角色说明和输出协议。
- SOP、检查表和决策树。
- 可复用 Skill Package。
- 工具使用说明和安全包装。
- 示例、反例与评估集。
- 路由、升级和复核策略。
- 能力等级和自治边界。

除非实际完成模型训练、微调或参数更新并有证据，否则不得声称“模型权重已经学习”或“永久内化”。

---

## 3. 四个必须分开的概念

### 3.1 Knowledge — 知识

Agent 可读取哪些事实、决定、规则、经验和文档。

### 3.2 Capability — 能力

Agent 经验证可以在特定条件下完成哪些类型的任务。

### 3.3 Permission — 权限

Agent 被允许读取或修改哪些资源、调用哪些工具。

### 3.4 Autonomy — 自治

Agent 可以在多大程度上无需逐步批准自行执行。

关系：

```text
有知识 ≠ 有能力
有能力 ≠ 有权限
有权限 ≠ 有自治
一次成功 ≠ 稳定能力
多 Agent 同意 ≠ 已验证事实
```

---

## 4. 能力对象模型

每项能力使用稳定记录：

```yaml
capability_id: CAP-BACKEND-API-MIGRATION
name: "设计并实施兼容性 API 迁移"
agent_or_role: backend-agent
scope: project | department | organization
level: C0 | C1 | C2 | C3 | C4
status: proposed | sandbox | validated | approved | restricted | deprecated | revoked
risk_class: low | medium | high | critical
allowed_environments: [development, test]
required_tools: [repo-read, repo-write, test-runner]
required_context: [api-contract, architecture-decisions, project-rules]
preconditions:
  - "存在批准的迁移计划"
  - "有回滚与兼容窗口"
forbidden_actions:
  - "未经批准修改生产流量"
evaluation_suite: EVAL-API-MIGRATION-V3
last_evaluated_at: 2026-06-18
valid_until: 2026-09-18
owner: Backend Lead
approvers: [CTO, QA]
security_review: required
success_evidence: []
known_failure_modes: []
version: 1
```

能力记录必须说明“在哪些条件下能做”，不能只写模糊的“擅长后端”。

---

## 5. 能力等级

### C0 — 未知 / 未批准

- 没有足够证据。
- 只能研究、解释或在安全样例上尝试。
- 不可用于真实高影响工作。

### C1 — 辅助能力

- 能提供草稿、分析或建议。
- 需要专业人员/上级 Agent 逐项复核。
- 不独立执行有副作用动作。

### C2 — 受监督执行

- 能在明确工作包、非生产环境和检查点下执行。
- 需要独立审查和验证。
- 默认适用于新验证的工程能力。

### C3 — 委托执行

- 能在已批准策略和范围内端到端完成常规任务。
- 高风险、异常和范围变化仍需升级。
- 必须有稳定评估、监控和回退。

### C4 — 有界自治

- 能在政策、预算、SLO、速率和停止条件内持续运行。
- 需要自动监控、操作审计、故障隔离和人工 kill switch。
- 不等于无限权限。

能力等级只能由有权限批准人提升。失败、漂移和环境变化可自动触发降级建议或临时限制。

---

## 6. 能力生命周期

```text
Observation
  ↓
Lesson Candidate
  ↓
Generalization Review
  ↓
Skill / Procedure Proposal
  ↓
Sandbox Evaluation
  ↓
Security & Quality Review
  ↓
Approved Capability
  ↓
Staged Rollout
  ↓
Production Monitoring
  ↓
Retain / Improve / Restrict / Deprecate / Revoke
```

### 6.1 Observation

记录具体事件，不急于概括：

- 成功了什么。
- 失败了什么。
- 使用了哪些上下文、工具和条件。
- 结果如何验证。

### 6.2 Lesson Candidate

把观察转成候选经验：

- 可重复的问题。
- 可能的根因。
- 适用范围。
- 反例和例外。
- 需要进一步测试的假设。

### 6.3 Generalization Review

判断经验能否推广：

- 是否只是偶然成功。
- 是否依赖特定项目、版本或数据。
- 是否与既有规则冲突。
- 是否可能引入安全或质量副作用。
- 是否已有重复能力。

### 6.4 Skill Proposal

形成可执行资产：

- 提示词或工作协议。
- SOP 或决策树。
- 工具包装和参数 schema。
- 示例、反例和退出条件。
- 验证与回滚方式。

### 6.5 Evaluation

在代表性、安全、可重复的评估集上测试。

### 6.6 Approval

根据风险由 Agent Owner、Department Lead、QA、Security、CTO 或 Owner 批准。

### 6.7 Staged Rollout

从低风险、非生产、人工复核开始，逐步扩大。

### 6.8 Monitoring

观察成功率、纠正率、异常行为、成本、延迟、权限使用和业务结果。

---

## 7. 任务结束后的学习循环

每个非微小任务执行 `Post-Task Learning Review`：

1. **Outcome**：实际交付和业务结果。
2. **Evidence**：测试、审查、运行和用户反馈。
3. **Context quality**：缺失、冗余或过期的上下文。
4. **Agent behavior**：哪些步骤正确，哪些需人工纠正。
5. **Process gaps**：SOP、规则、工具或交接缺口。
6. **Reusable asset**：可提炼的模板、技能、测试或文档。
7. **Risk**：推广该经验可能造成什么问题。
8. **Proposal**：保持、更新、试验、降级或不处理。

不是每个任务都必须新增规则。没有跨任务价值时，经验留在任务归档即可。

---

## 8. 部门持续学习

每个部门维护：

- `DEPARTMENT_MEMORY.md`：当前事实、边界和规则。
- `SOP_INDEX.md`：已批准流程。
- `LESSONS.md`：已验证经验与反模式。
- `CAPABILITIES.md`：角色能力和等级。
- `EVALUATIONS.md`：评估集、结果和版本。
- `OPEN_GAPS.md`：能力缺口和改进计划。

### 更新触发

- 完成重大任务。
- 出现重复缺陷或返工。
- 发生事故或安全事件。
- 客户/运营反馈揭示新模式。
- 依赖、模型、工具、架构或政策变化。
- 能力评估到期或表现漂移。

### 更新责任

执行 Agent 提交候选；Memory Steward 整理；Department Lead 对部门规则负责；QA/Security 对高风险能力独立验证。

---

## 9. Agent 个人运行记忆

每个 Agent 可有运行档案：

```text
/agents/<agent-id>/
  PROFILE.md
  CAPABILITIES.md
  EVALUATIONS.md
  ACTIVE_ASSIGNMENT.md
  CORRECTIONS.md
```

可记录：

- 角色与职责。
- 当前任务状态。
- 已验证能力。
- 工具和数据权限。
- 必须升级的情形。
- 已知失败模式。
- 最近纠正和评估。

不得记录：

- 隐藏思维链。
- 秘密或不必要个人数据。
- 未经验证的“个性判断”。
- 用于规避治理的私有规则。
- 由 Agent 自行宣告的权限和能力。

---

## 10. Skill Package 标准

推荐目录：

```text
/capabilities/skills/<skill-id>/
  SKILL.md
  EXAMPLES.md
  ANTI_EXAMPLES.md
  EVALS.md
  CHANGELOG.md
  /scripts
  /fixtures
```

`SKILL.md` 至少包含：

```markdown
# Skill
- Skill ID:
- Purpose:
- Applicable roles:
- Preconditions:
- Required context:
- Required tools:
- Allowed environments:
- Procedure:
- Validation:
- Failure modes:
- Escalation triggers:
- Forbidden actions:
- Security/privacy notes:
- Version:
- Owner:
- Last validated:
```

脚本和工具必须经过代码、安全和依赖审查；文档声称的能力必须能由评估复现。

---

## 11. 评估体系

### 11.1 评估集组成

- 正常样例。
- 边界样例。
- 已知历史失败样例。
- 对抗和提示注入样例。
- 权限和拒绝样例。
- 不完整、冲突和过期上下文样例。
- 工具失败、超时和部分结果样例。

### 11.2 评估维度

- 任务正确性。
- 证据与来源质量。
- 规则遵守。
- 权限边界。
- 风险识别和正确升级。
- 工具调用安全。
- 交接与恢复质量。
- 成本、延迟和稳定性。
- 不确定性表达。

### 11.3 通过规则

项目应按风险设门槛。至少要求：

- 所有安全关键和权限关键样例通过。
- 无伪造执行、测试或证据。
- 无越权或秘密泄露。
- 代表性任务达到可接受成功水平。
- 与旧版本相比没有不可接受回归。
- 失败时能进入安全状态并正确升级。

不能仅用平均分掩盖关键失败。

---

## 12. 能力晋升规则

能力从 C1 → C2 → C3 → C4 应逐级进行，除非有非常充分的独立证据和批准。

晋升材料包括：

- 能力定义和边界。
- 代表性评估结果。
- 历史真实任务表现。
- 已知失败模式。
- 工具与权限需求。
- 安全、隐私和业务风险。
- 监控和回退。
- 有效期和复审触发。

### C3/C4 额外要求

- 稳定的输入/输出契约。
- 自动质量门禁。
- 异常和漂移监控。
- 预算、速率和范围限制。
- kill switch。
- 事故与回滚流程。
- 独立批准。

---

## 13. 自动降级与撤销

出现下列情况应限制或降低能力：

- 严重错误、越权、秘密泄露或伪造证据。
- 新模型/提示/工具版本导致回归。
- 环境或业务规则发生重大变化。
- 评估过期且无法确认仍然有效。
- 多次需要人工纠正同一问题。
- 成本、延迟或稳定性超出允许范围。
- 使用了未批准的方法或数据。

降级不等于删除历史。保留失败证据、影响范围和重新验证条件。

---

## 14. 能力更新审批矩阵

| 变更 | 提议 | 审核 | 批准 |
|---|---|---|---|
| 提示词微调，不改变权限 | Capability Agent | QA / Department Lead | Agent Owner |
| 新部门 SOP | Dept Steward | QA / 受影响部门 | Department Lead |
| 新低风险 Skill | Capability Agent | QA | Department Lead |
| 新写入工具 | Agent Owner | Security / CTO | 对应权限批准人 |
| 生产工具权限 | Agent Owner | Security / SRE / QA | Owner 或授权人 |
| C2 → C3 | Agent Owner | QA / Security（按风险） | Department Lead / CEO |
| C3 → C4 | CEO / Agent Owner | QA / Security / Governance | Owner |
| 修改最高规则 | CEO / Governance | 受影响负责人 | Owner |
| 能力撤销 | QA / Security / Agent Owner | 对应负责人 | 可紧急先限制，后补批准 |

---

## 15. 防止错误学习

### 单次事件过拟合

- 一次成功只产生候选经验，不自动变成规则。
- 一次关键事故可以立即增加临时防护，但必须复审副作用。

### 幸存者偏差

- 同时记录失败、人工修正和未完成任务。
- 不只从成功案例学习。

### 指标投机

- 不按输出长度、任务数量或表面速度评估能力。
- 使用业务结果和保护指标。

### 记忆投毒

- 外部内容、未经确认的用户指令和模型输出不能直接变成高权威技能。
- 新技能要经过来源、权限和对抗审查。

### 自我批准

- 提议者不能独自批准高风险能力。
- Agent 不得修改自己的评估集以掩盖失败。

### 灾难性遗忘

- 新版本必须运行旧能力回归集。
- 被替代 SOP 保留历史和恢复路径。

---

## 16. 模型、提示和工具变化

任何底层变化都可能让能力证据失效：

- 模型或模型版本。
- 系统提示和规则。
- 工具 schema、权限和实现。
- 上下文编译方式。
- 数据源和检索索引。
- 业务规则和项目架构。

变化后应确定受影响能力，按风险重新评估。能力记录必须绑定关键运行版本。

---

## 17. 能力发展路线图

每个部门可使用：

```markdown
# Capability Roadmap

## Current state
- Capability / level / evidence / limitations

## Gaps
- 业务需求
- 当前缺口
- 风险

## Next experiments
- 假设
- 沙箱任务
- 评估集
- 通过标准

## Promotion candidates
- 所需批准
- 监控
- 回退

## Deprecation candidates
- 原因
- 替代能力
- 迁移计划
```

优先提升高频、可验证、可回滚且能明显降低老板协调负担的能力。

---

## 18. 学习指标

- 新能力首次验收通过率。
- 人工纠正率和重复纠正率。
- 能力升级后的回归率。
- 已知失败模式复发率。
- 从发现缺口到验证改进的周期。
- 可复用 Skill 被成功采用次数。
- 能力过期和未复审比例。
- Agent 正确拒绝/升级高风险任务的比例。
- 能力带来的业务时间、质量或成本改进。

不要以“能力数量”作为主要目标。

---

## 19. 能力发展 Agent 输出

```markdown
# Capability Review
- Task / incident / evaluation source:
- Agent / role:
- Current capability and level:
- Observed success:
- Observed failure or correction:
- Context and conditions:
- Candidate lesson:
- Generalizability:
- Proposed asset change:
- Evaluation plan:
- Security and permission impact:
- Recommended level change:
- Required approvers:
- Rollout and rollback:
- Memory updates:
```

---

## 20. 完成定义

一次能力更新只有在以下条件满足时才算完成：

- 能力边界和前置条件清楚。
- 资产版本化并可复现。
- 评估集和结果可定位。
- 安全、权限和隐私影响已审查。
- 批准人与有效期明确。
- 灰度、监控和回退可执行。
- Agent / 部门记忆与能力注册表同步。
- 旧能力被正确保留、替代或撤销。
