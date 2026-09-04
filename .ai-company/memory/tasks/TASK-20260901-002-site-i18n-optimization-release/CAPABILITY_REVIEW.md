# Capability Review — TASK-20260901-002

## Assessment

- Suggested level: C1 candidate for the bounded final-four i18n delivery; no permission or autonomy
  increase.
- Positive evidence: one writer preserved the presentation boundary, removed superseded non-i18n
  work, passed 84 targeted tests and one independent QA with direct-i18n P0/P1 zero.
- Negative evidence: the browser evidence author required three fixture corrections and the final
  story still stopped on out-of-scope focus assertions before completing every AI assertion.

## Improvement proposal

Future i18n browser stories should order frozen i18n assertions before unrelated reusable-component
focus checks, and should derive responsive accessible names from the production surface contract.
Out-of-scope accessibility discoveries must be recorded independently without preventing the scoped
i18n evidence from completing.

## Evaluation case

On the next four-page i18n batch, require one first-pass browser spec with: explicit scope-to-assertion
mapping, localized/dynamic/canonical separation, responsive name lookup, and a terminal request gate.
Success is a green scoped story without assertion deletion or product changes made solely for the
test. Repeated fixture misclassification or hidden responsive-DOM selection is a downgrade trigger.

## Authority boundary

This review changes no role permission, release authority or autonomy level. Owner approval for this
exact i18n candidate was granted on 2026-09-03; its boundaries and required release gates remain
unchanged.
