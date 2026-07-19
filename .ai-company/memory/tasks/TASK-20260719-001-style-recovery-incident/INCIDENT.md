# Incident Timeline

## 2026-07-19

- 09:40 CEST — Owner supplied a second mobile Chrome screenshot showing raw RepairDesk DOM after returning to the tab.
- 09:45 CEST — Declared SEV-2 / R3 / L2; no data or security impact observed.
- 09:45 CEST — Verified current public HTML contains the first recovery guard and current production commit is `READY`.
- 09:46 CEST — Identified the remaining control gap: fallback and shell visibility still depend on author stylesheet rules and cannot repair a pre-fix document without one refresh.

## Immediate mitigation

- Refresh or close/reopen the affected mobile tab once so it loads the current root document.
- Do not force-navigate existing Service Worker clients because that can lose unsaved form work.

## Recovery target

- New documents must preserve the recovery overlay and hide business DOM even when all author stylesheet nodes are absent.
