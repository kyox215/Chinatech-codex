# Evidence — TASK-20260720-003

| ID | Stage | Claim | Evidence | Result |
|---|---|---|---|---|
| E-001 | baseline | Isolated implementation starts from current remote | `/private/tmp/repairdesk-smart-print-qr-20260720`, branch `codex/smart-print-qr-20260720`, HEAD/remote `19f420717709991ed9f055124bdb9eb08934bcdd` | PASS |
| E-002 | governance | Original dirty checkout is not used as writer/release source | isolated worktree + single-writer task contract | PASS |
| E-003 | research | Supabase current RLS/roles/migration rules reviewed | official Supabase changelog and docs reviewed 2026-07-20 | PASS |
| E-004 | migration gate | Remote and local history are aligned through the applied AI-ledger hotfix | full hotfix branch integrated at merge `9f027221`; `supabase migration list --linked` aligns through `20260720065246` | PASS |
| E-005 | provenance | Remote-only migration has exact reviewed source | `origin/codex/ai-ledger-fence-hotfix-20260720`, migration SHA-256 `fdbd4b605fdbb2147a475f4d2adea7d43b5041e1ad5e4f1102de0222a23ca89d` | PASS |
| E-006 | dry-run | Only the reviewed smart-QR migration is pending | `supabase db push --linked --dry-run`: only `20260720190759_repair_order_customer_status_links.sql` | PASS |
| E-007 | database | Final SQL executes with security, atomicity and abuse-control invariants | clean PostgreSQL 17 replay; concurrent issue leaves exactly one unrevoked link; audit failure rolls the issue transaction back; revoke+audit atomic; combined limiter proves IP-blocked requests do not consume global capacity and global-blocked requests do not create IP rows | PASS |
| E-008 | quality | Final static/unit/integration gates | `npm run lint`; `npm run typecheck`; full Vitest `326 files / 2138 tests`; production `npm run build` with dynamic `/r` and four customer-status APIs | PASS |
| E-009 | browser/PDF | Chromium and WebKit print/public workflows | both browsers `5/5`; production-build public-header flow `1/1`; standard PDF 1 page, batch PDF 2 pages, long PDF 2 pages; evidence under `screenshots/TASK-20260720-003-smart-print-qr/` | PASS |
| E-010 | independent review | Final DATA/Architecture, Security and QA/UX reviews | real read-only agents `/root/smart_qr_arch_data` PASS, `/root/smart_qr_security` PASS, `/root/smart_qr_qa_ux` CONDITIONAL PASS with no P0/P1 software blocker | PASS WITH DEVICE CONDITION |
| E-011 | residual device gate | Physical Safari/HP preview, paper print and phone scan | requires shop hardware after deployment; synthetic browser/PDF evidence is complete | OWNER DEVICE CHECK |
| E-012 | production apply safety | First production apply was rejected before schema creation because link `order_id text` did not match production `repair_orders.id uuid` | PostgreSQL SQLSTATE `42804`; follow-up migration list shows `20260720190759` absent remotely; feature flag remained off and application was not pushed | SAFE FAILURE / NO CUSTOMER IMPACT |
| E-013 | corrective verification | Corrected link/RPC order IDs to UUID and revalidated against a UUID fixture | clean PostgreSQL 17 UUID-schema replay; concurrent issue, one-active invariant, audit-failure rollback, revoke+audit, RLS/grants and combined limiter all PASS | PASS |
| E-014 | production database | Corrected migration is applied and linked history is aligned | linked migration 20260720190759 present locally/remotely; live schema dump confirms UUID order_id, same-store FK, one-active partial index, RLS, service-role-only RPC/table access and rate/retention indexes | PASS |
| E-015 | Git release | Reviewed feature scope is authoritative on main | origin/main contains 24190b26a9a23994fc90c3c5b2e07c4337a35865; push was non-force after fresh remote reconciliation | PASS |
| E-016 | production deploy | Exact feature SHA is live | Vercel deployment dpl_J8AFvJEJTb9D9zikWizy42s79Dv5 built main@24190b2, reached READY and owns chinatech.in plus www.chinatech.in | PASS |
| E-017 | production configuration | Feature and rate-limit inputs are present without secret disclosure | encrypted Production variables CUSTOMER_STATUS_QR_ENABLED and CUSTOMER_STATUS_RATE_LIMIT_SECRET are configured; secret value was generated directly into Vercel and never recorded | PASS |
| E-018 | production smoke | Public route and auth boundaries behave safely | GET /r 200 with no-store/noindex/CSP/frame/referrer/CORP/nosniff headers; invalid synthetic token 404; unauthenticated issue and staff-resolve 401; no redirects or scoped error logs | PASS |

Do not store secrets, raw tokens, production credentials, full customer PII or unsupported pass claims here.
