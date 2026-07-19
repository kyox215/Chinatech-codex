# Checkpoints

## 2026-07-19T08:00:00Z — diagnosed / implementation ready

- Base: isolated `codex/ai-query-understanding-fix-20260719` from `origin/main@635b7288`.
- Verified: complex order text uses OpenAI Responses tool planning; locked phrases/order references use local deterministic routing.
- Root cause: the strict `search_orders` schema has no amount-anomaly filter, so the model can only misuse text search or ask a question; generic zero-result copy then misstates what information is missing.
- Decision: add a server-side, aggregate-finance-gated amount-consistency filter and expose only its enum through the AI tool. No order amount or customer identifier is sent to OpenAI or added to response cards.
- Next: implement the pure rule and repository permission/filter tests, then update AI contracts and UX copy.

## 2026-07-19T08:18:53Z — local candidate complete / release approval pending

- Completed: pure amount-consistency rule, aggregate-finance-gated list filter, strict AI enum, local Chinese/English/Italian intents, OpenAI planner guidance, safe result copy, mock parity and task documentation.
- Verified: exact user phrase uses the deterministic path with no provider/quota; owner path returns the scoped review result; sales path fails before repository access; response cards expose no amount/phone/IMEI additions.
- Gates: lint PASS; typecheck PASS; Vitest 305 files / 1930 tests PASS; Webpack production build PASS; 390×844 in-app browser PASS; targeted Playwright 1/1 PASS.
- Visual evidence: `screenshots/TASK-20260719-002-ai-order-query-understanding/amount-anomaly-mobile-390.png`.
- Repository drift handled: `origin/main` advanced from `635b7288` to `17c066f9` for an unrelated style-recovery incident; no target-file overlap. Candidate was cleanly rebased and committed on the isolated branch.
- Boundary: no key read/copy, paid provider request, migration, production data write, push or deploy. Production release remains a separate D4 approval.
- Memory checkpoint: task-local atomic checkpoint used because global `ACTIVE_CONTEXT.md` belongs to a concurrent task and must not be overwritten.
## 2026-07-19T08:24:39Z — 金额异常自然语言查询本地候选已完成并重基最新 main；lint、typecheck、1930 tests、Webpack build、390px 浏览器和 Playwright 全部通过。

- **Phase:** conditional-closeout
- **Completed/current state:** 金额异常自然语言查询本地候选已完成并重基最新 main；lint、typecheck、1930 tests、Webpack build、390px 浏览器和 Playwright 全部通过。
- **Next:** 等待老板单独批准 push、部署与生产登录态复验；未批准前保持生产不变。
- **Decision:** 金额异常走严格枚举和服务端财务权限过滤；原句走本地确定性路径，provider=0。
- **Evidence:**
  - isolated branch head; screenshot amount-anomaly-mobile-390.png; no migration, key read, paid call, push or deploy
- **Recorded by:** IntegrationLead
