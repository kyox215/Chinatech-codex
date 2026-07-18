# Context Packet — AI Assistant Phase 3B

## Stable code anchors

- Provider contract/factory: `src/features/ai-assistant/server/provider.ts`, `provider-factory.ts`
- Runtime and cost policy: `runtime-policy.ts`, `cost-policy.ts`, `feature-flags.ts`
- Service boundaries: `order-assistant.service.ts`, `vision-assistant.service.ts`
- Privacy and audit: `safety-identifier.ts`, `audit.ts`
- Typed contracts: `src/features/ai-assistant/model/contracts.ts`
- Server route composition: `src/server/api/repairdesk-router.ts`
- Governance migration: `supabase/migrations/20260718174042_ai_assistant_cost_governance_v1.sql`

## Decisions carried forward

- Fake provider remains the default and tests remain deterministic.
- Order deterministic parsing and complete local image recognition are free paths and must never initialize/dispatch OpenAI.
- The model proposes typed intent/data only; repositories and forms retain authorization, query, and write ownership.
- Aggregate audit only; never persist prompt/image/response content.
- Production migration, policy, secret upload, and live flags are independent gates.

## Secret handling

- The new key is outside this worktree in the owner's ignored root `.env.local`.
- Tests use obvious non-secret placeholders only.
- A live smoke may read the key in-process from the approved env file without printing it or copying it into this worktree.
