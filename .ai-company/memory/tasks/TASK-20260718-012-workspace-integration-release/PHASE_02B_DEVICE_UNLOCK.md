# Phase 02B — RU-02 设备解锁信息保留

状态：`completed`

## Scope

- 删除客户端缓存的 `clear_device_unlock` 隐式清除能力。
- 客户持有设备在具备 `canEditRepair` 权限时继续显示密码编辑入口。
- 两种保管状态的离线队列都拒绝保存明文密码。
- 不新增或重放数据库 migration。

## Implementation

- cache sync、offline autosave 测试、移动订单详情和 custody Playwright。
- commit：`05de4df8`

## Verification

- `git diff --check`：PASS。
- focused Vitest：7 files / 117 tests PASS。
- E2E 已加入 customer-held 密码入口、默认遮挡和无横向溢出断言，待 Phase 03 浏览器执行。

## Rollback

- 单独 revert `05de4df8`；既有生产 custody migration 不回滚。
