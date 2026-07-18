from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from orchestration.errors import IdentityError
from orchestration.identity import identify_project, resolve_runtime_root, validate_id


class IdentityTests(unittest.TestCase):
    def test_linked_worktrees_resolve_same_registry(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            repo = base / "repo"
            linked = base / "linked"
            subprocess.run(["git", "init", "-b", "main", str(repo)], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.name", "Orchestration Test"], check=True)
            (repo / ".ai-company").mkdir()
            (repo / ".ai-company" / "orchestration.json").write_text(
                json.dumps({"project_id": "stable-project", "runtime_strategy": "git_common_worktree_state"}),
                encoding="utf-8",
            )
            subprocess.run(["git", "-C", str(repo), "add", ".ai-company/orchestration.json"], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-m", "init"], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(repo), "worktree", "add", "-b", "linked-test", str(linked)], check=True, capture_output=True)
            first = identify_project(repo)
            second = identify_project(linked)
            self.assertEqual(first.project_id, "stable-project")
            self.assertEqual(first.git_common_dir, second.git_common_dir)
            self.assertEqual(resolve_runtime_root(first), resolve_runtime_root(second))

    def test_invalid_or_path_traversal_ids_are_rejected_without_echo(self) -> None:
        secret = "../../sk-THIS-MUST-NOT-ECHO"
        with self.assertRaises(IdentityError) as captured:
            validate_id(secret, "task_id")
        self.assertNotIn(secret, str(captured.exception))


if __name__ == "__main__":
    unittest.main()
