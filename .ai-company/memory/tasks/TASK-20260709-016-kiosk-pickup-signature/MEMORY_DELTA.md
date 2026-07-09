# Memory Delta — TASK-20260709-016-kiosk-pickup-signature

## Candidate project facts

- Kiosk signature evidence phase is implemented: staff-accepted kiosk submissions with `signature_data_url` save a private `order_attachments.kind = signature` record and show evidence in order detail. Source: TASK-20260709-016, `src/features/kiosk/server/kiosk.repository.ts`, `src/features/orders/components/order-overview-tab.tsx`. Status: observed/verified. Review trigger: before changing kiosk accept flow, order attachments, or pickup completion.
- Linked Supabase project `xluzcoduqsdvjoouqhkc` has kiosk MVP migration `20260709233000` in remote history and already has the signature attachment prerequisites. Normal `supabase db push --linked --dry-run` is still blocked by 25 historical migrations requiring `--include-all`. Source: TASK-20260709-016 EVIDENCE. Status: observed. Review trigger: before any broad production migration reconciliation.

## Candidate department updates

- DATA/SEC: Do not store raw signature data URLs in accepted kiosk session payloads or order events. Store signature files in the private `repairdesk-order-attachments` bucket and log only attachment metadata.
- QA: For kiosk signature changes, verify both server/mock accept flow and order detail visual evidence; `localhost` should be used for local browser screenshots when the dev server canonical origin rejects `127.0.0.1`.

## Candidate decisions / ADRs

- Decision: Do not run `supabase db push --include-all` as part of kiosk signature work. Treat task-specific database application as no-op when read-only checks prove required objects already exist.

## Candidate lessons and capability evidence

- Capability evidence: Integration lead completed code, data preflight, UI screenshot, tests, build, memory checkpoint, and scoped staging from an isolated worktree while preserving the dirty main checkout.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
