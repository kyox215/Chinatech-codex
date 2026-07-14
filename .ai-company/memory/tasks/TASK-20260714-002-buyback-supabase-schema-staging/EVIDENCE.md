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

No production customer row, Storage object, credential or secret was read into this evidence file.
