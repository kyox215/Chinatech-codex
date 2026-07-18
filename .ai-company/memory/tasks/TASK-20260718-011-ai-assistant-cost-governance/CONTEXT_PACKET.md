# Context Packet — Phase 3A

## Objective

降低 10 家店 AI 运行成本并建立可测、可限、可停的上线准备，同时保持生产 AI 全关闭。

## Verified baseline

- Clean isolated worktree and branch from `origin/main@f9b0ee8c`.
- Phase 0–2 code exists in production but dormant; prior release passed full gates and fail-closed smoke.
- `provider.ts` reports usage; `provider-factory.ts` intentionally has no live OpenAI implementation.
- `quota.ts` is a one-process Map and explicitly not a live hard cap.
- fake provider contains deterministic order parsing that can be moved before provider selection.
- audit allowlist already supports token aggregates and excludes messages/images/PII.
- A project key is present only in the Owner workspace ignored `.env.local`; value was not inspected and is not present in the isolated worktree.

## Hard boundaries

- No live provider, secret copy/sync, new dependency, real customer/identifier/image transmission, production migration or AI activation.
- One writer: Integration Lead. All spawned reviewers read-only.
- No persistent chats/images/drafts/RAM/multi-identifiers in Phase 3A.
- Missing config always disables openai provider; manual workflows remain.

## Open questions / D4

- Numeric spend approval: recommended `$50/month`, not yet explicit.
- Final model/SDK choice and whether older low-cost model meets the golden set.
- DPA/ZDR/MAM/EU residency/retention/deletion and privacy notice.
- Production migration apply and live Vercel env/secret rollout.

## Immediate action

Integrate three read-only reviews, then implement 3A1 deterministic routing as the first reversible increment.
