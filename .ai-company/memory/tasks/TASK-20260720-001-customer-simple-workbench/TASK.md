---
schema_version: 1
task_id: "TASK-20260720-001-customer-simple-workbench"
title: "客户功能与桌面移动端简洁工作台"
status: "release_pending"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["FLOW", "UX", "DATA", "QA", "SEC", "RELEASE"]
created_at: "2026-07-20T00:35:00+02:00"
updated_at: "2026-07-20T02:03:00+02:00"
---

# Task — 客户功能与桌面移动端简洁工作台

## Owner request

完善客户功能和 UI，电脑端与移动端都要简单明了、小白可用，尽量一页显示；内容不足时分组并固定在顶部切换。完成后推送并应用。

## Approved product contract

- 列表四个常用分组：`全部 / 处理中 / 待收款 / 要跟进`。
- 低频条件统一进入“更多筛选”。
- 详情保持五个分组：`总览 / 工单 / 设备 / 跟进 / 资料`。
- 详情只突出三项业务动作：新建工单、发消息、加待办。
- 消息只有在操作员确认实际发出后才记录联系历史。
- 搜索、分组、筛选和页码可通过 URL 恢复。

## Scope in

- 客户列表和详情的桌面/移动响应式密度、分组、键盘可访问性与返回上下文。
- 客户消息两步确认。
- 去除列表详情预取，并收窄列表浏览器响应字段。
- 单元、组件、仓库、六档响应式 E2E、截图、生产构建与发布验证。

## Scope out / blocked

- 不新增或修改数据库 schema/RPC。
- 不执行 `migration repair`、`db pull`、猜测迁移或任何生产 SQL。
- 客户列表 v4 RPC、数据库侧最小投影与新索引延后，直到精确迁移来源恢复并通过 Database Application Gate。

## Risk and control

- UI 与应用代码为可逆变更；生产推送/部署使任务整体归类 R4 / L2。
- 主线程是唯一写入者与发布者；三个部门代理仅做只读 FLOW、UX、DATA/QA/SEC 复核。
- 数据库迁移历史门禁失败时，老板的“应用”只执行无迁移应用部署，不扩大为数据库写入。

## Acceptance criteria

- [x] 四个常用分组和更多筛选清楚可用。
- [x] 列表上下文可从 URL 恢复。
- [x] 桌面 1024px 起表格无横向滚动；移动端使用紧凑卡片。
- [x] 详情五分组同排，移动端底部三项主操作不被全局浮钮遮挡。
- [x] 消息两步确认，模板不包含内部客户链接。
- [x] 列表响应去除不需要的敏感字段。
- [x] 六档响应式 E2E、全量单测、Lint、类型与生产构建通过。
- [x] 独立部门终审通过；无 P0/P1，DATA 仅批准 app-only 发布。
- [ ] 推送 main、生产部署与线上 smoke 通过。

## Rollback

- 应用回滚：回退本任务单一提交并重新部署前一主线版本。
- 数据回滚：本任务没有数据库迁移或生产数据写入，无数据回滚步骤。
