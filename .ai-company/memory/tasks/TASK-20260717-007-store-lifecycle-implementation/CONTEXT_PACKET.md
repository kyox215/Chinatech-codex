# Context Packet

## Goal

完成并验证店铺生命周期 P0-P5，同时保持多租户隔离、脏工作区保护和生产不可逆动作审批门。

## Verified current state

- P0 UUID 预检和 P1 结构化工单数据访问原因已实现并验证。
- P2 近期 TOTP/AAL2、一次性 challenge、主店主 atomic rename、API/UI、CAS/幂等/审计已完成。
- P3 close/archive/restore、非店主停用、Kiosk/邀请撤销、普通 API/Kiosk/邀请/离线门禁已完成。
- P4 catalog-driven DB+Storage export、三类 hash、加密 sink 合同和 restore verifier 已完成。
- P5 approval-locked purge worker、Supabase adapter、checkpoint/retry、FK ordering/cycle break、other-tenant guard 和 zero proof 已完成。
- Git 为 `main...origin/main [ahead 1, behind 8]`，存在多组其他任务改动。

## Hard boundaries

- 不执行生产 rename、close、archive、restore 或 purge。
- 不应用 linked/production migration，不改生产开关，不部署。
- 不按店铺名称定位目标；所有动作绑定 store UUID、revision、operation id 和审批证据。
- Integration Lead 是唯一写入者，保留所有无关工作区改动。

## Release direction

1. 若 Owner 批准，先隔离本任务文件并安全同步远端 `main`，不得混入无关 dirty-tree 改动。
2. 对精确 linked project 执行 migration history 比对和 dry-run，全部 flags 保持关闭。
3. 在 disposable store 上验证 rename/close/restore 和所有 rejection paths，再分阶段开启 mutation/enforcement。
4. 选择真实 encrypted sink/KMS，完成隔离 restore proof 后才可考虑 export rollout。
5. 真实 purge 需要新的 UUID-bound P0、hold/retention 放行和第二次不可逆批准；浏览器永不暴露 purge。

## Stale/conflicting memory

- `PROJECT_MEMORY.md` 中“生命周期仅为规划、尚未实现”若仍存在已过期；以本任务六个迁移、服务、worker、测试和 runbook 为准。
- 先前 conditional close 只证明控制面框架，不证明完整 P0-P5；本次续跑已重新打开任务。
