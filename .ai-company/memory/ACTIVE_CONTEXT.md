---
schema_version: 1
current_task_id: "TASK-20260719-001-ai-inventory-live-provider"
status: "active"
phase: "production-release"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-19T05:49:36Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**Chinatech 库存入库 AI 图片标签识别真实接入**

## Current state

Owner 已批准 ChinaTech Vision D4；订单文字 canary 已完成 30 分钟观察并释放写锁；Vision 候选已重放到 a3ae676d。生产预检：v2 enabled、5 次文字请求、open/bad/Vision/跨店均为 0、Vision audit 为 0、AI 表 4/4 RLS 且客户端无表权限、Vercel runtime errors 为 0。

## Blocking decisions

- Authority is exactly one synthetic no-PII cropped packaging-label Vision smoke, ChinaTech-only activation, and authenticated phone/desktop verification on `www.chinatech.in`.
- People, IDs, customer data, receipts/addresses, device screens, IMEI/SN/EAN, automatic inventory writes, public AI, another store, retries, or a model/budget change remain prohibited.
- Any policy, tenant, privacy, budget, ledger, audit, identifier, runtime or manual-fallback stop threshold keeps Vision flags off or triggers flags-first Vision rollback.

## Next action

提交批准证据，推送 exact lineage 到 main；保持 Vision flags off 部署；证明 v2 policy 后执行唯一一次合成无 PII Vision smoke。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260719-001-ai-inventory-live-provider/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
