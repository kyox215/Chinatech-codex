# Approval Ledger — AI Assistant Phase 3B

| Gate                                                          | Decision                        | Evidence                                                                                   | Effect                                             |
| ------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Isolated implementation and mocked validation                 | approved                        | owner asked to plan and start                                                              | local reversible code/tests may proceed            |
| Create/store a fresh OpenAI Platform key in ignored local env | approved                        | owner replied “是”                                                                         | key may be used without exposing its value         |
| Zero-cost OpenAI key/auth connectivity check                  | approved within current request | owner asked to connect the real API                                                        | may run locally without printing key/provider body |
| One synthetic, no-PII, minimal-cost generation smoke          | pending D4                      | durable production policy is not yet enabled                                               | do not bypass the budget gateway                   |
| Apply production live-provider upgrade migration              | pending D4                      | dormant `20260718174042` is already applied; new `20260718223739` is locally verified only | do not apply                                       |
| Choose/seed production budget and pricing policy              | pending D4                      | numeric defaults remain proposals                                                          | do not seed/enable                                 |
| Upload Vercel secrets and activate one-store live flags       | pending D4                      | canary store and privacy/budget acknowledgement not finalized                              | do not upload/enable                               |
| Push, deploy/promote, observe, retain/rollback                | pending D4                      | release packet not yet approved                                                            | do not push/deploy                                 |

## Owner decision packet to present after local gates

- Canary store: recommend verified `ChinaTech` / `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`; 6 other active stores remain excluded.
- Proposed caps: USD 50/month; 20 order calls/store/day; 10 vision calls/store/day; 300 calls/day globally; `Europe/Rome`.
- Data scope: recommend first canary as non-PII staff order filters only and vision off. `store:false` does not equal ZDR; default abuse logs may retain input/output up to about 30 days. Human confirmation remains mandatory before inventory writes.
- Model policy: retain the already versioned low-cost snapshots for the first canary, with a P1 upgrade before the documented order-model removal date.
- Stop thresholds: any auth/store leak, unreserved call, secret/PII logging, policy mismatch, repeated finalize failure, or observed cost overrun disables live immediately.
