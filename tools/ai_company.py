#!/usr/bin/env python3
"""AI Company OS repository control utility.

Dependency-free helper for task memory, context packets, checkpoints, closeout,
and structural validation. It deliberately does not deploy, publish, approve, or
modify application code.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
import tomllib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

VERSION = "3.0.0"
CORE_MEMORY_FILES = [
    "README.md",
    "ACTIVE_CONTEXT.md",
    "PROJECT_MEMORY.md",
    "COMPANY_MEMORY.md",
    "MEMORY_INDEX.md",
    "GLOSSARY.md",
    "DECISION_INDEX.md",
    "CAPABILITY_REGISTRY.md",
    "LESSONS_LEARNED.md",
    "OPEN_CONFLICTS.md",
]
RISK_LEVELS = ("R0", "R1", "R2", "R3", "R4")
AUTONOMY_LEVELS = ("L0", "L1", "L2", "L3", "L4")
TASK_CLASSES = ("T0", "T1", "T2", "T3")
VALIDATION_SKIP_DIRS = {
    ".git",
    ".next",
    "node_modules",
    "dist",
    "storybook-static",
    "playwright-report",
    "test-results",
    "__pycache__",
    ".pytest_cache",
}
SKILL_NAMES = {
    "company-task-intake", "context-rehydrate", "risk-autonomy-classify",
    "agent-team-compose", "task-plan-and-contract", "product-requirements",
    "architecture-review", "ui-ux-review", "data-migration-review",
    "implementation-control", "security-review", "quality-gate",
    "release-governance", "memory-checkpoint", "memory-consolidation",
    "department-memory-sync", "handoff-resume", "capability-review",
    "project-health-check", "incident-response", "documentation-sync",
    "task-closeout",
    "cross-session-orchestration",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def compact_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def yaml_quote(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def slugify(value: str, limit: int = 42) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return (value[:limit].rstrip("-") or "task")


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
            if text and not text.endswith("\n"):
                handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    finally:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass


def atomic_write_json(path: Path, data: Any) -> None:
    atomic_write_text(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def atomic_append(path: Path, text: str) -> None:
    current = path.read_text(encoding="utf-8") if path.exists() else ""
    if current and not current.endswith("\n"):
        current += "\n"
    atomic_write_text(path, current + text.lstrip("\n"))


def find_root(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit).expanduser().resolve()
    start = Path.cwd().resolve()
    try:
        result = subprocess.run(
            ["git", "-C", str(start), "rev-parse", "--show-toplevel"],
            check=True, capture_output=True, text=True, timeout=5,
        )
        root = Path(result.stdout.strip()).resolve()
        if (root / ".ai-company").exists() or (root / "AGENTS.md").exists():
            return root
    except Exception:
        pass
    for candidate in (start, *start.parents):
        if (candidate / ".ai-company").exists() or (candidate / "AGENTS.md").exists():
            return candidate
    raise SystemExit("Could not locate repository root. Use --root <path>.")


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}, text
    raw = text[4:end]
    body = text[end + 5:]
    data: dict[str, Any] = {}
    for line in raw.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        key, value = key.strip(), value.strip()
        if value in {"null", "~", "None"}:
            data[key] = None
        elif value in {"true", "false"}:
            data[key] = value == "true"
        elif value.startswith("["):
            try:
                data[key] = json.loads(value)
            except json.JSONDecodeError:
                data[key] = value
        elif value.startswith(('"', "'")):
            try:
                data[key] = json.loads(value)
            except json.JSONDecodeError:
                data[key] = value.strip('"\'')
        elif re.fullmatch(r"-?\d+", value):
            data[key] = int(value)
        else:
            data[key] = value
    return data, body


def render_frontmatter(data: dict[str, Any], body: str) -> str:
    lines = ["---"]
    for key, value in data.items():
        if value is None:
            out = "null"
        elif isinstance(value, bool):
            out = "true" if value else "false"
        elif isinstance(value, (list, dict)):
            out = json.dumps(value, ensure_ascii=False)
        elif isinstance(value, int):
            out = str(value)
        else:
            out = yaml_quote(str(value))
        lines.append(f"{key}: {out}")
    lines += ["---", ""]
    return "\n".join(lines) + body.lstrip("\n")


def update_frontmatter(path: Path, updates: dict[str, Any]) -> None:
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    data, body = parse_frontmatter(text)
    data.update(updates)
    atomic_write_text(path, render_frontmatter(data, body))


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def settings(root: Path) -> dict[str, Any]:
    defaults = {
        "context_max_chars": 12000,
        "context_file_max_chars": 5000,
        "strict_memory_gate": False,
        "enable_dirty_tracking": True,
    }
    value = load_json(root / ".ai-company" / "settings.json", {})
    if isinstance(value, dict):
        defaults.update(value)
    return defaults


def runtime_path(root: Path) -> Path:
    return root / ".ai-company" / "state" / "runtime.json"


def runtime_state(root: Path) -> dict[str, Any]:
    default = {
        "schema_version": 1, "dirty": False, "dirty_since": None,
        "last_tool_name": None, "last_command_sha256": None,
        "last_checkpoint_at": None, "last_checkpoint_task": None,
        "hook_version": "3.0",
    }
    value = load_json(runtime_path(root), {})
    if isinstance(value, dict):
        default.update(value)
    return default


def save_runtime(root: Path, state: dict[str, Any]) -> None:
    atomic_write_json(runtime_path(root), state)


def memory_dir(root: Path) -> Path:
    return root / ".ai-company" / "memory"


def active_data(root: Path) -> dict[str, Any]:
    path = memory_dir(root) / "ACTIVE_CONTEXT.md"
    if not path.exists():
        return {}
    data, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
    return data


def registered_open_task_ids(root: Path) -> list[str] | None:
    """Return runtime-open tasks; never infer them from historical Task files."""
    config_path = root / ".ai-company" / "orchestration.json"
    if not config_path.exists():
        return None
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise SystemExit(
            "Cross-session orchestration config is unreadable or malformed; "
            "refusing implicit task selection."
        ) from exc
    if not isinstance(config, dict) or not isinstance(config.get("enabled"), bool):
        raise SystemExit(
            "Cross-session orchestration config must be an object with boolean 'enabled'; "
            "refusing implicit task selection."
        )
    if not config["enabled"]:
        return None
    try:
        from orchestration.identity import identify_project, resolve_runtime_root
        from orchestration.store import OrchestrationStore

        identity = identify_project(root)
        store = OrchestrationStore(identity, resolve_runtime_root(identity))
        if not store.db_path.is_file():
            raise SystemExit(
                "Cross-session orchestration is enabled but the Registry is not initialized."
            )
        return [str(row["task_id"]) for row in store.open_tasks()]
    except Exception as exc:
        raise SystemExit(
            "Cross-session registry could not verify active tasks; refusing implicit task selection."
        ) from exc


def render_active(task_id: str | None, *, status: str, phase: str = "none",
                  task_class: str | None = None, risk: str | None = None,
                  autonomy: str | None = None, owner: str = "CEO-Orchestrator",
                  title: str = "", summary: str = "", next_action: str = "") -> str:
    now = utc_now()
    data = {
        "schema_version": 1,
        "current_task_id": task_id,
        "status": status,
        "phase": phase,
        "task_class": task_class,
        "risk_level": risk,
        "autonomy_level": autonomy,
        "owner": owner,
        "last_checkpoint_at": now if task_id else None,
        "checkpoint_required": False,
        "last_rehydrated_at": None,
    }
    if task_id:
        body = f'''# Active Context

## Current objective

**{title or task_id}**

## Current state

{summary or "Task created; intake and evidence gathering are pending."}

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

{next_action or "Run task intake, risk classification, and create an evidence-backed plan."}

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/{task_id}/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
'''
    else:
        body = '''# Active Context

## Current objective

No active task.

## Current state

- Status: idle
- No task is selected for automatic resumption.

## Next action

Create a task with `/opt/homebrew/bin/python3.12 tools/ai_company.py new-task --title "..."`.
'''
    return render_frontmatter(data, body)


def ensure_skeleton(root: Path) -> None:
    ai = root / ".ai-company"
    mem = ai / "memory"
    for rel in ["tasks", "decisions", "archive", "departments", "agents"]:
        (mem / rel).mkdir(parents=True, exist_ok=True)
    (ai / "state").mkdir(parents=True, exist_ok=True)
    if not (ai / "settings.json").exists():
        atomic_write_json(ai / "settings.json", {
            "schema_version": 1, "default_task_class": "T1",
            "default_risk_level": "R1", "default_autonomy_level": "L2",
            "context_max_chars": 12000, "context_file_max_chars": 5000,
            "strict_memory_gate": False, "enable_dirty_tracking": True,
            "redact_secrets": True,
        })
    active = mem / "ACTIVE_CONTEXT.md"
    if not active.exists():
        atomic_write_text(active, render_active(None, status="idle"))
    if not runtime_path(root).exists():
        save_runtime(root, runtime_state(root))


def git_status(root: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "status", "--short"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            rows = result.stdout.rstrip().splitlines()
            return "clean" if not rows else f"{len(rows)} changed/untracked paths"
    except Exception:
        pass
    return "unavailable"


def cmd_init(args: argparse.Namespace) -> int:
    root = find_root(args.root)
    ensure_skeleton(root)
    print(f"Initialized AI Company runtime at {root}")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    root = find_root(args.root)
    ensure_skeleton(root)
    active = active_data(root)
    state = runtime_state(root)
    print(f"AI Company OS {VERSION}")
    print(f"Root: {root}")
    print(f"Task: {active.get('current_task_id') or 'none'}")
    print(f"Status/phase: {active.get('status', 'unknown')} / {active.get('phase', 'unknown')}")
    print(f"Class/risk/autonomy: {active.get('task_class')} / {active.get('risk_level')} / {active.get('autonomy_level')}")
    print(f"Git workspace: {git_status(root)}")
    print(f"Checkpoint dirty: {bool(state.get('dirty'))}")
    if state.get("dirty_since"):
        print(f"Dirty since: {state['dirty_since']}")
    if state.get("last_checkpoint_at"):
        print(f"Last checkpoint: {state['last_checkpoint_at']} ({state.get('last_checkpoint_task')})")
    return 0


def cmd_new_task(args: argparse.Namespace) -> int:
    root = find_root(args.root)
    ensure_skeleton(root)
    active = active_data(root)
    has_foreground = bool(active.get("current_task_id")) and active.get("status") in {
        "proposed", "approved", "active", "in_progress", "blocked", "paused",
        "on_hold", "review", "verified", "released", "conditional",
    }
    if has_foreground and not args.allow_parallel and not args.activate:
        raise SystemExit(
            f"Active task {active['current_task_id']} exists. Close it or pass --allow-parallel "
            "and manage ACTIVE_CONTEXT explicitly."
        )
    task_id = args.task_id or f"TASK-{compact_utc()}-{slugify(args.title)}"
    task_dir = memory_dir(root) / "tasks" / task_id
    if task_dir.exists():
        raise SystemExit(f"Task already exists: {task_id}")
    task_dir.mkdir(parents=True)
    now = utc_now()
    departments = sorted({x.strip() for item in (args.departments or []) for x in item.split(",") if x.strip()})
    acceptance = args.acceptance or ["Acceptance criteria must be defined during task intake."]
    value = args.business_value or "Not provided; clarify during task intake."
    data = {
        "schema_version": 1, "task_id": task_id, "title": args.title,
        "status": "active", "task_class": args.task_class,
        "risk_level": args.risk, "autonomy_level": args.autonomy,
        "owner": args.owner, "departments": departments,
        "created_at": now, "updated_at": now,
    }
    body = f'''# Task — {args.title}

## Owner request

{args.title}

## Business value

{value}

## Scope in

- To be refined by `$company-task-intake`.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

'''
    body += "\n".join(f"- [ ] {x}" for x in acceptance)
    body += '''

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |

## Decision and approval points

- None registered yet. Run `$risk-autonomy-classify`.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
'''
    atomic_write_text(task_dir / "TASK.md", render_frontmatter(data, body))
    atomic_write_text(task_dir / "CHECKPOINTS.md", f'''# Checkpoints — {task_id}

## {now} — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
''')
    atomic_write_text(task_dir / "EVIDENCE.md", f'''# Evidence Index — {task_id}

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | {now} | {args.owner} |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
''')
    atomic_write_text(task_dir / "MEMORY_DELTA.md", f'''# Memory Delta — {task_id}

## Candidate project facts

- None yet.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- None yet.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
''')
    atomic_write_text(task_dir / "HANDOFF.md", f'''# Handoff / Resume — {task_id}

## Current handoff

- **Status:** no handoff prepared.
- **Last verified:** {now}
- **Workspace/branch:** inspect before resuming.
- **First action:** read `TASK.md` and latest checkpoint, then inspect the repository.
''')
    should_activate = bool(args.activate or not has_foreground)
    if should_activate:
        atomic_write_text(memory_dir(root) / "ACTIVE_CONTEXT.md", render_active(
            task_id, status="active", phase="intake", task_class=args.task_class,
            risk=args.risk, autonomy=args.autonomy, owner=args.owner, title=args.title,
            summary="Task created. Scope, facts, risk, and acceptance evidence require refinement.",
            next_action="Run task intake and risk classification before implementation.",
        ))
        state = runtime_state(root)
        state.update({
            "dirty": False, "dirty_since": None, "last_checkpoint_at": now,
            "last_checkpoint_task": task_id, "last_tool_name": "ai_company.new-task",
            "last_command_sha256": None,
        })
        save_runtime(root, state)
    print(task_id)
    print(f"Created {task_dir.relative_to(root)}")
    return 0


def task_dir_or_die(root: Path, task_id: str | None) -> tuple[str, Path]:
    if not task_id:
        registered = registered_open_task_ids(root)
        if registered is not None:
            if len(registered) != 1:
                reason = "No" if not registered else "Multiple"
                raise SystemExit(
                    f"{reason} registry tasks are open; pass --task explicitly."
                )
            task_id = registered[0]
        else:
            task_id = active_data(root).get("current_task_id")
    if not task_id:
        raise SystemExit("No task specified and no active task found.")
    path = memory_dir(root) / "tasks" / str(task_id)
    if not path.is_dir():
        raise SystemExit(f"Task directory not found: {path}")
    return str(task_id), path


def cmd_checkpoint(args: argparse.Namespace) -> int:
    root = find_root(args.root)
    ensure_skeleton(root)
    task_id, task_dir = task_dir_or_die(root, args.task)
    now = utc_now()
    details = [
        f"## {now} — {args.summary}", "",
        f"- **Phase:** {args.phase}",
        f"- **Completed/current state:** {args.summary}",
        f"- **Next:** {args.next}",
    ]
    if args.decision:
        details.append(f"- **Decision:** {args.decision}")
    if args.blocker:
        details.append(f"- **Blocker:** {args.blocker}")
    if args.evidence:
        details += ["- **Evidence:**"] + [f"  - {x}" for x in args.evidence]
    else:
        details.append("- **Evidence:** none added by this command; do not infer validation.")
    details += ["- **Recorded by:** " + args.actor, ""]
    atomic_append(task_dir / "CHECKPOINTS.md", "\n".join(details))
    if args.evidence:
        for item in args.evidence:
            digest = hashlib.sha256(item.encode("utf-8")).hexdigest()[:10]
            atomic_append(task_dir / "EVIDENCE.md", f"\n- `{now}` `{digest}` — {item}\n")
    update_frontmatter(task_dir / "TASK.md", {"updated_at": now})
    task_meta, task_body = parse_frontmatter((task_dir / "TASK.md").read_text(encoding="utf-8"))
    foreground = active_data(root).get("current_task_id")
    should_activate = bool(args.activate or foreground == task_id)
    if should_activate:
        atomic_write_text(memory_dir(root) / "ACTIVE_CONTEXT.md", render_active(
            task_id, status=str(task_meta.get("status", "active")), phase=args.phase,
            task_class=str(task_meta.get("task_class") or "T1"),
            risk=str(task_meta.get("risk_level") or "R1"),
            autonomy=str(task_meta.get("autonomy_level") or "L2"),
            owner=str(task_meta.get("owner") or args.actor),
            title=str(task_meta.get("title") or task_id), summary=args.summary,
            next_action=args.next,
        ))
        state = runtime_state(root)
        state.update({
            "dirty": False, "dirty_since": None, "last_checkpoint_at": now,
            "last_checkpoint_task": task_id, "last_tool_name": "ai_company.checkpoint",
            "last_command_sha256": None,
        })
        save_runtime(root, state)
    print(f"Checkpoint recorded for {task_id} at {now}")
    return 0


def safe_read(path: Path, max_chars: int) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""
    # Redact common accidental secret formats from generated context packets.
    patterns = [
        re.compile(r"(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*[^\s`'\"]+"),
        re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),
        re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    ]
    for pattern in patterns:
        text = pattern.sub("[REDACTED_SECRET]", text)
    return text if len(text) <= max_chars else text[:max_chars] + "\n…[truncated]"


def compile_context(root: Path, task_id: str | None, max_chars: int | None = None) -> str:
    cfg = settings(root)
    budget = max_chars or int(cfg.get("context_max_chars", 12000))
    per_file = int(cfg.get("context_file_max_chars", 5000))
    mem = memory_dir(root)
    explicit_task = bool(task_id)
    registry_selected_task = False
    active_text = safe_read(mem / "ACTIVE_CONTEXT.md", per_file)
    if not task_id:
        registered = registered_open_task_ids(root)
        if registered is not None:
            if len(registered) != 1:
                reason = "No" if not registered else "Multiple"
                raise SystemExit(f"{reason} registry tasks are open; pass --task explicitly.")
            task_id = registered[0]
            registry_selected_task = True
        else:
            task_id = parse_frontmatter(active_text)[0].get("current_task_id")
    paths = [mem / "PROJECT_MEMORY.md", mem / "OPEN_CONFLICTS.md"]
    if not explicit_task and not registry_selected_task:
        paths.insert(0, mem / "ACTIVE_CONTEXT.md")
    if task_id:
        td = mem / "tasks" / str(task_id)
        paths += [td / "TASK.md", td / "CHECKPOINTS.md", td / "EVIDENCE.md", td / "HANDOFF.md"]
    chunks = [
        "# AI Company OS Context Packet",
        f"Generated: {utc_now()}",
        f"Repository: {root}",
        f"Task: {task_id or 'none'}",
        "Authority note: verify material claims against code, tests, schemas, runtime evidence, or approved decisions.",
    ]
    used = sum(map(len, chunks))
    for path in paths:
        if not path.exists():
            continue
        text = safe_read(path, min(per_file, max(0, budget - used)))
        block = f"\n## {path.relative_to(root)}\n{text}"
        if used + len(block) > budget:
            remaining = budget - used
            if remaining > 160:
                chunks.append(block[:remaining] + "\n…[context budget exhausted]")
            break
        chunks.append(block)
        used += len(block)
    return "\n".join(chunks).rstrip() + "\n"


def cmd_context(args: argparse.Namespace) -> int:
    root = find_root(args.root)
    ensure_skeleton(root)
    text = compile_context(root, args.task, args.max_chars)
    if args.output:
        output = Path(args.output)
        if not output.is_absolute():
            output = root / output
        if output.exists():
            raise SystemExit(f"Refusing to overwrite existing context output: {output}")
        atomic_write_text(output, text)
        print(f"Wrote {output}")
    else:
        sys.stdout.write(text)
    return 0


def evidence_has_content(path: Path) -> bool:
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8", errors="replace")
    # More than initial request evidence or at least one appended timestamp/digest.
    return "\n- `20" in text or len(re.findall(r"\| E-\d+", text)) > 1


def cmd_close_task(args: argparse.Namespace) -> int:
    root = find_root(args.root)
    ensure_skeleton(root)
    task_id, task_dir = task_dir_or_die(root, args.task)
    state = runtime_state(root)
    if state.get("dirty") and not args.allow_dirty:
        raise SystemExit("Repository is dirty since the last checkpoint. Checkpoint first or pass --allow-dirty with an explicit reason.")
    if not evidence_has_content(task_dir / "EVIDENCE.md") and not args.allow_no_evidence:
        raise SystemExit("No post-intake evidence detected. Add evidence or pass --allow-no-evidence with an honest closeout outcome.")
    now = utc_now()
    status = args.status
    update_frontmatter(task_dir / "TASK.md", {"status": status, "updated_at": now, "closed_at": now})
    atomic_append(task_dir / "CHECKPOINTS.md", f'''\n## {now} — Task closeout

- **Status:** {status}
- **Outcome:** {args.outcome}
- **Residual risks:** {args.residual_risk or "None recorded by command; verify the task report."}
- **Follow-up:** {args.follow_up or "None recorded."}
- **Closed by:** {args.actor}
''')
    active = active_data(root)
    if active.get("current_task_id") == task_id:
        atomic_write_text(memory_dir(root) / "ACTIVE_CONTEXT.md", render_active(None, status="idle"))
    state.update({
        "dirty": False, "dirty_since": None, "last_checkpoint_at": now,
        "last_checkpoint_task": task_id, "last_tool_name": "ai_company.close-task",
        "last_command_sha256": None,
    })
    save_runtime(root, state)
    print(f"Closed {task_id} with status {status}")
    return 0


def cmd_list_tasks(args: argparse.Namespace) -> int:
    root = find_root(args.root)
    tasks = memory_dir(root) / "tasks"
    rows = []
    for task_file in sorted(tasks.glob("*/TASK.md"), reverse=True):
        data, _ = parse_frontmatter(task_file.read_text(encoding="utf-8"))
        if args.status and data.get("status") != args.status:
            continue
        rows.append((data.get("task_id", task_file.parent.name), data.get("status", "?"), data.get("risk_level", "?"), data.get("title", "?")))
    if not rows:
        print("No matching tasks.")
        return 0
    for task_id, status, risk, title in rows:
        print(f"{task_id}\t{status}\t{risk}\t{title}")
    return 0


@dataclass
class ValidationReport:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    checks: list[str] = field(default_factory=list)

    def ok(self, message: str) -> None:
        self.checks.append(message)

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)


def md_links(path: Path) -> Iterable[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    for target in re.findall(r"(?<!!)\[[^\]]*\]\(([^)]+)\)", text):
        target = target.strip().split(" ", 1)[0].strip("<>")
        if target:
            yield target


def should_skip_validation_path(path: Path, root: Path) -> bool:
    try:
        rel = path.relative_to(root)
    except ValueError:
        return False
    return any(part in VALIDATION_SKIP_DIRS for part in rel.parts)


def validate_bundle(root: Path, strict: bool = False) -> ValidationReport:
    report = ValidationReport()
    required = ["AGENTS.md", ".codex/config.toml", ".codex/hooks.json", ".ai-company/settings.json", "tools/ai_company.py"]
    for rel in required:
        if not (root / rel).exists():
            report.error(f"Missing required file: {rel}")
    if report.errors:
        return report

    agents_md = root / "AGENTS.md"
    size = agents_md.stat().st_size
    try:
        config = tomllib.loads((root / ".codex/config.toml").read_text(encoding="utf-8"))
        max_bytes = int(config.get("project_doc_max_bytes", 32768))
        report.ok("Parsed .codex/config.toml")
    except Exception as exc:
        report.error(f"Invalid .codex/config.toml: {exc}")
        max_bytes = 32768
    if size > max_bytes:
        report.error(f"AGENTS.md is {size} bytes, above project_doc_max_bytes={max_bytes}")
    else:
        report.ok(f"AGENTS.md size {size}/{max_bytes} bytes")

    try:
        hooks = json.loads((root / ".codex/hooks.json").read_text(encoding="utf-8"))
        if not isinstance(hooks.get("hooks"), dict):
            raise ValueError("top-level hooks object missing")
        for event in ("SessionStart", "SubagentStart", "PostToolUse", "Stop"):
            if event not in hooks["hooks"]:
                report.error(f"Hook event missing: {event}")
        report.ok("Parsed hooks.json and required lifecycle events")
    except Exception as exc:
        report.error(f"Invalid hooks.json: {exc}")

    try:
        json.loads((root / ".ai-company/settings.json").read_text(encoding="utf-8"))
        report.ok("Parsed .ai-company/settings.json")
    except Exception as exc:
        report.error(f"Invalid settings.json: {exc}")

    try:
        orchestration = json.loads((root / ".ai-company/orchestration.json").read_text(encoding="utf-8"))
        required_orchestration = {
            "schema_version", "project_id", "enabled", "mode", "runtime_strategy",
            "require_explicit_window_binding", "active_context_role",
            "fail_closed_on_ambiguous_task", "immutable_context_packets", "automation",
        }
        missing = sorted(required_orchestration - set(orchestration))
        if missing:
            raise ValueError("missing keys: " + ", ".join(missing))
        if orchestration.get("mode") != "shadow":
            raise ValueError("Phase 0A mode must be shadow")
        if not isinstance(orchestration.get("enabled"), bool):
            raise ValueError("enabled must be boolean")
        if orchestration.get("runtime_strategy") != "git_common_worktree_state":
            raise ValueError("unsupported runtime_strategy")
        for key in (
            "require_explicit_window_binding", "fail_closed_on_ambiguous_task",
            "immutable_context_packets",
        ):
            if orchestration.get(key) is not True:
                raise ValueError(f"{key} must be true")
        if orchestration.get("active_context_role") != "foreground_hint":
            raise ValueError("active_context_role must be foreground_hint")
        retention = orchestration.get("runtime_retention_days")
        if not isinstance(retention, int) or not 1 <= retention <= 90:
            raise ValueError("runtime_retention_days must be an integer from 1 to 90")
        automation = orchestration.get("automation")
        required_automation = {
            "spawn", "worktree", "writer_transfer", "integrate",
            "commit", "push", "deploy", "migrate",
        }
        if not isinstance(automation, dict) or set(automation) != required_automation:
            raise ValueError("automation keys do not match the Phase 0A contract")
        if any(value is not False for value in automation.values()):
            raise ValueError("Phase 0A automation flags must all be false")
        report.ok("Parsed and checked .ai-company/orchestration.json")
    except Exception as exc:
        report.error(f"Invalid orchestration.json: {exc}")

    try:
        schema = json.loads((root / ".ai-company/schemas/orchestration.schema.json").read_text(encoding="utf-8"))
        if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
            raise ValueError("draft 2020-12 declaration missing")
        report.ok("Parsed orchestration.schema.json")
    except Exception as exc:
        report.error(f"Invalid orchestration.schema.json: {exc}")

    agent_names: set[str] = set()
    agent_files = list((root / ".codex" / "agents").glob("*.toml"))
    if not agent_files:
        report.error("No custom Agent TOML files found")
    for path in agent_files:
        try:
            data = tomllib.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            report.error(f"Invalid Agent TOML {path.relative_to(root)}: {exc}")
            continue
        for key in ("name", "description", "developer_instructions"):
            if not str(data.get(key, "")).strip():
                report.error(f"{path.relative_to(root)} missing {key}")
        name = str(data.get("name", ""))
        if name in agent_names:
            report.error(f"Duplicate Agent name: {name}")
        agent_names.add(name)
    report.ok(f"Validated {len(agent_files)} custom Agent files")

    skill_names: set[str] = set()
    skill_files = list((root / ".agents" / "skills").glob("*/SKILL.md"))
    for path in skill_files:
        text = path.read_text(encoding="utf-8")
        data, _ = parse_frontmatter(text)
        name = str(data.get("name", ""))
        desc = str(data.get("description", ""))
        if not name or not desc:
            report.error(f"Skill metadata missing in {path.relative_to(root)}")
            continue
        if name != path.parent.name:
            report.error(f"Skill name/dir mismatch: {path.parent.name} vs {name}")
        if name in skill_names:
            report.error(f"Duplicate Skill name: {name}")
        skill_names.add(name)
    missing_skills = SKILL_NAMES - skill_names
    extra_skills = skill_names - SKILL_NAMES
    if missing_skills:
        report.error(f"Missing expected Skills: {', '.join(sorted(missing_skills))}")
    if extra_skills:
        report.warn(f"Additional Skills not in baseline catalog: {', '.join(sorted(extra_skills))}")
    report.ok(f"Validated {len(skill_files)} Skills")

    for rel in CORE_MEMORY_FILES:
        if not (memory_dir(root) / rel).exists():
            report.error(f"Missing core memory file: .ai-company/memory/{rel}")
    report.ok("Checked core memory files")

    # Compile all package Python without importing it or writing __pycache__.
    py_files = (
        list(root.glob("tools/*.py"))
        + list(root.glob("tools/orchestration/**/*.py"))
        + list(root.glob(".codex/hooks/*.py"))
    )
    for path in py_files:
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "import pathlib, sys; path=pathlib.Path(sys.argv[1]); compile(path.read_text(encoding='utf-8'), str(path), 'exec')",
                str(path),
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            report.error(f"Python compile failed for {path.relative_to(root)}: {result.stderr.strip()}")
    report.ok(f"Compiled {len(py_files)} Python files")

    rules = root / ".codex" / "rules" / "default.rules"
    if not rules.exists():
        report.error("Missing default.rules")
    else:
        text = rules.read_text(encoding="utf-8")
        if text.count("prefix_rule(") < 5 or text.count("prefix_rule(") != text.count("\n)"):
            report.warn("Rules file requires manual/Codex execpolicy syntax review")
        if any(x not in {"allow", "prompt", "forbidden"} for x in re.findall(r'decision\s*=\s*"([^"]+)"', text)):
            report.error("Rules file contains an unsupported decision")
        report.ok("Performed static rules checks")

    # Balanced fenced blocks and local links. Link gaps are warnings because
    # imported policy references can be deployment-layout dependent.
    md_files = [path for path in root.rglob("*.md") if not should_skip_validation_path(path, root)]
    broken_links: list[str] = []
    for path in md_files:
        text = path.read_text(encoding="utf-8", errors="replace")
        if text.count("```") % 2:
            report.error(f"Unbalanced Markdown code fence: {path.relative_to(root)}")
        for target in md_links(path):
            if target.startswith(("http://", "https://", "mailto:", "#", "sandbox:")):
                continue
            target_path = target.split("#", 1)[0]
            if not target_path:
                continue
            resolved = (path.parent / target_path).resolve()
            try:
                resolved.relative_to(root.resolve())
            except ValueError:
                continue
            if not resolved.exists():
                broken_links.append(f"{path.relative_to(root)} -> {target}")
    if broken_links:
        for item in broken_links[:30]:
            report.warn(f"Broken local Markdown link: {item}")
        if len(broken_links) > 30:
            report.warn(f"... and {len(broken_links)-30} more broken local Markdown links")
    report.ok(f"Checked {len(md_files)} Markdown files")

    # Lightweight accidental-secret scan. Avoid generic placeholders and code
    # that merely documents detection patterns.
    secret_assign = re.compile(r"(?i)\b(api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*['\"]([^'\"]{12,})['\"]")
    for path in root.rglob("*"):
        if should_skip_validation_path(path, root):
            continue
        if not path.is_file() or path.suffix.lower() not in {".md", ".toml", ".json", ".py", ".rules", ".txt"}:
            continue
        if "hook_common.py" in path.name:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in secret_assign.finditer(text):
            value = match.group(2)
            if any(marker in value.lower() for marker in ("placeholder", "example", "your_", "<", "[redacted")):
                continue
            report.warn(f"Possible secret-like assignment in {path.relative_to(root)}")
            break
    report.ok("Performed lightweight secret-pattern scan")

    if strict and report.warnings:
        report.errors.extend(f"Strict mode: {x}" for x in report.warnings)
    return report


def cmd_validate(args: argparse.Namespace) -> int:
    root = find_root(args.root)
    report = validate_bundle(root, args.strict)
    print(f"Validation root: {root}")
    for line in report.checks:
        print(f"[OK] {line}")
    for line in report.warnings:
        print(f"[WARN] {line}")
    for line in report.errors:
        print(f"[ERROR] {line}")
    print(f"Summary: {len(report.checks)} checks, {len(report.warnings)} warnings, {len(report.errors)} errors")
    if args.report:
        out = Path(args.report)
        if not out.is_absolute():
            out = root / out
        lines = ["# AI Company OS Validation Report", "", f"- Generated: {utc_now()}", f"- Root: `{root}`", f"- Result: {'PASS' if not report.errors else 'FAIL'}", "", "## Checks"]
        lines += [f"- ✅ {x}" for x in report.checks] or ["- None"]
        lines += ["", "## Warnings"] + ([f"- ⚠️ {x}" for x in report.warnings] or ["- None"])
        lines += ["", "## Errors"] + ([f"- ❌ {x}" for x in report.errors] or ["- None"])
        atomic_write_text(out, "\n".join(lines))
        print(f"Report: {out}")
    return 0 if not report.errors else 1


def cmd_memory_audit(args: argparse.Namespace) -> int:
    root = find_root(args.root)
    mem = memory_dir(root)
    issues: list[str] = []
    placeholders: list[str] = []
    for path in mem.rglob("*.md"):
        text = path.read_text(encoding="utf-8", errors="replace")
        data, _ = parse_frontmatter(text)
        status = data.get("status")
        if status in {"verified", "approved"} and not (data.get("last_verified_at") or data.get("last_reviewed_at")):
            issues.append(f"{path.relative_to(root)}: {status} without verification timestamp")
        if re.search(r"\bTBD\b|Not initialized|unknown until inspected", text):
            placeholders.append(str(path.relative_to(root)))
    conflicts = (mem / "OPEN_CONFLICTS.md").read_text(encoding="utf-8", errors="replace") if (mem / "OPEN_CONFLICTS.md").exists() else ""
    print(f"Memory files: {len(list(mem.rglob('*.md')))}")
    print(f"Potential metadata issues: {len(issues)}")
    for x in issues[:20]:
        print(f"[ISSUE] {x}")
    print(f"Files with adoption placeholders: {len(placeholders)}")
    for x in placeholders[:20]:
        print(f"[TEMPLATE] {x}")
    if "| — | none recorded" not in conflicts:
        print("[NOTICE] OPEN_CONFLICTS may contain active entries; review it manually.")
    return 1 if issues and args.strict else 0


def cmd_orchestrator(args: argparse.Namespace) -> int:
    from orchestration.cli import main as orchestration_main

    forwarded = list(args.orchestrator_args)
    if forwarded[:1] == ["--"]:
        forwarded = forwarded[1:]
    return orchestration_main(forwarded, default_root=str(find_root(args.root)))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AI Company OS task and memory control utility")
    parser.add_argument("--root", help="Repository root (defaults to detected Git/AI Company root)")
    parser.add_argument("--version", action="version", version=VERSION)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("init", help="Create missing runtime directories and state")
    p.set_defaults(func=cmd_init)

    p = sub.add_parser("status", help="Show active task, risk, workspace, and checkpoint state")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("new-task", help="Create a durable task memory directory")
    p.add_argument("--title", required=True)
    p.add_argument("--task-id")
    p.add_argument("--task-class", choices=TASK_CLASSES, default="T1")
    p.add_argument("--risk", choices=RISK_LEVELS, default="R1")
    p.add_argument("--autonomy", choices=AUTONOMY_LEVELS, default="L2")
    p.add_argument("--owner", default="CEO-Orchestrator")
    p.add_argument("--business-value")
    p.add_argument("--departments", action="append", help="Comma-separated; repeatable")
    p.add_argument("--acceptance", action="append", help="Acceptance criterion; repeatable")
    p.add_argument("--allow-parallel", action="store_true")
    p.add_argument("--activate", action="store_true", help="Explicitly switch ACTIVE_CONTEXT to the new task")
    p.set_defaults(func=cmd_new_task)

    p = sub.add_parser("checkpoint", help="Record a recoverable task checkpoint and clear dirty state")
    p.add_argument("--task")
    p.add_argument("--summary", required=True)
    p.add_argument("--next", required=True)
    p.add_argument("--phase", default="implementation")
    p.add_argument("--evidence", action="append")
    p.add_argument("--decision")
    p.add_argument("--blocker")
    p.add_argument("--actor", default="CEO-Orchestrator")
    p.add_argument("--activate", action="store_true", help="Explicitly switch ACTIVE_CONTEXT to this task")
    p.set_defaults(func=cmd_checkpoint)

    p = sub.add_parser("context", help="Compile a size-bounded, redacted context packet")
    p.add_argument("--task")
    p.add_argument("--output")
    p.add_argument("--max-chars", type=int)
    p.set_defaults(func=cmd_context)

    p = sub.add_parser("close-task", help="Close a task after evidence and checkpoint checks")
    p.add_argument("--task")
    p.add_argument("--status", choices=("closed", "conditional", "blocked", "cancelled"), default="closed")
    p.add_argument("--outcome", required=True)
    p.add_argument("--residual-risk")
    p.add_argument("--follow-up")
    p.add_argument("--actor", default="CEO-Orchestrator")
    p.add_argument("--allow-dirty", action="store_true")
    p.add_argument("--allow-no-evidence", action="store_true")
    p.set_defaults(func=cmd_close_task)

    p = sub.add_parser("list-tasks", help="List task metadata")
    p.add_argument("--status")
    p.set_defaults(func=cmd_list_tasks)

    p = sub.add_parser("validate", aliases=["doctor"], help="Validate Codex-native structure and syntax")
    p.add_argument("--strict", action="store_true")
    p.add_argument("--report")
    p.set_defaults(func=cmd_validate)

    p = sub.add_parser("memory-audit", help="Find stale metadata, placeholders, and conflicts")
    p.add_argument("--strict", action="store_true")
    p.set_defaults(func=cmd_memory_audit)

    p = sub.add_parser("orchestrator", help="Run the cross-session orchestration control plane")
    p.add_argument("orchestrator_args", nargs=argparse.REMAINDER)
    p.set_defaults(func=cmd_orchestrator)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
