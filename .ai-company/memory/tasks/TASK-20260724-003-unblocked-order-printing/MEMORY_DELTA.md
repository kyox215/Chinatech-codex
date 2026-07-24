# Memory Delta

- Order printing treats store identity and customer-status QR as enhancements, not hard prerequisites.
- Missing or mismatched store settings must fall back safely and never borrow another tenant identity.
- QR issuance failure degrades to a plain order reference instead of cancelling printing.
- Existing role capability, object scope, and void/deleted restrictions remain authoritative.
