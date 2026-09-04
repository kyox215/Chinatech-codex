# Memory Delta — TASK-20260904-001-mobile-overflow-audit-fix

## Candidate project facts

- Source: E-005/E-007. Status: observed and regression-covered. Owner: Frontend. Scope: mobile dashboard quick-action cards. Review trigger: any change to the three-column mobile quick-start grid or locale labels. Fact: document-level `scrollWidth` alone does not detect inline text escaping a fixed grid card; containment geometry is required for this surface.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- Source: E-010. Status: candidate lesson. Owner: QA. Scope: responsive i18n UI checks. Review trigger: future long-label responsive regressions. Lesson: locale-specific cookies must be set before navigation; synthetic Italian field content without an Italian UI locale does not validate translated chrome.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
