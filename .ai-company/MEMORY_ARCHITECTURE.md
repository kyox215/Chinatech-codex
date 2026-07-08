# MEMORY ARCHITECTURE — 组织记忆持久化与技术架构

## 1. 目标

本文件定义 AI Company OS 的持久记忆架构。它解决四个问题：

1. 信息保存在哪里。
2. 哪些信息是事实、决定、摘要或临时状态。
3. 多个 Agent 如何安全地读写、版本化和恢复。
4. 上下文窗口有限时，如何从长期记忆编译短期工作上下文。

---

## 2. 关键事实：模型上下文不等于持久记忆

- 模型当前会话中的上下文是易失的。
- 持久记忆必须落到可重读的介质：版本控制文件、数据库、对象存储、经批准的记忆服务或其组合。
- 向量数据库只负责相似性检索，不应成为唯一事实来源。
- 摘要和 embedding 是派生视图，可以重建；原始决定、证据和事件记录必须有可定位来源。
- 任何 Agent 在未确认持久化成功前，不得报告“已永久记住”。

---

## 3. 逻辑分层

### M0 — 宪法记忆 Constitution

内容：老板长期指令、公司制度、安全法律边界、自治和审批规则。

- 权威最高。
- 更新频率最低。
- 只允许明确批准修改。
- 默认纳入每个任务的控制上下文。

### M1 — 公司记忆 Company

内容：战略、组织、术语、跨项目原则、重大经营决定。

- 跨项目有效。
- 由 Owner、CEO、Governance 维护。
- 应有复审周期和适用范围。

### M2 — 项目组合记忆 Portfolio

内容：项目关系、路线图、共享能力、资源约束、依赖和优先级。

- 解决跨项目冲突和复用。
- 不替代单个项目的当前实现记录。

### M3 — 项目记忆 Project

内容：业务规则、架构、模块地图、API、数据、权限、环境、部署、风险和 ADR。

- 是多数任务恢复的主要长期上下文。
- 必须与代码、schema、配置和运行证据校准。

### M4 — 部门记忆 Department

内容：部门职责、领域词汇、SOP、接口、惯例、经验、风险和能力。

- 每个部门有明确 Steward。
- 允许部门自主维护 A1 内容；A2 以上按治理流程审批。

### M5 — Agent 运行档案 Agent Profile

内容：角色、职责、能力等级、工具权限、限制、评估、常见失败模式。

- 不是人格化日记。
- 不包含隐藏思维链。
- 任何权限和能力升级必须可审计。

### M6 — 任务与工作记忆 Task / Working

内容：目标、范围、状态、当前计划、事实、假设、决定、阻塞和证据索引。

- 生命周期随任务变化。
- 任务关闭后归档，并选择性提升为长期知识。

### M7 — 情节与事件记忆 Episodic / Event

内容：执行时间线、工具动作、状态变化、事故和验证结果。

- 适合审计和重建。
- 原始事件通常不直接塞入 Agent 上下文，而通过快照和摘要使用。

### M8 — 派生记忆 Derived

内容：摘要、索引、知识图谱、embedding、缓存、推荐和上下文包。

- 可丢弃并重建。
- 必须保留原始来源链接。
- 不得单独作为高风险事实证明。

---

## 4. 多维分类

每条记忆不仅有层级，还必须至少按以下维度分类：

### 4.1 认知状态

- `verified`：由权威证据验证。
- `approved`：由有权限角色批准为规范或决定。
- `observed`：实际观察到，但可能只适用于特定时间/环境。
- `inferred`：从事实推断。
- `proposed`：尚未批准的建议。
- `unknown`：未知或证据不足。

### 4.2 生命周期状态

- `draft`。
- `active`。
- `disputed`。
- `superseded`。
- `expired`。
- `archived`。
- `quarantined`。

### 4.3 敏感等级

- `public`：可公开。
- `internal`：组织内部。
- `confidential`：按角色最小授权。
- `restricted`：严格限定，通常涉及高敏感数据、秘密或重大安全信息。

### 4.4 时间语义

- `valid_from` / `valid_until`：业务有效期。
- `observed_at`：被观察时间。
- `recorded_at`：写入时间。
- `review_at`：下次复审时间或事件触发条件。

不得把“记录得晚”误认为“事实更晚”。

---

## 5. 标准记忆对象

推荐 YAML front matter + Markdown 正文：

```markdown
---
memory_id: MEM-20260618-0001
title: Customer quote acceptance state machine
scope: project
project_id: PROJECT-001
department: product
type: decision
status: active
epistemic_status: approved
authority: A3
sensitivity: internal
owner: Product Lead
created_at: 2026-06-18T14:00:00+02:00
updated_at: 2026-06-18T14:00:00+02:00
valid_from: 2026-06-18
valid_until: null
review_at: on_business_rule_change
version: 1
source_refs:
  - docs/decisions/DEC-004.md
  - tasks/TASK-20260618-01/approval.md
supersedes: []
superseded_by: null
related_ids:
  - API-CONTRACT-QUOTE-01
  - DB-MIGRATION-027
tags: [quote, customer, state-machine]
---

# Statement

客户只能在报价处于 `pending_customer` 时确认或拒绝。

# Scope and exceptions

...

# Evidence and rationale

...
```

