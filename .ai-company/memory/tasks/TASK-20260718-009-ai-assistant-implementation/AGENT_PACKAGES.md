# Agent Packages — Phase 0

## Product / FLOW + UX

- Mode: `read_only`
- Goal: 把计划映射到当前 RepairOS 入口、订单/库存表单和完整 UI 状态，给出 Phase 1/2 可实现切片和验收矩阵。
- Must read: 主计划、UI/Component declarations、responsive、mobile detail、AppBar/providers/inventory/capture code。
- Forbidden: 编辑、安装依赖、secret、生产数据、部署、子代理。
- Return: 当前事实、建议组件/入口、状态机、响应式/a11y、测试/截图清单、blockers、文件证据。

## Architecture / API

- Mode: `read_only`
- Goal: 从最新代码验证 BFF、auth、router、order/inventory contracts，比较直接 fetch 与官方 OpenAI SDK，定义 Responses API provider/tool/schema/error/retry/usage 边界。
- Must read: 主计划、ARCHITECTURE、package/lock、BFF/router/schemas/auth/audit/api/types。
- Research: 只使用当前 OpenAI 官方文档；不做 live API 调用。
- Forbidden: 编辑、secret、DB mutation、部署、子代理。
- Return: 架构事实图、选项、推荐、依赖决定、接口、失败模型、测试、文件证据。

## Data / Security / QA / Release

- Mode: `read_only`
- Goal: 验证数据缺口、迁移/RLS/Grants/幂等、图片/PII/key威胁、黄金集、Vercel/production门禁和回滚。
- Must read: 主计划、migrations、inventory repository、storage/audit/auth、Vercel/config/test scripts。
- Research: 当前 Supabase/OpenAI/Vercel 官方资料；不读取 secret。
- Forbidden: 编辑、SQL mutation、live customer data、deploy、子代理。
- Return: severity findings、data contract、migration plan、threat model、test/release gates、blockers、文件证据。

## Phase 1 independent review outcomes

### Product / UX

- Final report: conditional, P0 0, P1 3.
- Reconciled fixes: visible suggestions now match planner behavior; current mobile module action remains first/primary and AI is second; six-flow Playwright coverage was added.
- Additional fixes: misconfiguration is non-retryable, offline status is announced, composer receives focus and offline suggestions are disabled.

### Architecture / API

- Final report: conditional, P0 0, P1 1.
- Reconciled fixes: provider/repository/audit failures now map to stable safe errors and emit bounded audit outcomes; authentication precedes JSON parsing and AI POST content length is bounded.
- Deferred live gates: durable timeout/AbortSignal, safety identifier and real-provider dependency remain blocked before external calls.

### Data / Security / QA / Release

- Final report: conditional, P0 0, P1 3.
- Reconciled fixes: exact store rollout allowlist, configured local fake quota, full outcome audit, aggregate-only token sanitization and six-flow E2E coverage.
- Deferred live gate: durable atomic quota and runtime production rollout controls must be approved and verified before live provider activation.

All reviewers were real read-only subagents. They did not edit, stage, commit, push, deploy, access secrets or mutate data. The Integration Lead integrated and verified every accepted fix.

## Phase 2 independent review outcomes

### Product / UX

- Initial report: conditional, P0 0, P1 4.
- Reconciled fixes: edit only focuses/selects until actual input changes; zero-decision apply is disabled with a count-aware CTA; result status is announced and focused; dirty close confirms while authority change force-cleans; pending save copy is explicit.
- Final focused re-review: pass, P0 0, P1 0; 1 file / 6 tests passed.

### Architecture / Security

- Initial report identified unapproved Tesseract CDN worker/core/lang loading and pre-decode resource-bomb exposure.
- Reconciled fixes: Tesseract fallback disabled with safe OCR degradation; shared JPEG/PNG/WebP header parser rejects oversized dimensions before decode and validates again after decode; server reuses the parser.
- Final focused re-review: pass for default-off/fake/page-memory slice, P0 0, P1 0. Real OpenAI images remain blocked; permission preflight before body read and cancellable local workers remain P2 hardening.

### Data / QA / Release

- Initial report: conditional, P0 0, P1 4; focused 16 files / 95 tests, typecheck and 4/4 Playwright were independently observed before final fixes.
- Reconciled fixes: resource-bomb preflight, CDN fallback removal, screenshot masking/recapture, baseline `next-env.d.ts` restoration and explicit “no business write except aggregate audit” documentation.
- Final evidence: full lint/typecheck, 257 files / 1690 tests, Webpack build and final combined 10/10 Playwright; first combined 8/10 flaky/tolerance failure is retained in E-030 rather than hidden.

All Phase 2 reviewers were real read-only subagents. They did not edit, stage, commit, push, deploy, access secrets or mutate data. The Integration Lead integrated and verified every accepted fix.
