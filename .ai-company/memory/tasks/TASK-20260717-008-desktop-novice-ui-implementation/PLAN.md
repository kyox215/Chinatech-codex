# Plan

1. 锁定隔离基线、迁移边界与现有行为证据。
2. 实施 P0 术语、错误状态和统一下一步展示基础。
3. 实施工单列表、新建、详情与概览的核心新手路径。
4. 统一客户、回收、库存和设置中的任务导向信息。
5. 完成局部到全量测试、四档桌面视口和截图证据。
6. 检查 linked Supabase migration 历史，先 dry-run，再仅应用本任务必要 migration。
7. 独立 QA/安全/数据复核后提交，重放最新 `origin/main`，推送 `main`。
8. 发布后执行页面、API、数据库元数据和迁移历史冒烟检查，更新记忆并关闭。

## Change budget

- 优先复用现有五阶段简单流程、库存/回收 next-action helpers 和公共 UI 组件。
- 不新增依赖，不格式化全项目，不拆分所有大型 screen，不修改无关 server/migration。
- 如纯 UI 即可实现，不新增 schema。

## Stop conditions

- 发现当前 `origin/main` 与计划存在状态机、权限或支付语义冲突。
- 实施需要应用非本任务 migration，或 linked dry-run包含 `--include-all` 才能继续。
- main 远端在发布窗口发生未整合变化。
- 任何测试显示金额、保管、密码、租户或权限回归。
