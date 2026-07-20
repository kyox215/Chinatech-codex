# Checkpoints — TASK-20260720-003

## 2026-07-20T18:59:37Z — Context ready and implementation authorized

- **Phase:** received → implementing/gated discovery.
- **Owner authorization:** “开始实施计划 完成后推送并应用”。
- **Baseline:** clean isolated branch `codex/smart-print-qr-20260720` from `origin/main` at `19f420717709991ed9f055124bdb9eb08934bcdd`; original dirty checkout preserved.
- **Risk:** R3/L2. Owner approved code, migration and production release, but migration history/dry-run/security/quality remain hard stop conditions.
- **Agents:** three real read-only packages spawned for DATA/architecture, SEC/privacy and QA/UX.
- **External evidence:** current Supabase official docs confirm RLS on exposed public-schema tables, service-role-only server access and dry-run/migration-list workflow; May 2026 changelog notes new public tables may require explicit grants.
- **Next:** verify linked migration list/dry-run, integrate review findings, then begin single-writer implementation.

## 2026-07-20T19:07:00Z — Remote-only migration provenance recovered

- **Gate result:** linked migration list is aligned through `20260720013000` and has exactly one remote-only version, `20260720065246`; the pre-integration dry-run stops on that version and performs no write.
- **Provenance:** exact migration SQL exists on `origin/codex/ai-ledger-fence-hotfix-20260720`; recorded SHA-256 is `fdbd4b605fdbb2147a475f4d2adea7d43b5041e1ad5e4f1102de0222a23ca89d` and matches the isolated release worktree.
- **Decision:** integrate the complete two-commit hotfix branch before creating the smart-QR migration, then rerun linked list/dry-run. Do not use `migration repair`, `--include-all`, manual history edits or reapply the live SQL.
- **Reason:** the hotfix handoff explicitly marks its branch as mandatory input to the next database release; this is a prerequisite integration, not a new database write.
- **Next:** checkpoint the current task contract, merge the hotfix branch, preserve this task as ACTIVE_CONTEXT, then prove linked dry-run is up to date.

## 2026-07-20T20:41:49Z — Release candidate passed code, database and independent review gates

- **Phase:** implementation complete → release ready; production has not yet received migration `20260720190759` or this application commit.
- **Database evidence:** linked history aligns through `20260720065246`; dry-run lists only `20260720190759`. The final migration passed a clean PostgreSQL 17 replay. Two concurrent issue sessions produced two historical rows but exactly one unrevoked row and two audits; a forced audit failure rolled the new link back; revoke+audit and combined IP/global limiter invariants passed.
- **Quality evidence:** lint PASS, typecheck PASS, full Vitest 326 files / 2138 tests PASS, final production build PASS. Chromium and WebKit feature workflows passed; standard/batch/long PDFs are 1/2/2 pages.
- **Independent reviews:** DATA/Architecture PASS, Security PASS, QA/UX conditional PASS with no software P0/P1; only the physical Safari + HP + phone scan remains device-specific.
- **Key decisions:** issue/revoke are service-role-only atomic RPCs with ordered order locks, audit in the same transaction and a partial unique index. The front-door limiter atomically prevents both one-IP global exhaustion and global-saturation IP-row growth. Production Vercel trusts only `x-vercel-forwarded-for` and otherwise uses the bounded `unknown` bucket.
- **Residual risk:** real multi-IP abuse remains an observability/firewall concern; no raw bearer token, customer PII or credential is stored in task evidence.
- **Next:** re-fetch remote main, repeat linked list/dry-run, apply only `20260720190759`, verify database objects, commit/push exact scope, enable the feature flag, wait for exact Vercel deployment READY, then smoke and close.

## 2026-07-20T20:48:18Z — Production migration attempt safely rejected; UUID contract corrected

- **Incident:** the first `supabase db push --linked` reached only `20260720190759` but PostgreSQL rejected the initial table definition with SQLSTATE `42804`: link `order_id text` was incompatible with production `repair_orders.id uuid`.
- **Impact:** no customer impact. The feature flag remained absent/off, application commit was not pushed, the table was not created and `supabase migration list --linked` confirms `20260720190759` was not recorded remotely.
- **Root cause:** the local migration replay fixture incorrectly modeled `repair_orders.id` as text, so it proved transaction/permission behavior without matching the production column type.
- **Correction:** link `order_id`, issue JSON recordset casts and revoke RPC parameter/signature now use UUID end to end. The SQL text test explicitly asserts UUID.
- **Recovery evidence:** a clean PostgreSQL 17 fixture with UUID order IDs applied the full migration. Two concurrent issue sessions left one unrevoked link and two audits; forced audit failure rolled back; revoke+audit, RLS/grants and combined limiter invariants passed.
- **Next:** rerun focused/full code gates and linked dry-run, amend the unpublished commit, then retry only `20260720190759`.

## 2026-07-20T21:00:19Z — Production release closed

- **Phase:** released and production verified.
- **Database:** corrected migration 20260720190759 applied; linked history aligns and live catalog/ACL/RLS/index/function postchecks pass.
- **Application:** origin/main includes feature commit 24190b26a9a23994fc90c3c5b2e07c4337a35865; exact Vercel deployment dpl_J8AFvJEJTb9D9zikWizy42s79Dv5 is READY on both production aliases.
- **Configuration:** Production feature flag and rate-limit secret are present and encrypted; no secret value was printed, committed or copied into evidence.
- **Smoke:** /r returns 200 with the required security headers; invalid public token returns 404; unauthenticated issue/staff-resolve return 401; scoped production error scan is empty.
- **Residual:** physical Safari + HP preview/paper print + phone scan remains an owner device check; batch size 50 was not browser-stressed and remains P2.
- **Rollback:** turn off CUSTOMER_STATUS_QR_ENABLED and promote the prior compatible Vercel deployment; keep the additive database history.
- **State:** task closed. No production data mutation beyond the additive reviewed schema occurred.
