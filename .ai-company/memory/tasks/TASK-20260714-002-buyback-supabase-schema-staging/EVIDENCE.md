# Evidence Index — TASK-20260714-002-buyback-supabase-schema-staging

| ID | Evidence | Result | Collected |
|---|---|---|---|
| E-001 | Owner instruction | Explicit `应用supabase改动`; scope narrowed to buyback migration on `main` | 2026-07-14 |
| E-002 | Linked project | `xluzcoduqsdvjoouqhkc`, `ACTIVE_HEALTHY`, PostgreSQL 17.6 | 2026-07-14T16:48Z |
| E-003 | Production data/catalog preflight | target table/RPC/9 fields/bucket absent; duplicate payments=0; pre-final legacy payments=0; attachments to relabel=0; IDs UUID; composite item key exists; no active/long transaction; largest related table 229376 bytes | 2026-07-14T16:48Z |
| E-004 | Storage policy preflight | `storage.objects` policy list empty; target bucket absent | 2026-07-14T16:48Z |
| E-005 | Migration history | remote has `20260714004500`; `20260712150000` local-only | 2026-07-14 |
| E-006 | Remote-history source reconciliation | restored `20260714004500` bytes equal commit `0bd8fd59`; SHA256 `67358d718348cb22b0a800030a67aa88df59769a6526600f6017fad599bf2ddf` | 2026-07-14 |
| E-007 | Migration hardening | payment guards before first write; lock timeout 5s; statement timeout 5min; no runtime table/RPC grants; dormant comments | 2026-07-14 |
| E-008 | Focused migration contract | Vitest 1 file / 7 tests passed | 2026-07-14T16:55Z |
| E-009 | PG17 UUID fixture | migration executed; RLS=true; 9 columns; private 8MiB bucket; rows/objects=0; service-role table/RPC privileges all false | 2026-07-14 |
| E-010 | PG17 text-ID fixture | same result as UUID fixture | 2026-07-14 |
| E-011 | Duplicate-payment fixture | migration exited at preflight; agreement table/bucket/guided fields/indexes all remained absent | 2026-07-14 |
| E-012 | Official CLI runner atomicity | deliberate later-statement failure left probe table=false and migration history row=false | 2026-07-14 |
| E-013 | Full local history reset | blocked before target by historical `20260611102805` assumption: `inventory_items.product_channel` absent; recorded as pre-existing migration debt, not a target migration failure | 2026-07-14 |
| E-014 | Backup evidence | eight completed physical backups listed; latest `2026-07-14T06:44:53.792Z`; `pitr_enabled=false`, `walg_enabled=true` | 2026-07-14T17:05Z |
| E-015 | Latest official CLI dry-run | Supabase CLI 2.109.1 `db push --linked --dry-run --include-all` listed only `20260712150000_buyback_guided_evidence_finalize.sql` | 2026-07-14T17:02Z |
| E-016 | Independent DATA review | CONDITIONAL GO for dormant/empty staging only | 2026-07-14 |
| E-017 | Independent SEC review | GO for dormant staging; runtime enable remains NO-GO | 2026-07-14 |
| E-018 | Independent QA/REL review | CONDITIONAL GO after commit freeze and repeated exact dry-run | 2026-07-14 |
| E-019 | Frozen migration digest before commit | `20260712150000` SHA256 `83957a0e68a535f01ce6f9e3f1a1d2707491b6ede9f7d78701446bafabe3f542` | 2026-07-14T17:10Z |
| E-020 | Repository quality gates | agents check, lint, typecheck, 132 files / 910 tests, and production build 22/22 pages passed; first build attempt was sandbox-only port denial and passed unchanged with required permission | 2026-07-14T17:12Z |
| E-021 | Frozen source commit and push | scoped source commit `66aa468e05e8914c403e855151f3f453a5f66f3b` pushed to `origin/main`; migration SHA256 remained `83957a0e68a535f01ce6f9e3f1a1d2707491b6ede9f7d78701446bafabe3f542` | 2026-07-14T17:14Z |
| E-022 | Frozen-commit release gate | immediate production preflight remained zero/absent with no long transaction or waiting lock; CLI 2.109.1 dry-run listed only `20260712150000` | 2026-07-14T17:17Z |
| E-023 | Production migration apply | `npx --yes supabase@2.109.1 db push --linked --include-all` applied exactly `20260712150000_buyback_guided_evidence_finalize.sql`; no repair, seed, raw DDL, SQL Editor or Settings/Kiosk migration | 2026-07-14T17:18Z |
| E-024 | Migration/catalog postcheck | history contains `20260712150000`; agreement RLS enabled; one invoker/empty-search-path RPC; private 8MiB MIME-limited bucket; 9 fields, validated constraints and valid/ready indexes | 2026-07-14T17:19Z |
| E-025 | ACL/data/storage postcheck | agreement rows=0, evidence objects=0, staged/restricted relabels=0, duplicate/legacy payment anomalies=0; anon/authenticated/service_role table DML and RPC EXECUTE all false; storage policy list empty | 2026-07-14T17:19Z |
| E-026 | Final migration parity | post-apply CLI dry-run returned `Remote database is up to date.` | 2026-07-14T17:21Z |
| E-027 | Advisors and immediate service observation | target has no advisor WARN/ERROR; intentional INFO is RLS-with-no-policy plus dormant empty-table index notices; Postgres/Storage/API showed no target failure and API responses in the window were HTTP 200 | 2026-07-14T17:23Z |
| E-028 | Delayed observation | at `2026-07-14T17:28:37Z`: migration recorded=true, agreement rows=0, evidence objects=0, all runtime DML/EXECUTE=false, duplicate payments=0; API 4xx/5xx=0 and Storage non-2xx=0 | 2026-07-14T17:28Z |
| E-029 | Observation-query correction | one Postgres ERROR was generated by the operator's first read-only check referencing nonexistent `public.payments`; corrected to `inventory_transactions` and the complete observation passed. It was not an application or migration error | 2026-07-14T17:28Z |
| E-030 | Independent reviews | DATA `buyback_data_review`: CONDITIONAL GO dormant-only; SEC `buyback_security_review`: GO dormant-only; REL/QA `buyback_release_review`: CONDITIONAL GO after frozen commit and exact dry-run | 2026-07-14 |
| E-031 | Visual-evidence decision | no UI/runtime behavior changed and the sensitive workflow intentionally remains feature-off, so there is no related task page to screenshot; database catalog/ACL/storage/history/log evidence is the required substitute | 2026-07-14 |
| E-032 | Closeout governance gates | `npm run agents:check` and `git diff --check` passed; `memory-audit` exited 0 with four historical timestamp issues and existing templates; repository-wide validate still reports the same 12 historical duplicate Agent names outside this task diff | 2026-07-14T17:34Z |
| E-033 | Fixture cleanup | stopped and auto-removed only `repairdesk_buyback_fixture_20260714` and `repairdesk_runner_atomicity_20260714`; filtered Docker recheck returned no matching containers | 2026-07-14T17:35Z |

No production customer row, Storage object, credential or secret was read into this evidence file.
- `2026-07-14T17:33:09Z` `ab397a4211` — E-021..E-031；commit 66aa468e；post-apply dry-run up to date；2026-07-14T17:28:37Z delayed ACL/empty-state observation。
- `2026-07-14T17:35:54Z` `f40e4dabc6` — E-021..E-033；git diff --check PASS；agents:check PASS；memory-audit exit 0。
