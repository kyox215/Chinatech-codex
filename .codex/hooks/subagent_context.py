#!/usr/bin/env python3
"""Inject role-scoped formal memory when a Codex subagent starts."""
from __future__ import annotations

import re
from pathlib import Path

from hook_common import (
    extract_frontmatter_value,
    find_repo_root,
    read_hook_input,
    safe_read,
    settings,
)

ROLE_DEPARTMENTS: dict[str, tuple[str, ...]] = {
    "project_explorer": ("architecture",),
    "product_analyst": ("product",),
    "solution_architect": ("architecture", "platform"),
    "ux_reviewer": ("design", "frontend"),
    "data_reviewer": ("data",),
    "security_reviewer": ("security",),
    "qa_reviewer": ("qa",),
    "release_reviewer": ("operations", "platform"),
    "documentation_reviewer": ("documentation",),
    "capability_auditor": ("memory",),
    "implementer": (),
    "memory_steward": ("memory",),
}


def safe_agent_name(value: object) -> str:
    name = str(value or "").strip().replace("-", "_")
    return name if re.fullmatch(r"[A-Za-z0-9_]+", name) else "unknown"


def append_with_budget(sections: list[str], path: Path, root: Path, budget: int, per_file: int, redact: bool) -> int:
    used = sum(len(x) for x in sections)
    remaining = budget - used
    if remaining <= 160 or not path.is_file():
        return used
    text = safe_read(path, min(per_file, remaining), redact)
    if not text:
        return used
    block = f"\n## {path.relative_to(root)}\n{text}"
    if len(block) > remaining:
        block = block[:remaining] + "\n…[role context budget exhausted]"
    sections.append(block)
    return used + len(block)


def main() -> int:
    payload = read_hook_input()
    root = find_repo_root(payload.get("cwd"))
    cfg = settings(root)
    total_budget = int(cfg.get("subagent_context_max_chars", 9000))
    per_file = int(cfg.get("subagent_context_file_max_chars", 3200))
    redact = bool(cfg.get("redact_secrets", True))
    agent = safe_agent_name(payload.get("agent_type"))
    memory = root / ".ai-company" / "memory"

    active_path = memory / "ACTIVE_CONTEXT.md"
    active_text = safe_read(active_path, per_file, redact)
    task_id = extract_frontmatter_value(active_text, "current_task_id")

    sections = [
        "# AI Company OS — role-scoped subagent context",
        f"Agent type: {agent}",
        f"Current task: {task_id or 'none'}",
        "This packet is a navigation aid, not proof. Verify material claims against repository files, tests, schemas, logs, or approved decisions.",
        "Return evidence and a concise Memory Delta to the parent. Do not directly expand your own permissions, autonomy, or capability level.",
    ]

    candidates: list[Path] = [
        active_path,
        memory / "agents" / f"{agent}.md",
        memory / "PROJECT_MEMORY.md",
        memory / "OPEN_CONFLICTS.md",
    ]
    if task_id:
        task_dir = memory / "tasks" / task_id
        candidates.extend([task_dir / "TASK.md", task_dir / "CHECKPOINTS.md", task_dir / "EVIDENCE.md"])
    for department in ROLE_DEPARTMENTS.get(agent, ()):
        candidates.append(memory / "departments" / f"{department}.md")

    seen: set[Path] = set()
    for path in candidates:
        if path in seen:
            continue
        seen.add(path)
        append_with_budget(sections, path, root, total_budget, per_file, redact)
        if sum(len(x) for x in sections) >= total_budget:
            break

    print("\n".join(sections))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
