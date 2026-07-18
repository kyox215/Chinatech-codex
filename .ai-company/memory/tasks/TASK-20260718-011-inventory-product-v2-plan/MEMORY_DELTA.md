# Memory Delta — TASK-20260718-011-inventory-product-v2-plan

## Candidate reusable decisions

- 库存前台使用“录入→检测/整备→上架→售卖→完成/售后”五阶段，V1 状态作为兼容层。
- 设备类使用 catalog/variant/serial unit，多标识符独立存储；配件使用 quantity balance/movement。
- V1 采用替换式退役：并行、迁移、对账、切换、观察后再删除旧 UI；历史数据不随 UI 删除。
- AI 作为可选草稿加速器，逐字段确认、可撤销、手工常驻、不新增权限、不正式写入。

## 已验证并可复用

- V2 正式命令必须使用数据库 RPC 事务、idempotency key、expected version 和同店复合外键；金额进入哈希前固定为 `numeric(12,2)`。
- 发布采用 schema/commands/UI/allowlist 分层 fail-closed flags；V1 mutations 在观察期默认保留。
- 首个发布切片已在 PostgreSQL 17、全量测试、production build 和 390/1440 浏览器视图验证。

生产 migration apply、RPC grant 和门店开关尚未批准，不得提升为“生产已启用”。
