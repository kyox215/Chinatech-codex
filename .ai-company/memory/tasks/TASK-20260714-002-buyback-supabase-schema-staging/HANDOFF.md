# Handoff — TASK-20260714-002-buyback-supabase-schema-staging

## Current state

- Status: in progress; pre-release CONDITIONAL GO.
- Workspace: `/private/tmp/repairdesk-buyback-feature-off-20260714`.
- Production target: Supabase `xluzcoduqsdvjoouqhkc`.
- Exact allowed write: dormant schema migration `20260712150000` only.
- Runtime enable, grants, Storage uploads and real finalize remain prohibited.

## Immediate next action

Commit and push only the hardened migration, its test, the recovered `20260714004500` source and this
task evidence. From the frozen commit, repeat preflight and exact dry-run. Apply only if both are still
green, then run the complete postcheck and observation packet.

## Stop conditions

- dry-run lists anything except `20260712150000`;
- payment preflight or attachment reclassification count becomes non-zero;
- partial target object appears;
- long transaction/waiting lock appears;
- source SHA or target project changes;
- apply attempts to grant runtime access or enable the sensitive workflow.
