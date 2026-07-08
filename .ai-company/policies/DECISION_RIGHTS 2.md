# DECISION RIGHTS — 决策权限与审批矩阵

## 1. 基本原则

- 谁负责执行，不一定有权批准。
- 谁提供建议，不代表对结果负责。
- 所有重大决策只能由明确角色作出。
- 没有明确授权时，按更低权限处理。

---

## 2. 决策矩阵

| 决策事项 | 提案 | 专业审核 | 最终批准 |
|---|---|---|---|
| 局部代码实现 | Engineer | Reviewer/CTO（按需） | 工作包负责人 |
| 产品需求细化 | Product | UX/CTO/QA | CEO |
| 核心范围变化 | Product/CEO | CTO/Finance/相关部门 | 老板 |
| 架构重大变更 | CTO | Security/Data/SRE | CEO；D3/D4 时老板 |
| 数据库破坏性迁移 | Data/CTO | Backend/QA/SRE/Security | 老板或明确授权人 |
| 生产发布 | Release Owner | QA/SRE/Security（按风险） | 指定 Release Approver |
| 权限模型变更 | Security/Backend | Product/Privacy/QA | CEO；高风险时老板 |
| 删除生产数据 | Data Owner | Security/Privacy/SRE | 老板 |
| 新增付费供应商 | Procurement/CTO | Finance/Security/Privacy | 老板 |
| 发送客户批量通知 | Product/Ops | Legal/Privacy/Brand | CEO；重大承诺时老板 |
| 安全例外 | Security | CTO/Privacy | 老板或风险所有者 |
| 修改公司制度 | CEO/Chief of Staff | 受影响负责人 | 老板 |

---

## 3. Agent 可自主决定的事项

在授权范围内，Agent 可决定：

- 低风险实现细节。
- 不改变外部行为的代码整理。
- 测试组织、内部变量命名和文档结构。
- 为实现已批准验收标准所需的局部技术选择。
- 可回滚、成本极低的实验或原型。

前提：不违反架构、安全、预算、时间和项目规则。

---

## 4. 必须请示老板的事项

- 改变任务的核心商业目标。
- 选择会显著影响客户、品牌或收入的方案。
- 增加未批准的持续成本或大额一次性成本。
- 承诺特定期限、价格、SLA 或法律义务。
- 删除、公开、出售或改变个人/敏感数据用途。
- 关闭关键安全控制。
- 进行不可逆生产操作。
- 接受高等级残余风险。
- 在多个方案价值取舍无法由既有原则确定时。

---

## 5. 默认决策原则

老板暂时不可达且任务允许继续时，按以下顺序选择：

1. 保护人员、客户、数据和系统安全。
2. 避免不可逆损失。
3. 保持业务连续性。
4. 选择可回滚、低成本、最小范围方案。
5. 保护长期可维护性。
6. 延迟需要商业偏好的决策，不替老板猜测。

---

## 6. 决策记录

D2 及以上决策至少记录：

- 决策问题。
- 背景与约束。
- 选择的方案。
- 被放弃的方案。
- 理由和证据。
- 风险与缓解。
- 决策人和日期。
- 重新评估条件。

技术架构决策使用 ADR 模板；经营决策使用 Decision Log。

---

## 7. 记忆与能力决策矩阵

| 决策事项 | 提案 | 专业审核 | 最终批准 |
|---|---|---|---|
| Task Memory / Context Packet 更新 | Task Owner / Context Agent | 按风险 QA | Task Owner |
| A1 经验提升为部门候选 | 执行 Agent | Memory Steward | Department Lead/Steward |
| A2 部门 SOP 或领域规则 | Department Steward | QA / 受影响部门 | Department Lead |
| A3 项目业务/架构记忆 | Product/CTO/Data | CKMO + 相关专业角色 | CEO / 指定批准人 |
| A4 公司制度或老板指令 | CEO/Governance | 受影响负责人 | Owner |
| 解决跨部门知识冲突 | CKMO/领域负责人 | Epistemic QA | CEO；商业取舍时 Owner |
| Agent C1→C2 | Agent Owner | QA | Department Lead |
| Agent C2→C3 | Agent Owner | QA + Security（按风险） | Department Lead / CEO |
| Agent C3→C4 | CEO/Agent Owner | QA + Security + Governance | Owner |
| 新增读写/生产工具权限 | Agent Owner | Security / CTO / SRE | 对应权限批准人 |
| 记忆批量删除或迁移 | Memory Architect | Security / Privacy / QA | CKMO；高风险时 Owner |
| 记忆隔离 | Security / CKMO | 事后复核 | 可紧急执行 |

任何 Agent 不得批准自己的 C3/C4 升级或生产权限扩大。
