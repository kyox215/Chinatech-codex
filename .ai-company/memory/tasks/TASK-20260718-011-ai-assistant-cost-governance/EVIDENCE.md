# Evidence Index — TASK-20260718-011-ai-assistant-cost-governance

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-18T17:11:44Z | IntegrationLead |
| E-002 | git baseline | implementation is isolated from Owner dirty main and starts at current remote main | branch `codex/ai-assistant-cost-governance-20260718`; `HEAD=origin/main=f9b0ee8c` | verified | 2026-07-18T17:12Z | IntegrationLead |
| E-003 | prior handoff | Phase 0–2 is dormant and Phase 3–5 remain D4-gated | prior task `HANDOFF.md`, `APPROVALS.md`, `CLOSEOUT_REPORT.md` | verified | 2026-07-18 | IntegrationLead |
| E-004 | credential boundary | a usable key is present only in ignored Owner-workspace `.env.local`; isolated worktree has none and no value was read | silent exit-status checks and `git check-ignore -q` | verified presence only | 2026-07-18 | IntegrationLead |
| E-005 | current architecture | live provider is intentionally unimplemented; quota is per-process; usage/audit seams exist | `provider.ts`, `provider-factory.ts`, `quota.ts`, `audit.ts`, services | verified | 2026-07-18 | IntegrationLead |
| E-006 | official docs | Codex/API billing separation, current model prices/caching/image token controls and Supabase Grants/RLS separation inform the plan | official OpenAI docs MCP and Supabase docs search | verified current 2026-07-18 | IntegrationLead |
| E-007 | independent review | Architecture/API, Data/Security and Product/QA/Release independently found process-local quota, provider-before-direct routing, parallel local/cloud vision and UTC-day semantics unsafe for paid pilot | `/root/phase3a_arch_api`, `/root/phase3a_data_security`, `/root/phase3a_product_qa_release`; `REVIEW_SYNTHESIS.md` | 3 read-only reports integrated; no agent writes | 2026-07-18 | IntegrationLead |
| E-008 | focused tests | direct order bypass, request abuse guard, local-first vision, runtime/cost/Safety ID/deadline/audit contracts pass | focused `npx vitest run ...` batches | 44 tests green in latest service/audit batch; new focused batches green | 2026-07-18 | IntegrationLead |
| E-009 | typecheck | new TypeScript contracts and route signal propagation compile | `npm run typecheck` | exit 0 | 2026-07-18 | IntegrationLead |
| E-010 | migration generation | migration filename came from Supabase CLI, not an invented timestamp | `npx supabase migration new ai_assistant_cost_governance_v1`; CLI 2.109.1 | created `20260718174042_ai_assistant_cost_governance_v1.sql` | 2026-07-18 | IntegrationLead |
| E-011 | migration parse/catalog | final SQL executes on isolated PostgreSQL 17; no enabled policy; RLS true; anon/authenticated table and RPC access false; service RPC access true | temporary no-volume `postgres:17-alpine` container, `psql -v ON_ERROR_STOP=1 -f`, catalog queries | verified; container removed | 2026-07-18 | IntegrationLead |
| E-012 | migration behavior | reserve/idempotent replay/store limit, concurrent final slot, 308 micro-USD settlement, pre-dispatch release, stale reserved-max settlement and overrun policy disable behave as contracted | synthetic-only temporary PostgreSQL calls | verified; one concurrent reserve succeeded and one was blocked | 2026-07-18 | IntegrationLead |
| E-013 | historical migration limitation | whole-repository local Supabase replay fails before Phase 3A at historical `inventory_items.product_channel` baseline drift | isolated `supabase db start --workdir ...` | blocked before new migration; not misreported as Phase 3A failure or production pass | 2026-07-18 | IntegrationLead |
| E-014 | documentation | canonical cost governance, staff, vision, architecture and documentation impact are synchronized | `docs/AI_ASSISTANT_COST_GOVERNANCE.md`, related docs, `DOCUMENTATION_IMPACT.md` | updated; live gates remain explicit | 2026-07-18 | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
