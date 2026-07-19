# Vision client-stall remediation plan

## Outcome

Deliver a production-safe Chinatech inventory-label Vision flow that cannot remain indefinitely busy, clearly tells a novice which stage is running, always preserves manual intake, never auto-writes inventory, and remains within the already approved D4 privacy and cost envelope.

## Current architecture facts

1. The browser derives a metadata-free image before local recognition.
2. The incident regression proves the prepared-state render triggered the old `[prepared]` effect cleanup, which aborted the newly assigned controller and left the UI in `working` forever before HTTP.
3. The optional label-photo path also had two defense-in-depth gaps: a synchronous main-thread ZXing fallback and FileReader conversion without an abort deadline.
4. Only after those client steps does the BFF route enforce capability, store, policy, reservation, server re-decode/re-encode and OpenAI dispatch.
5. The incident stopped before the BFF route: production usage/open/audit and route logs were all zero.

## Options

### A — Recommended minimal hotfix

- Use only preemptible browser-native local detectors in the optional Vision image path; if unavailable or empty, fall through to the existing specification-only cloud recognizer.
- Keep identifier capture local in the next scan/manual step and never send IMEI/SN/EAN to cloud.
- Add AbortSignal/deadline support to Blob conversion and a whole-pipeline watchdog.
- Add explicit preparation, local inspection and cloud recognition messages.

Benefits: no new dependency, smallest failure surface, fastest rollback, preserves privacy and manual flow. Tradeoff: browsers without native barcode detection will not extract identifiers from the label photo; this is acceptable because cloud identifiers are deliberately forbidden and scan/manual entry already exists.

### B — Worker-isolated ZXing

Move image decode into a dedicated worker with transferable pixel data and explicit termination.

Benefits: retains local barcode fallback. Tradeoffs: larger architecture, bundle/worker compatibility risk, more mobile memory use and a longer validation path. Not justified for the incident hotfix unless option A fails acceptance.

## Implementation contract

- No schema, migration, budget, model, dependency or tenant expansion.
- No retry loop and no automatic inventory mutation.
- Each selected file has one client operation identity; clear/new selection invalidates stale work.
- Every asynchronous boundary settles with success, actionable error, abort or timeout.
- Manual Next remains usable whenever AI is unavailable, failed or disabled.
- Production Vision flags stay off until all local and production preflight gates pass.

## Verification

- Focused unit/component tests for native-unavailable fallthrough, stage transitions, timeout/abort, stale completion and one server call.
- Existing inventory Vision and API tests; assert zero inventory-create requests.
- Full lint, typecheck, unit/integration test and production build.
- Production dependency audit, secret/client-bundle scan and diff hygiene.
- Browser checks at 390x844 and 1280x800 for preparation/local/cloud/error/manual states, no horizontal overflow and screenshots.
- Independent architecture, QA/UX and security/release review.

## Release and rollback

1. Recheck `origin/main` and push only a fast-forward, scoped hotfix.
2. Deploy with all three Vision gates off.
3. Verify deployment source, aliases, policy attestation, zero Vision ledger/open/audit and clean runtime errors.
4. After zero-ledger/policy/auth preflight, enable only ChinaTech Vision gates and perform the single already-authorized, pre-inspected synthetic no-PII cropped-specification smoke through the formal UI.
5. Verify exactly one provider attempt, settled usage, safe structured output with `identifiers=[]`, no identifier fields in the request contract, no inventory write and mobile/desktop usability. Do not claim software can prove selected pixels contain no prohibited content.
6. Observe for the runbook window. Any timeout, duplicate request, audit/ledger mismatch, privacy violation or runtime error triggers flags-first rollback.

## Stop conditions

- Any request or output contains a prohibited identifier or PII.
- Any retry or duplicate provider attempt appears.
- Ledger reservation cannot be reconciled.
- Client can remain busy past its watchdog.
- Manual Next becomes blocked.
- Remote main drifts in an overlapping file before push.
