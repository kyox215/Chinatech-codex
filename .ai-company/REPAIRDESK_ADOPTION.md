# RepairDesk 治理兼容说明

状态：2026-09-15起改为按需参考。当前工作规则统一到 [根AGENTS](../AGENTS.md)。

原 AI Company OS 接入全文保留在 [历史快照](../docs/archive/governance-20260915/adoption.snapshot.md.txt)。不再在每个任务中预读全部政策、部门表和角色映射。

保留的实际能力：

- `.ai-company/orchestration.json`、`tools/orchestration/`：跨会话身份与集成互斥，按[调度声明](../docs/CROSS_SESSION_ORCHESTRATION_DECLARATION.md)执行。
- `.ai-company/memory/tasks/`：现有任务连续性；保留历史证据和当前未完成任务，不另建平行真相源。
- `.codex/hooks*`、`.codex/agents/`、`.agents/skills/`：可执行配置及按需能力；是否已运行必须由真实证据说明。
- `.ai-company/policies/`：专门任务所需的背景参考，不自动扩大必读清单、授权或审批。

安全、权限、数据隔离、秘密与生产批准门槛继续有效。只把重复流程移出默认入口，未关闭运行控制。

规则修改执行 `npm run agents:check`；运行结构变化另做 `tools/ai_company.py validate --strict` 及相关专项验证。
