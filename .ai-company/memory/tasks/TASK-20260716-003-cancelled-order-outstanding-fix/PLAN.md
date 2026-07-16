# Execution Plan

1. WP-00：固定最新 main、失败 fixture、当前 SQL/API/UI/caching 基线和 release lock。
2. WP-01：建立唯一 TypeScript contribution helper，修 repository、Mock、filter/KPI/export parity。
3. WP-02：新增 v3 客户列表函数并修支付 RPC 取消状态门禁；保留 v2 兼容包装器。
4. WP-03：修客户/订单取消历史文案、双状态和所有相关 cache invalidation。
5. WP-04：增加 unit/repository/mock/router/SQL/E2E 测试，运行全量门禁与独立复核。
6. WP-05：生成脱敏视觉证据、同步文档/记忆；数据库 expand → post-check → main push → smoke。

状态：WP-00 至 WP-05 全部完成；生产使用 migration `20260716175044` 与 `20260716175056` 前向应用并复验。

回滚：应用可独立切回旧版本；数据库不恢复会重现缺陷的旧函数定义。若 v3 或支付 RPC 出现回归，保持取消聚合排除与收款门禁，使用经 review 的前向 `create or replace` migration 修正；不删除历史数据或 ledger。
