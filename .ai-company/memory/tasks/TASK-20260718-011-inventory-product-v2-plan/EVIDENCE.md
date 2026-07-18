# Evidence Index — TASK-20260718-011-inventory-product-v2-plan

| ID | Type | Claim | Evidence | Result |
|---|---|---|---|---|
| E-001 | Git | 当前工作区不适合直接实施/删除 | `git status --short --branch` | `main...origin/main [ahead 1, behind 45]` 且有大量其他改动 |
| E-002 | UI | 库存页面为大型混合职责屏幕 | `src/features/inventory/screens/inventory-screen.tsx` | 3318 行，含列表、详情、录入、检测、销售、票据、导入 |
| E-003 | Flow | 普通手工库存默认 `listed` | `inventory-screen.tsx` `IntakeDialog` | 观察到 `source_type=manual_stock`、`initial_status=listed` |
| E-004 | Data | 当前无目录/规格/多标识符/销售单分层 | `src/lib/repairdesk/types.ts` Inventory types；migrations | 单一 `brand/model/storage_capacity/serial_or_imei` 与 item/transaction/event 模型 |
| E-005 | Atomicity | 销售核心动作不是一个数据库原子事务 | `inventory.repository.ts` `sellInventoryItem` | 商品 update 后依次插入 transaction/event/audit |
| E-006 | Customer | 底层支持来源/买家客户 ID | Inventory types/repository | `customer_id`、`buyer_customer_id` 存在，UI mapper 主要提交自由文本 |
| E-007 | AI | AI 尚未正式启用但实现已存在 | `src/features/ai-assistant/`；TASK-009 | 图片去元数据、local+server 候选、逐字段人工确认和 fail-closed flags 已存在并被 V2 复用 |
| E-008 | UX review | V1 UI 适合退役而非删除数据 | UX/QA read-only Agent 报告 | 推荐五阶段、独立录入/售卖、完整状态与 6 viewport |
| E-009 | External | 序列设备应按实例追踪 | GS1/Odoo 官方资料 | 支持 catalog/variant 与 serial unit 分层 |
| E-010 | External | 保修与财政票据需要独立正式边界 | MIMIT/Your Europe/Agenzia Entrate | 二手保证、2026 告知、RT/Documento Commerciale 需要发布前确认 |
| E-011 | DB | V2 migration 可执行且命令原子/幂等 | PostgreSQL 17 隔离容器；最小真实依赖 schema | 两 migration、入库/售卖、幂等重放、失败无残留、RLS 与默认 RPC revoke 全部通过 |
| E-012 | Regression | 代码质量门禁通过 | `npm run lint/typecheck/test/build` | lint 0；typecheck 0；283 files / 1789 tests；Next production build 0 |
| E-013 | UX | 手机/桌面逐步录入通过 | `evidence/inventory-v2-mobile-review.png`、`inventory-v2-desktop-review.png` | 390×844、1440×900；来源→AI→型号→来源主体→价格→复核，草稿保持 |
| E-014 | Release | 默认上线不改变生产行为 | `.env.example`、feature-flag tests、release runbook | flags 默认关闭；V2 RPC 对 service_role 仍 revoke；V1 fallback 保留 |

本任务不记录 secret、完整客户 PII、完整 IMEI 或生产数据。
- `2026-07-18T17:34:39Z` `853770b8a4` — docs/INVENTORY_PRODUCT_V2_RELAUNCH_PLAN.md
- `2026-07-18T17:35:12Z` `d893f899fa` — .ai-company/memory/tasks/TASK-20260718-011-inventory-product-v2-plan/AGENT_PACKAGES.md
- `2026-07-18T17:55:38Z` `6043d74cb9` — .ai-company/memory/tasks/TASK-20260718-011-inventory-product-v2-plan/EXECUTION_CONTRACT.md
