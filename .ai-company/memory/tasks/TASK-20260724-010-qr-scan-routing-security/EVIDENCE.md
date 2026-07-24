# Evidence

## Automated gates

- Targeted Vitest: 10 files / 59 tests passed.
- Full Vitest: 354 files / 2356 tests passed.
- ESLint, TypeScript and `git diff --check`: passed.
- Next.js 16.2.11 production build with Node 22.12.0: passed; 27/27 static pages generated.
- Chromium mobile E2E: 2/2 passed.
- WebKit mobile E2E: 2/2 passed.
- Independent Chromium repeat-each=5: 10/10 passed.
- Independent security review: PASS, no open P0/P1/P2.

## Visual evidence

- `evidence/staff-scan-masked-chromium-390.png`
- `evidence/staff-scan-masked-webkit-390.png`

Both show the dedicated repair QR result, masked sensitive link, one “查看此订单” action and no copy action.

## Scope evidence

- No migration, dependency, lockfile, public DTO or server authorization file changed.
- Pre-push remote `main`: `7a57ab0ac282928ac94811072ccfd630c7a7311d`.

## Production release

- Main commit: `5ac58f61`.
- Vercel deployment: `dpl_GCgyDGC4GjLgBywtkmU7RuHBEfco`, target Production, state Ready.
- Production aliases: `www.chinatech.in`, `chinatech.in`.
- `/r`: HTTP 200 with `cache-control: private, no-cache, no-store`, `referrer-policy: no-referrer`, `x-robots-tag: noindex`.
- Anonymous `/orders`: HTTP 307 to `/login?next=%2Forders`.
- Synthetic invalid customer-status token: safe `LINK_UNAVAILABLE`, HTTP 404.
- Vercel error logs for the new deployment since release: zero entries.
- `2026-07-24T17:08:16Z` `fec6bf067c` — .ai-company/memory/tasks/TASK-20260724-010-qr-scan-routing-security/EVIDENCE.md
- `2026-07-24T17:15:41Z` `fec6bf067c` — .ai-company/memory/tasks/TASK-20260724-010-qr-scan-routing-security/EVIDENCE.md
