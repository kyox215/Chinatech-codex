"""Transactional SQLite registry for RepairDesk cross-session orchestration.

Only bounded identity and coordination metadata is stored. Raw prompts, command
output, environment variables, diffs, secrets, and customer data are excluded by
schema and API design.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Iterator

from .errors import (
    BindingConflict,
    ContextConflict,
    IdempotencyConflict,
    IdentityError,
    RegistryUnavailable,
    VersionConflict,
)
from .identity import ProjectIdentity, validate_id

SCHEMA_VERSION = 1
OPEN_TASK_STATUSES = ("open", "in_progress", "blocked", "conditional")
OPEN_RUN_STATUSES = ("open", "in_progress", "blocked")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def canonical_hash(value: object) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    repo_fingerprint TEXT NOT NULL,
    common_dir_fingerprint TEXT NOT NULL,
    created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS commands (
    command_id TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    operation TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS tasks (
    project_id TEXT NOT NULL REFERENCES projects(project_id),
    task_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('open','in_progress','blocked','conditional','closed','cancelled')),
    title_slug TEXT NOT NULL DEFAULT '' CHECK(title_slug=''),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(project_id, task_id)
) STRICT;

CREATE TABLE IF NOT EXISTS runs (
    project_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('open','in_progress','blocked','closed','cancelled')),
    instruction_version INTEGER NOT NULL CHECK(instruction_version >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(project_id, task_id, run_id),
    FOREIGN KEY(project_id, task_id) REFERENCES tasks(project_id, task_id)
) STRICT;

CREATE TABLE IF NOT EXISTS windows (
    project_id TEXT NOT NULL,
    window_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('intake','controller','writer','reviewer','observer','integration_lead')),
    state TEXT NOT NULL CHECK(state IN ('bound','closed')),
    bound_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(project_id, window_id),
    FOREIGN KEY(project_id, task_id, run_id) REFERENCES runs(project_id, task_id, run_id)
) STRICT;

CREATE TABLE IF NOT EXISTS workers (
    project_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    window_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('controller','writer','reviewer','observer')),
    state TEXT NOT NULL CHECK(state IN ('active','closed')),
    created_at TEXT NOT NULL,
    PRIMARY KEY(project_id, worker_id),
    FOREIGN KEY(project_id, window_id) REFERENCES windows(project_id, window_id),
    FOREIGN KEY(project_id, task_id, run_id) REFERENCES runs(project_id, task_id, run_id)
) STRICT;

CREATE TABLE IF NOT EXISTS work_packages (
    project_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    wp_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('ready','claimed','completed','cancelled')),
    claimed_by TEXT,
    version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(project_id, task_id, run_id, wp_id),
    FOREIGN KEY(project_id, task_id, run_id) REFERENCES runs(project_id, task_id, run_id),
    FOREIGN KEY(project_id, claimed_by) REFERENCES workers(project_id, worker_id)
) STRICT;

CREATE TABLE IF NOT EXISTS context_packets (
    project_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    window_id TEXT NOT NULL,
    instruction_version INTEGER NOT NULL,
    file_sha256 TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('pending','ready','quarantined')),
    created_at TEXT NOT NULL,
    PRIMARY KEY(project_id, task_id, run_id, window_id, instruction_version),
    FOREIGN KEY(project_id, window_id) REFERENCES windows(project_id, window_id),
    FOREIGN KEY(project_id, task_id, run_id) REFERENCES runs(project_id, task_id, run_id)
) STRICT;

CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(project_id),
    event_type TEXT NOT NULL,
    task_id TEXT,
    run_id TEXT,
    window_id TEXT,
    worker_id TEXT,
    wp_id TEXT,
    created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS integration_leases (
    project_id TEXT PRIMARY KEY REFERENCES projects(project_id),
    holder_window_id TEXT NOT NULL,
    lease_version INTEGER NOT NULL,
    expires_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS release_leases (
    project_id TEXT PRIMARY KEY REFERENCES projects(project_id),
    holder_window_id TEXT NOT NULL,
    lease_version INTEGER NOT NULL,
    expires_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(project_id, task_id, status);
CREATE INDEX IF NOT EXISTS idx_events_scope ON events(project_id, task_id, run_id);
"""


