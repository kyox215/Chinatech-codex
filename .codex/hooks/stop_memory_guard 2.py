#!/usr/bin/env python3
"""Warn, or optionally continue once, when changes lack a memory checkpoint."""
from __future__ import annotations

from hook_common import find_repo_root, output_json, read_hook_input, runtime_state, settings


def main() -> int:
    payload = read_hook_input()
    root = find_repo_root(payload.get("cwd"))
    cfg = settings(root)
    state = runtime_state(root)
    if not state.get("dirty"):
        output_json({"continue": True})
        return 0

    warning = (
        "AI Company OS detected repository changes after the last checkpoint. "
        "Inspect the diff, record evidence, and run `python tools/ai_company.py checkpoint ...` "
        "or explicitly document why no durable memory update is required."
    )
    strict = bool(cfg.get("strict_memory_gate", False))
    already_continued = bool(payload.get("stop_hook_active", False))
    if strict and not already_continued:
        output_json({"decision": "block", "reason": warning})
    else:
        output_json({"continue": True, "systemMessage": warning})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