正文只写必要、可审计内容，不保存私有思维过程。

---

## 6. 推荐物理目录

```text
/.ai-company/
  /memory/
    README.md
    MEMORY_INDEX.md
    ACTIVE_CONTEXT.md
    COMPANY_MEMORY.md
    PORTFOLIO_MEMORY.md
    PROJECT_MEMORY.md
    GLOSSARY.md
    /decisions
    /rules
    /projects
      /<project-id>
        PROJECT_SNAPSHOT.md
        ARCHITECTURE_INDEX.md
        BUSINESS_RULES.md
        DATA_AND_API_INDEX.md
        RISK_INDEX.md
    /departments
      /<department-id>
        DEPARTMENT_MEMORY.md
        SOP_INDEX.md
        LESSONS.md
        CAPABILITIES.md
    /agents
      /<agent-id>
        PROFILE.md
        CAPABILITIES.md
        EVALUATIONS.md
        ACTIVE_ASSIGNMENT.md
    /tasks
      /<task-id>
        TASK_MEMORY.md
        EVENT_LOG.md
        CONTEXT_PACKET.md
        EVIDENCE_INDEX.md
        /handoffs
        /checkpoints
    /conflicts
    /lessons
    /quarantine
    /archive
  /capabilities/
    CAPABILITY_REGISTRY.md
    /skills/<skill-id>/SKILL.md
    /evals/<capability-id>/
```

小型项目可把同类内容合并，但稳定 ID、来源、状态和版本不可省略。

---

## 7. 事件日志 + 快照模式

推荐使用两种互补记录：

### 7.1 Append-only Event Log

每个重要变化追加事件，不原地改写历史：

```yaml
event_id: EVT-20260618-0188
task_id: TASK-20260618-01
event_type: decision_approved
actor: CEO-Agent
timestamp: 2026-06-18T15:20:00+02:00
object_ids: [DEC-004, MEM-20260618-0001]
source_ref: tasks/TASK-20260618-01/approval.md
summary: "批准客户报价确认状态机"
```

### 7.2 Materialized Snapshot

把事件折叠成当前状态，供快速恢复：

- 当前任务状态。
- 当前有效决定。
- 当前待办和阻塞。
- 当前风险。
- 最新证据。
- 下一步和恢复入口。

快照出错时应能从事件日志和原始来源重建。

---

## 8. 存储实现建议

### 8.1 版本控制 Markdown（最小可行）

适合：单项目、中低并发、需要人类可读与代码评审。

优点：透明、可审查、可 diff、易迁移。

限制：并发写、复杂查询、细粒度权限和大规模事件性能有限。

### 8.2 关系数据库

适合：多项目、多 Agent、结构化状态、事务和权限。

建议表：

- `memory_records`。
- `memory_versions`。
- `memory_relations`。
- `memory_events`。
- `memory_access_policies`。
- `context_packets`。
- `agent_capabilities`。
- `evaluations`。
- `memory_conflicts`。

必须保留原始来源定位，不把数据库文本变成无法审计的孤立结论。

### 8.3 对象存储

适合：大文件、日志、截图、制品和历史快照。

数据库只保存元数据、哈希、权限和对象地址。

### 8.4 全文与向量检索

用于候选召回，不用于决定权威。

- 全文检索适合稳定术语、ID、路径和精确字段。
- 向量检索适合语义相似、不同表述和历史经验。
- 最终排序还必须结合权限、状态、权威、时间和来源质量。

### 8.5 推荐组合

```text
Git/Docs = 规范与人类可读事实
Relational DB = 状态、版本、权限、关系和事件
Object Store = 大型证据和归档
Search/Vector Index = 可重建的检索层
```

---

## 9. 读路径

1. 解析任务、角色和权限。
2. 加载 M0/M1 中必须生效的控制规则。
3. 读取任务快照和最新检查点。
4. 检索项目、部门、决定、能力和相关经验。
5. 过滤无权限、过期、被替代和隔离记录。
6. 发现冲突并标记，不静默选边。
7. 从原始来源抽查高风险结论。
8. 编译角色专用 Context Packet。
9. 记录使用了哪些记忆版本，便于复现。

---

## 10. 写路径

1. Agent 产生 Memory Candidate。
2. 写入任务事件或候选区。
3. Curator 检查类型、来源、去重、适用范围和敏感性。
4. 根据权威级别路由批准。
5. 使用乐观锁或版本检查提交。
6. 生成新版本和审计事件。
7. 更新索引和派生视图。
8. 通知受影响部门或任务刷新上下文。
9. 对高影响变更触发回归评估。

不得由检索摘要直接反写原始事实。

---

## 11. 并发与一致性

