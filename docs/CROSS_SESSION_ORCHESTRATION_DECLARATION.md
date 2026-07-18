# RepairDesk Cross-Session Orchestration Declaration

- Status: Phase 0A enabled in shadow mode
- Owner: Hexiang Huang / 鹤祥
- Project ID: `repairdesk-chinatech`
- Configuration: `.ai-company/orchestration.json`
- Implementation version: `tools/orchestration` 0.1
Last reviewed: 2026-07-18

## Purpose

This declaration is the permanent project contract for running RepairDesk work in several Codex windows without using chat history or `ACTIVE_CONTEXT.md` as task identity.

The Phase 0A control plane provides:

- one project-scoped SQLite/WAL Registry shared by linked Git worktrees;
- explicit project/task/run/window/worker/work-package identities;
- one-time window binding and CAS work-package claims;
- idempotent commands using `command_id` plus a canonical request hash;
- an exclusive, expiring project integration lease;
- deterministic, redacted, immutable Context Packets with file hashes;
- fail-closed selection when several Registry tasks are open;
- compatibility behavior that keeps background tasks from moving the foreground pointer.

It does not make different processes owned by the same macOS user cryptographically confidential. File modes `0700` and `0600` protect against other OS users and accidents; hashes detect packet changes. They do not stop a malicious process running as the same user.

## Automatic invocation

Once this declaration and the project Skill are present, every newly loaded top-level Codex window must automatically invoke `$cross-session-orchestration` for a non-micro task or any work that may overlap an existing task. The Owner may speak normally and does not need to repeat this setup.

Already-open windows may need to reload the repository rules before they can see this declaration. Phase 0A does not expose an API that remotely controls arbitrary existing Codex GUI windows.

Simple independent read-only questions may skip registration only after confirming that they will not write repository files, Task Memory, Registry state, Git state, or external state.

## Natural-language routing

| Owner intent | Controller interpretation |
|---|---|
| “另外做、新任务、再开一个” | Create a separate Task Memory directory, Registry task/run and new window binding; do not change the foreground pointer unless explicitly activated. |
| “继续、恢复、接着做” | Inspect Registry status, select the explicit task/run, bind the new window, verify the latest Context Packet, then resume from evidence. |
| “补充、改成、不要某项” | Update the task contract, use the bound Controller's `instruction-advance` CAS command, then issue a new-version Packet before new writes. Do not reinterpret or overwrite an old packet. |
| “暂停、取消” | Pause is Task Memory-only in Phase 0A and stops new claims; cancellation uses the lease-holder `task-close --status cancelled`. Preserve evidence and worktrees. |
| “进度、现在在做什么” | Read Registry and Task Memory; report each task separately, including owner/window, state, evidence and blocker. |

If several open tasks plausibly match an ambiguous instruction, the window must remain read-only and ask the Owner which business objective they mean. It must not guess from `ACTIVE_CONTEXT.md`.

## Startup and binding protocol

Every applicable top-level window follows this order:

1. Load `AGENTS.md` and `$cross-session-orchestration`.
2. Treat the window as logically `UNBOUND`; Phase 0A does not persist an unbound window row.
3. Run Registry `doctor` and `status` against the Git-common-dir runtime.
4. Resolve a single explicit project/task/run. Create separate task/run IDs for independent work.
5. Generate a unique safe `window_id`. Bind it once with the minimum role.
6. Register a worker and work package only when delegated execution requires them.
7. Issue the current immutable Context Packet and verify its exact SHA-256 before scoped work.
8. Apply existing risk, autonomy, permission, worktree and file-ownership gates.
9. Before integration or final closeout, acquire and verify the project integration lease. Reverify its holder, version and expiry before and after every material external step.

A window cannot be rebound to a different task. To switch tasks, close/release the old window identity and create a new window identity.

## Authority and isolation

Policy authority, highest first:

1. latest explicit Owner instruction;
2. root `AGENTS.md`;
3. this declaration;
4. One Command Mode and RepairDesk department rules;
5. generic AI Company policies.

Runtime identity authority, highest first:

1. shared SQLite Registry;
2. the immutable Context Packet selected by that Registry identity;
3. Git Task Memory as the durable audit projection;
4. `ACTIVE_CONTEXT.md` as a foreground convenience hint only.

Each business task receives its own `.ai-company/memory/tasks/<task_id>/` files. Each concurrent write task must also have an isolated worktree or explicitly disjoint file ownership under the existing single-writer rules. Task Memory isolation does not by itself prevent two windows from editing the same business file.

Only one live project integration lease may exist. A top-level chat calling itself “main” does not make it Integration Lead. The active lease holder alone may perform final integration, close its own bound task/run, or make a final completion claim; it can never close another task or run. It still needs the Owner's normal approval for commit, push, deploy, migration, or production actions. This is a cooperative expiring fencing token; external Git operations are not part of the SQLite transaction, so holder/version/expiry must be rechecked at every material boundary.

## Command reference

Use the compatibility entry point from the repository root. The `--` separates legacy arguments from the orchestration CLI.

