#!/usr/bin/env python3
"""Record that a supported Codex tool may have changed repository state."""
from __future__ import annotations

import re

from hook_common import (
    find_repo_root,
    output_json,
    read_hook_input,
    runtime_state,
    save_runtime_state,
    settings,
    sha256_text,
    utc_now,
)

WRITE_RE = re.compile(
    r"(?:^|[;&|]\s*|\s)(?:"
    r"rm|mv|cp|mkdir|rmdir|touch|install|patch|"
    r"sed\s+-i|perl\s+-pi|tee|truncate|"
    r"git\s+(?:add|commit|checkout|switch|restore|reset|clean|merge|rebase|cherry-pick)|"
    r"(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove|update|run\s+(?:build|format|lint:fix|generate))|"
    r"npx\s+(?:prisma|prettier|eslint)|"
    r"(?:python|python3|node|ruby|php)\s+[^\n]*(?:generate|migrate|write|update)|"
    r"docker\s+(?:build|compose\s+up)|"
    r"terraform\s+(?:apply|destroy|import)|"
    r"kubectl\s+(?:apply|delete|patch|replace|scale)|"
    r"supabase\s+db\s+(?:push|reset)"
    r")\b|(?:^|[^<])>>?|\bcat\s+[^\n]*>\s*",
    re.IGNORECASE,
)


def likely_write(tool_name: str, tool_input: object) -> tuple[bool, str]:
    if tool_name in {"apply_patch", "Edit", "Write"}:
        raw = str(tool_input)
        return True, raw
    if not isinstance(tool_input, dict):
        return False, ""
    command = str(tool_input.get("command", ""))
    return bool(WRITE_RE.search(command)), command


def main() -> int:
    payload = read_hook_input()
    root = find_repo_root(payload.get("cwd"))
    cfg = settings(root)
    if not cfg.get("enable_dirty_tracking", True):
        output_json({})
        return 0

    tool_name = str(payload.get("tool_name", ""))
    changed, raw = likely_write(tool_name, payload.get("tool_input", {}))
    if not changed:
        output_json({})
        return 0

    state = runtime_state(root)
    if not state.get("dirty"):
        state["dirty_since"] = utc_now()
    state["dirty"] = True
    state["last_tool_name"] = tool_name
    # Store only a digest, never the raw command or tool payload.
    state["last_command_sha256"] = sha256_text(raw)
    save_runtime_state(root, state)
    output_json({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": "Repository state may have changed. Before task closure, validate the diff and run $memory-checkpoint."
        }
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
