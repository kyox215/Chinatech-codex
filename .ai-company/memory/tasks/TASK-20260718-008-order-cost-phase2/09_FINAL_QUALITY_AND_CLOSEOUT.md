# Stage 09 — Final Quality, Documentation and Closeout

Status: CONDITIONAL PASS / closed under Owner Option B — 2026-07-18

## Goal

Map every acceptance criterion to current evidence, synchronize operating documentation and
memory, prove the production release stayed dormant, and close without overstating broad recovery.

## Acceptance and evidence matrix

| Requirement | Evidence | Result |
|---|---|---|
| Independent stage contracts and checkpoints | Stage 00–09 Markdown files; `CHECKPOINTS.md` | PASS |
| Ledger, profit, parts, export, backfill and currency correctness | E-007..E-036; PostgreSQL 17 harnesses | PASS |
| Role, tenant, RLS and browser-grant isolation | E-040, E-053, E-063, production hidden-state smoke | PASS |
| Full application regression and build | E-041/E-042: 259 files / 1,669 tests; lint/type/build | PASS |
| Exact production migration unit | E-058, E-061..E-064; delayed no-op dry-run | PASS |
| Non-force main push and exact-SHA deployment | E-065; `main@b8932b2c`, READY deployment | PASS |
| Child flags remain off and no automatic backfill | E-066/E-069 | PASS |
| PII-free production smoke and screenshots | E-067; three `production-*.jpg` files | PASS |
| Runtime/database observation | E-068/E-069 | PASS |
| Physical restore and full-history replay | Stage 08 Option B | ACCEPTED EXCEPTION |

## Quality conclusion

**CONDITIONAL.** The complete Phase 2 product/release scope is delivered and observed, and the
Owner explicitly accepted the two broad recovery gaps for this release only. The result must not
be represented as a full environment Database Application Gate PASS. No high-risk child feature
was activated and no production historical backfill was run.

## Documentation impact

- Updated authoritative `docs/ORDER_INTERNAL_COSTS.md` with applied-migration and dormant-runtime
  status.
- Updated task contract, Stage 07/09, evidence, CEO report, handoff, screenshots and checkpoints.
- Consolidated reusable rules into project and affected department memories without copying PII,
  secrets or raw rows.
- `.env.example` and API/schema documentation were already synchronized in Stage 06; no new runtime
  configuration value was added during release.

## Capability review

Three real Stage 00 review agents and the Integration Lead produced reusable product/architecture,
data/security and QA/release evidence. This is a C2 candidate for bounded order-cost release work,
not an autonomy or permission upgrade. See `CAPABILITY_REVIEW.md`.

## Residual work

- DATA + Operations + Owner: repair the full historical migration baseline and run an isolated
  physical restore drill with owner, RPO/RTO and artifact evidence.
- DATA + Security: separately discover consumers before legacy RLS/policy/function hardening.
- Product + Owner: enable each dormant Phase 2 child capability only through a new approved rollout.

## Reproduction

1. `supabase db push --linked --dry-run` must report `Remote database is up to date`.
2. Vercel deployment metadata must map production to the released `main` SHA and READY state.
3. `/finance` must show the closed authorization state while child flags are absent.
4. Settings must contain Phase 1 default costs but not procurement/currency/backfill cards.
5. Selecting “屏幕” in `/orders/new` must show internal cost beside customer quote without submit.
6. Production error logs and Phase 2 background-write table counts must remain clean/zero.
