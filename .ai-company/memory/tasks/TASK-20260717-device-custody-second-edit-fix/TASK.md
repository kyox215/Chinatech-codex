---
schema_version: 1
task_id: "TASK-20260717-device-custody-second-edit-fix"
title: "设备保管二次修改版本同步修复"
status: "in_progress"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
created_at: "2026-07-17T18:00:00Z"
updated_at: "2026-07-17T18:04:32Z"
---
# Task

## Owner Goal

老板要求按照已批准计划开始执行，修复订单详情中设备保管无法二次修改的问题，完成验证后推送并应用到 `main`。

## Scope

- 修复设备保管更新后前端仍使用旧 `updated_at` 导致第二次修改被乐观锁拒绝的问题。
- 检查相关 UI、API facade、服务端 repository、mock 与测试路径。
- 保留服务端权限、租户隔离、`expected_updated_at` 乐观锁和终态修正规则。
- 不执行生产数据库写入，不修改已应用 Supabase migration。

## Acceptance Criteria

- 设备保管第一次更新成功后，当前详情缓存立即持有服务端返回的新 `updated_at`。
- 第二次设备保管修改优先使用最新缓存版本，不要求用户手动刷新。
- 客户持有时清除本地缓存中的解锁字段；门店收机时清除当前交付时间。
- 非终态实际交还可显示交付时间；终态历史修正不伪造交付时间。
- `lint`、`typecheck`、单元测试、构建和设备保管 E2E 通过。
- 最终提交只包含本任务相关文件，保留无关工作区改动。

## Verification Plan

- Targeted Vitest for `cache-sync` and custody mock behavior.
- Full `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- Playwright device-custody flow.
- Mobile screenshot evidence for order detail custody card.
