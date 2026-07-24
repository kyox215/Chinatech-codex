# Handoff

## Current state

Implementation and local validation are complete. The authenticated local preview is kept open at `/orders`; production is unchanged.

## Rollback

Revert task-owned hunks in the print profile, print sheets and three order screens. Do not revert unrelated contextual-notice changes already present in the same order-detail files.

## Production

No push, deployment, environment-variable change or production mutation has been authorized or performed.
