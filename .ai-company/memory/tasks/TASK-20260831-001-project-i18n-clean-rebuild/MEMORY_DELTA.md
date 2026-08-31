# Memory Delta — TASK-20260831-001-project-i18n-clean-rebuild

## Candidate project facts

- Consolidated: RepairDesk employee UI supports exactly `zh-CN`, `it-IT`, and `en`, with Chinese as deterministic default, stable URLs, a strict non-sensitive Cookie, typed in-repo dictionaries and explicit Europe/Rome/EUR formatters. Source: `docs/EMPLOYEE_INTERFACE_I18N.md`, `119e39da`, production `dpl_J2fh5rx5gfTanES51s9C5FsoSC1x`. Status: production verified; owner: Frontend + Integration Lead; review trigger: locale/provider/root-layout/customer-language changes.
- Consolidated: employee locale does not change fixed-Italian `/r` or Kiosk communication context, printed/legal language, tenant, permissions, queries or business payloads. Source: proxy/unit/browser/security evidence E-020/E-029. Status: production verified; owner: Frontend + Security; review trigger: customer communication or routing changes.

## Candidate department updates

- Consolidated to Frontend: preserve self-named three-language radio menu, 44px target, in-place state/route/scroll behavior and strict Cookie allowlist.
- Consolidated to QA: locale releases require catalog/token parity, SSR/fallback, customer-route isolation, Chromium/WebKit keyboard/state/overflow coverage, sanitized screenshots and exact-SHA production smoke.
- Consolidated to Documentation/Operations: `docs/EMPLOYEE_INTERFACE_I18N.md` is the active scope authority; deep historical domain strings remain an explicit incremental backlog; rollback uses prior READY deployment or scoped forward revert.

## Candidate decisions / ADRs

- Consolidated decision: support exactly `zh-CN`, `it-IT`, `en`; Chinese default; stable URLs; typed in-repo dictionaries + React Context + Cookie + explicit Intl helpers; no new dependency/config. Source: Owner goal + clean-baseline architecture review + production evidence. Status: production verified; owner: Integration Lead; review trigger: provider/SSR contract changes or a requested fourth locale.

## Candidate lessons and capability evidence

- C1 candidate only: fresh remote rebuild, single-writer implementation, three independent read-only reviews, full R3 gates, exact non-force push and exact-SHA Vercel production verification succeeded. No capability level, autonomy, production permission or decision authority is upgraded by this task.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
