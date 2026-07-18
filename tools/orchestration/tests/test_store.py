from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from orchestration.errors import BindingConflict, IdempotencyConflict, RegistryUnavailable, VersionConflict

from helpers import make_store, register_bound_stack


class StoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name).resolve()
        self.store = make_store(self.base)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_registry_uses_wal_foreign_keys_full_sync_and_secure_modes(self) -> None:
        result = self.store.doctor()
        self.assertTrue(result["ok"], result["failures"])
        self.assertEqual(result["journal_mode"].lower(), "wal")
        self.assertEqual(result["foreign_keys"], 1)
        self.assertIn(result["synchronous"], (2, 3))
        self.assertEqual(self.store.project_dir.stat().st_mode & 0o777, 0o700)
        self.assertEqual(self.store.db_path.stat().st_mode & 0o777, 0o600)
        with self.store._connect() as _connection:
            for suffix in ("-wal", "-shm"):
                path = Path(str(self.store.db_path) + suffix)
                self.assertTrue(path.is_file())
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_hostile_umask_still_creates_secure_runtime(self) -> None:
        old = os.umask(0)
        try:
            other = make_store(self.base / "hostile", project_id="hostile-project")
        finally:
            os.umask(old)
        self.assertEqual(other.runtime_root.stat().st_mode & 0o777, 0o700)
        self.assertEqual(other.db_path.stat().st_mode & 0o777, 0o600)

    def test_command_replay_is_idempotent_and_mismatch_rejected(self) -> None:
        first, replayed = self.store.register_task(task_id="TASK-A", command_id="command-A")
        second, replayed_second = self.store.register_task(task_id="TASK-A", command_id="command-A")
        self.assertFalse(replayed)
        self.assertTrue(replayed_second)
        self.assertEqual(first, second)
        with self.assertRaises(IdempotencyConflict):
            self.store.register_task(task_id="TASK-B", command_id="command-A")

    def test_window_bind_once_and_wrong_rebind_is_rejected(self) -> None:
        ids = register_bound_stack(self.store)
        result, replayed = self.store.bind_window(
            task_id=ids["task_id"], run_id=ids["run_id"], window_id=ids["window_id"],
            role="controller", command_id="cmd-window-retry",
        )
        self.assertEqual(result["window_id"], ids["window_id"])
        self.assertFalse(replayed)
        self.store.register_task(task_id="TASK-2", command_id="cmd-task-2")
        self.store.register_run(task_id="TASK-2", run_id="RUN-2", command_id="cmd-run-2")
        with self.assertRaises(BindingConflict):
            self.store.bind_window(
                task_id="TASK-2", run_id="RUN-2", window_id=ids["window_id"],
                role="controller", command_id="cmd-window-wrong",
            )

    def test_integration_lease_has_exactly_one_holder(self) -> None:
        for suffix in ("I1", "I2"):
            self.store.register_task(task_id=f"TASK-{suffix}", command_id=f"task-{suffix}")
            self.store.register_run(task_id=f"TASK-{suffix}", run_id=f"RUN-{suffix}", command_id=f"run-{suffix}")
            self.store.bind_window(
                task_id=f"TASK-{suffix}", run_id=f"RUN-{suffix}", window_id=f"WINDOW-{suffix}",
                role="integration_lead", command_id=f"window-{suffix}",
            )
        first, _ = self.store.acquire_integration_lease(
            window_id="WINDOW-I1", command_id="lease-I1", ttl_seconds=600
        )
        self.assertEqual(first["holder_window_id"], "WINDOW-I1")
        with self.assertRaises(BindingConflict):
            self.store.acquire_integration_lease(
                window_id="WINDOW-I2", command_id="lease-I2", ttl_seconds=600
            )
        self.store.assert_integration_lease(window_id="WINDOW-I1")

    def test_integration_lease_cannot_close_foreign_task(self) -> None:
        for suffix in ("A", "B"):
            self.store.register_task(task_id=f"TASK-{suffix}", command_id=f"task-{suffix}")
            self.store.register_run(
                task_id=f"TASK-{suffix}", run_id=f"RUN-{suffix}", command_id=f"run-{suffix}"
            )
            self.store.bind_window(
                task_id=f"TASK-{suffix}", run_id=f"RUN-{suffix}",
                window_id=f"WINDOW-{suffix}", role="integration_lead",
                command_id=f"window-{suffix}",
            )
        self.store.acquire_integration_lease(
            window_id="WINDOW-A", command_id="lease-A", ttl_seconds=600
        )
        with self.assertRaises(BindingConflict):
            self.store.close_task(
                task_id="TASK-B", integration_window_id="WINDOW-A",
                command_id="close-foreign-task",
            )
        self.assertIn("TASK-B", [row["task_id"] for row in self.store.open_tasks()])

    def test_integration_lease_cannot_close_foreign_run(self) -> None:
        for suffix in ("A", "B"):
            self.store.register_task(task_id=f"TASK-{suffix}", command_id=f"task-{suffix}")
            self.store.register_run(
                task_id=f"TASK-{suffix}", run_id=f"RUN-{suffix}", command_id=f"run-{suffix}"
            )
            self.store.bind_window(
                task_id=f"TASK-{suffix}", run_id=f"RUN-{suffix}",
                window_id=f"WINDOW-{suffix}", role="integration_lead",
                command_id=f"window-{suffix}",
            )
        self.store.acquire_integration_lease(
            window_id="WINDOW-A", command_id="lease-A", ttl_seconds=600
        )
        with self.assertRaises(BindingConflict):
            self.store.close_run(
                task_id="TASK-B", run_id="RUN-B", integration_window_id="WINDOW-A",
                command_id="close-foreign-run",
            )
        self.assertTrue(any(
            row["task_id"] == "TASK-B" and row["run_id"] == "RUN-B"
            for row in self.store.status()["open_runs"]
        ))

    def test_concurrent_wp_claim_has_exactly_one_winner(self) -> None:
        ids = register_bound_stack(self.store)
        with ThreadPoolExecutor(max_workers=32) as pool:
            for round_number in range(50):
                wp_id = f"WP-RACE-{round_number}"
                self.store.register_work_package(
                    task_id=ids["task_id"], run_id=ids["run_id"], window_id=ids["window_id"], wp_id=wp_id,
                    command_id=f"register-race-wp-{round_number}",
                )
                barrier = threading.Barrier(32)

                def contender(index: int) -> str:
                    barrier.wait()
                    try:
                        self.store.claim_work_package(
                            task_id=ids["task_id"], run_id=ids["run_id"],
                            window_id=ids["window_id"], worker_id=ids["worker_id"],
                            wp_id=wp_id, expected_version=1,
                            command_id=f"claim-{round_number}-{index}",
                        )
                        return "winner"
                    except VersionConflict:
                        return "lost"

                outcomes = list(pool.map(contender, range(32)))
                self.assertEqual(outcomes.count("winner"), 1, round_number)
                self.assertEqual(outcomes.count("lost"), 31, round_number)

    def test_claimed_work_can_complete_then_window_release(self) -> None:
        ids = register_bound_stack(self.store, "COMPLETE")
        claimed, _ = self.store.claim_work_package(
            **ids, expected_version=1, command_id="claim-complete"
        )
        self.assertEqual(claimed["version"], 2)
        completed, _ = self.store.complete_work_package(
            **ids, expected_version=2, command_id="complete-work"
        )
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["version"], 3)
        released, _ = self.store.release_window(
            task_id=ids["task_id"], run_id=ids["run_id"],
            window_id=ids["window_id"], command_id="release-complete-window",
        )
        self.assertEqual(released["state"], "closed")

    def test_concurrent_task_create_has_exactly_one_transition(self) -> None:
        barrier = threading.Barrier(24)

        def contender(index: int) -> str:
            barrier.wait()
            try:
                self.store.register_task(task_id="TASK-RACE", command_id=f"task-race-{index}")
                return "winner"
            except BindingConflict:
                return "lost"

        with ThreadPoolExecutor(max_workers=24) as pool:
            outcomes = list(pool.map(contender, range(24)))
        self.assertEqual(outcomes.count("winner"), 1)
        self.assertEqual(outcomes.count("lost"), 23)

    def test_restart_preserves_binding_claim_and_integrity(self) -> None:
        ids = register_bound_stack(self.store)
        self.store.claim_work_package(**ids, expected_version=1, command_id="claim-once")
        restarted = type(self.store)(self.store.identity, self.store.runtime_root)
        binding = restarted.assert_window_binding(
            task_id=ids["task_id"], run_id=ids["run_id"], window_id=ids["window_id"]
        )
        self.assertEqual(binding["window_id"], ids["window_id"])
        self.assertEqual(restarted.status()["integrity"], "ok")

    def test_unsupported_schema_fails_closed(self) -> None:
        with sqlite3.connect(self.store.db_path) as conn:
            conn.execute("UPDATE meta SET value='999' WHERE key='schema_version'")
            conn.commit()
        with self.assertRaises(RegistryUnavailable):
            self.store.status()

    def test_database_busy_timeout_fails_closed_without_partial_task(self) -> None:
        blocker = sqlite3.connect(self.store.db_path, isolation_level=None)
        blocker.execute("BEGIN IMMEDIATE")
        try:
            impatient = type(self.store)(
                self.store.identity, self.store.runtime_root, busy_timeout_ms=25
            )
            with self.assertRaises(RegistryUnavailable):
                impatient.register_task(task_id="TASK-BUSY", command_id="cmd-busy")
        finally:
            blocker.rollback()
            blocker.close()
        self.assertNotIn("TASK-BUSY", [row["task_id"] for row in self.store.open_tasks()])

    def test_corrupt_database_is_reported_and_not_recreated(self) -> None:
        corrupt = make_store(self.base / "corrupt", project_id="corrupt-project")
        corrupt.db_path.write_bytes(b"not-a-sqlite-database")
        before = corrupt.db_path.read_bytes()
        with self.assertRaises(RegistryUnavailable):
            corrupt.initialize()
        self.assertEqual(corrupt.db_path.read_bytes(), before)

    def test_process_death_before_commit_leaves_no_partial_claim(self) -> None:
        ids = register_bound_stack(self.store, "KILL-BEFORE")
        code = (
            "import os,sqlite3;"
            f"c=sqlite3.connect({str(self.store.db_path)!r},isolation_level=None);"
            "c.execute('PRAGMA foreign_keys=ON');c.execute('BEGIN IMMEDIATE');"
            f"c.execute(\"UPDATE work_packages SET status='claimed',version=version+1 WHERE project_id=? AND task_id=? AND run_id=? AND wp_id=?\","
            f"({self.store.identity.project_id!r},{ids['task_id']!r},{ids['run_id']!r},{ids['wp_id']!r}));"
            "os._exit(0)"
        )
        subprocess.run([sys.executable, "-c", code], check=True)
        with sqlite3.connect(self.store.db_path) as conn:
            row = conn.execute(
                "SELECT status,version FROM work_packages WHERE project_id=? AND task_id=? AND run_id=? AND wp_id=?",
                (self.store.identity.project_id, ids["task_id"], ids["run_id"], ids["wp_id"]),
            ).fetchone()
        self.assertEqual(row, ("ready", 1))

    def test_process_death_after_commit_replays_without_duplicate(self) -> None:
        ids = register_bound_stack(self.store, "KILL-AFTER")
        repo_root = Path(__file__).resolve().parents[3]
        code = f"""
import os
from pathlib import Path
from orchestration.identity import ProjectIdentity
from orchestration.store import OrchestrationStore
identity = ProjectIdentity(
    project_id={self.store.identity.project_id!r},
    repo_fingerprint={self.store.identity.repo_fingerprint!r},
    repo_root=Path({str(self.store.identity.repo_root)!r}),
    git_common_dir=Path({str(self.store.identity.git_common_dir)!r}),
    shared_worktree_root=Path({str(self.store.identity.shared_worktree_root)!r}),
    origin="",
)
store = OrchestrationStore(identity, Path({str(self.store.runtime_root)!r}))
store.claim_work_package(
    task_id={ids['task_id']!r}, run_id={ids['run_id']!r},
    window_id={ids['window_id']!r}, worker_id={ids['worker_id']!r},
    wp_id={ids['wp_id']!r}, expected_version=1, command_id="claim-after-commit",
)
os._exit(0)
"""
        environment = os.environ.copy()
        environment["PYTHONPATH"] = str(repo_root / "tools")
        subprocess.run([sys.executable, "-c", code], check=True, env=environment)
        result, replayed = self.store.claim_work_package(
            **ids, expected_version=1, command_id="claim-after-commit"
        )
        self.assertTrue(replayed)
        self.assertEqual(result["version"], 2)
        with sqlite3.connect(self.store.db_path) as conn:
            claims = conn.execute(
                "SELECT COUNT(*) FROM events WHERE event_type='wp_claimed' AND task_id=? AND wp_id=?",
                (ids["task_id"], ids["wp_id"]),
            ).fetchone()[0]
        self.assertEqual(claims, 1)

    def test_registry_schema_excludes_raw_content_columns(self) -> None:
        with sqlite3.connect(self.store.db_path) as conn:
            columns = []
            for table in ("commands", "events", "tasks", "runs", "windows", "workers", "work_packages"):
                columns.extend(row[1].lower() for row in conn.execute(f"PRAGMA table_info({table})"))
        forbidden = {"prompt", "stdout", "stderr", "diff", "environment", "env", "payload"}
        self.assertFalse(forbidden.intersection(columns))
        self.store.register_task(task_id="TASK-NO-TITLE", command_id="task-no-title")
        with sqlite3.connect(self.store.db_path) as conn:
            values = conn.execute("SELECT DISTINCT title_slug FROM tasks").fetchall()
        self.assertEqual(values, [("",)])

    def test_runtime_symlink_is_rejected(self) -> None:
        target = self.base / "target-runtime"
        target.mkdir()
        link = self.base / "linked-runtime"
        link.symlink_to(target, target_is_directory=True)
        unsafe = type(self.store)(self.store.identity, link)
        with self.assertRaises(RegistryUnavailable):
            unsafe.initialize()

    def test_runtime_symlink_ancestor_is_rejected(self) -> None:
        target = self.base / "ancestor-target"
        target.mkdir()
        link = self.base / "ancestor-link"
        link.symlink_to(target, target_is_directory=True)
        unsafe = type(self.store)(self.store.identity, link / "nested-runtime")
        with self.assertRaises(RegistryUnavailable):
            unsafe.initialize()

    def test_observer_cannot_register_writer_or_claim_work(self) -> None:
        self.store.register_task(task_id="TASK-OBS", command_id="task-obs")
        self.store.register_run(task_id="TASK-OBS", run_id="RUN-OBS", command_id="run-obs")
        self.store.bind_window(
            task_id="TASK-OBS", run_id="RUN-OBS", window_id="WINDOW-OBS",
            role="observer", command_id="window-obs",
        )
        with self.assertRaises(BindingConflict):
            self.store.register_worker(
                task_id="TASK-OBS", run_id="RUN-OBS", window_id="WINDOW-OBS",
                worker_id="WORKER-WRITER", role="writer", command_id="worker-writer",
            )
        self.store.register_worker(
            task_id="TASK-OBS", run_id="RUN-OBS", window_id="WINDOW-OBS",
            worker_id="WORKER-OBS", role="observer", command_id="worker-obs",
        )
        self.store.bind_window(
            task_id="TASK-OBS", run_id="RUN-OBS", window_id="WINDOW-CTRL",
            role="controller", command_id="window-ctrl",
        )
        self.store.register_work_package(
            task_id="TASK-OBS", run_id="RUN-OBS", window_id="WINDOW-CTRL",
            wp_id="WP-OBS", command_id="wp-obs",
        )
        with self.assertRaises(BindingConflict):
            self.store.claim_work_package(
                task_id="TASK-OBS", run_id="RUN-OBS", window_id="WINDOW-OBS",
                worker_id="WORKER-OBS", wp_id="WP-OBS", expected_version=1,
                command_id="claim-obs",
            )

    def test_instruction_advance_and_task_close_lifecycle(self) -> None:
        ids = register_bound_stack(self.store, "LIFE")
        self.store.bind_window(
            task_id=ids["task_id"], run_id=ids["run_id"], window_id="WINDOW-INTEGRATION",
            role="integration_lead", command_id="window-integration",
        )
        advanced, _ = self.store.advance_instruction(
            task_id=ids["task_id"], run_id=ids["run_id"], window_id=ids["window_id"],
            expected_version=1, command_id="advance-life",
        )
        self.assertEqual(advanced["instruction_version"], 2)
        self.store.acquire_integration_lease(
            window_id="WINDOW-INTEGRATION", command_id="lease-life", ttl_seconds=600,
        )
        closed, _ = self.store.close_task(
            task_id=ids["task_id"], integration_window_id="WINDOW-INTEGRATION",
            command_id="close-life", status="closed",
        )
        self.assertEqual(closed["status"], "closed")
        self.assertNotIn(ids["task_id"], [row["task_id"] for row in self.store.open_tasks()])
        status = self.store.status()
        self.assertFalse(any(row["task_id"] == ids["task_id"] for row in status["open_runs"]))
        self.assertFalse(any(row["task_id"] == ids["task_id"] for row in status["bound_windows"]))
        with self.assertRaises(BindingConflict):
            self.store.register_run(
                task_id=ids["task_id"], run_id="RUN-RESURRECT",
                command_id="run-resurrect",
            )
        with self.assertRaises(BindingConflict):
            self.store.bind_window(
                task_id=ids["task_id"], run_id=ids["run_id"],
                window_id="WINDOW-RESURRECT", role="controller",
                command_id="window-resurrect",
            )
        with self.assertRaises(BindingConflict):
            self.store.register_work_package(
                task_id=ids["task_id"], run_id=ids["run_id"],
                window_id=ids["window_id"], wp_id="WP-RESURRECT",
                command_id="wp-resurrect",
            )

    def test_status_exposes_recovery_identity(self) -> None:
        ids = register_bound_stack(self.store, "STATUS")
        status = self.store.status()
        run = next(row for row in status["open_runs"] if row["task_id"] == ids["task_id"])
        window = next(row for row in status["bound_windows"] if row["window_id"] == ids["window_id"])
        self.assertEqual(run["run_id"], ids["run_id"])
        self.assertEqual(run["instruction_version"], 1)
        self.assertEqual(window["role"], "controller")


if __name__ == "__main__":
    unittest.main()
