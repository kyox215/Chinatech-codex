# Handoff / Resume — TASK-20260718-014-ai-assistant-live-pilot

## Current handoff

- **Status:** D4-v2 ChinaTech employee order-text slice conditionally closed; 24-hour read-only follow-up pending.
- **Last verified:** 2026-07-19T01:30:41Z after a complete 30-minute observation.
- **Workspace/branch:** isolated worktree `/private/tmp/repairdesk-ai-v2-live.oU1dTS/worktree`; branch `codex/ai-v2-d4-release-20260719`. Never edit or clean the owner's dirty root checkout.
- **Production state:** `main@152caa1ce5e415d464e0cfc73674ae4cda3cfa6a`; Vercel `dpl_946N6xMftqrRpKTzGmnDBmbjrR2y` READY; `ai-runtime-v2` enabled and v1 disabled. ChinaTech-only master/order-text flags are active; Vision, draft apply, public/customer assistant, PII and other stores remain off.
- **Ledger state:** 2 finalized requests / 2 provider attempts / 167 microUSD total; v2 smoke HTTP/ledger/audit succeeded at 44 microUSD; open, bad, overrun, Vision and cross-store counts are zero.
- **Observation:** `00:58:50.334Z` through `01:28:56.132Z`, scoped Vercel runtime errors zero. No employee request arrived during the window, so retain the actual v2 one-shot as service-path evidence.
- **Security:** four AI tables have RLS and zero client-role table grants. Advisor no-policy notices are INFO and intentional for service-role-only access; unrelated legacy warnings remain open.
- **Browser:** an explicit user site-use restriction blocks Chrome access to `www.chinatech.in`; do not bypass it. Local synthetic screenshots plus production deployment/HTTP/ledger/audit are the alternate evidence.
- **Next action:** at 24 hours after activation, perform only read-only policy/ledger/audit/runtime checks. Any Vision, PII, automatic write, public/customer AI, second store, model or budget change requires a new R4/D4 task.
