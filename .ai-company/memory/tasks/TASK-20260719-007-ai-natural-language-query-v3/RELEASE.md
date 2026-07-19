# Release Plan — AI 自然语言订单查询 V3

## Release unit and authority

- Target: Vercel production for Chinatech RepairDesk.
- Unit: one scoped business commit based on latest `origin/main`.
- Owner authorization: implementation, non-force `main` push and production application deployment are explicit in this thread.
- No database migration, data backfill, secret rotation, feature-budget change or production write operation.

## Gates

- Quality Gate: PASS in `QUALITY_GATE.md`.
- Security: closed-world filter compiler, fail-closed archive permission and PII egress boundary verified.
- Compatibility: response contract moves from AI order v2 to v3 in the same frontend/backend release.
- Build: Next.js Webpack production build passes.
- Remote: fetch immediately before commit/push; stop on overlapping `origin/main` drift.

## Deployment sequence

1. Freeze and audit the exact file list; stage only task files.
2. Commit on the isolated release branch.
3. Fetch `origin`; if `main` changed, rebase and rerun relevant gates.
4. Push non-force `HEAD:main` only when the fast-forward assertion holds.
5. Wait for the Git-linked Vercel deployment for the exact commit; if the Git event is cancelled or missing, deploy the same clean commit with the linked Vercel project.
6. Require `READY`, exact Git SHA metadata and both production aliases.
7. Run anonymous/no-PII route and AI boundary smoke; scan deployment error logs.

## Health criteria

- `https://www.chinatech.in` and `https://chinatech.in` resolve to the READY deployment.
- Public page/manifest is reachable; unauthenticated private AI endpoints remain private.
- No new Vercel error/fatal cluster after deployment.
- No production model request or customer record is used for smoke testing.

## Rollback

- Immediate containment: disable `AI_ASSISTANT_ENABLED` if the AI sheet itself is unsafe.
- Artifact rollback: promote the previous READY production deployment.
- Forward fix: restore the prior contract/service/UI commit and redeploy.
- Data rollback: not applicable; this release has no migration or production data write.

## Actual release

- Business commit: `445b5e8117fd5bd8fcad33eb4ea120a5688e1816` (`feat(ai): harden natural-language order queries`).
- Integration: non-force `HEAD:main`; remote exact-SHA check passed.
- Vercel: `dpl_9e2FqCMMyfKuRiyHVHcbUzm7NVSc`, `READY`, production target, exact business SHA.
- Production aliases: `www.chinatech.in`, `chinatech.in` and the linked Vercel aliases.
- Smoke: login/manifest reachable; anonymous AI endpoints remain 401; post-release error/fatal scan is empty.
- Closeout documentation is a follow-up no-runtime-diff commit; its deployment may replace the exact artifact on the aliases without changing application code.
