# Handoff / Resume — TASK-20260724-008-mobile-print-performance

## Current handoff

- **Status:** approved production release is live; automated gates and unauthenticated route smoke passed.
- **Last verified:** 2026-07-24T19:00:00Z
- **Workspace/branch:** `/private/tmp/repairdesk-fixed-pdf-print-release`, `codex/mobile-print-performance`; runtime fix `2553cab6`, release head `d2c81e0a` pushed to `main`.
- **Production:** Vercel `dpl_14SPAuGGVYs7E5diGRLR2yfGJWCs` is READY and owns `www.chinatech.in` / `chinatech.in`.
- **First action:** on real iPhone 16 Pro Chrome and Honor Magic 8 Pro Chrome, fully close the old tab, reopen the production app, generate A5 PDF, tap “打印或分享 PDF”, confirm the system menu opens, cancel and retry, then verify “查看 PDF” and download fallback.
- **Residual gate:** native Android/iOS system UI and printed QR decode cannot be proven by mocked Chromium/WebKit automation.
