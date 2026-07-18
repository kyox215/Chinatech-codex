# AI Company OS Skills Catalog

Codex initially sees each Skill name and description; full instructions are loaded only when selected. Keep descriptions precise and invoke a Skill explicitly with `$skill-name` when the workflow is mandatory.

| Skill | Trigger summary |
|---|---|
| `$cross-session-orchestration` | 用于新窗口、跨会话、多窗口并行、另开任务、继续/恢复/暂停/取消/查看进度；先登记并显式绑定身份，再验证不可变 Context Packet。 |
| `$company-task-intake` | 用于接收老板的新任务，把目标转换为任务章程、范围、验收标准、约束和待确认事实；微小纯问答不触发。 |
| `$context-rehydrate` | 用于新会话、长上下文压缩、任务恢复或交接后，按证据恢复最小充分上下文；简单独立问答不触发。 |
| `$risk-autonomy-classify` | 用于任务接收、范围变化或高影响操作前，判定 R0–R4 风险、L0–L4 自治和 D1–D4 决策权限。 |
| `$agent-team-compose` | 用于 T2/T3 或需要独立专业判断的任务，选择最小充分的 Codex 子 Agent 团队并定义工作包。 |
| `$task-plan-and-contract` | 用于标准以上任务，在实施前生成阶段计划、工作包、依赖、验证、回滚和变更合同。 |
| `$product-requirements` | 用于新功能、业务流程、角色权限或用户可见行为变化，生成可测试 PRD 与状态规则。 |
| `$architecture-review` | 用于跨模块、公共接口、核心依赖、可靠性或重大技术方案变化；局部样式修改不触发。 |
| `$ui-ux-review` | 用于页面、组件、交互流程、响应式布局或可访问性变化，输出完整状态和可实现规范。 |
| `$data-migration-review` | 用于数据库 schema、数据模型、索引、回填、迁移、删除或数据保留变化。 |
| `$implementation-control` | 用于批准方案后的业务代码实施，强制单一写入者、最小变更、范围控制和即时验证。 |
| `$security-review` | 用于认证、授权、敏感数据、外部输入、秘密、依赖或高风险功能；也用于发布前独立安全复核。 |
| `$quality-gate` | 用于实施后或发布前，验证验收标准、回归、边界、权限和证据，给出通过/有条件/失败结论。 |
| `$release-governance` | 用于客户可见、生产、包发布、迁移或基础设施变更，生成发布、观测、回滚和批准方案。 |
| `$memory-checkpoint` | 用于阶段完成、关键决定、阻塞、写入后审查前、上下文压缩或暂停时，保存可恢复检查点。 |
| `$memory-consolidation` | 用于任务阶段稳定或关闭时，把任务经验筛选为项目、部门、决策或能力长期记忆；临时细节不沉淀。 |
| `$department-memory-sync` | 用于任务改变部门规则、接口、SOP、风险或能力时，同步受影响部门的长期记忆和交接边界。 |
| `$handoff-resume` | 用于 Agent、部门、会话或人员之间交接，以及暂停后恢复，生成可验证的 Handoff/Resume Packet。 |
| `$capability-review` | 用于任务关闭、重复成功或失败后，评估 Agent/Skill 能力证据、改进建议和 C0–C4 等级；不自动授权。 |
| `$project-health-check` | 用于“项目体检”、接管旧项目或定期治理审计，按证据输出 P0/P1/P2 问题和分阶段路线图。 |
| `$incident-response` | 用于生产异常、数据损坏、安全事件、严重回归或客户重大影响，优先止损、证据和恢复。 |
| `$documentation-sync` | 用于代码、API、数据、部署、SOP 或用户行为变化后，检查并修正文档漂移。 |
| `$task-closeout` | 用于任务准备完成时，汇总验收、审查、风险、文档、记忆和能力结果并正式关闭或有条件关闭。 |

## Maintenance rules

- Skill changes are governed by `.ai-company/policies/SKILL_GOVERNANCE.md`.
- A Skill may improve through evidence, but changes do not automatically increase Agent permission or autonomy.
- Keep reusable procedures in Skills; keep current project facts in `.ai-company/memory/`.
- Test high-impact Skills with representative positive, boundary, and refusal cases before promoting them.
