# Execution Plan — Unknown Intake to Confirmed Quote

## Change contract

- Reuse `issue_description`, `diagnosis_result`, `fault_prices`, approval and workflow fields.
- Add only the minimum database objects required for a safe atomic publish command and message lifecycle metadata.
- Keep legacy reads compatible; never rewrite historical orders based on the literal word “检测”.
- Preserve the current `wa.me` integration and distinguish prepared/opened/confirmed-sent from provider delivery.
- Keep payment correction permissions separate from first-quote preparation.

## Slice order and exit gates

1. **Baseline and failing tests** — reproduce unknown-intake validation, combined-save dead end, missing quote readiness and misleading WhatsApp status.
2. **Domain rules** — unknown intake, quote readiness, zero-price exception, role handoff and stable error mapping are pure tested helpers.
3. **Intake/UI** — desktop/mobile new order accepts unknown issue without a quote line; existing quick-repair behavior remains compatible.
4. **Diagnosis workspace** — reusable workspace appears on order detail and task page with loading, offline, no-permission, conflict and partial-success states.
5. **Permissions/API** — `order:quote_prepare` is server enforced, object scoped and represented consistently in capabilities, client, mock and tests.
6. **Atomic publish RPC** — row lock/CAS, idempotency, server-derived money, approval reset, workflow transition, event/audit and returned order snapshot occur in one transaction.
7. **Notification lifecycle** — preview uses fresh server state; opening WhatsApp does not claim send; staff confirmation binds to the published quote version.
8. **Verification/release** — full gates, browser screenshots, PG replay, linked dry-run/apply/postcheck, serialized push/deploy/smoke and task closeout.

## Required stop conditions

- Any cross-store/object authorization ambiguity.
- Any migration queue containing unreviewed unrelated migrations.
- Any remote migration history drift, missing recovery evidence or failed replay.
- Any amount/balance/approval inconsistency or non-idempotent duplicate event.
- Any inability to preserve the primary dirty workspace or serialize Git/DB/deploy writes.
- Any real customer communication requirement; this task uses test/mock recipients only.

## Rollback

- Before migration: revert the scoped commit in the isolated branch.
- After additive migration: disable the new UI/action path and leave dormant RPC/metadata in place; do not use destructive down migrations.
- After quote publication: retain audit/history and correct with a compensating event; never delete business history.
- If deployment is unhealthy: roll back the application to the prior known-good SHA while retaining compatible additive database objects.
