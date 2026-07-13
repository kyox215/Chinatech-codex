# Handoff / Resume — TASK-20260712-005-buyback-guided-evidence

## Current handoff

- **Status:** pre-release freeze; code and browser gates are green, push gate still pending.
- **Last verified:** 2026-07-13T08:33:00Z
- **Workspace/branch:** `/private/tmp/repairdesk-buyback-guided-20260712` / `codex/buyback-guided-v2-20260712`.
- **First action:** obtain final read-only security conclusion, fetch/rebase on current `origin/main`, rerun final gates, commit the closeout evidence and push `HEAD:main` without applying the migration.

## Verified implementation

- Six-step beginner flow: device, quote, inspection, seller, restricted evidence/signature and final confirmation.
- Passport needs one identity page; other document types require front/back. Full document numbers are not persisted.
- Sales can prepare and hand off; only Owner/Manager can capture/read restricted evidence and finalize.
- The signed snapshot includes device, seller, amount, payment, declarations and versioned Italian legal text; changing signed content invalidates the hash.
- Finalization uses expected version, idempotency key, advisory/entity locks and a single database RPC contract.
- Buyback resale requires data wipe, IMEI and activation-lock checks; a return resets all three to `unchecked`.
- Quality-check writes use expected-version/CAS and remove the staged check row on conflict.
- Client evidence compression is bounded to 2.4MB and the API rejects JSON envelopes above 4.4MB.

## Production release blockers / residual risks

- **NO-GO for production migration/deploy in this task.** `20260712150000_buyback_guided_evidence_finalize.sql` has not been applied to linked or production Supabase.
- Before a production apply, run dry-run plus real dual-schema fixtures, verify RPC grants/RLS/storage bucket policies and validate serial/advisory-lock behavior with concurrent requests.
- Legal/privacy text is an implementation baseline, not professional legal approval. The Owner must obtain Italian privacy/contract review and choose retention/legal-hold periods before production use.
- Staged restricted evidence expires after 24 hours in access control, but an automated deletion/retention job is not included.
- EXIF stripping, malware scanning, OCR/NFC and signed direct-upload architecture remain future hardening; current files are compressed and Base64 posted within the hosted body envelope.
- Generic inventory sale/payment writes remain a separate existing workflow and were not converted to one transaction in this buyback-acquisition task.
