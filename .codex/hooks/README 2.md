# Memory lifecycle hooks

These repository hooks are intentionally small, dependency-free, and local:

1. `session_start_memory.py` reads only whitelisted project-memory files and
   injects a size-limited context packet.
2. `subagent_context.py` gives each spawned specialist a role-scoped packet:
   current task, its Agent profile, project facts, conflicts, and only the
   department memories relevant to that role.
3. `mark_memory_dirty.py` records that a supported write-like tool ran. It saves
   only the tool name and a SHA-256 digest of the command/tool payload—not the
   raw command, transcript, or secrets.
4. `stop_memory_guard.py` warns when changes occurred after the latest
   checkpoint. The default is non-blocking; set `strict_memory_gate` in
   `.ai-company/settings.json` only after your team validates the workflow.

## Trust and review

Project hooks execute local code. Review every script and `.codex/hooks.json`
before trusting them in Codex. Changes to the hook definition should trigger a
new review. Keep this directory code-reviewed.

## Limitations

- Dirty tracking is a reminder, not a complete filesystem audit.
- Post-tool hooks cannot undo an action that already ran.
- A clean dirty marker is not proof that tests passed.
- Formal project memory still requires evidence and human/Agent review.
