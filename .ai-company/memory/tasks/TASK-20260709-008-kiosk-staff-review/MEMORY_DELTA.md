# Memory Delta — TASK-20260709-008-kiosk-staff-review

## Candidate project facts

- Existing kiosk MVP schema (`20260709233000_customer_kiosk_ipad_mvp.sql`) already supports staff review statuses with `submitted`, `accepted`, `returned`, `accepted_by`, `accepted_at`, and `returned_at`; staff review implementation did not require a new migration. Source: implementation evidence E-002/E-008. Status: observed. Owner: DATA/API. Review trigger: before adding signature attachment persistence or pickup completion.
- In local E2E bypass mode, staff RepairDesk API uses the mock source; public kiosk source must also use mock when `REPAIRDESK_E2E_ORDER_AUDIT=1` or `REPAIRDESK_E2E_BUSINESS_DESKTOP=1`, otherwise mock kiosk tokens fail when `.env.local` has Supabase config. Source: `src/server/api/kiosk-public-source.ts` and `src/server/api/kiosk-public-source.test.ts`. Status: implemented. Owner: API/QA. Review trigger: before changing public kiosk auth/source routing.

## Candidate department updates

- QA: full Vitest passed after kiosk staff review implementation (93 files / 623 tests), scoped ESLint passed for changed kiosk/API/settings files, sandbox-external build passed. Full `npm run lint` and `npm run typecheck` in the active checkout were blocked by unrelated staged inventory changes.
- DOC: no standalone docs updated; task memory is the current implementation record. Future external SOP should document staff review, return reason, and signature persistence once later stages are implemented.

## Candidate decisions / ADRs

- Decision: keep staff review inside Settings / 客户 iPad for this stage instead of adding a new navigation page, because the existing kiosk device/session surface already exists and avoids touching order-detail WIP. Status: implemented. Owner: UX/API. Review trigger: if review queue grows beyond settings/admin use.
- Decision: do not store full signature data or customer PII in order event payloads; order events record only session id, type, version, booleans, and field-presence flags. Status: implemented. Owner: SEC/API. Review trigger: before audit-log sanitizer or attachment signature storage work.

## Candidate lessons and capability evidence

- Clean push may require a separate worktree when another active window has unrelated staged changes in the main checkout; do not unstage or include those files without Owner approval.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
