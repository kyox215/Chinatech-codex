# Memory Delta

Candidate durable lessons:

- Customer-facing iPad mode should be modeled as a store-bound kiosk device plus staff-created sessions, not as a full staff account handed to customers.
- Kiosk realtime payloads must remain PII-free and should only signal session invalidation/update.
- Customer submissions should be staff-reviewed before mutating canonical customer/order records.
- Public customer kiosk routes must bypass both auth redirect and the staff AppShell; verify `/kiosk` screenshots after middleware/provider changes, not only build output.
- Supabase production migrations for kiosk tables remain approval-gated even when migration files are committed.

No long-term memory file was directly updated in this task.
