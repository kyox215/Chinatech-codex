#!/usr/bin/env python3
"""Shared, dependency-free helpers for AI Company OS Codex hooks."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

VERSION = "3.0"
DEFAULT_SETTINGS: dict[str, Any] = {
    "schema_version": 1,
    "context_max_chars": 12000,
    "context_file_max_chars": 5000,
    "subagent_context_max_chars": 9000,
    "subagent_context_file_max_chars": 3200,
    "strict_memory_gate": False,
    "enable_dirty_tracking": True,
    "redact_secrets": True,
}

SECRET_PATTERNS = [
    re.compile(r"(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*[^\s`'\"]+"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def read_hook_input() -> dict[str, Any]:
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def find_repo_root(cwd: str | None = None) -> Path:
    start = Path(cwd or os.getcwd()).resolve()
    try:
        out = subprocess.run(
            ["git", "-C", str(start), "rev-parse", "--show-toplevel"],
            check=True,
            capture_output=True,
            text=True,
            timeout=3,
        ).stdout.strip()
        if out:
            return Path(out).resolve()
    except Exception:
        pass
    for candidate in (start, *start.parents):
        if (candidate / ".ai-company").exists() or (candidate / "AGENTS.md").exists():
            return candidate
    return start


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_name, path)
    finally:
        try:
            os.unlink(tmp_name)
        except FileNotFoundError:
            pass


def settings(root: Path) -> dict[str, Any]:
    merged = dict(DEFAULT_SETTINGS)
    value = load_json(root / ".ai-company" / "settings.json", {})
    if isinstance(value, dict):
        merged.update(value)
    return merged


def runtime_path(root: Path) -> Path:
    return root / ".ai-company" / "state" / "runtime.json"


def runtime_state(root: Path) -> dict[str, Any]:
    default = {
        "schema_version": 1,
        "dirty": False,
        "dirty_since": None,
        "last_tool_name": None,
        "last_command_sha256": None,
        "last_checkpoint_at": None,
        "last_checkpoint_task": None,
        "hook_version": VERSION,
    }
    value = load_json(runtime_path(root), {})
    if isinstance(value, dict):
        default.update(value)
    return default


def save_runtime_state(root: Path, value: dict[str, Any]) -> None:
    value["schema_version"] = 1
    value["hook_version"] = VERSION
    atomic_write_json(runtime_path(root), value)


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()


def redact(value: str) -> str:
    result = value
    for pattern in SECRET_PATTERNS:
        result = pattern.sub("[REDACTED_SECRET]", result)
    return result


def safe_read(path: Path, max_chars: int, do_redact: bool = True) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""
    if do_redact:
        text = redact(text)
    if len(text) > max_chars:
        text = text[:max_chars] + "\n…[truncated by memory context budget]"
    return text


def extract_frontmatter_value(text: str, key: str) -> str | None:
    match = re.search(rf"(?m)^{re.escape(key)}:\s*[\"']?([^\n\"']+)", text)
    if not match:
        return None
    value = match.group(1).strip()
    return None if value.lower() in {"null", "none", "~", ""} else value


def output_json(value: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(value, ensure_ascii=False))
