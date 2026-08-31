# Memory Delta — TASK-20260831-002-i18n-deep-ui-release-a

## Candidate project facts

- **Observed:** the reproducible TSX Han audit moved from 5,839 / 4,213 at baseline to 5,599 / 4,088 after the frozen 240-occurrence Release A migration. Source: E-005/E-010/E-016. Review trigger: audit script or App Router reachability changes.
- **Observed:** current supported employee locales remain `zh-CN`, `it-IT`, and `en`; customer/scanner/print content has separate language and business boundaries. Source: `docs/EMPLOYEE_INTERFACE_I18N.md`. Review trigger: adding a locale or translating customer output.

## Candidate department updates

- **Frontend/QA:** direct literal scans must be paired with code/exact-text display adapters because fixed system copy can arrive from model/config imports. Unknown/custom labels remain verbatim. Source: E-009/E-011/E-017. Owner: Frontend + QA.
- **Security:** localization E2E uses a deny-by-default RepairDesk mutation detector with an explicit read-only POST allowlist. Source: E-012/E-013. Owner: QA + Security; review whenever a new POST read endpoint is added.

## Candidate decisions / ADRs

- **Accepted boundary:** Release A is Dashboard Quick/Priority + Orders Queue. Orders/Dashboard scanner Sheet bodies are a registered Release B item governed by the scanner boundary declaration. Status: accepted for this release. Review trigger: scanner localization work begins.
- **Accepted test interpretation:** an open mobile filter modal makes the external language switcher unreachable under the focus trap, so state preservation is tested on executable non-default filter/view/page paths rather than changing modal behavior. Status: accepted by QA.

## Candidate lessons and capability evidence

- **Evidence:** independent QA caught plural-only API matching, default-state false positives, queue-stage Chinese baseline drift and singular relative-time grammar before release. These defects were closed with exact regression tests. Source: E-011–E-017.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
