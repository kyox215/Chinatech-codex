# Phase plan

1. **Contract and baseline** — freeze root cause, amount consistency rules, permission boundary and focused regression inputs.
2. **Domain and repository** — add a pure amount-consistency helper, index field, actor-gated filter and repository tests.
3. **AI contract and UX** — add the strict enum parameter, deterministic phrases, provider guidance and query-specific messages.
4. **Verification** — focused tests, lint, typecheck, full test/build, security/diff review and mobile screenshot when the local page is available.
5. **Closeout** — checkpoint evidence and report the local candidate; no push/deploy without separate D4 approval.

## Change budget

- Allowed: `src/entities/order/*`, order list type/schema/repository tests, `src/features/ai-assistant/*`, AI route/E2E tests, this task folder, task-specific screenshot.
- Forbidden: migrations, dependencies, secrets/env files, production flags, unrelated UI/refactors, Git push/deploy.

## Validation mapping

- Intent understanding: router/fake/OpenAI provider tests.
- Correct data selection: domain and repository tests.
- Permission boundary: repository and service tests.
- Safe output: AI service/route serialization assertions.
- User-visible behavior: component/E2E mobile state and screenshot.
