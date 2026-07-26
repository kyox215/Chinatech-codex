---
schema_version: 1
task_id: "TASK-20260726-002-eu-phone-catalog"
title: "欧洲近十年手机目录与颜色色块联动入库"
status: "in_progress"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Hexiang Huang"
departments: ["Product", "Frontend", "UX", "QA", "Documentation", "Release"]
created_at: "2026-07-26T21:20:00Z"
updated_at: "2026-07-26T21:54:31Z"
---

# Task — 欧洲近十年手机目录与颜色色块联动入库

## Owner request

库存手机入库改为可选择品牌、型号、内存、容量和颜色；面向欧洲近十年机型，颜色必须同时有文字和可视色块。完成后推送 main 并部署。

## Scope in

- 版本控制的欧洲手机目录与滚动十年过滤。
- 品牌、型号可搜索选择；RAM、容量与颜色按型号联动。
- 颜色名称 + 色块 + 非颜色选中状态。
- 手动兜底、AI 候选兼容和标准化状态更新。
- 单元/组件测试、声明、响应式截图、main 推送和生产部署。

## Scope out

- 数据库 migration、历史库存回填、在线目录后台、第三方付费型号库。
- 改变库存权限、RPC、售卖、价格、打印或回收流程。

## Hard constraints

- 在隔离工作区 `/private/tmp/repairdesk-eu-phone-catalog-20260726` 单一写入。
- 当前主工作区的未提交内容不得进入本发布。
- 目录未命中不能阻断入库；Apple RAM 不猜测。
- 生产发布只允许非强制推送；远端变化必须重新同步和验证。

## Acceptance criteria

- [x] 20 个欧洲常见品牌组、至少 150 个近十年型号可搜索。
- [x] 品牌/型号/RAM/容量/颜色联动且切换上游会清理不兼容值。
- [x] 每个目录颜色同时显示名称、色块、边框和可访问选中状态。
- [x] 目录外/旧机型/缺失配置可手动录入，不改变现有保存合同。
- [x] `standard` / `unstandardized` / `needs_review` 语义正确。
- [x] lint、typecheck、test、build 通过并有桌面/手机视觉证据。
- [ ] main 推送、生产部署和正式域名冒烟验证完成。

## Decision

本期使用静态代码目录，不做数据库迁移。目录用于标准化建议，手动录入永远保留。
