# RepairDesk Agent 辅助材料

状态：按需使用。当前执行规则与模型/并发上限只在 [AGENTS.md](../AGENTS.md) 维护。

此目录保留专用skills、角色模板、兼容检查和历史记录；不是每项任务的强制启动清单。旧版说明见 [快照](../docs/archive/governance-20260915/agents-readme.snapshot.md.txt)。

## Decision Owner Flow

1. 主线程接收自然语言目标，确认项目、授权、现有变更和可测结果。
2. 独立子任务能提高质量/效率时才委派，传最小必要上下文并划定互斥写入路径。
3. Sub-agents report blockers to the Integration Lead. 子代理不向老板请求扩权，不提交、发布、迁移或处理秘密。
4. 实际执行者提供证据，主线程按风险审查与验收；跨会话身份/最终集成继续遵循 [调度声明](../docs/CROSS_SESSION_ORCHESTRATION_DECLARATION.md)。

## 按需参考

- [任务包](task-package-template.md)：目标、所有权、非目标、验证和停止条件。
- [角色名册](department-roster.md)：查找专业视角，不代表必须派出独立代理。
- [集成清单](integration-checklist.md)：按实际风险选用，不机械扩大测试。
- [复杂任务说明](../docs/COMPLEX_REQUIREMENT_MULTI_AGENT_DECLARATION.md)：分歧及跨模块风险处理。
- `repairdesk-multiagent.yaml` 保留旧工具兼容；与根规则冲突时根规则优先。

规则文件修改运行 `npm run agents:config`、`npm run agents:templates`、`npm run agents:check`。业务验证与CI要求仍遵循根规则。
