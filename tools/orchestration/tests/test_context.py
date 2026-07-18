from __future__ import annotations

import hashlib
import json
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from orchestration.context import issue_context_packet, read_context_packet
from orchestration.errors import ContextConflict, VersionConflict

from helpers import make_store, register_bound_stack


class ContextTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name).resolve()
        self.store = make_store(self.base)
        self.ids = register_bound_stack(self.store, "A")
        memory = self.store.identity.repo_root / ".ai-company" / "memory"
        task_a = memory / "tasks" / self.ids["task_id"]
        task_a.mkdir(parents=True)
        (task_a / "TASK.md").write_text(
            f'---\ntask_id: "{self.ids["task_id"]}"\n---\n# Task A\nA_ONLY\n',
            encoding="utf-8",
        )
        (task_a / "CHECKPOINTS.md").write_text("# Checkpoints\nA_SAFE\n", encoding="utf-8")
        (task_a / "HANDOFF.md").write_text("# Handoff\nA_NEXT\n", encoding="utf-8")
        task_b = memory / "tasks" / "TASK-B"
        task_b.mkdir(parents=True)
        (task_b / "TASK.md").write_text("B_ONLY_MARKER\n", encoding="utf-8")
        (memory / "ACTIVE_CONTEXT.md").write_text("B_ACTIVE_MARKER\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def issue(self):
        return issue_context_packet(self.store, **{
            key: self.ids[key] for key in ("task_id", "run_id", "window_id")
        }, instruction_version=1)

    def test_packet_hash_matches_bytes_is_stable_and_excludes_foreign_task(self) -> None:
        first = self.issue()
        first_bytes = first.path.read_bytes()
        second = self.issue()
        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(first_bytes, second.path.read_bytes())
        self.assertEqual(first.file_sha256, hashlib.sha256(first_bytes).hexdigest())
        text = first_bytes.decode("utf-8")
        self.assertIn("A_ONLY", text)
        self.assertNotIn("B_ONLY_MARKER", text)
        self.assertNotIn("B_ACTIVE_MARKER", text)
        self.assertNotIn("ACTIVE_CONTEXT.md", text)

    def test_same_version_changed_content_is_rejected(self) -> None:
        self.issue()
        task = self.store.identity.repo_root / ".ai-company" / "memory" / "tasks" / self.ids["task_id"] / "TASK.md"
        task.write_text("# Task A\nCHANGED\n", encoding="utf-8")
        with self.assertRaises(ContextConflict):
            self.issue()

    def test_tampering_is_detected_by_read_and_doctor(self) -> None:
        packet = self.issue()
        packet.path.write_bytes(packet.path.read_bytes() + b"tamper")
        with self.assertRaises(ContextConflict):
            read_context_packet(
                self.store,
                task_id=self.ids["task_id"], run_id=self.ids["run_id"],
                window_id=self.ids["window_id"], instruction_version=1,
            )
        self.assertFalse(self.store.doctor()["ok"])
        record = self.store.context_record(
            task_id=self.ids["task_id"], run_id=self.ids["run_id"],
            window_id=self.ids["window_id"], instruction_version=1,
        )
        self.assertEqual(record["state"], "quarantined")

    def test_secret_and_pii_canaries_are_absent_and_permissions_are_secure(self) -> None:
        task = self.store.identity.repo_root / ".ai-company" / "memory" / "tasks" / self.ids["task_id"] / "TASK.md"
        task.write_text(
            f'---\ntask_id: "{self.ids["task_id"]}"\n---\n'
            "sk-ABCDEFGHIJKLMNOPQRST ghp_ABCDEFGHIJKLMNOPQRSTUVWX "
            "AKIAABCDEFGHIJKLMNOP password=\"do-not-leak-this\" "
            "email=person@example.com phone=+39 333 123 4567 imei=123456789012345\n",
            encoding="utf-8",
        )
        packet = self.issue()
        raw = packet.path.read_bytes()
        for canary in (
            b"sk-ABCDEFGHIJKLMNOPQRST", b"ghp_ABCDEFGHIJKLMNOPQRSTUVWX",
            b"AKIAABCDEFGHIJKLMNOP", b"do-not-leak-this",
            b"person@example.com", b"333 123 4567", b"123456789012345",
        ):
            self.assertNotIn(canary, raw)
            self.assertNotIn(canary, self.store.db_path.read_bytes())
        self.assertEqual(packet.path.stat().st_mode & 0o777, 0o600)
        json.loads(raw)

    def test_pending_packet_without_file_is_recovered(self) -> None:
        from orchestration.context import build_packet_bytes

        encoded = build_packet_bytes(
            self.store, task_id=self.ids["task_id"], run_id=self.ids["run_id"],
            window_id=self.ids["window_id"], instruction_version=1,
        )
        digest = hashlib.sha256(encoded).hexdigest()
        relative = f"contexts/{self.ids['task_id']}/{self.ids['run_id']}/{self.ids['window_id']}/v000001-{digest}.json"
        self.store.reserve_context_packet(
            task_id=self.ids["task_id"], run_id=self.ids["run_id"],
            window_id=self.ids["window_id"], instruction_version=1,
            file_sha256=digest, relative_path=relative,
        )
        self.assertFalse(self.store.doctor()["ok"])
        packet = self.issue()
        self.assertTrue(packet.path.is_file())
        self.assertTrue(self.store.doctor()["ok"])

    def test_concurrent_packet_creation_has_one_file_creator(self) -> None:
        barrier = threading.Barrier(16)

        def contender(_: int) -> bool:
            barrier.wait()
            return self.issue().created

        with ThreadPoolExecutor(max_workers=16) as pool:
            results = list(pool.map(contender, range(16)))
        self.assertEqual(results.count(True), 1)
        self.assertEqual(results.count(False), 15)

    def test_context_requires_regular_nonempty_task_contract_and_checkpoint(self) -> None:
        task_dir = self.store.identity.repo_root / ".ai-company" / "memory" / "tasks" / self.ids["task_id"]
        task = task_dir / "TASK.md"
        task.unlink()
        with self.assertRaises(ContextConflict):
            self.issue()
        task.write_text("", encoding="utf-8")
        with self.assertRaises(ContextConflict):
            self.issue()
        task.write_text('---\ntask_id: "TASK-WRONG"\n---\nwrong\n', encoding="utf-8")
        with self.assertRaises(ContextConflict):
            self.issue()
        task.write_text(f'---\ntask_id: "{self.ids["task_id"]}"\n---\n' + "x" * 29_000, encoding="utf-8")
        with self.assertRaises(ContextConflict):
            self.issue()
        task.write_text(f'---\ntask_id: "{self.ids["task_id"]}"\n---\nvalid\n', encoding="utf-8")
        checkpoint = task_dir / "CHECKPOINTS.md"
        checkpoint.write_text("", encoding="utf-8")
        with self.assertRaises(ContextConflict):
            self.issue()
        checkpoint.write_text("valid checkpoint\n", encoding="utf-8")
        task.unlink()
        task.symlink_to(task_dir / "HANDOFF.md")
        with self.assertRaises(ContextConflict):
            self.issue()

    def test_pending_packet_with_wrong_file_is_quarantined(self) -> None:
        from orchestration.context import build_packet_bytes

        encoded = build_packet_bytes(
            self.store, task_id=self.ids["task_id"], run_id=self.ids["run_id"],
            window_id=self.ids["window_id"], instruction_version=1,
        )
        digest = hashlib.sha256(encoded).hexdigest()
        relative = Path("contexts") / self.ids["task_id"] / self.ids["run_id"] / self.ids["window_id"] / f"v000001-{digest}.json"
        self.store.reserve_context_packet(
            task_id=self.ids["task_id"], run_id=self.ids["run_id"],
            window_id=self.ids["window_id"], instruction_version=1,
            file_sha256=digest, relative_path=str(relative),
        )
        path = self.store.project_dir / relative
        path.parent.mkdir(parents=True)
        path.write_bytes(b"partial-or-wrong")
        with self.assertRaises(ContextConflict):
            self.issue()
        record = self.store.context_record(
            task_id=self.ids["task_id"], run_id=self.ids["run_id"],
            window_id=self.ids["window_id"], instruction_version=1,
        )
        self.assertEqual(record["state"], "quarantined")

    def test_doctor_detects_unregistered_packet_orphan(self) -> None:
        orphan = self.store.context_dir / "orphan.json"
        orphan.write_text("{}", encoding="utf-8")
        self.assertFalse(self.store.doctor()["ok"])

    def test_doctor_detects_crash_temp_artifact(self) -> None:
        orphan = self.store.context_dir / ".packet.pending.tmp"
        orphan.write_text("partial", encoding="utf-8")
        self.assertFalse(self.store.doctor()["ok"])

    def test_old_packet_is_rejected_after_instruction_advance(self) -> None:
        self.issue()
        self.store.advance_instruction(
            task_id=self.ids["task_id"], run_id=self.ids["run_id"],
            window_id=self.ids["window_id"], expected_version=1,
            command_id="advance-context-v2",
        )
        with self.assertRaises(VersionConflict):
            read_context_packet(
                self.store,
                task_id=self.ids["task_id"], run_id=self.ids["run_id"],
                window_id=self.ids["window_id"], instruction_version=1,
            )


if __name__ == "__main__":
    unittest.main()
