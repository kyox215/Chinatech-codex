---
task_id: "TASK-20260724-003-unblocked-order-printing"
status: "verified"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
updated_at: "2026-07-23T23:10:20Z"
---
# Task

## Owner goal

维修工单不要因为店铺资料或客户二维码不可用而无法打印；使用简单、稳定的打印规则。

## Scope

- 订单详情、任务页、订单列表单张/批量打印。
- 打印店铺资料的安全降级。
- 客户查询二维码的可选增强。
- 相关单元测试与打印权威声明。

## Constraints

- 保留既有角色 capability、对象级店铺范围和作废/删除工单限制。
- 不修改数据库、生产配置或部署。
- 设置记录与当前店铺不一致时不得打印其他租户资料。
- 不覆盖并行订单详情上下文提示改动。

## Acceptance

- 店铺资料缺失、旧资料误判或 QR 关闭时仍能打开普通工单打印。
- QR 可用时继续附带客户查询二维码。
- QR 签发失败时降级，不中断打印。
- 作废/删除工单仍不可打印。
- 跨店设置不进入打印文档。

## Execution

Single writer: main Integration Lead. Existing read-only print/security audits were reused; no new agents spawned because the implementation slice has overlapping dirty order files and requires one controlled writer.
