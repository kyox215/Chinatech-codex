"""Deterministic, redacted and immutable context packets."""

from __future__ import annotations

import hashlib
import json
import os
import re
import threading
from dataclasses import dataclass
from pathlib import Path

from .errors import ContextConflict, IdentityError
from .identity import validate_id
from .store import OrchestrationStore

DEFAULT_MAX_PACKET_BYTES = 96_000
SOURCE_MAX_BYTES = 28_000

SECRET_PATTERNS = (
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
    re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~-]{12,}\b"),
    re.compile(r"(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|service[_-]?role|password)\s*[:=]\s*(?:\"[^\"\n]+\"|'[^'\n]+'|[^\s`'\"]+)"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
)
PII_PATTERNS = (
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    re.compile(r"(?<!\d)(?:\+?39[ .-]?)?(?:3\d{2}|0\d{1,3})[ .-]?\d{3}[ .-]?\d{3,4}(?!\d)"),
    re.compile(r"(?<!\d)\d{15}(?!\d)"),
)


@dataclass(frozen=True)
class ContextPacket:
    path: Path
    file_sha256: str
    instruction_version: int
    created: bool


def redact_text(text: str) -> str:
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("[REDACTED_SECRET]", text)
    for pattern in PII_PATTERNS:
        text = pattern.sub("[REDACTED_PII]", text)
    return text


def _source_bytes(
    path: Path,
    *,
    required: bool = False,
    tail: bool = False,
) -> tuple[str, str] | None:
    if not path.is_file() or path.is_symlink():
        if required:
            raise ContextConflict(f"required context source is missing: {path.name}")
        return None
    size = path.stat().st_size
    if required and (size == 0 or size > SOURCE_MAX_BYTES):
        raise ContextConflict(f"required context source has an invalid size: {path.name}")
    with path.open("rb") as handle:
        if tail and size > SOURCE_MAX_BYTES:
            handle.seek(size - SOURCE_MAX_BYTES)
            raw = b"...[earlier source omitted]\n" + handle.read(SOURCE_MAX_BYTES)
        else:
            raw = handle.read(SOURCE_MAX_BYTES + 1)
            if len(raw) > SOURCE_MAX_BYTES:
                raw = raw[:SOURCE_MAX_BYTES] + b"\n...[source truncated]"
    text = redact_text(raw.decode("utf-8", errors="replace"))
    if required and not text.strip():
        raise ContextConflict(f"required context source is empty: {path.name}")
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return text, digest


