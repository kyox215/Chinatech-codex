# Handoff

## Current phase

Production release complete.

## Resume

1. Read `TASK.md`, `EVIDENCE.md`, and latest checkpoint.
2. If a production issue is reported, inspect deployment `dpl_5LyV5fUQZC5W3H1GgZbTj9rS7LcK` and compare against application commit `469803b78a7134b530b64433c2140de94715cb43`.
3. Preserve the fixed-token database identities and legacy resolver during any rollback; prefer a forward fix.
4. Never log raw QR tokens, HMAC keys, customer PII or production credentials.
