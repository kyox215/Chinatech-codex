from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import ai_company


class CompatibilityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        ai_company.ensure_skeleton(self.root)
        self.active_a = ai_company.render_active(
            "TASK-A", status="active", phase="implementation", title="Task A"
        )
        ai_company.atomic_write_text(
            self.root / ".ai-company" / "memory" / "ACTIVE_CONTEXT.md", self.active_a
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def new_args(self, *, activate: bool = False) -> SimpleNamespace:
        return SimpleNamespace(
            root=str(self.root), title="Task B", task_id="TASK-B", task_class="T1",
            risk="R1", autonomy="L2", owner="Tester", business_value="isolation",
            departments=[], acceptance=["isolated"], allow_parallel=True, activate=activate,
        )

    def test_parallel_new_task_without_activate_preserves_pointer_bytes(self) -> None:
        before = (self.root / ".ai-company" / "memory" / "ACTIVE_CONTEXT.md").read_bytes()
        ai_company.cmd_new_task(self.new_args())
        after = (self.root / ".ai-company" / "memory" / "ACTIVE_CONTEXT.md").read_bytes()
        self.assertEqual(before, after)

    def test_parallel_new_task_with_activate_changes_pointer(self) -> None:
        before = (self.root / ".ai-company" / "memory" / "ACTIVE_CONTEXT.md").read_bytes()
        ai_company.cmd_new_task(self.new_args(activate=True))
        after = (self.root / ".ai-company" / "memory" / "ACTIVE_CONTEXT.md").read_bytes()
        self.assertNotEqual(before, after)
        self.assertIn(b"TASK-B", after)

    def _make_task_b(self) -> None:
        task = self.root / ".ai-company" / "memory" / "tasks" / "TASK-B"
        task.mkdir(parents=True)
        ai_company.atomic_write_text(
            task / "TASK.md",
            ai_company.render_frontmatter(
                {"task_id": "TASK-B", "status": "active", "task_class": "T1", "risk_level": "R1", "autonomy_level": "L2", "owner": "Tester", "title": "Task B"},
                "# Task B\nB_TASK_MARKER\n",
            ),
        )
        for name in ("CHECKPOINTS.md", "EVIDENCE.md", "HANDOFF.md"):
            ai_company.atomic_write_text(task / name, f"# {name}\n")

    def checkpoint_args(self, *, activate: bool = False) -> SimpleNamespace:
        return SimpleNamespace(
            root=str(self.root), task="TASK-B", summary="background progress", next="continue",
            phase="implementation", decision=None, blocker=None, evidence=None,
            actor="Tester", activate=activate,
        )

    def test_background_checkpoint_without_activate_preserves_pointer_bytes(self) -> None:
        self._make_task_b()
        before = (self.root / ".ai-company" / "memory" / "ACTIVE_CONTEXT.md").read_bytes()
        ai_company.cmd_checkpoint(self.checkpoint_args())
        after = (self.root / ".ai-company" / "memory" / "ACTIVE_CONTEXT.md").read_bytes()
        self.assertEqual(before, after)

    def test_background_checkpoint_with_activate_changes_pointer(self) -> None:
        self._make_task_b()
        ai_company.cmd_checkpoint(self.checkpoint_args(activate=True))
        after = (self.root / ".ai-company" / "memory" / "ACTIVE_CONTEXT.md").read_bytes()
        self.assertIn(b"TASK-B", after)

    def test_implicit_task_fails_closed_with_multiple_registry_tasks(self) -> None:
        with patch.object(ai_company, "registered_open_task_ids", return_value=["TASK-A", "TASK-B"]):
            with self.assertRaises(SystemExit):
                ai_company.task_dir_or_die(self.root, None)
            with self.assertRaises(SystemExit):
                ai_company.compile_context(self.root, None)

    def test_implicit_task_fails_closed_with_zero_registry_tasks(self) -> None:
        with patch.object(ai_company, "registered_open_task_ids", return_value=[]):
            with self.assertRaises(SystemExit):
                ai_company.task_dir_or_die(self.root, None)
            with self.assertRaises(SystemExit):
                ai_company.compile_context(self.root, None)

    def test_explicit_task_context_excludes_foreign_active_context(self) -> None:
        self._make_task_b()
        text = ai_company.compile_context(self.root, "TASK-B")
        self.assertIn("B_TASK_MARKER", text)
        self.assertNotIn("Task A", text)
        self.assertNotIn("ACTIVE_CONTEXT.md", text)

    def test_registry_selected_task_context_excludes_foreign_active_context(self) -> None:
        self._make_task_b()
        with patch.object(ai_company, "registered_open_task_ids", return_value=["TASK-B"]):
            text = ai_company.compile_context(self.root, None)
        self.assertIn("B_TASK_MARKER", text)
        self.assertNotIn("Task A", text)
        self.assertNotIn("ACTIVE_CONTEXT.md", text)

    def test_enabled_missing_registry_fails_closed_without_pointer_change(self) -> None:
        ai_company.atomic_write_json(
            self.root / ".ai-company" / "orchestration.json",
            {"enabled": True, "project_id": "missing-registry", "runtime_strategy": "git_common_worktree_state"},
        )
        before = (self.root / ".ai-company" / "memory" / "ACTIVE_CONTEXT.md").read_bytes()
        with self.assertRaises(SystemExit):
            ai_company.task_dir_or_die(self.root, None)
        after = (self.root / ".ai-company" / "memory" / "ACTIVE_CONTEXT.md").read_bytes()
        self.assertEqual(before, after)

    def test_malformed_orchestration_config_cannot_fall_back_to_active_context(self) -> None:
        config = self.root / ".ai-company" / "orchestration.json"
        config.write_text("{ invalid", encoding="utf-8")
        with self.assertRaises(SystemExit):
            ai_company.task_dir_or_die(self.root, None)
        with self.assertRaises(SystemExit):
            ai_company.compile_context(self.root, None)


if __name__ == "__main__":
    unittest.main()
