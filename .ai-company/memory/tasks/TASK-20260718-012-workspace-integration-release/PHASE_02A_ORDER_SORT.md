# Phase 02A — RU-01 工单进度排序

状态：`completed`

## Scope

- 在同一业务队列中先按页面显示的五步工作流进度排序，再按创建时间、工单号和 ID 稳定排序。
- 不改变队列分组、权限、数据库或 API。

## Implementation

- `src/features/orders/model/order-list-grouping.ts`
- `src/features/orders/model/order-list-grouping.test.ts`
- commit：`bdffa5f8`

## Verification

- `git diff --check`：PASS。
- focused Vitest：3 files / 128 tests PASS。
- 验证不同进度顺序与同进度 tie-breaker。

## Rollback

- 单独 revert `bdffa5f8`。
