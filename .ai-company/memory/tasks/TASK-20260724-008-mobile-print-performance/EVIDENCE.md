# Evidence Index — TASK-20260724-008-mobile-print-performance

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-24T14:06:01Z | CEO-Orchestrator |
| E-002 | code | mobile explicit delivery, desktop fallback, cache/timing and abort ownership implemented | `src/features/orders/print/*`, three order screens | observed | 2026-07-24T14:42:00Z | IntegrationLead |
| E-003 | unit | print/delivery/StrictMode/unmount/scope-race and fallback tests | `npm run test` | 354 files / 2347 tests passed | 2026-07-24T14:42:00Z | IntegrationLead |
| E-004 | static | lint and TypeScript validation | `npm run lint`, `npm run typecheck` | passed | 2026-07-24T14:42:00Z | IntegrationLead |
| E-005 | browser | fixed four-mode and mobile 390/430 flow | `npm run test:e2e:print-safari:mock` | 7 passed / 1 legacy skipped | 2026-07-24T14:42:00Z | IntegrationLead |
| E-006 | stability | repeated mobile 390/430 run | `--grep "mobile order detail" --repeat-each=3` | 6/6 passed | 2026-07-24T14:42:00Z | IntegrationLead |
| E-007 | build | production Next.js build | `npm run build` | passed | 2026-07-24T14:42:00Z | IntegrationLead |
| E-008 | visual | mobile ready dialog and explicit print/share action | `screenshots/TASK-20260724-008-mobile-print-performance/mobile-pdf-ready-390.png` | inspected | 2026-07-24T14:42:00Z | IntegrationLead |
| E-009 | gap | configured Playwright projects | `--project=webkit` | unavailable; only Chromium configured | 2026-07-24T14:42:00Z | IntegrationLead |
| E-010 | integration | local fix replayed onto latest QR-secured main | commit `2553cab6`, parent `719d2998` | rebased without conflict; not pushed | 2026-07-24T18:05:00Z | IntegrationLead |
| E-011 | unit | full post-rebase regression | `npm run test` | 357 files / 2370 tests passed | 2026-07-24T18:05:00Z | IntegrationLead |
| E-012 | static | post-rebase lint and TypeScript validation | `npm run lint -- --no-cache`, `npm run typecheck` | passed | 2026-07-24T18:05:00Z | IntegrationLead |
| E-013 | build | post-rebase production Next.js build | `npm run build` | passed after approved font-network access | 2026-07-24T18:05:00Z | IntegrationLead |
| E-014 | browser | post-rebase desktop four-mode and Android-UA mobile flow | `npm run test:e2e:print-safari:mock` | 7 passed / 1 legacy skipped | 2026-07-24T18:05:00Z | IntegrationLead |
| E-015 | review | architecture and QA read-only review | subagents `mobile_print_arch_review`, `mobile_print_qa_review` | no P0; release remains blocked on native-device smoke | 2026-07-24T18:05:00Z | IntegrationLead |
| E-016 | release gate | final lint, typecheck, full unit and production build | `npm run lint -- --no-cache`, `npm run typecheck`, `npm run test`, `npm run build` | passed on `d2c81e0a` | 2026-07-24T19:00:00Z | IntegrationLead |
| E-017 | browser | final print E2E before production release | `npm run test:e2e:print-safari:mock` | command exited 0; four-mode and 390px mobile cases passed | 2026-07-24T19:00:00Z | IntegrationLead |
| E-018 | git | approved release integrated to main | `git push origin HEAD:main` | `719d2998..d2c81e0a` | 2026-07-24T19:00:00Z | IntegrationLead |
| E-019 | deployment | exact main SHA built and assigned to production domains | Vercel `dpl_14SPAuGGVYs7E5diGRLR2yfGJWCs` | READY; `www.chinatech.in` and `chinatech.in` aliases active | 2026-07-24T19:00:00Z | IntegrationLead |
| E-020 | smoke | unauthenticated production route health | `curl -sSIL https://www.chinatech.in/orders` | 307 to login; login 200; Vercel response healthy | 2026-07-24T19:00:00Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