def build_packet_bytes(
    store: OrchestrationStore,
    *,
    task_id: str,
    run_id: str,
    window_id: str,
    instruction_version: int,
    max_packet_bytes: int = DEFAULT_MAX_PACKET_BYTES,
) -> bytes:
    for label, value in (("task_id", task_id), ("run_id", run_id), ("window_id", window_id)):
        validate_id(value, label)
    if instruction_version < 1:
        raise IdentityError("instruction_version must be positive")
    binding = store.assert_window_binding(task_id=task_id, run_id=run_id, window_id=window_id)
    root = store.identity.repo_root
    task_dir = root / ".ai-company" / "memory" / "tasks" / task_id
    allowlist = (
        (task_dir / "TASK.md", True, False),
        (task_dir / "CHECKPOINTS.md", True, True),
        (task_dir / "HANDOFF.md", False, True),
        (root / "docs" / "CROSS_SESSION_ORCHESTRATION_DECLARATION.md", False, False),
    )
    sources: list[dict[str, str]] = []
    for path, required, tail in allowlist:
        item = _source_bytes(path, required=required, tail=tail)
        if item is None:
            continue
        text, digest = item
        sources.append(
            {
                "path": str(path.relative_to(root)),
                "sha256": digest,
                "content": text,
            }
        )
    task_text = str(sources[0]["content"])
    match = re.search(r"(?m)^task_id:\s*[\"']?([^\"'\s]+)", task_text)
    if not match or match.group(1) != task_id:
        raise ContextConflict("TASK.md identity does not match the bound task")
    payload = {
        "schema_version": 1,
        "identity": {
            "project_id": store.identity.project_id,
            "task_id": task_id,
            "run_id": run_id,
            "window_id": window_id,
            "role": binding["role"],
            "instruction_version": instruction_version,
        },
        "authority": {
            "binding_grants_permission": False,
            "active_context_is_identity": False,
            "registry_required": True,
            "phase": "0A-shadow",
        },
        "sources": sources,
    }
    payload_canonical = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    document = {
        **payload,
        "payload_sha256": hashlib.sha256(payload_canonical).hexdigest(),
    }
    encoded = (
        json.dumps(document, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")
    if len(encoded) > max_packet_bytes:
        raise ContextConflict("context packet exceeds the configured size limit")
    return encoded


def _secure_packet_parent(path: Path, project_dir: Path) -> None:
    current = project_dir
    for part in path.parent.relative_to(project_dir).parts:
        current = current / part
        if current.is_symlink():
            raise ContextConflict("context packet directory cannot be a symlink")
        current.mkdir(exist_ok=True)
        os.chmod(current, 0o700)


def issue_context_packet(
    store: OrchestrationStore,
    *,
    task_id: str,
    run_id: str,
    window_id: str,
    instruction_version: int,
    max_packet_bytes: int = DEFAULT_MAX_PACKET_BYTES,
) -> ContextPacket:
    encoded = build_packet_bytes(
        store,
        task_id=task_id,
        run_id=run_id,
        window_id=window_id,
        instruction_version=instruction_version,
        max_packet_bytes=max_packet_bytes,
    )
    digest = hashlib.sha256(encoded).hexdigest()
    relative = Path("contexts") / task_id / run_id / window_id / f"v{instruction_version:06d}-{digest}.json"
    record, _replayed = store.reserve_context_packet(
        task_id=task_id,
        run_id=run_id,
        window_id=window_id,
        instruction_version=instruction_version,
        file_sha256=digest,
        relative_path=str(relative),
    )
    path = store.project_dir / str(record["relative_path"])
    _secure_packet_parent(path, store.project_dir)
    created = False
    if path.exists():
        if path.is_symlink() or path.read_bytes() != encoded:
            store.quarantine_context_packet(
                task_id=task_id,
                run_id=run_id,
                window_id=window_id,
                instruction_version=instruction_version,
            )
            raise ContextConflict("immutable context packet path has unexpected content")
        os.chmod(path, 0o600)
    else:
        temp_path = path.parent / (
            f".{path.name}.{os.getpid()}.{threading.get_ident()}.tmp"
        )
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        try:
            fd = os.open(temp_path, flags, 0o600)
        except FileExistsError:
            raise ContextConflict("context packet temporary path collision")
        else:
            try:
                os.fchmod(fd, 0o600)
                view = memoryview(encoded)
                while view:
                    written = os.write(fd, view)
                    view = view[written:]
                os.fsync(fd)
            finally:
                os.close(fd)
            try:
                os.link(temp_path, path, follow_symlinks=False)
                created = True
            except FileExistsError:
                if path.is_symlink() or path.read_bytes() != encoded:
                    store.quarantine_context_packet(
                        task_id=task_id,
                        run_id=run_id,
                        window_id=window_id,
                        instruction_version=instruction_version,
                    )
                    raise ContextConflict("concurrent context packet content differs")
            finally:
                try:
                    temp_path.unlink()
                except FileNotFoundError:
                    pass
            dir_fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
    store.finalize_context_packet(
        task_id=task_id,
        run_id=run_id,
        window_id=window_id,
        instruction_version=instruction_version,
        file_sha256=digest,
    )
    return ContextPacket(
        path=path,
        file_sha256=digest,
        instruction_version=instruction_version,
        created=created,
    )


def read_context_packet(
    store: OrchestrationStore,
    *,
    task_id: str,
    run_id: str,
    window_id: str,
    instruction_version: int,
) -> bytes:
    store.assert_window_binding(task_id=task_id, run_id=run_id, window_id=window_id)
    store.assert_current_instruction(
        task_id=task_id,
        run_id=run_id,
        instruction_version=instruction_version,
    )
    record = store.context_record(
        task_id=task_id,
        run_id=run_id,
        window_id=window_id,
        instruction_version=instruction_version,
    )
    if not record or record["state"] != "ready":
        raise ContextConflict("ready context packet is not registered")
    path = store.project_dir / str(record["relative_path"])
    if not path.is_file() or path.is_symlink():
        raise ContextConflict("context packet is missing")
    encoded = path.read_bytes()
    if hashlib.sha256(encoded).hexdigest() != record["file_sha256"]:
        store.quarantine_context_packet(
            task_id=task_id,
            run_id=run_id,
            window_id=window_id,
            instruction_version=instruction_version,
        )
        raise ContextConflict("context packet tampering detected")
    return encoded
