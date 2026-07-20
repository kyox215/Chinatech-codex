# Closeout — AI 自然语言订单查询 V4 第一发布包

## Decision

**Closed / production verified.** The approved read-only staff order-query slice is live at business SHA `321834c87cfe75a64159f17c4e8cc9a4d0797d4d` through Vercel deployment `dpl_5UigWH51jjD2HmgTh58GpLLNfQ8X`.

## Acceptance

| Acceptance area                                                 | Result | Evidence            |
| --------------------------------------------------------------- | ------ | ------------------- |
| Evidence-backed model semantics and trusted local precedence    | PASS   | E-008, E-009, E-013 |
| All-date/device/payment/queue/service/parts/completion language | PASS   | E-009, E-012        |
| Opaque actor/store-bound provider-free continuation             | PASS   | E-010, E-013        |
| Locale, compact UI, cumulative cards and explicit navigation    | PASS   | E-010, E-014        |
| Full code, governance and build gates                           | PASS   | E-011, E-012, E-015 |
| Exact-SHA production deployment and safe smoke                  | PASS   | E-016 through E-020 |

## Release facts

- Main business commit: `321834c87cfe75a64159f17c4e8cc9a4d0797d4d`.
- Production deployment: `dpl_5UigWH51jjD2HmgTh58GpLLNfQ8X`, READY.
- Production aliases: `www.chinatech.in` and `chinatech.in` resolve to the same deployment.
- Quality: 318/318 Vitest files, 2,088/2,088 tests, 136 focused AI tests, 12/12 browser tests, lint, typecheck, Webpack build and 46/46 orchestration tests passed.
- Visual proof: the two masked 390px PNG files under `screenshots/TASK-20260720-001-ai-order-query-v4-release/`.

## Boundaries and residual risk

- Inline order writes, public/customer AI, model/budget/quota/price, secrets, allowlist, schema and production data were unchanged.
- Production smoke was anonymous and synthetic; it did not use customer PII or create a provider charge. Authenticated production UI was intentionally not opened, so masked local browser screenshots remain the final visual proof.
- The controlled ontology is intentionally finite. New phrasing should enter through a failing corpus case before expanding the compiler.

## Rollback

Promote prior READY deployment `dpl_81tzbecdBxBKrjZwSeApdSuQAGBq` (`a86fc839`) and revert `321834c8`. This release has no migration or data write, so no database rollback is required.
