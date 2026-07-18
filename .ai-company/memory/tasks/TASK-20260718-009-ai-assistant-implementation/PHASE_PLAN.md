# Phase Plan — TASK-20260718-009-ai-assistant-implementation

## Current status

| Phase | Status | Exit evidence |
|---|---|---|
| Phase 0 | completed | E-002–E-008 and 2026-07-18T13:05:12Z checkpoint |
| Phase 1 | completed | E-009–E-018 and Phase 1 checkpoint |
| Phase 2 | completed | E-021–E-032 and Phase 2 checkpoint |
| Phase 3 | pending | production apply remains D4 pending |
| Phase 4 | pending | depends on shared Phase 2 contract |
| Phase 5 | pending | public activation remains D4 pending |
| Release | completed | E-033–E-039: fast-forward push, exact-SHA READY deploy, fail-closed env check, smoke/observation and rollback target |

## 全局阶段协议

每个阶段严格执行：

1. 完整读取 `docs/AI_ASSISTANT_VISION_INTAKE_PLAN.md`。
2. 核对 `git status`、分支、上一检查点、阶段输入和批准状态。
3. 把该阶段设为唯一 `in_progress` 目标，其他阶段保持 pending。
4. 主线程单一写入；只读 Reviewer 不修改代码。
5. 每个可验证增量先跑最窄测试，再跑阶段门禁。
6. Product/Architecture/Data/Security/QA 按风险独立复核。
7. 更新 Evidence、Handoff、Plan Delta，并运行 `$memory-checkpoint`。
8. 只有退出条件有证据时才进入下一阶段。

## Phase 0 — Foundation and Gates

### Deliverables

- 隔离分支/工作树和干净基线。
- API Key 本地安全配置；生产 Secret 只在发布门执行。
- ADR：Next.js BFF + Responses API + 严格工具白名单 + `store:false`。
- 数据流、威胁模型、角色/权限、失败模型、功能旗标、预算与隐私批准包。
- Strict Zod/JSON Schema、provider interface、fake provider 和最小脱敏 fixture 基线。
- 当前 OpenAI/Supabase/Vercel 官方资料记录。

### Exit

- 三份只读部门报告已集成，分歧已裁决。
- 架构、数据、安全、UI 和发布边界可实现且无未登记 blocker。
- 首次付费请求、真实客户数据发送和生产迁移仍有明确门禁。
- Phase 0 检查点完成。

## Phase 1 — Staff Read-only Order Assistant

### Deliverables

- 员工后台 AI Sheet；桌面与移动入口符合 RepairOS。
- `search_orders` / `get_order_summary` 只读工具。
- `actor_id` / `store_id` / permission 只由服务端注入。
- 订单卡显示来源、更新时间、有限字段和详情入口。
- 无权限、无结果、含糊、超时、429、离线与 manual fallback 状态。

### Exit

- 0 个跨店/越权成功；无模型正式写入工具。
- 订单答案全部来自当前业务服务而非模型记忆。
- 单元、合约、集成、角色 E2E、移动/桌面截图和安全复核通过。

## Phase 2 — Vision to Editable Inventory Draft

### Deliverables

- JPEG/PNG/WebP 安全上传、MIME/magic/真实解码、EXIF 清理、尺寸和并发限制。
- 本地条码/OCR/Luhn + OpenAI 视觉结构化输出合并。
- brand/model/color/RAM/storage 与独立 identifiers 候选、置信、冲突、警告。
- 逐字段接受/修改/清空/拒绝，一键应用到现有库存表单。
- 成本、售价、成色、所有权、激活锁和真伪始终人工/确定性来源。

### Exit

- 未点击应用/保存时无库存、订单、草稿或图片业务写入；仅持久化 allowlist、聚合型安全审计事件。
- 应用后只预填确认字段，正式保存仍走现有服务。
- 脱敏黄金集和注入/恶意上传测试通过；图片截图不含完整标识符。

## Phase 3 — Durable Drafts and Data Expansion

### Deliverables

- 可空 RAM、多标识符、session/run/draft/review 数据合同。
- additive expand migration、复合 tenant FK、RLS、最小 Grants、索引、TTL/清理和审计。
- 草稿 version CAS、唯一幂等键、重复请求返回同一正式结果。
- linked dry-run、schema clone、advisors、数据量/锁/恢复/观察证据。

### Exit

- migration 执行级批准；否则只完成代码/迁移文件并保持 flag off，不谎称生产完成。
- A 店无法读取/写入 B 店任何 AI 对象。
- 迁移前后兼容、回滚/功能关闭和恢复计划验证。

## Phase 4 — Buyback and New-order Prefill

### Deliverables

- 回收流程预填，不绕过身份/所有权/检查/报价/签名/付款/finalize。
- 新维修单预填，不绕过客户、故障、授权、财务和服务端归属。
- 同一照片识别 contract 复用，不创建第二套解析逻辑。

### Exit

- 关键业务证据与现有幂等路径保持完整。
- 草稿期间外部副作用禁用；角色 E2E 和回归通过。

## Phase 5 — Public Customer Assistant

### Deliverables

- 与员工后台分离的入口、session、rate limit、abuse control 和审计。
- 登录/OTP/单订单短时授权；不能按任意电话或订单号枚举。
- 仅返回该客户被授权订单的有限状态；正式库存/付款/权限写入禁止。
- 客户图片只生成送修申请草稿，含隐私告知和删除路径。

### Exit

- 独立 Privacy/Security/DPA/公开激活批准。
- 枚举、重放、越权、限流、上传、注入和数据删除 E2E 通过。
- 未批准时保持 `AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED=false`。

## Release and Observation

- 执行 `lint → typecheck → test → build → targeted E2E → security/data checks`。
- 生成桌面、390px、430px 的脱敏截图。
- 文档、env 示例、运行手册、变更日志、任务记忆和 ADR 同步。
- 从隔离分支进行 scope-only commit，推送并经过 CI。
- 生产环境只配置批准的 Secret/flags/migration，完成 smoke 和观察窗口。
- 回滚顺序：关闭 public/write/draft/tool/assistant flags → 回退部署 → 轮换泄露密钥；不紧急删除表。

### 2026-07-18 release result

- Business commit `8bef230f94d2` was pushed without force to the named recovery branch and `main`.
- Vercel deployment `dpl_HWmQRHjy9XRYPMvLT1E1oraee7jr` built exact commit `8bef230`, reached `READY`, and received the `www.chinatech.in` aliases.
- Production contains no `AI_*` or `OPENAI_*` environment names; absent variables keep every AI capability disabled and no local key was synchronized.
- Logged-out root/inventory/orders safely resolve to login; unauthenticated AI capabilities returns `401` with `private, no-store`; the immediate error-log query returned no entries.
- Rollback target is READY deployment `dpl_5tbk1iFUafSExZK3ezWAkxoawQSi` built from `main@0f5ed6e`.
- Phase 3–5 remain pending and are not part of this completed release unit.
