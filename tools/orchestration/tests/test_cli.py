from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path

from orchestration.cli import main


class CliBoundaryTests(unittest.TestCase):
    def test_disabled_configuration_rejects_registry_mutation(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw) / "repo"
            subprocess.run(["git", "init", "-b", "main", str(repo)], check=True, capture_output=True)
            (repo / ".ai-company").mkdir()
            (repo / ".ai-company" / "orchestration.json").write_text(
                json.dumps({
                    "project_id": "disabled-test",
                    "enabled": False,
                    "runtime_strategy": "git_common_worktree_state",
                }),
                encoding="utf-8",
            )
            errors = StringIO()
            with redirect_stderr(errors):
                result = main(["--root", str(repo), "init"])
            self.assertEqual(result, 2)
            self.assertIn("disabled", errors.getvalue())
            self.assertFalse((repo / ".ai-company" / "state" / "orchestration").exists())


if __name__ == "__main__":
    unittest.main()
