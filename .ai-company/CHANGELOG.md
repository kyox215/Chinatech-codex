# CHANGELOG

## v2.0 — Memory & Capability Edition

### Added

- Memory System Prompt 和独立记忆部门。
- Context Orchestrator、Retrieval、Curator、Epistemic QA、Capability Development 等角色。
- M0–M8 分层持久记忆架构。
- 事件日志、快照、Context Packet、Memory Delta、Checkpoint、Handoff 和 Resume 协议。
- 部门记忆、Agent 运行档案和 Capability Registry。
- C0–C4 能力等级、沙箱评估、灰度、监控、降级和撤销。
- 规范事实与描述事实、来源权威、知识冲突、时效和安全遗忘。
- 记忆投毒、提示注入、跨域泄露和敏感信息清理流程。
- 18 份记忆/能力模板和可复制的 runtime-memory 起始目录。
- v1.0 升级指南和记忆快速启动指南。

### Changed

- MASTER_PROMPT、AGENTS、PROJECT_RULES、TASK_FLOW 和 AGENT_PROTOCOL 变为 memory-first。
- 治理、审批、RACI、安全、QA、发布、文档、指标和落地指南加入记忆与能力门禁。
- 任务关闭要求同步部门记忆并执行 Capability Review。

### Safety clarifications

- 聊天上下文不等于持久记忆。
- 不保存隐藏思维链，只保存可审计理由和证据。
- Agent 不能自我扩权或自行宣布能力升级。
