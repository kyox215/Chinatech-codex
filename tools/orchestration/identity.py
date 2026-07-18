"""Stable project identity and shared runtime path resolution."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from .errors import IdentityError

ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")


@dataclass(frozen=True)
class ProjectIdentity:
    project_id: str
    repo_fingerprint: str
    repo_root: Path
    git_common_dir: Path
    shared_worktree_root: Path
    origin: str


def validate_id(value: str, label: str) -> str:
    value = str(value).strip()
    if not ID_PATTERN.fullmatch(value):
        raise IdentityError(f"{label} must match the safe identifier policy")
    return value


def _git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "git command failed"
        raise IdentityError(detail)
    return result.stdout.strip()


def _sanitize_origin(value: str) -> str:
    value = value.strip()
    if "://" not in value:
        # SCP-like SSH origins contain a username but no credential. Remove the
        # username so the fingerprint is clone-method agnostic where possible.
        if "@" in value and ":" in value:
            value = value.split("@", 1)[1]
        return value.rstrip("/")
    parts = urlsplit(value)
    host = parts.hostname or ""
    if parts.port:
        host = f"{host}:{parts.port}"
    return urlunsplit((parts.scheme.lower(), host.lower(), parts.path.rstrip("/"), "", ""))


def identify_project(root: Path) -> ProjectIdentity:
    repo_root = Path(_git(root, "rev-parse", "--show-toplevel")).resolve()
    common_dir = Path(
        _git(repo_root, "rev-parse", "--path-format=absolute", "--git-common-dir")
    ).resolve()
    if common_dir.name != ".git":
        raise IdentityError("non-standard Git common directory is unsupported")
    shared_root = common_dir.parent

    origin_result = subprocess.run(
        ["git", "-C", str(repo_root), "config", "--get", "remote.origin.url"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    origin = _sanitize_origin(origin_result.stdout) if origin_result.returncode == 0 else ""
    config = load_project_config(repo_root)
    configured_id = config.get("project_id")
    source = origin or f"git-common-dir:{common_dir}"
    fingerprint = hashlib.sha256(source.encode("utf-8")).hexdigest()
    project_id = (
        validate_id(str(configured_id), "project_id")
        if configured_id
        else f"PRJ-{fingerprint[:16]}"
    )
    return ProjectIdentity(
        project_id=project_id,
        repo_fingerprint=fingerprint,
        repo_root=repo_root,
        git_common_dir=common_dir,
        shared_worktree_root=shared_root,
        origin=origin,
    )


def load_project_config(root: Path) -> dict[str, object]:
    path = root / ".ai-company" / "orchestration.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError) as exc:
        raise IdentityError(f"Invalid {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise IdentityError(f"{path} must contain a JSON object")
    return value


def resolve_runtime_root(
    identity: ProjectIdentity,
    explicit: str | Path | None = None,
) -> Path:
    if explicit:
        candidate = Path(explicit).expanduser()
        if not candidate.is_absolute():
            candidate = identity.repo_root / candidate
        return Path(os.path.abspath(candidate))

    config = load_project_config(identity.repo_root)
    strategy = str(config.get("runtime_strategy", "git_common_worktree_state"))
    if strategy != "git_common_worktree_state":
        raise IdentityError(f"Unsupported orchestration runtime_strategy: {strategy}")
    return (
        identity.shared_worktree_root
        / ".ai-company"
        / "state"
        / "orchestration"
    )
