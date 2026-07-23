# Memory Delta — TASK-20260723-006-order-entry-unification

## Candidate project facts

- **verified / task-local:** 跨模块普通新建与详情入口使用 `/orders` 工作区意图；独立页面和任务页保留为深链/降级。来源：`REPORT.md`、`order-workspace-intent.ts`、E2E。Owner：Frontend。复审触发：新增工单入口或改变桌面/移动详情表面。

## Candidate department updates

- **Frontend / verified:** 新增跨模块工单入口必须使用工作区 URL builder，不能重新散落拼接桌面详情链接。
- **QA / verified:** 工单入口回归至少覆盖 URL 刷新恢复、关闭清理、客户/设备预填、390px 与桌面无横向溢出。

## Candidate decisions / ADRs

- **approved task decision:** 工作区意图是跨模块普通入口；`/orders/new`、`/orders/{id}`、`/orders/{id}/task` 继续存在，不做重定向或删除。

## Candidate lessons and capability evidence

- **lesson / verified:** 仅验证弹窗可见不足以证明路由生命周期正确；关闭后 URL 清理必须作为 E2E 断言。

## Consolidation outcome

- 本次不直接写入 `PROJECT_MEMORY.md`、部门记忆或架构声明：这些文件已有并行任务未提交修改，当前窗口没有其文件所有权。
- 候选长期知识保留在本任务 `REPORT.md` 与本文件；代码中的 builder、解析测试和 E2E 是当前权威执行证据。
- 未进行能力等级调整：一次成功不足以提升 Agent 自治或权限。

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
