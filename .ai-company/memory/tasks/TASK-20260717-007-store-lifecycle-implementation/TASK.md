---
schema_version: 1
task_id: "TASK-20260717-007-store-lifecycle-implementation"
title: "店铺生命周期 P0-P5 安全控制面实施"
status: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2_code_L1_production"
owner: "IntegrationLead"
departments: ["Architecture", "Product", "Data", "Security", "QA", "Documentation"]
created_at: "2026-07-17T21:45:00+02:00"
updated_at: "2026-07-18T07:58:49Z"
closed_at: "2026-07-18T07:58:49Z"
---
# Task

## Owner goal

把店铺删除、重命名、可恢复关闭、完整导出与永久清除路线设置为完整实施目标并开始执行。

## Authorized scope

- 实现 P0 UUID 预检与脱敏阻断计数。
- 实现 P1 工单数据结构化访问原因和设置页文案。
- 实现 P2 近期 TOTP/AAL2、一次性 challenge、主店主原子重命名、审计和设置页入口。
- 实现 P3 可逆关闭、延迟归档、恢复、凭据撤销和浏览器/Kiosk/邀请/离线写入门禁。
- 实现 P4 数据库与 UUID 前缀 Storage 导出、三类 hash、加密 sink 合同和隔离恢复证明 worker。
- 实现 P5 二次批准调度、lease/checkpoint/retry、Storage-first、FK 排序/环处理、零残留证明与 tombstone worker。
- 本地代码、测试、migration、文档和截图验证。

## Hard boundaries

- 不执行生产 rename、close、restore 或 purge。
- 六个 linked/production migration 仅在精确 dry-run 与 Owner 批准后应用；不得扩大到其他 migration。
- 不开启生产 feature flags，不执行真实 rename、close、restore、export 或 purge。
- 不按店铺名称执行任何动作。
- 永久清除继续需要恢复演练、retention/hold 放行和第二次精确批准。

## Department execution

- Architecture/Product、Data/DB、Security/QA 均被纳入审查范围，但本次续跑未新 spawn 子代理。
- no-spawn reason：用户没有明确要求多代理，且当前会话级规则要求仅在用户或适用规则明确要求时启动；主线程按单一写入者完成实现与复核。
- Integration Lead：唯一写入者、集成者、验证者、文档维护者和生产边界决策者。

## Acceptance state

- P0/P1：完成，UUID-bound 预检、结构化访问原因和设置页文案有单元测试。
- P2：完成，主店主 + 近期 TOTP + 一次性 challenge + revision CAS + 幂等重命名 + 同步客户可见名 + 审计 + UI。
- P3：完成，可逆关闭/归档/恢复、非店主成员停用、Kiosk/邀请凭据撤销、普通 API/Kiosk/邀请/离线写入门禁均已实现。
- P4：完成，数据库/Storage 导出 worker、确定性 manifests、DB/Storage/artifact hash 和隔离恢复证明已实现。
- P5：完成，批准锁定的调度、可恢复 worker、Storage-first、FK child-before-parent、目标 UUID cycle break、其他租户 guard、零残留证明和无 PII tombstone 已实现。
- 浏览器永久删除入口刻意不存在；五个 feature flags 默认关闭。

代码、本地验证、六个生产 migration apply 和 `main` 快进推送均已完成。不能表述为真实店铺已经删除或当前可直接永久清除。

## Verification evidence

- 六个 lifecycle migrations 已按顺序应用到隔离 PostgreSQL 17 临时数据库；所有相关 PL/pgSQL 经 `plpgsql_check` 为 0 错误。
- 隔离 `service_role` 合成事务通过 `rename -> closing -> restore`，最终 revision=4；三个 challenge 均被消费，非店主成员恢复后仍 inactive；事务整体 rollback。
- 最新生产 schema 的动态 export catalog 为 39 表、purge catalog 为 37 表，非 UUID `store_id` 表和未覆盖 public RESTRICT/NO ACTION child 表均为 0。
- 最新 `origin/main` 隔离候选的 lint/typecheck 通过，`npm run test -- --run` 为 238 files / 1578 tests，生产依赖审计为 0 漏洞。
- `npm run build` 通过：24/24 static pages。
- 手机端 Playwright 设置页验证通过，截图：`screenshots/store-lifecycle-actions-mobile.png`。
- linked project `xluzcoduqsdvjoouqhkc` 已精确应用六个 migration；7/7 店铺回填 active lifecycle，RLS/grants/function/trigger/job-table 后检和 linked error-level lint 通过。

## Release state

- 六个 migration 已生产应用；五个 feature flags 保持关闭，未执行真实店铺动作。
- 当前根工作区的其他任务改动未被暂存；生命周期候选在最新 `origin/main` 隔离工作树集成并以非强制快进推送。
- 实施提交（已纳入远端 `main`）：`55cb7ab5a928b67daf4856e80486f2ccec5fbd59`。
- 推送后 linked dry-run 返回 `Remote database is up to date`。
- 生产 purge 必须重新绑定目标 UUID，重新跑 P0、完成真实加密 sink/KMS 与隔离 restore proof，并获得第二次不可逆批准。