class OrchestrationStore:
    """Fail-closed registry with one SQLite connection per operation."""

    def __init__(
        self,
        identity: ProjectIdentity,
        runtime_root: Path,
        *,
        busy_timeout_ms: int = 5000,
    ) -> None:
        self.identity = identity
        self.runtime_root = Path(runtime_root)
        self.project_dir = self.runtime_root / identity.project_id
        self.db_path = self.project_dir / "registry.sqlite3"
        self.context_dir = self.project_dir / "contexts"
        self.busy_timeout_ms = int(busy_timeout_ms)

    @staticmethod
    def _fingerprint_path(path: Path) -> str:
        return hashlib.sha256(str(path.resolve()).encode("utf-8")).hexdigest()

    @staticmethod
    def _reject_symlink(path: Path) -> None:
        absolute = path.absolute()
        current = Path(absolute.anchor)
        parts = absolute.parts[1:] if absolute.anchor else absolute.parts
        for part in parts:
            current = current / part
            if current.is_symlink():
                raise RegistryUnavailable("orchestration runtime path cannot contain a symlink")

    @staticmethod
    def _secure_dir(path: Path) -> None:
        OrchestrationStore._reject_symlink(path)
        path.mkdir(parents=True, exist_ok=True)
        OrchestrationStore._reject_symlink(path)
        os.chmod(path, 0o700)

    @staticmethod
    def _secure_file(path: Path) -> None:
        try:
            if path.exists():
                OrchestrationStore._reject_symlink(path)
                os.chmod(path, 0o600)
        except FileNotFoundError:
            # SQLite can remove WAL/SHM between the existence check and chmod
            # when the last concurrent connection closes. The next open/doctor
            # pass recreates and verifies sidecars; never recreate them here.
            return

    def _secure_runtime(self) -> None:
        self._secure_dir(self.runtime_root)
        self._secure_dir(self.project_dir)
        self._secure_dir(self.context_dir)
        for suffix in ("", "-wal", "-shm"):
            self._secure_file(Path(str(self.db_path) + suffix))

    def initialize(self) -> dict[str, object]:
        self._secure_runtime()
        try:
            with self._connect(require_exists=False) as conn:
                conn.executescript(SCHEMA)
                conn.execute(
                    "INSERT OR IGNORE INTO meta(key,value) VALUES('schema_version',?)",
                    (str(SCHEMA_VERSION),),
                )
                schema_row = conn.execute(
                    "SELECT value FROM meta WHERE key='schema_version'"
                ).fetchone()
                if not schema_row or schema_row["value"] != str(SCHEMA_VERSION):
                    raise RegistryUnavailable("orchestration registry schema version is unsupported")
                # The Phase 0A API deliberately stores no task title or prompt.
                conn.execute("UPDATE tasks SET title_slug='' WHERE title_slug<>''")
                common_fingerprint = self._fingerprint_path(self.identity.git_common_dir)
                row = conn.execute(
                    "SELECT repo_fingerprint, common_dir_fingerprint FROM projects WHERE project_id=?",
                    (self.identity.project_id,),
                ).fetchone()
                if row and tuple(row) != (
                    self.identity.repo_fingerprint,
                    common_fingerprint,
                ):
                    raise IdentityError("project registry identity does not match this checkout")
                conn.execute(
                    """INSERT OR IGNORE INTO projects(
                        project_id,repo_fingerprint,common_dir_fingerprint,created_at
                    ) VALUES(?,?,?,?)""",
                    (
                        self.identity.project_id,
                        self.identity.repo_fingerprint,
                        common_fingerprint,
                        utc_now(),
                    ),
                )
                conn.commit()
        except sqlite3.DatabaseError as exc:
            raise RegistryUnavailable("orchestration registry could not be initialized") from exc
        finally:
            self._secure_runtime()
        return {
            "project_id": self.identity.project_id,
            "db_path": str(self.db_path),
            "schema_version": SCHEMA_VERSION,
        }

    @contextmanager
    def _connect(self, *, require_exists: bool = True) -> Iterator[sqlite3.Connection]:
        if require_exists and not self.db_path.is_file():
            raise RegistryUnavailable("orchestration registry is not initialized")
        self._reject_symlink(self.runtime_root)
        self._reject_symlink(self.project_dir)
        self._reject_symlink(self.db_path)
        try:
            conn = sqlite3.connect(
                self.db_path,
                timeout=max(self.busy_timeout_ms / 1000, 0),
                isolation_level=None,
            )
            conn.row_factory = sqlite3.Row
            conn.execute(f"PRAGMA busy_timeout={self.busy_timeout_ms}")
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=FULL")
            yield conn
        except sqlite3.DatabaseError as exc:
            raise RegistryUnavailable("orchestration registry operation failed closed") from exc
        finally:
            if "conn" in locals():
                conn.close()
            self._secure_runtime()

    @contextmanager
    def _transaction(self) -> Iterator[sqlite3.Connection]:
        with self._connect() as conn:
            try:
                conn.execute("BEGIN IMMEDIATE")
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise

    def _project_guard(self, conn: sqlite3.Connection) -> None:
        schema_row = conn.execute(
            "SELECT value FROM meta WHERE key='schema_version'"
        ).fetchone()
        if not schema_row or schema_row["value"] != str(SCHEMA_VERSION):
            raise RegistryUnavailable("orchestration registry schema version is unsupported")
        row = conn.execute(
            "SELECT repo_fingerprint,common_dir_fingerprint FROM projects WHERE project_id=?",
            (self.identity.project_id,),
        ).fetchone()
        expected = (
            self.identity.repo_fingerprint,
            self._fingerprint_path(self.identity.git_common_dir),
        )
        if row is None or tuple(row) != expected:
            raise IdentityError("project identity verification failed")

    def _run_command(
        self,
        command_id: str,
        operation: str,
        request: object,
        transition: Callable[[sqlite3.Connection], dict[str, object]],
    ) -> tuple[dict[str, object], bool]:
        command_id = validate_id(command_id, "command_id")
        request_hash = canonical_hash(request)
        with self._transaction() as conn:
            self._project_guard(conn)
            row = conn.execute(
                "SELECT request_hash,operation,result_json FROM commands WHERE command_id=?",
                (command_id,),
            ).fetchone()
            if row:
                if row["request_hash"] != request_hash or row["operation"] != operation:
                    raise IdempotencyConflict("command replay content does not match")
                return json.loads(row["result_json"]), True
            result = transition(conn)
            conn.execute(
                "INSERT INTO commands(command_id,request_hash,operation,result_json,created_at) VALUES(?,?,?,?,?)",
                (
                    command_id,
                    request_hash,
                    operation,
                    json.dumps(result, sort_keys=True, separators=(",", ":")),
                    utc_now(),
                ),
            )
            return result, False

    def register_task(
        self,
        *,
        task_id: str,
        command_id: str,
        status: str = "open",
    ) -> tuple[dict[str, object], bool]:
        task_id = validate_id(task_id, "task_id")
        if status not in OPEN_TASK_STATUSES:
            raise IdentityError("new task status is not open")
        request = {"task_id": task_id, "status": status}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            now = utc_now()
            try:
                conn.execute(
                    """INSERT INTO tasks(project_id,task_id,status,title_slug,created_at,updated_at)
                       VALUES(?,?,?,'',?,?)""",
                    (self.identity.project_id, task_id, status, now, now),
                )
            except sqlite3.IntegrityError as exc:
                raise BindingConflict("task is already registered") from exc
            self._event(conn, "task_registered", task_id=task_id)
            return {"project_id": self.identity.project_id, "task_id": task_id, "status": status}

        return self._run_command(command_id, "task.register", request, transition)

    def register_run(
        self,
        *,
        task_id: str,
        run_id: str,
        command_id: str,
        instruction_version: int = 1,
    ) -> tuple[dict[str, object], bool]:
        task_id = validate_id(task_id, "task_id")
        run_id = validate_id(run_id, "run_id")
        if instruction_version < 1:
            raise IdentityError("instruction_version must be positive")
        request = {"task_id": task_id, "run_id": run_id, "instruction_version": instruction_version}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            now = utc_now()
            task = conn.execute(
                "SELECT status FROM tasks WHERE project_id=? AND task_id=?",
                (self.identity.project_id, task_id),
            ).fetchone()
            if not task or task["status"] not in OPEN_TASK_STATUSES:
                raise BindingConflict("run parent task is not open")
            try:
                conn.execute(
                    "INSERT INTO runs VALUES(?,?,?,?,?,?,?)",
                    (self.identity.project_id, task_id, run_id, "open", instruction_version, now, now),
                )
            except sqlite3.IntegrityError as exc:
                raise BindingConflict("run cannot be registered for this task") from exc
            self._event(conn, "run_registered", task_id=task_id, run_id=run_id)
            return {"project_id": self.identity.project_id, "task_id": task_id, "run_id": run_id, "instruction_version": instruction_version}

        return self._run_command(command_id, "run.register", request, transition)

    def bind_window(
        self,
        *,
        task_id: str,
        run_id: str,
        window_id: str,
        role: str,
        command_id: str,
    ) -> tuple[dict[str, object], bool]:
        task_id = validate_id(task_id, "task_id")
        run_id = validate_id(run_id, "run_id")
        window_id = validate_id(window_id, "window_id")
        if role not in {"intake", "controller", "writer", "reviewer", "observer", "integration_lead"}:
            raise IdentityError("unsupported window role")
        request = {"task_id": task_id, "run_id": run_id, "window_id": window_id, "role": role}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            existing = conn.execute(
                "SELECT task_id,run_id,role,state FROM windows WHERE project_id=? AND window_id=?",
                (self.identity.project_id, window_id),
            ).fetchone()
            if existing:
                expected = (task_id, run_id, role, "bound")
                if tuple(existing) != expected:
                    raise BindingConflict("window is already bound to another identity")
                return {"project_id": self.identity.project_id, "task_id": task_id, "run_id": run_id, "window_id": window_id, "role": role}
            run = conn.execute(
                "SELECT status FROM runs WHERE project_id=? AND task_id=? AND run_id=?",
                (self.identity.project_id, task_id, run_id),
            ).fetchone()
            if not run or run["status"] not in OPEN_RUN_STATUSES:
                raise BindingConflict("window target run is not open")
            now = utc_now()
            conn.execute(
                "INSERT INTO windows VALUES(?,?,?,?,?,?,?,?)",
                (self.identity.project_id, window_id, task_id, run_id, role, "bound", now, now),
            )
            self._event(conn, "window_bound", task_id=task_id, run_id=run_id, window_id=window_id)
            return {"project_id": self.identity.project_id, "task_id": task_id, "run_id": run_id, "window_id": window_id, "role": role}

        return self._run_command(command_id, "window.bind", request, transition)

    def register_worker(
        self,
        *,
        task_id: str,
        run_id: str,
        window_id: str,
        worker_id: str,
        role: str,
        command_id: str,
    ) -> tuple[dict[str, object], bool]:
        for label, value in (("task_id", task_id), ("run_id", run_id), ("window_id", window_id), ("worker_id", worker_id)):
            validate_id(value, label)
        if role not in {"controller", "writer", "reviewer", "observer"}:
            raise IdentityError("unsupported worker role")
        request = {"task_id": task_id, "run_id": run_id, "window_id": window_id, "worker_id": worker_id, "role": role}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            window = self._assert_window_row(conn, task_id, run_id, window_id)
            if window["role"] != role:
                raise BindingConflict("worker role must match the bound window role")
            now = utc_now()
            try:
                conn.execute(
                    "INSERT INTO workers VALUES(?,?,?,?,?,?,?,?)",
                    (self.identity.project_id, worker_id, window_id, task_id, run_id, role, "active", now),
                )
            except sqlite3.IntegrityError as exc:
                raise BindingConflict("worker identity is already registered") from exc
            self._event(conn, "worker_registered", task_id=task_id, run_id=run_id, window_id=window_id, worker_id=worker_id)
            return request | {"project_id": self.identity.project_id}

        return self._run_command(command_id, "worker.register", request, transition)

    def register_work_package(
        self,
        *,
        task_id: str,
        run_id: str,
        window_id: str,
        wp_id: str,
        command_id: str,
    ) -> tuple[dict[str, object], bool]:
        for label, value in (("task_id", task_id), ("run_id", run_id), ("window_id", window_id), ("wp_id", wp_id)):
            validate_id(value, label)
        request = {"task_id": task_id, "run_id": run_id, "window_id": window_id, "wp_id": wp_id}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            window = self._assert_window_row(conn, task_id, run_id, window_id)
            if window["role"] not in {"controller", "integration_lead"}:
                raise BindingConflict("window role cannot register a work package")
            run = conn.execute(
                "SELECT status FROM runs WHERE project_id=? AND task_id=? AND run_id=?",
                (self.identity.project_id, task_id, run_id),
            ).fetchone()
            if not run or run["status"] not in OPEN_RUN_STATUSES:
                raise BindingConflict("work package parent run is not open")
            now = utc_now()
            try:
                conn.execute(
                    "INSERT INTO work_packages VALUES(?,?,?,?,?,?,?,?,?)",
                    (self.identity.project_id, task_id, run_id, wp_id, "ready", None, 1, now, now),
                )
            except sqlite3.IntegrityError as exc:
                raise BindingConflict("work package cannot be registered") from exc
            self._event(conn, "wp_registered", task_id=task_id, run_id=run_id, wp_id=wp_id)
            return request | {"project_id": self.identity.project_id, "status": "ready", "version": 1}

        return self._run_command(command_id, "wp.register", request, transition)

    def claim_work_package(
        self,
        *,
        task_id: str,
        run_id: str,
        window_id: str,
        worker_id: str,
        wp_id: str,
        expected_version: int,
        command_id: str,
    ) -> tuple[dict[str, object], bool]:
        for label, value in (("task_id", task_id), ("run_id", run_id), ("window_id", window_id), ("worker_id", worker_id), ("wp_id", wp_id)):
            validate_id(value, label)
        request = {"task_id": task_id, "run_id": run_id, "window_id": window_id, "worker_id": worker_id, "wp_id": wp_id, "expected_version": expected_version}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            self._assert_window_row(conn, task_id, run_id, window_id)
            worker = conn.execute(
                "SELECT task_id,run_id,window_id,role,state FROM workers WHERE project_id=? AND worker_id=?",
                (self.identity.project_id, worker_id),
            ).fetchone()
            if (
                not worker
                or (worker["task_id"], worker["run_id"], worker["window_id"], worker["state"])
                != (task_id, run_id, window_id, "active")
            ):
                raise BindingConflict("worker is not bound to this window and run")
            if worker["role"] not in {"controller", "writer"}:
                raise BindingConflict("worker role cannot claim an executable work package")
            run = conn.execute(
                "SELECT status FROM runs WHERE project_id=? AND task_id=? AND run_id=?",
                (self.identity.project_id, task_id, run_id),
            ).fetchone()
            if not run or run["status"] not in OPEN_RUN_STATUSES:
                raise BindingConflict("run is not open")
            cursor = conn.execute(
                """UPDATE work_packages SET status='claimed',claimed_by=?,version=version+1,updated_at=?
                   WHERE project_id=? AND task_id=? AND run_id=? AND wp_id=?
                     AND status='ready' AND version=?""",
                (worker_id, utc_now(), self.identity.project_id, task_id, run_id, wp_id, expected_version),
            )
            if cursor.rowcount != 1:
                raise VersionConflict("work package claim lost or version is stale")
            version = expected_version + 1
            self._event(conn, "wp_claimed", task_id=task_id, run_id=run_id, window_id=window_id, worker_id=worker_id, wp_id=wp_id)
            return request | {"project_id": self.identity.project_id, "status": "claimed", "version": version}

        return self._run_command(command_id, "wp.claim", request, transition)

    def complete_work_package(
        self,
        *,
        task_id: str,
        run_id: str,
        window_id: str,
        worker_id: str,
        wp_id: str,
        expected_version: int,
        command_id: str,
    ) -> tuple[dict[str, object], bool]:
        for label, value in (("task_id", task_id), ("run_id", run_id), ("window_id", window_id), ("worker_id", worker_id), ("wp_id", wp_id)):
            validate_id(value, label)
        request = {
            "task_id": task_id, "run_id": run_id, "window_id": window_id,
            "worker_id": worker_id, "wp_id": wp_id,
            "expected_version": expected_version,
        }

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            self._assert_window_row(conn, task_id, run_id, window_id)
            worker = conn.execute(
                """SELECT task_id,run_id,window_id,role,state FROM workers
                   WHERE project_id=? AND worker_id=?""",
                (self.identity.project_id, worker_id),
            ).fetchone()
            if (
                not worker
                or (worker["task_id"], worker["run_id"], worker["window_id"], worker["state"])
                != (task_id, run_id, window_id, "active")
                or worker["role"] not in {"controller", "writer"}
            ):
                raise BindingConflict("worker cannot complete this work package")
            cursor = conn.execute(
                """UPDATE work_packages SET status='completed',version=version+1,updated_at=?
                   WHERE project_id=? AND task_id=? AND run_id=? AND wp_id=?
                     AND status='claimed' AND claimed_by=? AND version=?""",
                (utc_now(), self.identity.project_id, task_id, run_id, wp_id, worker_id, expected_version),
            )
            if cursor.rowcount != 1:
                raise VersionConflict("work package completion lost or version is stale")
            version = expected_version + 1
            self._event(conn, "wp_completed", task_id=task_id, run_id=run_id, window_id=window_id, worker_id=worker_id, wp_id=wp_id)
            return request | {"project_id": self.identity.project_id, "status": "completed", "version": version}

        return self._run_command(command_id, "wp.complete", request, transition)

    def assert_window_binding(self, *, task_id: str, run_id: str, window_id: str) -> dict[str, object]:
        for label, value in (("task_id", task_id), ("run_id", run_id), ("window_id", window_id)):
            validate_id(value, label)
        with self._connect() as conn:
            self._project_guard(conn)
            row = self._assert_window_row(conn, task_id, run_id, window_id)
            return dict(row)

    def assert_current_instruction(
        self,
        *,
        task_id: str,
        run_id: str,
        instruction_version: int,
    ) -> dict[str, object]:
        with self._connect() as conn:
            self._project_guard(conn)
            row = conn.execute(
                """SELECT status,instruction_version FROM runs
                   WHERE project_id=? AND task_id=? AND run_id=?""",
                (self.identity.project_id, task_id, run_id),
            ).fetchone()
            if not row or row["status"] not in OPEN_RUN_STATUSES:
                raise BindingConflict("context run is not open")
            if int(row["instruction_version"]) != int(instruction_version):
                raise VersionConflict("context instruction version is stale")
            return dict(row)

    def _assert_window_row(self, conn: sqlite3.Connection, task_id: str, run_id: str, window_id: str) -> sqlite3.Row:
        row = conn.execute(
            "SELECT task_id,run_id,window_id,role,state FROM windows WHERE project_id=? AND window_id=?",
            (self.identity.project_id, window_id),
        ).fetchone()
        if not row or row["state"] != "bound" or row["task_id"] != task_id or row["run_id"] != run_id:
            raise BindingConflict("window identity binding is missing or mismatched")
        return row

    def reserve_context_packet(
        self,
        *,
        task_id: str,
        run_id: str,
        window_id: str,
        instruction_version: int,
        file_sha256: str,
        relative_path: str,
    ) -> tuple[dict[str, object], bool]:
        with self._transaction() as conn:
            self._project_guard(conn)
            self._assert_window_row(conn, task_id, run_id, window_id)
            run = conn.execute(
                "SELECT instruction_version,status FROM runs WHERE project_id=? AND task_id=? AND run_id=?",
                (self.identity.project_id, task_id, run_id),
            ).fetchone()
            if not run or run["status"] not in OPEN_RUN_STATUSES:
                raise BindingConflict("context target run is not open")
            if int(run["instruction_version"]) != int(instruction_version):
                raise VersionConflict("instruction version is stale")
            existing = conn.execute(
                """SELECT file_sha256,relative_path,state FROM context_packets
                   WHERE project_id=? AND task_id=? AND run_id=? AND window_id=? AND instruction_version=?""",
                (self.identity.project_id, task_id, run_id, window_id, instruction_version),
            ).fetchone()
            if existing:
                if existing["file_sha256"] != file_sha256:
                    raise ContextConflict("immutable context version already has different content")
                return {"file_sha256": file_sha256, "relative_path": existing["relative_path"], "instruction_version": instruction_version, "state": existing["state"]}, True
            conn.execute(
                "INSERT INTO context_packets VALUES(?,?,?,?,?,?,?,?,?)",
                (self.identity.project_id, task_id, run_id, window_id, instruction_version, file_sha256, relative_path, "pending", utc_now()),
            )
            self._event(conn, "context_reserved", task_id=task_id, run_id=run_id, window_id=window_id)
            return {"file_sha256": file_sha256, "relative_path": relative_path, "instruction_version": instruction_version, "state": "pending"}, False

    def finalize_context_packet(
        self,
        *,
        task_id: str,
        run_id: str,
        window_id: str,
        instruction_version: int,
        file_sha256: str,
    ) -> dict[str, object]:
        failure: str | None = None
        result: dict[str, object] | None = None
        with self._transaction() as conn:
            self._project_guard(conn)
            row = conn.execute(
                """SELECT file_sha256,relative_path,state FROM context_packets
                   WHERE project_id=? AND task_id=? AND run_id=? AND window_id=? AND instruction_version=?""",
                (self.identity.project_id, task_id, run_id, window_id, instruction_version),
            ).fetchone()
            if not row or row["file_sha256"] != file_sha256:
                raise ContextConflict("context reservation is missing or mismatched")
            if row["state"] == "quarantined":
                raise ContextConflict("context packet is quarantined")
            path = self.project_dir / row["relative_path"]
            if not path.is_file() or path.is_symlink():
                raise ContextConflict("context packet file is missing")
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != file_sha256:
                conn.execute(
                    """UPDATE context_packets SET state='quarantined'
                       WHERE project_id=? AND task_id=? AND run_id=? AND window_id=? AND instruction_version=?""",
                    (self.identity.project_id, task_id, run_id, window_id, instruction_version),
                )
                self._event(conn, "context_quarantined", task_id=task_id, run_id=run_id, window_id=window_id)
                failure = "context packet hash verification failed"
            else:
                conn.execute(
                    """UPDATE context_packets SET state='ready'
                       WHERE project_id=? AND task_id=? AND run_id=? AND window_id=? AND instruction_version=?""",
                    (self.identity.project_id, task_id, run_id, window_id, instruction_version),
                )
                self._event(conn, "context_ready", task_id=task_id, run_id=run_id, window_id=window_id)
                result = {"file_sha256": file_sha256, "relative_path": row["relative_path"], "instruction_version": instruction_version, "state": "ready"}
        if failure:
            raise ContextConflict(failure)
        if result is None:
            raise ContextConflict("context packet could not be finalized")
        return result

    def quarantine_context_packet(
        self,
        *,
        task_id: str,
        run_id: str,
        window_id: str,
        instruction_version: int,
    ) -> None:
        with self._transaction() as conn:
            self._project_guard(conn)
            cursor = conn.execute(
                """UPDATE context_packets SET state='quarantined'
                   WHERE project_id=? AND task_id=? AND run_id=? AND window_id=? AND instruction_version=?""",
                (self.identity.project_id, task_id, run_id, window_id, instruction_version),
            )
            if cursor.rowcount != 1:
                raise ContextConflict("context packet is not registered")
            self._event(conn, "context_quarantined", task_id=task_id, run_id=run_id, window_id=window_id)

    def context_record(self, *, task_id: str, run_id: str, window_id: str, instruction_version: int) -> dict[str, object] | None:
        with self._connect() as conn:
            self._project_guard(conn)
            row = conn.execute(
                """SELECT file_sha256,relative_path,instruction_version,state FROM context_packets
                   WHERE project_id=? AND task_id=? AND run_id=? AND window_id=? AND instruction_version=?""",
                (self.identity.project_id, task_id, run_id, window_id, instruction_version),
            ).fetchone()
            return dict(row) if row else None

    def advance_instruction(
        self,
        *,
        task_id: str,
        run_id: str,
        window_id: str,
        expected_version: int,
        command_id: str,
    ) -> tuple[dict[str, object], bool]:
        for label, value in (("task_id", task_id), ("run_id", run_id), ("window_id", window_id)):
            validate_id(value, label)
        request = {
            "task_id": task_id,
            "run_id": run_id,
            "window_id": window_id,
            "expected_version": expected_version,
        }

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            window = self._assert_window_row(conn, task_id, run_id, window_id)
            if window["role"] not in {"controller", "integration_lead"}:
                raise BindingConflict("window role cannot advance instructions")
            cursor = conn.execute(
                """UPDATE runs SET instruction_version=instruction_version+1,updated_at=?
                   WHERE project_id=? AND task_id=? AND run_id=?
                     AND status IN ('open','in_progress','blocked') AND instruction_version=?""",
                (utc_now(), self.identity.project_id, task_id, run_id, expected_version),
            )
            if cursor.rowcount != 1:
                raise VersionConflict("instruction version is stale or run is closed")
            version = expected_version + 1
            self._event(conn, "instruction_advanced", task_id=task_id, run_id=run_id, window_id=window_id)
            return request | {"project_id": self.identity.project_id, "instruction_version": version}

        return self._run_command(command_id, "instruction.advance", request, transition)

    def close_run(
        self,
        *,
        task_id: str,
        run_id: str,
        integration_window_id: str,
        command_id: str,
        status: str = "closed",
    ) -> tuple[dict[str, object], bool]:
        for label, value in (("task_id", task_id), ("run_id", run_id), ("window_id", integration_window_id)):
            validate_id(value, label)
        if status not in {"closed", "cancelled"}:
            raise IdentityError("run close status is unsupported")
        request = {"task_id": task_id, "run_id": run_id, "integration_window_id": integration_window_id, "status": status}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            self._assert_scoped_integration_lease_row(
                conn, integration_window_id, task_id=task_id, run_id=run_id
            )
            row = conn.execute(
                "SELECT status FROM runs WHERE project_id=? AND task_id=? AND run_id=?",
                (self.identity.project_id, task_id, run_id),
            ).fetchone()
            if not row:
                raise BindingConflict("run is not registered")
            if row["status"] in {"closed", "cancelled"}:
                if row["status"] != status:
                    raise BindingConflict("run already has another terminal status")
                return request | {"project_id": self.identity.project_id}
            now = utc_now()
            conn.execute(
                """UPDATE work_packages SET status='cancelled',version=version+1,updated_at=?
                   WHERE project_id=? AND task_id=? AND run_id=? AND status IN ('ready','claimed')""",
                (now, self.identity.project_id, task_id, run_id),
            )
            conn.execute(
                "UPDATE workers SET state='closed' WHERE project_id=? AND task_id=? AND run_id=? AND state='active'",
                (self.identity.project_id, task_id, run_id),
            )
            conn.execute(
                "UPDATE windows SET state='closed',updated_at=? WHERE project_id=? AND task_id=? AND run_id=? AND state='bound'",
                (now, self.identity.project_id, task_id, run_id),
            )
            conn.execute(
                "UPDATE runs SET status=?,updated_at=? WHERE project_id=? AND task_id=? AND run_id=?",
                (status, now, self.identity.project_id, task_id, run_id),
            )
            holder = conn.execute(
                "SELECT holder_window_id FROM integration_leases WHERE project_id=?",
                (self.identity.project_id,),
            ).fetchone()
            if holder and holder["holder_window_id"] in {
                row["window_id"] for row in conn.execute(
                    "SELECT window_id FROM windows WHERE project_id=? AND task_id=? AND run_id=?",
                    (self.identity.project_id, task_id, run_id),
                ).fetchall()
            }:
                conn.execute("DELETE FROM integration_leases WHERE project_id=?", (self.identity.project_id,))
            self._event(conn, "run_closed", task_id=task_id, run_id=run_id, window_id=integration_window_id)
            return request | {"project_id": self.identity.project_id}

        return self._run_command(command_id, "run.close", request, transition)

    def close_task(
        self,
        *,
        task_id: str,
        integration_window_id: str,
        command_id: str,
        status: str = "closed",
    ) -> tuple[dict[str, object], bool]:
        validate_id(task_id, "task_id")
        validate_id(integration_window_id, "window_id")
        if status not in {"closed", "cancelled"}:
            raise IdentityError("task close status is unsupported")
        request = {"task_id": task_id, "integration_window_id": integration_window_id, "status": status}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            self._assert_scoped_integration_lease_row(
                conn, integration_window_id, task_id=task_id
            )
            task = conn.execute(
                "SELECT status FROM tasks WHERE project_id=? AND task_id=?",
                (self.identity.project_id, task_id),
            ).fetchone()
            if not task:
                raise BindingConflict("task is not registered")
            if task["status"] in {"closed", "cancelled"}:
                if task["status"] != status:
                    raise BindingConflict("task already has another terminal status")
                return request | {"project_id": self.identity.project_id}
            now = utc_now()
            counts = {
                "runs": conn.execute("SELECT COUNT(*) FROM runs WHERE project_id=? AND task_id=? AND status NOT IN ('closed','cancelled')", (self.identity.project_id, task_id)).fetchone()[0],
                "windows": conn.execute("SELECT COUNT(*) FROM windows WHERE project_id=? AND task_id=? AND state='bound'", (self.identity.project_id, task_id)).fetchone()[0],
                "work_packages": conn.execute("SELECT COUNT(*) FROM work_packages WHERE project_id=? AND task_id=? AND status IN ('ready','claimed')", (self.identity.project_id, task_id)).fetchone()[0],
            }
            conn.execute(
                """UPDATE work_packages SET status='cancelled',version=version+1,updated_at=?
                   WHERE project_id=? AND task_id=? AND status IN ('ready','claimed')""",
                (now, self.identity.project_id, task_id),
            )
            conn.execute("UPDATE workers SET state='closed' WHERE project_id=? AND task_id=? AND state='active'", (self.identity.project_id, task_id))
            conn.execute("UPDATE windows SET state='closed',updated_at=? WHERE project_id=? AND task_id=? AND state='bound'", (now, self.identity.project_id, task_id))
            conn.execute("UPDATE runs SET status=?,updated_at=? WHERE project_id=? AND task_id=? AND status NOT IN ('closed','cancelled')", (status, now, self.identity.project_id, task_id))
            conn.execute("UPDATE tasks SET status=?,updated_at=? WHERE project_id=? AND task_id=?", (status, now, self.identity.project_id, task_id))
            holder_task = conn.execute(
                """SELECT w.task_id FROM integration_leases l
                   JOIN windows w ON w.project_id=l.project_id AND w.window_id=l.holder_window_id
                   WHERE l.project_id=?""",
                (self.identity.project_id,),
            ).fetchone()
            if holder_task and holder_task["task_id"] == task_id:
                conn.execute("DELETE FROM integration_leases WHERE project_id=?", (self.identity.project_id,))
            self._event(conn, "task_closed", task_id=task_id, window_id=integration_window_id)
            return request | {"project_id": self.identity.project_id, "closed_resources": counts}

        return self._run_command(command_id, "task.close", request, transition)

    def release_window(
        self,
        *,
        task_id: str,
        run_id: str,
        window_id: str,
        command_id: str,
    ) -> tuple[dict[str, object], bool]:
        for label, value in (("task_id", task_id), ("run_id", run_id), ("window_id", window_id)):
            validate_id(value, label)
        request = {"task_id": task_id, "run_id": run_id, "window_id": window_id}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            self._assert_window_row(conn, task_id, run_id, window_id)
            lease = conn.execute(
                "SELECT holder_window_id,expires_at FROM integration_leases WHERE project_id=?",
                (self.identity.project_id,),
            ).fetchone()
            if lease and lease["holder_window_id"] == window_id:
                expires = datetime.fromisoformat(lease["expires_at"].replace("Z", "+00:00"))
                if expires > datetime.now(timezone.utc):
                    raise BindingConflict("release the active integration lease before closing its window")
            claimed = conn.execute(
                """SELECT COUNT(*) FROM work_packages wp JOIN workers w
                   ON w.project_id=wp.project_id AND w.worker_id=wp.claimed_by
                   WHERE wp.project_id=? AND w.window_id=? AND wp.status='claimed'""",
                (self.identity.project_id, window_id),
            ).fetchone()[0]
            if claimed:
                raise BindingConflict("window still owns claimed work packages")
            conn.execute("UPDATE workers SET state='closed' WHERE project_id=? AND window_id=?", (self.identity.project_id, window_id))
            conn.execute("UPDATE windows SET state='closed',updated_at=? WHERE project_id=? AND window_id=?", (utc_now(), self.identity.project_id, window_id))
            self._event(conn, "window_released", task_id=task_id, run_id=run_id, window_id=window_id)
            return request | {"project_id": self.identity.project_id, "state": "closed"}

        return self._run_command(command_id, "window.release", request, transition)

    def open_tasks(self) -> list[dict[str, object]]:
        placeholders = ",".join("?" for _ in OPEN_TASK_STATUSES)
        with self._connect() as conn:
            self._project_guard(conn)
            rows = conn.execute(
                f"SELECT task_id,status,updated_at FROM tasks WHERE project_id=? AND status IN ({placeholders}) ORDER BY task_id",
                (self.identity.project_id, *OPEN_TASK_STATUSES),
            ).fetchall()
            return [dict(row) for row in rows]

    def status(self) -> dict[str, object]:
        with self._connect() as conn:
            self._project_guard(conn)
            integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
            journal = conn.execute("PRAGMA journal_mode").fetchone()[0]
            foreign_keys = conn.execute("PRAGMA foreign_keys").fetchone()[0]
            synchronous = conn.execute("PRAGMA synchronous").fetchone()[0]
            counts = {}
            for table in ("tasks", "runs", "windows", "workers", "work_packages", "context_packets", "commands", "events"):
                counts[table] = conn.execute(
                    f"SELECT COUNT(*) FROM {table} WHERE project_id=?" if table not in {"commands"} else "SELECT COUNT(*) FROM commands",
                    (self.identity.project_id,) if table not in {"commands"} else (),
                ).fetchone()[0]
            open_runs = [dict(row) for row in conn.execute(
                """SELECT task_id,run_id,status,instruction_version,updated_at FROM runs
                   WHERE project_id=? AND status IN ('open','in_progress','blocked')
                   ORDER BY task_id,run_id""",
                (self.identity.project_id,),
            ).fetchall()]
            bound_windows = [dict(row) for row in conn.execute(
                """SELECT task_id,run_id,window_id,role,state,updated_at FROM windows
                   WHERE project_id=? AND state='bound' ORDER BY task_id,run_id,window_id""",
                (self.identity.project_id,),
            ).fetchall()]
            ready_packets = [dict(row) for row in conn.execute(
                """SELECT task_id,run_id,window_id,instruction_version,file_sha256,relative_path
                   FROM context_packets WHERE project_id=? AND state='ready'
                   ORDER BY task_id,run_id,window_id,instruction_version""",
                (self.identity.project_id,),
            ).fetchall()]
            return {
                "project_id": self.identity.project_id,
                "runtime_root": str(self.runtime_root),
                "db_path": str(self.db_path),
                "integrity": integrity,
                "journal_mode": journal,
                "foreign_keys": foreign_keys,
                "synchronous": synchronous,
                "counts": counts,
                "open_tasks": self.open_tasks(),
                "open_runs": open_runs,
                "bound_windows": bound_windows,
                "ready_context_packets": ready_packets,
                "integration_lease": self.integration_lease(),
            }

    def acquire_integration_lease(
        self,
        *,
        window_id: str,
        command_id: str,
        ttl_seconds: int = 900,
    ) -> tuple[dict[str, object], bool]:
        window_id = validate_id(window_id, "window_id")
        if ttl_seconds < 60 or ttl_seconds > 3600:
            raise IdentityError("integration lease TTL must be between 60 and 3600 seconds")
        request = {"window_id": window_id, "ttl_seconds": ttl_seconds}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            window = conn.execute(
                "SELECT task_id,run_id,role,state FROM windows WHERE project_id=? AND window_id=?",
                (self.identity.project_id, window_id),
            ).fetchone()
            if not window or window["state"] != "bound" or window["role"] != "integration_lead":
                raise BindingConflict("window is not bound as integration_lead")
            existing = conn.execute(
                "SELECT holder_window_id,lease_version,expires_at FROM integration_leases WHERE project_id=?",
                (self.identity.project_id,),
            ).fetchone()
            now_dt = datetime.now(timezone.utc)
            if existing:
                expires = datetime.fromisoformat(existing["expires_at"].replace("Z", "+00:00"))
                if expires > now_dt and existing["holder_window_id"] != window_id:
                    raise BindingConflict("integration lease is held by another window")
                version = int(existing["lease_version"]) + 1
            else:
                version = 1
            expires_at = (now_dt + timedelta(seconds=ttl_seconds)).isoformat(timespec="seconds").replace("+00:00", "Z")
            conn.execute(
                """INSERT INTO integration_leases(project_id,holder_window_id,lease_version,expires_at)
                   VALUES(?,?,?,?)
                   ON CONFLICT(project_id) DO UPDATE SET
                     holder_window_id=excluded.holder_window_id,
                     lease_version=excluded.lease_version,
                     expires_at=excluded.expires_at""",
                (self.identity.project_id, window_id, version, expires_at),
            )
            self._event(
                conn, "integration_lease_acquired", task_id=window["task_id"],
                run_id=window["run_id"], window_id=window_id,
            )
            return {
                "project_id": self.identity.project_id,
                "holder_window_id": window_id,
                "lease_version": version,
                "expires_at": expires_at,
            }

        return self._run_command(command_id, "integration_lease.acquire", request, transition)

    def release_integration_lease(
        self,
        *,
        window_id: str,
        expected_version: int,
        command_id: str,
    ) -> tuple[dict[str, object], bool]:
        window_id = validate_id(window_id, "window_id")
        request = {"window_id": window_id, "expected_version": expected_version}

        def transition(conn: sqlite3.Connection) -> dict[str, object]:
            cursor = conn.execute(
                """DELETE FROM integration_leases
                   WHERE project_id=? AND holder_window_id=? AND lease_version=?""",
                (self.identity.project_id, window_id, expected_version),
            )
            if cursor.rowcount != 1:
                raise VersionConflict("integration lease fencing token is stale")
            self._event(conn, "integration_lease_released", window_id=window_id)
            return request | {"project_id": self.identity.project_id, "released": True}

        return self._run_command(command_id, "integration_lease.release", request, transition)

    def _assert_integration_lease_row(self, conn: sqlite3.Connection, window_id: str) -> sqlite3.Row:
        row = conn.execute(
            "SELECT holder_window_id,lease_version,expires_at FROM integration_leases WHERE project_id=?",
            (self.identity.project_id,),
        ).fetchone()
        if not row or row["holder_window_id"] != window_id:
            raise BindingConflict("window does not hold the integration lease")
        expires = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
        if expires <= datetime.now(timezone.utc):
            raise BindingConflict("integration lease has expired")
        return row

    def _assert_scoped_integration_lease_row(
        self,
        conn: sqlite3.Connection,
        window_id: str,
        *,
        task_id: str,
        run_id: str | None = None,
    ) -> sqlite3.Row:
        lease = self._assert_integration_lease_row(conn, window_id)
        window = conn.execute(
            "SELECT task_id,run_id,role,state FROM windows WHERE project_id=? AND window_id=?",
            (self.identity.project_id, window_id),
        ).fetchone()
        if (
            not window
            or window["state"] != "bound"
            or window["role"] != "integration_lead"
            or window["task_id"] != task_id
            or (run_id is not None and window["run_id"] != run_id)
        ):
            raise BindingConflict("integration lease holder is outside the target task or run")
        return lease

    def integration_lease(self) -> dict[str, object] | None:
        with self._connect() as conn:
            self._project_guard(conn)
            row = conn.execute(
                "SELECT holder_window_id,lease_version,expires_at FROM integration_leases WHERE project_id=?",
                (self.identity.project_id,),
            ).fetchone()
            if not row:
                return None
            result = dict(row)
            expires = datetime.fromisoformat(str(result["expires_at"]).replace("Z", "+00:00"))
            result["active"] = expires > datetime.now(timezone.utc)
            return result

    def assert_integration_lease(self, *, window_id: str) -> dict[str, object]:
        window_id = validate_id(window_id, "window_id")
        lease = self.integration_lease()
        if not lease or not lease["active"] or lease["holder_window_id"] != window_id:
            raise BindingConflict("window does not hold the active integration lease")
        return lease

    def doctor(self) -> dict[str, object]:
        status = self.status()
        failures: list[str] = []
        if status["integrity"] != "ok":
            failures.append("sqlite integrity check failed")
        if str(status["journal_mode"]).lower() != "wal":
            failures.append("journal mode is not WAL")
        if status["foreign_keys"] != 1:
            failures.append("foreign keys are disabled")
        if status["synchronous"] not in (2, 3):
            failures.append("synchronous mode is not FULL or EXTRA")
        for path, expected in ((self.runtime_root, 0o700), (self.project_dir, 0o700), (self.context_dir, 0o700), (self.db_path, 0o600)):
            if not path.exists() or (path.stat().st_mode & 0o777) != expected:
                failures.append(f"permission mismatch: {path.name}")
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT file_sha256,relative_path,state FROM context_packets WHERE project_id=?",
                (self.identity.project_id,),
            ).fetchall()
        registered_paths = {str(row["relative_path"]) for row in rows}
        for row in rows:
            if row["state"] != "ready":
                failures.append("context packet is not ready")
            path = self.project_dir / row["relative_path"]
            if not path.is_file():
                failures.append("registered context packet is missing")
                continue
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != row["file_sha256"]:
                failures.append("registered context packet is tampered")
            if (path.stat().st_mode & 0o777) != 0o600:
                failures.append("context packet permission mismatch")
        if self.context_dir.is_dir():
            for path in self.context_dir.rglob("*"):
                if not path.is_file() and not path.is_symlink():
                    continue
                relative = str(path.relative_to(self.project_dir))
                if relative not in registered_paths:
                    failures.append("unregistered context artifact detected")
        return status | {"ok": not failures, "failures": failures}

    def _event(
        self,
        conn: sqlite3.Connection,
        event_type: str,
        *,
        task_id: str | None = None,
        run_id: str | None = None,
        window_id: str | None = None,
        worker_id: str | None = None,
        wp_id: str | None = None,
    ) -> None:
        conn.execute(
            """INSERT INTO events(project_id,event_type,task_id,run_id,window_id,worker_id,wp_id,created_at)
               VALUES(?,?,?,?,?,?,?,?)""",
            (self.identity.project_id, event_type, task_id, run_id, window_id, worker_id, wp_id, utc_now()),
        )
