# Handoff / Resume — TASK-20260731-001-buyback-mobile-density-implementation

## Current handoff

- **Status:** closed and deployed.
- **Last verified:** 2026-07-31 CEST.
- **Workspace/branch:** `/private/tmp/repairdesk-buyback-mobile-density-20260731` / `codex/buyback-mobile-density-20260731`.
- **Base SHA:** `bb88cb099fc404543995b4dcbb46b502e1eabbdb`.
- **Release:** commit `71fa80a3`; Vercel `dpl_3zaDN4w3rKX77JS4WPz75vCKdsHh`; authenticated 390/1024 production smoke PASS without writes.
- **Forbidden:** do not edit API/server/Supabase paths; do not use the dirty root worktree for business code.
- **Verified gates:** lint, typecheck, 2531 tests, production build, Chromium/WebKit guided flow and desktop overflow.
- **Rollback:** promote `dpl_BuUyuWGkURnmUK44smgfJChi6V3e` and, for write-path containment, disable `REPAIRDESK_BUYBACK_TRANSPARENT_QUOTE_WRITE_ENABLED`; do not delete quote history or run SQL.
