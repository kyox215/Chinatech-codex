# Duplicate Directory and Generated Output Hygiene Report - TASK-20260619-015

- Task: `TASK-20260619-015`
- Scope: clean confirmed empty duplicate directories and inventory ignored/generated duplicate-like output.
- Boundary: no source files, canonical directories, generated files, business code, production data, dependencies, staging, commits, pushes, or deploys were changed.
- Status: empty-directory cleanup verified; generated-output cleanup deferred.

## Executive Result

| Category | Pre-cleanup | Action | Post-cleanup |
|---|---:|---|---:|
| Empty duplicate directories outside generated output roots | 14 | Removed exactly the 14 confirmed-empty directories. | 0 |
| Git-visible untracked duplicate files with canonical counterparts | 0 | No action needed. | 0 |
| Ignored/generated duplicate-like output paths | 56 | Inventory only; not deleted in this task. | 56 |

## Removed Empty Directories

These directories were confirmed empty before removal:

| # | Removed directory |
|---:|---|
| 1 | `public/icons 2` |
| 2 | `src/features/capture/model 2` |
| 3 | `src/features/capture/components 2` |
| 4 | `src/features/auth/model 2` |
| 5 | `src/features/auth/screens 2` |
| 6 | `src/features/platform/server 2` |
| 7 | `src/features/platform/api 2` |
| 8 | `src/features/platform/screens 2` |
| 9 | `src/features/stores/server 2` |
| 10 | `src/features/stores/api 2` |
| 11 | `src/features/stores/testing 2` |
| 12 | `src/features/buyback/model 2` |
| 13 | `src/features/buyback/components 2` |
| 14 | `src/features/buyback/screens 2` |

## Ignored / Generated Duplicate-Like Output Inventory

These paths are under generated or ignored output roots and were not deleted in this task:

| Root | Count | Classification |
|---|---:|---|
| `.next/` | 41 | Next.js/Turbopack build and cache output; generated, ignored. |
| `storybook-static/` | 11 | Storybook static export output; generated, ignored. |
| `playwright-report/` | 2 | Playwright HTML report output; generated, ignored. |
| `test-results/` | 2 | Playwright/test runner result metadata; generated, ignored. |

Exact generated duplicate-like paths:

```text
.next/BUILD_ID 2
.next/app-path-routes-manifest 2.json
.next/build-manifest 2.json
.next/build/package 4.json
.next/build/postcss 4.js
.next/build/postcss.js 4.map
.next/diagnostics/build-diagnostics 4.json
.next/diagnostics/framework 4.json
.next/diagnostics/route-bundle-stats 2.json
.next/export-marker 2.json
.next/fallback-build-manifest 2.json
.next/images-manifest 2.json
.next/next-minimal-server.js.nft 2.json
.next/next-server.js.nft 2.json
.next/package 3.json
.next/prerender-manifest 2.json
.next/required-server-files 2.js
.next/required-server-files 2.json
.next/routes-manifest 2.json
.next/server/app-paths-manifest 2.json
.next/server/chunks 2
.next/server/functions-config-manifest 2.json
.next/server/interception-route-rewrite-manifest 2.js
.next/server/middleware 2.js
.next/server/middleware 3
.next/server/middleware-build-manifest 2.js
.next/server/middleware-manifest 2.json
.next/server/middleware.js 2.map
.next/server/middleware.js.nft 2.json
.next/server/next-font-manifest 2.js
.next/server/next-font-manifest 2.json
.next/server/pages 2
.next/server/pages-manifest 2.json
.next/server/prefetch-hints 2.json
.next/server/server-reference-manifest 2.js
.next/server/server-reference-manifest 2.json
.next/static/chunks 3
.next/trace 3
.next/trace-build 3
.next/turbopack 3
.next/types/cache-life.d 2.ts
.next/types/routes.d 2.ts
.next/types/validator 2.ts
playwright-report/index 2.html
playwright-report/index 3.html
storybook-static/assets 2
storybook-static/favicon 2.svg
storybook-static/iframe 2.html
storybook-static/index 2.html
storybook-static/index 2.json
storybook-static/nunito-sans-bold 2.woff2
storybook-static/nunito-sans-bold-italic 2.woff2
storybook-static/nunito-sans-italic 2.woff2
storybook-static/nunito-sans-regular 2.woff2
storybook-static/sb-common-assets 2
storybook-static/vite-inject-mocker-entry 2.js
test-results/.last-run 2.json
test-results/.last-run 3.json
```

## Verification

| Gate | Result |
|---|---|
| Pre-cleanup empty directory scan | Found 14 empty `* 2*` directories outside `.next/`, `storybook-static/`, and `node_modules`. |
| Empty directory cleanup | `rmdir` removed exactly the 14 confirmed-empty directories. |
| Post-cleanup empty directory scan | No matching empty duplicate directories remain. |
| Duplicate file scan | `same=0 diff=0 missing=0 nonfiles=0` for Git-visible untracked ` 2` files with canonical counterparts. |
| Generated output inventory | 56 ignored/generated duplicate-like paths found and intentionally left untouched. |

## Residual Risks

| Risk | Level | Owner | Handling |
|---|---|---|---|
| Generated duplicate-like output remains in `.next/`, `storybook-static/`, `playwright-report/`, and `test-results/`. | P3 | Operations + QA | Treat as generated-output hygiene only; clean with a separate task if disk/workspace noise matters. |
| Broader dirty worktree remains. | P2 | Operations + QA | Keep future tasks path-scoped and do not stage unrelated files. |

## Recommendation

Run a separate L2 task only if generated-output cleanup is desired. Recommended scope:

- Remove or regenerate `.next/`, `storybook-static/`, `playwright-report/`, and `test-results/` outputs as generated artifacts.
- Do not treat generated-output duplicate-like names as source-tree conflicts.
- Validate with `npm run agents:check`; run app/build/test gates only if the generated outputs are required for a preview or report.
