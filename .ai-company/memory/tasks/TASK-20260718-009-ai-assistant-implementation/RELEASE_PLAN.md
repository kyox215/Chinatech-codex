# Release Plan — AI Assistant Phase 0–2 Safe Slice

## Release unit

- Scope: Phase 0 architecture/contracts, Phase 1 staff read-only order assistant, Phase 2 image-to-unsaved-inventory-form draft.
- Target Git: latest `origin/main`, integrated from `codex/ai-assistant-implementation-20260718` with a scope-only commit.
- Target runtime: Vercel production project `chinatech-codex`, canonical site `https://www.chinatech.in`.
- Data/dependencies: no migration, no Storage change, no package/lock change, no production key sync.

## Mandatory production configuration

The release is dormant and fail-closed:

```dotenv
AI_ASSISTANT_ENABLED=0
AI_ORDER_READ_TOOLS_ENABLED=0
AI_VISION_INTAKE_ENABLED=0
AI_DRAFT_APPLY_ENABLED=0
AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED=0
AI_ASSISTANT_PROVIDER=fake
AI_ASSISTANT_STORE_ALLOWLIST=
AI_ASSISTANT_REQUESTS_PER_STORE_DAY=0
AI_ASSISTANT_EXTERNAL_DATA_APPROVED=0
AI_ASSISTANT_BUDGET_APPROVED=0
```

Absent variables have the same fail-closed effect. The local `OPENAI_API_KEY` must not be copied to Vercel in this release.

## Pre-release gates

- Fetch/prune and integrate the latest remote main without touching the owner's dirty main worktree.
- Resolve every overlapping latest-main change intentionally; no dropped cost/finance work.
- `git diff --check`, secret/real-identifier scan, scope inventory and baseline generated-file check.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npx next build --webpack` after latest-main integration.
- Run Phase 1+2 Playwright with fake provider; final result must be green and evidence images masked.
- Independent Product/UX, Architecture/Security and Data/QA/Release reviews must have P0 0 / P1 0 for this release unit.

## Publish sequence

1. Create a scope-only commit on the isolated branch.
2. Fetch remote again; require the release commit to be a fast-forward descendant of current `origin/main`.
3. Push the named release branch for recovery, then fast-forward remote `main` to the same verified commit.
4. Confirm Vercel project identity before deployment; do not create a new project.
5. Deploy the exact release commit to `chinatech-codex` production.

## Production smoke and observation

- Deployment is `READY` and resolves through the production alias.
- `GET /api/repairdesk/ai/capabilities` unauthenticated remains `401`/safe denial.
- Logged-out pages load; ordinary manual inventory and orders routes remain reachable.
- With all flags absent/off, no AI entry is visible and no OpenAI request is possible.
- Inspect deployment logs for build/runtime errors without exposing environment values.
- Observe immediately after deploy and record deployment ID/URL, commit, smoke results and rollback target.

## Rollback

1. Ensure `AI_DRAFT_APPLY_ENABLED=0`, `AI_VISION_INTAKE_ENABLED=0`, `AI_ORDER_READ_TOOLS_ENABLED=0` and `AI_ASSISTANT_ENABLED=0`.
2. Roll Vercel production back to the previous known-good deployment if any non-AI regression appears.
3. Revert the scope-only Git commit if necessary; do not delete tables or run database rollback because this release has no migration.
4. If a key leak is suspected, rotate it at the provider; the key is not part of this release.

## Residual blocked scope

- Real OpenAI text/image calls, numeric API budget, real-data privacy/DPA/ZDR/region/deletion approval.
- Official OpenAI/server image dependencies, durable quota, server deadlines/safety identifier and live golden-set validation.
- Phase 3 migration/apply, Phase 4 formal workflow expansion and Phase 5 public activation.

## Production release record — 2026-07-18

- Git: named branch and `main` both received business commit `8bef230f94d2` by non-force fast-forward.
- Runtime: Vercel deployment `dpl_HWmQRHjy9XRYPMvLT1E1oraee7jr`, exact Git commit `8bef230`, status `READY`, canonical alias `https://www.chinatech.in`.
- Configuration: production variable-name review found no `AI_*`/`OPENAI_*`; absent values preserve the mandatory fail-closed state and the local key was not synchronized.
- Smoke: `/`, `/inventory`, and `/orders` safely resolved to `/login`; `/api/repairdesk/ai/capabilities` returned unauthenticated `401` with `private, no-store`.
- Observation: Vercel build completed successfully with 25 static pages; the immediate error-level runtime query returned no entries.
- Rollback: previous READY production deployment `dpl_5tbk1iFUafSExZK3ezWAkxoawQSi`, URL `https://chinatech-codex-1nk9lvvus-kyox120-9295s-projects.vercel.app`, Git commit `0f5ed6e`.
