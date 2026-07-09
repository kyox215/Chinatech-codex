# Memory Delta

## Candidate Project Memory

- Global scan/search now has a shared resolver in `features/capture`; future pages should reuse it instead of implementing page-specific scan behavior.
- Inventory scan payloads should use `/inventory?item=...` for exact focus and `/inventory?q=...` for search fallback.
- Scanner payloads are navigation/search inputs only; public customer-facing QR flows require separate privacy/security approval.

## Database

- No database change was required for the first global scan search implementation.