```bash
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- init
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- doctor
/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- status

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- task-register \
  --task-id TASK-YYYYMMDD-NNN-name --command-id CMD-task-register

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- run-register \
  --task-id TASK-YYYYMMDD-NNN-name --run-id RUN-001 \
  --instruction-version 1 --command-id CMD-run-register

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- window-bind \
  --task-id TASK-YYYYMMDD-NNN-name --run-id RUN-001 \
  --window-id WINDOW-unique --role controller --command-id CMD-window-bind

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- context-issue \
  --task-id TASK-YYYYMMDD-NNN-name --run-id RUN-001 \
  --window-id WINDOW-unique --instruction-version 1

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- lease-acquire \
  --window-id WINDOW-integration --command-id CMD-integration-lease

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- instruction-advance \
  --task-id TASK-YYYYMMDD-NNN-name --run-id RUN-001 \
  --window-id WINDOW-controller --expected-version 1 \
  --command-id CMD-instruction-v2

/opt/homebrew/bin/python3.12 tools/ai_company.py orchestrator -- task-close \
  --task-id TASK-YYYYMMDD-NNN-name --window-id WINDOW-integration \
  --status closed --command-id CMD-task-close
```

Use a stable `command_id` when retrying the same state transition. A retry with the same request returns the committed result. Reusing that command ID for different content fails closed.

`status` returns open task/run identity, instruction version, bound windows/roles, ready Packet hashes/paths and the current integration lease. Task owner, acceptance evidence and blockers remain in the matching Task Memory files and must be reported alongside Registry state.

## ACTIVE_CONTEXT compatibility

- `ACTIVE_CONTEXT.md` is not a scheduler or lock.
- A normal new task may become foreground when no foreground task exists.
- `new-task --allow-parallel` preserves the existing pointer by default.
- `checkpoint --task <background-task>` preserves the existing pointer by default.
- Only explicit `--activate` may switch the pointer.
- When more than one Registry task is open, `checkpoint` or legacy `context` without a task ID fails closed.
- Explicit or Registry-selected task context excludes the foreground `ACTIVE_CONTEXT.md`; only the intentionally disabled/missing legacy configuration may use that pointer as fallback.

## Data minimization and retention

The Registry stores IDs, states, hashes, versions, timestamps and lease metadata. It does not store full prompts, stdout/stderr, diffs, environment variables, secrets or customer PII.

Context sources use an allowlist and redact common credentials, email addresses, Italian phone numbers and IMEI-shaped values. Do not intentionally put secrets, production credentials or full customer records into Task Memory.

Packet issuance requires a regular, non-empty, bounded `TASK.md` whose task ID matches the binding and a non-empty `CHECKPOINTS.md`. It refuses an empty contract rather than signing a nearly empty context.

Runtime packets and operational events have a target retention of 14 days. Phase 0A records this policy but does not automatically delete runtime data. Cleanup remains a later, explicitly reviewed operation.

## Fail-closed and No-Go conditions

Remain read-only and stop coordination writes when any of these is true:

- Registry is missing after initialization was expected, corrupt, locked beyond timeout, or has an unsupported schema;
- `.ai-company/orchestration.json` exists but is unreadable, malformed, non-object, or does not declare a boolean `enabled` value;
- project/common-dir identity does not match;
- runtime or database is a symbolic link;
- task/run/window/worker/work-package identity is missing or mismatched;
- a window is already bound elsewhere;
- instruction or CAS version is stale;
- a Context Packet is missing, changed, quarantined, oversized or from another identity;
- several open tasks exist and no task is explicit;
- another window holds the active integration lease;
- the requested action needs an approval, Writer ownership or production authority that the binding does not grant.

Never auto-recreate a corrupt database, overwrite a Context Packet, steal a live lease, clean a dirty worktree, delete task evidence, force-push, deploy or migrate as recovery.

## Doctor and recovery

`doctor` checks SQLite integrity, WAL, foreign keys, synchronous mode, project/common-dir identity, permissions and registered Context Packet hashes.

For a failed Context Packet saga:

- matching pending record plus matching file: verify and finalize it;
- matching pending record without a file: retry the same deterministic packet operation;
- mismatched bytes: quarantine/fail closed; never overwrite;
- unregistered orphan: preserve for investigation, then remove only through a reviewed cleanup task.

For a damaged Registry, disable orchestration or restore a reviewed backup. Do not silently create an empty Registry because that would erase ownership facts.

## Phase boundaries and complete roadmap

### Phase 0A — enabled now

Identity, Registry, binding, work-package CAS, immutable Context Packets, integration lease, compatibility fixes, project declaration and reusable Skill. Operation is cooperative `shadow` mode.

### Phase 0B — not enabled

Migrate SessionStart/SubagentStart hooks so an unbound session receives only `UNBOUND`, add formal pause/resume state transitions, packet cleanup automation, per-task Controller/Writer/resource leases, backup/retention jobs and richer crash/process tests.

### Phase 1 — not enabled

Optional automatic isolated worktree allocation, disjoint path claims, event-to-Task-Memory projection and an Integration Lead dashboard. No automatic Git publication.

### Phase 2 — not enabled

Only after repeated evidence and Owner approval: bounded automatic integration queues. Commit, push, deploy, migration, secret handling and production remain separate explicit gates.

## Disable and rollback

Set `enabled` to `false` only in a reviewed project change, keep the Registry read-only for audit, and return to the legacy single-task flow. Revert the scoped Git commit normally if necessary; do not force-push and do not delete runtime or dirty worktrees automatically.