- 每条记录有 `version` 或 ETag。
- 写入时声明基于哪个版本。
- 当前版本已变化时，拒绝静默覆盖并要求合并。
- 同一高风险记录在一个时间段只允许一个有效编辑所有者。
- 多记录更新可使用事务或 Change Set。
- Context Packet 记录其依赖的记忆版本；依赖更新后标记 packet stale。

### Change Set

```yaml
change_set_id: MCS-20260618-03
base_versions:
  MEM-001: 4
  MEM-009: 2
changes:
  - update: MEM-001
  - supersede: MEM-009
approvals:
  - CKMO
  - Security
rollback_ref: git-commit-or-db-transaction-id
```

---

## 12. 版本、替代和删除

### 版本

- 每次语义变化创建新版本。
- 拼写和无语义格式修改可按实现决定是否升版本，但必须保持审计。

### 替代

- 新记录通过 `supersedes` 指向旧记录。
- 旧记录保留但从默认检索中降权或排除。
- 新记录说明替代原因和生效时间。

### 删除

- 普通知识优先软删除/归档。
- 法律、隐私或秘密要求删除时，执行受控硬删除和索引清除。
- 派生缓存、embedding、备份和导出副本也必须纳入删除范围。
- 删除动作记录对象 ID、批准、范围和验证，不保留被要求删除的敏感正文。

---

## 13. 保留策略

示例默认策略，项目应按法律和业务调整：

| 内容 | 建议处理 |
|---|---|
| 活跃制度和决定 | 长期保留，定期复审 |
| 任务工作记忆 | 任务关闭后归档，提取长期知识 |
| 详细工具日志 | 按审计和故障需要限期保留 |
| 摘要与检索缓存 | 可重建，可短期保留 |
| 能力评估结果 | 保留当前与关键历史版本 |
| 含个人或敏感数据记录 | 最小化并按批准期限删除 |
| 过期假设和草稿 | 归档或清理，默认不检索 |

禁止“因为以后可能有用”而无限保留所有上下文。

---

## 14. 关系模型

推荐关系：

- `supports`：证据支持结论。
- `contradicts`：记录相互冲突。
- `supersedes`：新记录替代旧记录。
- `implements`：代码/配置实现决定。
- `validated_by`：由测试或审计验证。
- `depends_on`：依赖。
- `owned_by`：所有者。
- `applies_to`：适用范围。
- `derived_from`：摘要或索引来源。
- `learned_from`：能力或经验来自任务/事故。
- `requires_capability`：任务需要能力。

知识图谱可作为索引，但关系也必须指向真实对象和来源。

---

## 15. 完整性与防篡改

高风险记忆可使用：

- 内容哈希。
- 版本控制签名。
- 数据库审计日志。
- 不可变对象版本。
- 批准记录。
- 备份校验。

需要检测：

- 内容被修改但版本未变化。
- 来源失效或被删除。
- 高权威记录未经批准变更。
- 派生索引与源记录不一致。
- 不同环境存在记忆漂移。

---

## 16. 备份与恢复

必须定义：

- RPO：最多可丢失多少记忆更新。
- RTO：记忆服务多久恢复。
- 备份范围：正文、元数据、版本、关系、权限、事件和索引重建配置。
- 恢复顺序：M0/M1 → 项目决定 → 任务状态 → 其他历史。
- 恢复验证：抽样重建 Context Packet，并与恢复前快照比较。

向量索引可以重建，但原始文本、元数据、权限和来源不可只存在索引中。

---

## 17. 记忆服务接口（概念）

```text
get(memory_id, version?)
search(query, scope, status, authority, time, acl)
propose(record)
review(candidate_id, decision, comments)
commit(change_set)
supersede(old_id, new_id)
checkpoint(task_id)
compile_context(task_id, agent_id, mode, budget)
list_conflicts(scope)
quarantine(memory_id, reason)
restore(snapshot_id)
audit(scope, policy)
```

任何实现都应把读、提议、批准、写入和权限管理分离。

---

## 18. 最小落地架构

没有数据库和向量服务时，仍可采用：

1. Markdown 文件作为当前事实和决定。
2. Git 历史作为版本与审计。
3. `EVENT_LOG.md` 作为追加事件。
4. `MEMORY_INDEX.md` 作为人工维护索引。
5. 文件搜索 + 稳定 ID 作为检索。
6. `CONTEXT_PACKET.md` 作为每次任务的编译产物。
7. PR 审核作为高权威写入门禁。

这比依赖单次长聊天更可靠，并可在未来迁移到数据库而不丢失语义。

---

## 19. 架构验收标准

- 任务在无聊天历史条件下可恢复。
- 每条关键记忆可追溯到来源和版本。
- 派生索引删除后可重建。
- 权限隔离和敏感分级在读写两端执行。
- 并发写不会静默丢失更新。
- 冲突、过期和被替代记录不会默认当作当前事实。
- 能力和权限变化有独立审批和回退。
- 备份恢复经过实际演练。
