# SUBAGENT GOVERNANCE — 子 Agent 治理

## 1. 原则

1. 子 Agent 由主线程显式创建。
2. 子 Agent 是隔离工作单元，不是最终决策者。
3. 最佳用途是可并行的调查、审查、测试设计和证据收集。
4. 写入型子 Agent 必须受单一写入者和范围锁约束。
5. 每次创建都要能说明“为什么单线程不足”。

## 2. 创建触发条件

至少满足一项：

- 有两个以上相对独立的调查维度。
- 需要独立安全/QA/数据审查。
- 仓库很大，需要并行代码地图。
- 需要不同专业方案并行评估。
- 长任务需要隔离上下文，避免主线程污染。

不满足时由主线程直接执行。

## 3. 数量控制

- T1：0–2 个。
- T2：2–4 个。
- T3：3–5 个，且必须有明确风险角色。
- 超过 5 个需要说明并行收益和合并策略。
- 默认 `max_threads = 6`，不得把线程上限当成目标数量。

## 4. 深度控制

默认 `max_depth = 1`。根线程可创建直接子 Agent；不鼓励递归委派。若确需更深层级，必须：

- 限定子树目标。
- 设定最大线程和预算。
- 禁止重复 fan-out。
- 指定汇总 owner。

## 5. 权限

- 只读 Agent 不得请求写权限完成“顺手修复”。
- Reviewer 不得改变被审查文件。
- implementer 不得执行生产部署、外部发送或不可逆迁移，除非批准包明确授权。
- memory_steward 只写 `.ai-company/memory/`、`.ai-company/state/` 和相关任务文档。
- 父线程的实时沙箱/审批覆盖可能影响子线程，因此主线程仍需检查实际运行权限。

## 6. 输出协议

只读专业 Agent 默认输出：

```text
# Scope
# Verified facts
# Assumptions / unknowns
# Findings by severity
# Options
# Recommendation
# Evidence paths
# Risks / rollback
# Questions requiring decision
```

实施 Agent 默认输出：

```text
# Files changed
# Behavior changed
# Tests run and exact results
# Deviations from plan
# Remaining risks
# Memory delta candidates
```

## 7. 证据等级

- E0：无证据的意见。
- E1：文件或文档引用。
- E2：代码路径、测试或可复现实验。
- E3：运行环境或生产可观察证据。
- E4：多来源、一致、独立复核证据。

高风险结论不能只依赖 E0/E1。

## 8. 失败与停止

子 Agent 必须停止并返回父线程，而不是自行扩大范围，当：

- 需要更高权限。
- 发现当前任务外的重大问题。
- 证据冲突无法解决。
- 工具或环境不足。
- 已达到工作包退出条件。
- 继续工作会覆盖用户变更。

## 9. 合并冲突

主线程记录：

- 冲突结论。
- 各自证据。
- 适用范围差异。
- 最终选择或升级对象。
- 未解决冲突的到期条件。

不得通过多数投票代替证据和决策权限。
