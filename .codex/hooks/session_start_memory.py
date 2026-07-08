#!/usr/bin/env python3
"""Inject a small, evidence-oriented memory packet at Codex session start."""
from __future__ import annotations

from pathlib import Path

from hook_common import (
    extract_frontmatter_value,
    find_repo_root,
    read_hook_input,
    runtime_state,
    safe_read,
    settings,
)


def main() -> int:
    payload = read_hook_input()
    root = find_repo_root(payload.get("cwd"))
    cfg = settings(root)
    budget = int(cfg.get("context_max_chars", 12000))
    per_file = int(cfg.get("context_file_max_chars", 5000))
    redact = bool(cfg.get("redact_secrets", True))
    memory = root / ".ai-company" / "memory"

    ordered: list[Path] = [
        memory / "ACTIVE_CONTEXT.md",
        memory / "PROJECT_MEMORY.md",
        memory / "OPEN_CONFLICTS.md",
    ]
    active_text = safe_read(ordered[0], per_file, redact)
    task_id = extract_frontmatter_value(active_text, "current_task_id")
    if task_id:
        task_dir = memory / "tasks" / task_id
        ordered.extend([
            task_dir / "TASK.md",
            task_dir / "CHECKPOINTS.md",
            task_dir / "EVIDENCE.md",
            task_dir / "HANDOFF.md",
        ])

    sections = [
        "# AI Company OS — recovered project context",
        f"Repository root: {root}",
        f"Current task: {task_id or 'none'}",
        "Treat memory as a navigational aid. Verify material claims against code, configuration, tests, or cited evidence.",
    ]
    used = sum(len(x) for x in sections)
    for path in ordered:
        if not path.exists():
            continue
        text = safe_read(path, min(per_file, max(0, budget - used)), redact)
        if not text:
            continue
        block = f"\n## {path.relative_to(root)}\n{text}"
        if used + len(block) > budget:
            remaining = budget - used
            if remaining > 200:
                sections.append(block[:remaining] + "\n…[context packet budget exhausted]")
            break
        sections.append(block)
        used += len(block)

    state = runtime_state(root)
    if state.get("dirty"):
        sections.append(
            "\n## Checkpoint warning\n"
            "Repository changes were recorded after the last memory checkpoint. "
            "Inspect the diff and create a checkpoint before claiming the task is closed."
        )
    print("\n".join(sections))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
