# PRD — RepairDesk AI Assistant Live Pilot

## Goal

Allow an authorized staff member in one approved store to ask natural-language order questions or upload a device-box label, while ensuring AI never bypasses store isolation, budget policy, validation, or human confirmation.

## Actors

- **Owner/admin:** configures budget, canary store, and live status outside the chat surface.
- **Authorized store staff:** uses order assistant and label recognition for their current store only.
- **Unauthorized/non-member staff:** receives the existing safe forbidden response; no provider call occurs.

## User-visible flows

### Order assistant

1. Try deterministic parsing/search first.
2. Use the paid model only when the request needs language understanding and all live gates pass.
3. Validate the model's structured plan, then execute the existing actor-scoped repository query.
4. Return search results, a safe summary, or a clarification question; never let the model issue SQL or mutate an order.

### Device-label recognition

1. Validate type and size before dispatch.
2. Use local parsing when complete enough; otherwise reserve budget and send the image to the approved model.
3. Return typed candidate fields with confidence/warnings for staff review.
4. Do not write inventory automatically; the staff member edits/confirms before the existing inventory form can save.

## State rules

| State | Provider call | User result |
|---|---:|---|
| live disabled / store not allowed / role denied | 0 | safe unavailable/forbidden response |
| deterministic order request | 0 | existing deterministic result |
| locally complete image extraction | 0 | local recognition result |
| budget reservation rejected | 0 | safe budget unavailable response |
| reservation accepted and provider succeeds | 1 | validated typed result; usage finalized |
| provider outcome unknown or finalization fails | at most 1 | safe retry-later response; reservation held conservatively |
| proven failure before network dispatch | 0 | safe retry-later response; reservation may be released |

## Non-functional requirements

- No prompts/images in audit or budget records; no provider response bodies in errors/logs.
- One provider attempt per request, hard timeout, exact model allowlist, and bounded image/token input.
- Same `clientRequestId` is idempotent; retries cannot double-spend or cross stores.
- Every paid path is attributable by aggregate store/actor hashes, request kind, model, tokens, cost, latency, and budget outcome.
- Emergency rollback starts with live flags and does not require destructive SQL.

## Success measures for the canary

- Zero cross-store or unauthorized provider calls.
- Zero unreserved paid calls and zero secrets/PII in logs.
- Budget and daily caps reject before dispatch.
- Structured-response validation success is measurable; invalid output fails safely.
- Staff can review recognized fields without any automatic inventory mutation.
