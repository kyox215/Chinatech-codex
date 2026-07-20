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
