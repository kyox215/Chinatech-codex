# Checkpoints — TASK-20260714-002-buyback-supabase-schema-staging

## 2026-07-14T17:08:02Z — Dormant staging pre-release gates satisfied

- Owner explicitly requested applying the Supabase change.
- Scope is exactly buyback migration `20260712150000`; Settings/Kiosk remains excluded.
- Original migration was NO-GO; DATA/SEC/REL findings drove payment-preflight ordering, bounded
  timeouts and complete runtime ACL revocation.
- Production read-only checks are green and current target objects are absent.
- PG17 UUID/Text fixtures, fail-before-write fixture and official CLI runner rollback proof pass.
- Production history source `20260714004500` is restored byte-for-byte from its applied commit.
- Official CLI 2.109.1 dry-run lists exactly one migration: `20260712150000`.
- Eight completed physical backups are visible; latest is 2026-07-14T06:44:53.792Z; PITR is off.
- Next: freeze exact files in a scoped commit, push main, rerun immediate linked gates from that
  commit, apply only the target, then execute catalog/ACL/storage/feature-off observation.

## 2026-07-14T17:10:06Z — Dormant buyback schema staging pre-release gates pass: production preflight, UUID/text PG17 fixtures, fail-before-write, official runner rollback, backup evidence and single-migration dry-run verified; runtime grants and feature remain off.

- **Phase:** implementation
- **Completed/current state:** Dormant buyback schema staging pre-release gates pass: production preflight, UUID/text PG17 fixtures, fail-before-write, official runner rollback, backup evidence and single-migration dry-run verified; runtime grants and feature remain off.
- **Next:** Freeze scoped files in a commit and push main; from that commit rerun immediate preflight and exact dry-run, then apply only 20260712150000 and execute catalog/ACL/storage/feature-off postchecks.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
