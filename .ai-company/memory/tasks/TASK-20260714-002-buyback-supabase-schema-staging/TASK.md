---
schema_version: 1
task_id: "TASK-20260714-002-buyback-supabase-schema-staging"
title: "回收敏感资料 Supabase 空 Schema 分阶段上线"
status: "closed"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["DATA", "INT", "QA", "REL", "SEC"]
created_at: "2026-07-14T17:08:02Z"
updated_at: "2026-07-14T17:39:39Z"
closed_at: "2026-07-14T17:39:39Z"
---
# Task — 回收敏感资料 Supabase 空 Schema 分阶段上线

## Owner request

`应用supabase改动`

## Objective

只把 `20260712150000_buyback_guided_evidence_finalize.sql` 作为 dormant、空且不可访问的
Schema staging 应用到已链接生产 Supabase。不得启用证件/签名采集、付款或 finalize。

## Scope in

- 对齐生产已应用但 `main` 缺失的 `20260714004500` 源文件。
- 将回收迁移改为付款异常先行、有限锁等待和有限语句时间。
- Schema staging 后保持协议表及 finalize RPC 对全部 runtime role 无权限。
- 生产只读 preflight、官方 CLI 精确 dry-run、单迁移 apply、catalog/ACL/storage 后检。
- 保持 `BUYBACK_SENSITIVE_WORKFLOW_ENABLED=false`。

## Scope out

- 不上传身份证、签名或任何 Storage 对象。
- 不创建真实回收协议、付款或 finalize 业务记录。
- 不授予协议表或 RPC 运行时权限，不恢复六步敏感 UI。
- 不应用 Settings/Kiosk 迁移，不使用 migration repair、SQL Editor 或 raw DDL。
- 不决定 retention、legal-hold 或正式法律文本；这些属于独立 enable task。

## Acceptance criteria

- [x] 生产 preflight：目标对象 absent、两项付款异常为 0、附件回标为 0、无长事务。
- [x] PG17 UUID/Text 双 schema 执行通过；异常付款 fixture 在首写前零残留失败。
- [x] 官方 CLI runner 故意失败时 table/history 均回滚。
- [x] 生产物理备份列表存在 completed restore point；PITR=false 已明确记录。
- [x] linked dry-run 精确只列 `20260712150000`。
- [x] 精确 SQL、测试与远端历史源文件提交并推送 `main`。
- [x] 从冻结 commit 重跑即时 preflight 和 dry-run，仍只列目标迁移。
- [x] 正式 apply 成功且 migration history 仅新增 `20260712150000`。
- [x] 表/RPC/bucket/字段/索引/约束/ACL 后检全绿且行数/对象数为 0。
- [x] feature-off 与生产错误/锁观察通过；任务正式关闭。

## Release boundary

这是 Schema staging，不是功能启用。任何 runtime grant、身份证/签名上传、真实 finalize 或
六步敏感流程恢复，都必须新建 enable task，完成 retention/cleanup、不可变协议、复合租户
外键、意大利隐私/合同审核和真实并发测试后再次由 Owner 批准。

## Recovery

- 最新可见物理备份：2026-07-14T06:44:53.792Z，状态 `COMPLETED`；PITR 未启用。
- 应用错误时保持 feature-off，禁止盲目重跑或 repair history；先查 catalog/history。
- 成功后优先撤权/前向修复。因迁移含附件字段和回标语义，不承诺简单 down migration。

## Closeout boundary

- Scoped result: PASS，生产空 Schema staging 已完成。
- Runtime result: feature-off；协议表及 finalize RPC 对 runtime roles 仍不可访问。
- Not certified: 完整迁移历史从零重建、PITR/恢复演练、敏感功能法律/保留/清理门禁。
- Visual evidence: 本任务仅修改数据库结构且敏感 UI 保持关闭，没有相关任务页面可截图；以 migration history、catalog、ACL、bucket、日志和 final dry-run 作为替代证据。
