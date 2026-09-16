# AI 运行资料目录规则

当前项目规则见 [根AGENTS](../AGENTS.md)。此目录的通用公司组织图已归档到 [历史快照](../docs/archive/governance-20260915/company-AGENTS.snapshot.md.txt)，不再要求按职级或部门组织每项任务。

- 此目录只保存任务连续性、决策、证据、必要政策和跨会话运行配置；不保存秘密、生产凭据、完整客户PII或隐藏推理。
- 事实、假设、推断、提案、决定和实际结果明确区分；引用原始证据，不将旧摘要当新验证。
- 只更新本任务拥有的文件，保护其他任务和已有未提交改动。旧runtime-memory不再写入新任务。
- Registry身份与不可变Packet遵循 [调度声明](../docs/CROSS_SESSION_ORCHESTRATION_DECLARATION.md)；不得重建损坏Registry、篡改Packet、抢lease或用ACTIVE_CONTEXT猜身份。
- 发布、权限、数据、支付、隐私、迁移及不可逆动作的授权/独立风险审查保持；文档不得自行授予权限。
- 高风险能力变化需要实际评估和批准；不因一次成功自我扩权。只有稳定、跨任务有效的结论进入长期记忆。
- 普通任务不生成全套部门绩效、RACI或能力评级；保留最小可恢复检查点与证据即可。
