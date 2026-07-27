# Memory Delta — TASK-20260727-005-mobile-order-list-density-plan

## Candidate project facts

- 手机端工单列表采用 320–440px 有界流体密度，触控目标保持 44px，来源：本任务实现与 E2E；状态：待任务关闭时归档；owner：IntegrationLead；review trigger：RepairOS 移动列表标准变更。

## Candidate department updates

- UX/QA：移动端队列密度验收固定覆盖 320/375/390/393/402/430/440px 与 Chromium/WebKit；来源：`orders-mobile-queue-loading.spec.ts`；状态：已验证。

## Candidate decisions / ADRs

- 不按设备型号分支，不用 `transform: scale()`/CSS `zoom`；使用 `clamp()` 有界 token 并保持交互尺寸底线。来源：Owner 批准合同与实现；状态：accepted；scope：移动端工单列表。

## Candidate lessons and capability evidence

- E2E 将密度目标直接量化为顶部高度、四列两行、触控尺寸、分组标题、订单卡高度和可见条数，可防止后续视觉回归。

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
