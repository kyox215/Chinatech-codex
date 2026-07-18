# Memory Delta

## Candidate facts

- Store owner lifecycle is modeled separately from platform `stores.status`.
- Order-data access now has structured reasons while legacy booleans remain compatible.
- Close must revoke and independently gate Kiosk/invite paths; restore never revives old credentials.
- Rename is a short atomic RPC with revision CAS, idempotency and one-time AAL2 challenge consumption.
- Export covers deterministic DB rows and UUID-prefixed Storage objects, persists database/storage/artifact hashes, and requires an isolated restore proof.
- Purge is a private approval-locked worker saga with Storage-first ordering, FK child-before-parent deletion, target-only cycle break, leases/checkpoints/retry, other-tenant guard, zero proof and a non-PII tombstone.
- Every lifecycle feature flag uses exact `1` and defaults off; permanent purge is never exposed to the browser.

## Not promoted

- Production migrations are applied and `main` is pushed; feature flags remain off.
- The target store is not renamed, closed or deleted.
- The real encrypted backup destination/KMS, production restore environment, retention decision and exact purge target remain undecided and require release approval.
