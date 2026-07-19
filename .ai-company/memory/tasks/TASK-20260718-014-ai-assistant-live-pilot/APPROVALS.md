# Approval Ledger — AI Assistant Phase 3B

| Gate                                                          | Decision                        | Evidence                                                                                   | Effect                                             |
| ------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Isolated implementation and mocked validation                 | approved                        | owner asked to plan and start                                                              | local reversible code/tests may proceed            |
| Create/store a fresh OpenAI Platform key in ignored local env | approved                        | owner replied “是”                                                                         | key may be used without exposing its value         |
| Zero-cost OpenAI key/auth connectivity check                  | approved within current request | owner asked to connect the real API                                                        | may run locally without printing key/provider body |
| One synthetic, no-PII, minimal-cost generation smoke          | D4 approved                     | owner explicitly replied `批准 D4` to the exact release packet                             | only through the durable production service path  |
| Apply production live-provider upgrade migration              | D4 approved                     | exact approved unit is `20260718223739`; never rewrite/replay `20260718174042`              | apply only after a fresh linked dry-run            |
| Choose/seed production budget and pricing policy              | D4 approved                     | USD 50/month; order 20/store/day; global 300/day; actor 30/min; Europe/Rome                 | seed disabled, attest, then enable                 |
| Upload Vercel secrets and activate one-store live flags       | D4 approved                     | ChinaTech only; staff non-PII order text; vision/draft/public assistant remain off          | Production scope only; fail closed                 |
| Push, deploy/promote, observe, retain/rollback                | D4 approved                     | owner explicitly approved push, deploy, one billable smoke, 30-minute observation          | serialize release and use written stop thresholds |

## Owner decision packet to present after local gates

- Canary store: recommend verified `ChinaTech` / `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`; 6 other active stores remain excluded.
- Proposed caps: USD 50/month; 20 order calls/store/day; 10 vision calls/store/day; 300 calls/day globally; `Europe/Rome`.
- Data scope: recommend first canary as non-PII staff order filters only and vision off. `store:false` does not equal ZDR; default abuse logs may retain input/output up to about 30 days. Human confirmation remains mandatory before inventory writes.
- Model policy: retain the already versioned low-cost snapshots for the first canary, with a P1 upgrade before the documented order-model removal date.
- Stop thresholds: any auth/store leak, unreserved call, secret/PII logging, policy mismatch, repeated finalize failure, or observed cost overrun disables live immediately.

## 2026-07-19 D4 decision

Owner approved the exact packet above with `批准 D4`. Approval is bounded to one store (`ChinaTech`, `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`), order-text only, non-PII staff use, the recorded model/pricing policy and caps, one service-path billable smoke, and a 30-minute observation. Vision, automatic writes, public/customer AI, a second store, PII egress, a different model/budget, or destructive database rollback remain outside this approval.

## 2026-07-19 D4-v2 decision

Owner explicitly approved: `批准 D4-v2：复用现有加密密钥，部署 ai-runtime-v2，创建并验证 v2 policy，执行一次额外的无 PII 计费 smoke；仅在 HTTP、账本和审计全部成功后开启 ChinaTech 单店员工订单文字 AI，并观察 30 分钟。Vision、自动写入、公开助手、PII 和其他店铺继续关闭。`

This renewed authority is limited to the versioned minimal-reasoning remediation. The exact model, pricing, 256 output-token ceiling, USD 50 monthly cap, per-store/global/actor limits, timezone, one provider attempt, ChinaTech UUID, and service-path-only smoke remain unchanged. Any failed HTTP, ledger, audit, attestation, isolation, privacy, cost, or deployment gate stops the release with live flags off and the v2 policy disabled. The existing encrypted key may be reused but must not be read or printed.
