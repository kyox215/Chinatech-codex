# Security incident summary — legacy browser-role exposure

Status: **contained at the immediate and minimum-observation gates; normal Settings/Kiosk release remains frozen**

This repository copy is intentionally sanitized. The exact production target, object inventory, ACL
snapshot, executable SQL, rollback SQL, catalog hashes and synthetic verification identifiers remain only
in the protected preservation material and must not be published through a normal feature branch.

## Verified impact

- A production review found legacy public-schema objects reachable by browser roles with privileges that
  were broader than the current RepairDesk server architecture requires.
- No evidence of exploitation was established. This was a confirmed exposed attack surface, not a
  confirmed data breach.
- Repository and recent application-path review did not identify a current RepairDesk dependency on the
  exposed browser-role path, but an unknown external legacy consumer could not be ruled out.

## Containment completed

- The Owner authorized one exact, reversible privilege-containment transaction.
- Browser-role access to the reviewed legacy surface and public execution of the reviewed authentication
  helper were removed without changing rows, schema, RLS, policies, migration history, feature flags,
  Git state or deployment state.
- Rehearsal, immediate verification and the minimum observation gate confirmed browser-role denial,
  preserved server-role access, preserved authentication-trigger behavior, unchanged migration state and
  healthy current application entry points.
- No rollback threshold fired.

## Open risk and release decision

- The originally planned one-hour and 24-hour follow-ups were not recorded. A current check cannot
  retroactively prove those historical windows remained continuously healthy.
- Default privileges, permissive legacy policies and other function-hardening items remain separate R4
  work. They are not silently included in this Settings package.
- `origin/main` advanced after the incident baseline, so the Settings candidate must be reviewed and
  validated again against the current main line.
- Settings push/PR, deployment, Kiosk migration, production feature flags and any further database action
  remain **NO-GO** until an independent current release review and explicit Owner approval.

## Repository handling

- Keep this summary only; do not add the full containment runbook to an ordinary Git branch.
- Do not reconstruct or publish exact production identifiers, object lists, SQL or rollback commands from
  the preservation ref.
- Escalate any new evidence of unauthorized access, unexpected mutation or current application regression
  to a new security/privacy incident rather than reopening the old runbook implicitly.
