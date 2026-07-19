# Incident — Chinatech mobile Vision client stall

## Declaration

- **Severity:** SEV-3 — contained single-store optional-feature incident.
- **Started:** approximately 2026-07-19 12:59 CEST.
- **Incident Commander:** RepairDesk Integration Lead.
- **Impact:** one Chinatech Owner attempt; manual inventory intake remained available; no customer/public AI exposure.
- **Current state:** contained; all three Vision gates are off.

## Confirmed facts

- The mobile UI displayed the prepared-photo delete control while still showing the processing state, so browser image preparation completed and the stall occurred after prepared state was set.
- Two Supabase read-only checks returned Vision usage/open/audit `0/0/0`.
- Vercel showed no `ai/vision/extract` request and no corresponding runtime error.
- No provider request was reserved or dispatched, OpenAI was not called, no charge occurred and the one authorized smoke remains unconsumed.
- `AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED`, `AI_VISION_INTAKE_ENABLED` and `AI_DRAFT_APPLY_ENABLED` were set to `0`.

## Confirmed root cause

The V2 card assigned the newly prepared image with `setPrepared(nextPrepared)` while its cleanup effect depended on `prepared`. That render ran the cleanup for the previous value, and the cleanup called `abortRef.current?.abort()` against the current recognition controller. The async handler then observed the aborted signal and returned without changing the `working` status, leaving the prepared-photo delete control visible beside an indefinite spinner. An executable component regression failed before the fix by proving the active signal was aborted immediately after the prepared-state render, and passes after moving disposal to a ref plus unmount/explicit-reset cleanup.

The main-thread ZXing fallback was not the primary incident cause, but it and unbounded FileReader conversion were defense-in-depth risks. The hotfix removes ZXing only from this optional label-photo path, preserves the dedicated scan/manual identifier path, adds an abortable FileReader deadline and a whole-client-pipeline watchdog.

## Recovery

- Keep Vision disabled while the hotfix is developed and verified.
- Preserve manual inventory entry and do not retry the image.
- Reopen only after focused/full tests, mobile/desktop evidence, zero-ledger production preflight and confirmation that the existing exactly-once no-PII authority is still unconsumed.
