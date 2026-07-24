# Memory Delta

- Each existing repair order now has one stable opaque QR identity; normal reprint is deterministic and reset/lifecycle restore rotates it.
- Anonymous scan shows the customer-safe public progress page; authorized logged-in staff auto-route to internal detail; unauthorized staff stay public.
- Printing for every existing order state requires exactly one QR and never downgrades to a QR-less document.
- Stable identities are service-role-only, full-history backfilled and protected by versioned dedicated HMAC keys; legacy QR links continue to resolve.
