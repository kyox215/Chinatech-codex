# Memory Delta — TASK-20260719-001-ai-inventory-live-provider

## Candidate project facts

- **Fact:** the Vision release candidate uses a direct locked `sharp@0.34.5` server dependency to fully decode, bound, orient and re-encode one metadata-free JPEG before fingerprint/reserve/provider dispatch. Source: E-004/E-006/E-008; status: verified local candidate; owner: API/SEC; scope: inventory Vision; review trigger: dependency/model/image policy change.
- **Fact:** initial OpenAI Vision output is specification-only and must contain no identifiers; local scan/manual remains authoritative for IMEI/SN/EAN. Source: provider/service contracts and E-003/E-009; status: verified; owner: Product/SEC; scope: first Chinatech pilot; review trigger: any identifier schema expansion.
- **Fact:** desktop/mobile cloud fallback still applies only selected fields to an unsaved draft and issues no inventory-create request. Source: E-009/E-010; status: verified mocked-cloud; owner: UI/QA; review trigger: intake save-flow change.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- **Decision:** Vision remains fail-closed until an independent Owner D4 covers reuse of the existing v2 policy, cropped-label photo boundary, one synthetic paid Vision smoke, formal-domain test-account verification, main/deploy and Chinatech Vision activation. Source: TASK decision gate and Vision runbook; status: active; owner: Owner + Release; review trigger: Owner response.
- **Decision:** reuse the already approved immutable `ai-runtime-v2` `$50/month`, 20 order/day, 10 Vision/day, 300 global/day and 30 actor/minute values; do not create a conflicting `$3` policy. This numeric reuse does not approve photo egress. Source: `origin/main@ec134a42`, concurrent order release checkpoint and Vision runbook; status: proposed for independent Vision scope/not approved; owner: Owner; review trigger: Vision D4 decision.
- **Decision:** serialize behind `TASK-20260718-014-ai-assistant-live-pilot`; this task must not race its Supabase, Vercel, `main` or formal-domain operations. Source: active context and E-014; status: active; owner: Release; review trigger: release-lock handoff.

## Candidate lessons and capability evidence

- None yet.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
