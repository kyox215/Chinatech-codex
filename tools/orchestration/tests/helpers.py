from __future__ import annotations

import json
from pathlib import Path

from orchestration.identity import ProjectIdentity
from orchestration.store import OrchestrationStore


def make_store(base: Path, *, project_id: str = "repairdesk-test") -> OrchestrationStore:
    repo = base / "repo"
    common = repo / ".git"
    common.mkdir(parents=True, exist_ok=True)
    config_dir = repo / ".ai-company"
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / "orchestration.json").write_text(
        json.dumps({"project_id": project_id, "runtime_strategy": "git_common_worktree_state"}),
        encoding="utf-8",
    )
    identity = ProjectIdentity(
        project_id=project_id,
        repo_fingerprint="f" * 64,
        repo_root=repo,
        git_common_dir=common,
        shared_worktree_root=repo,
        origin="",
    )
    store = OrchestrationStore(identity, base / "runtime")
    store.initialize()
    return store


def register_bound_stack(store: OrchestrationStore, suffix: str = "1") -> dict[str, str]:
    ids = {
        "task_id": f"TASK-{suffix}",
        "run_id": f"RUN-{suffix}",
        "window_id": f"WINDOW-{suffix}",
        "worker_id": f"WORKER-{suffix}",
        "wp_id": f"WP-{suffix}",
    }
    store.register_task(task_id=ids["task_id"], command_id=f"cmd-task-{suffix}")
    store.register_run(task_id=ids["task_id"], run_id=ids["run_id"], command_id=f"cmd-run-{suffix}")
    store.bind_window(
        task_id=ids["task_id"], run_id=ids["run_id"], window_id=ids["window_id"],
        role="controller", command_id=f"cmd-window-{suffix}",
    )
    store.register_worker(
        task_id=ids["task_id"], run_id=ids["run_id"], window_id=ids["window_id"],
        worker_id=ids["worker_id"], role="controller", command_id=f"cmd-worker-{suffix}",
    )
    store.register_work_package(
        task_id=ids["task_id"], run_id=ids["run_id"], window_id=ids["window_id"], wp_id=ids["wp_id"],
        command_id=f"cmd-wp-{suffix}",
    )
    return ids
