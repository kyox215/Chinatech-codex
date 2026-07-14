# WP-09 Integrated Visual Evidence Manifest

Captured/reviewed: 2026-07-14 CEST
Data: synthetic mock identities and records only
Production flags/data: not used
Next development indicator: hidden in all six images
Final local target: `origin/main@d5384e88`; buyback images regenerated after the final sync

| File | Viewport | Image size | Capability/state | Evidence purpose |
| --- | --- | --- | --- | --- |
| `wp09-integration-overview-390x844.png` | 390×844 | 390×1189 full page | mock owner, 9/9 visible | mobile Settings overview and touch layout |
| `wp09-integration-overview-1440x900.png` | 1440×900 | 1440×900 | mock owner, 9/9 visible | desktop Settings rail and two-column overview |
| `wp09-integration-member-drawer-1280x800.png` | 1280×800 | 1280×800 | mock owner/member manager | employee role and extra-grant Drawer |
| `wp09-integration-store-recovery-390x844.png` | 390×844 | 390×844 | store readable; store-settings request failed | section-local error and reachable retry recovery |
| `wp09-integration-buyback-closed-390x844.png` | 390×844 | 390×844 | mock owner, step 4/4 | mobile quote-only closed state; no sensitive controls |
| `wp09-integration-buyback-closed-1440x900.png` | 1440×900 | 1440×900 | mock owner, step 4/4 | desktop quote-only closed state; no sensitive controls |

All files live under `screenshots/responsive-density/settings/`. Visual inspection found no production
customer PII, credential, pairing code, token, raw signature, workbook content, or Next development
indicator. Names, phone numbers, IMEI values, document IDs, amounts and receipt IDs are synthetic test data.

The two buyback images are regenerated from main's fail-closed four-step flow. They must show the `资料关闭`
state and no seller identity, document upload, payment, signature or finalize controls. They prove only the
local UI projection; Router/repository negative tests remain the authoritative bypass boundary. They do not
authorize re-enablement or establish approved tenant legal documents.

This is the minimum integrated local evidence set. It does not replace the incomplete five-role, offline/409,
cross-store late-response, 50+ member, production database, retention, legal-review, or release matrix.
