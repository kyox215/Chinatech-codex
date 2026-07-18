"""Machine-readable command line adapter for Phase 0A orchestration."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .context import issue_context_packet, read_context_packet
from .errors import OrchestrationError, PermissionBoundaryError
from .identity import identify_project, load_project_config, resolve_runtime_root
from .store import OrchestrationStore


def _store(args: argparse.Namespace, *, mutation: bool = False) -> OrchestrationStore:
    root = Path(args.root or Path.cwd()).resolve()
    identity = identify_project(root)
    config = load_project_config(identity.repo_root)
    if mutation and config.get("enabled") is not True:
        raise PermissionBoundaryError("cross-session orchestration is disabled")
    runtime = resolve_runtime_root(identity)
    return OrchestrationStore(identity, runtime)


def _print(value: object) -> None:
    print(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2))


def cmd_init(args: argparse.Namespace) -> int:
    _print(_store(args, mutation=True).initialize())
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    _print(_store(args).status())
    return 0


def cmd_doctor(args: argparse.Namespace) -> int:
    result = _store(args).doctor()
    _print(result)
    return 0 if result["ok"] else 2


def cmd_task_register(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).register_task(
        task_id=args.task_id,
        command_id=args.command_id,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_run_register(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).register_run(
        task_id=args.task_id,
        run_id=args.run_id,
        command_id=args.command_id,
        instruction_version=args.instruction_version,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_window_bind(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).bind_window(
        task_id=args.task_id,
        run_id=args.run_id,
        window_id=args.window_id,
        role=args.role,
        command_id=args.command_id,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_worker_register(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).register_worker(
        task_id=args.task_id,
        run_id=args.run_id,
        window_id=args.window_id,
        worker_id=args.worker_id,
        role=args.role,
        command_id=args.command_id,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_wp_register(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).register_work_package(
        task_id=args.task_id,
        run_id=args.run_id,
        window_id=args.window_id,
        wp_id=args.wp_id,
        command_id=args.command_id,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_wp_claim(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).claim_work_package(
        task_id=args.task_id,
        run_id=args.run_id,
        window_id=args.window_id,
        worker_id=args.worker_id,
        wp_id=args.wp_id,
        expected_version=args.expected_version,
        command_id=args.command_id,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_wp_complete(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).complete_work_package(
        task_id=args.task_id,
        run_id=args.run_id,
        window_id=args.window_id,
        worker_id=args.worker_id,
        wp_id=args.wp_id,
        expected_version=args.expected_version,
        command_id=args.command_id,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_context_issue(args: argparse.Namespace) -> int:
    packet = issue_context_packet(
        _store(args, mutation=True),
        task_id=args.task_id,
        run_id=args.run_id,
        window_id=args.window_id,
        instruction_version=args.instruction_version,
        max_packet_bytes=args.max_bytes,
    )
    _print(
        {
            "path": str(packet.path),
            "file_sha256": packet.file_sha256,
            "instruction_version": packet.instruction_version,
            "created": packet.created,
        }
    )
    return 0


def cmd_context_read(args: argparse.Namespace) -> int:
    encoded = read_context_packet(
        _store(args),
        task_id=args.task_id,
        run_id=args.run_id,
        window_id=args.window_id,
        instruction_version=args.instruction_version,
    )
    sys.stdout.buffer.write(encoded)
    return 0


def cmd_lease_acquire(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).acquire_integration_lease(
        window_id=args.window_id,
        command_id=args.command_id,
        ttl_seconds=args.ttl_seconds,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_lease_release(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).release_integration_lease(
        window_id=args.window_id,
        expected_version=args.expected_version,
        command_id=args.command_id,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_instruction_advance(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).advance_instruction(
        task_id=args.task_id, run_id=args.run_id, window_id=args.window_id,
        expected_version=args.expected_version, command_id=args.command_id,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_task_close(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).close_task(
        task_id=args.task_id, integration_window_id=args.window_id,
        command_id=args.command_id, status=args.status,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_run_close(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).close_run(
        task_id=args.task_id, run_id=args.run_id,
        integration_window_id=args.window_id, command_id=args.command_id,
        status=args.status,
    )
    _print(result | {"replayed": replayed})
    return 0


def cmd_window_release(args: argparse.Namespace) -> int:
    result, replayed = _store(args, mutation=True).release_window(
        task_id=args.task_id, run_id=args.run_id, window_id=args.window_id,
        command_id=args.command_id,
    )
    _print(result | {"replayed": replayed})
    return 0


def build_parser(default_root: str | None = None) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="RepairDesk cross-session orchestration")
    parser.add_argument("--root", default=default_root)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("init")
    p.set_defaults(func=cmd_init)
    p = sub.add_parser("status")
    p.set_defaults(func=cmd_status)
    p = sub.add_parser("doctor")
    p.set_defaults(func=cmd_doctor)

    p = sub.add_parser("lease-acquire")
    p.add_argument("--window-id", required=True)
    p.add_argument("--command-id", required=True)
    p.add_argument("--ttl-seconds", type=int, default=900)
    p.set_defaults(func=cmd_lease_acquire)

    p = sub.add_parser("lease-release")
    p.add_argument("--window-id", required=True)
    p.add_argument("--expected-version", type=int, required=True)
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_lease_release)

    p = sub.add_parser("task-register")
    p.add_argument("--task-id", required=True)
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_task_register)

    p = sub.add_parser("task-close")
    p.add_argument("--task-id", required=True)
    p.add_argument("--window-id", required=True)
    p.add_argument("--status", choices=("closed", "cancelled"), default="closed")
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_task_close)

    p = sub.add_parser("run-register")
    p.add_argument("--task-id", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--command-id", required=True)
    p.add_argument("--instruction-version", type=int, default=1)
    p.set_defaults(func=cmd_run_register)

    p = sub.add_parser("run-close")
    p.add_argument("--task-id", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--window-id", required=True)
    p.add_argument("--status", choices=("closed", "cancelled"), default="closed")
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_run_close)

    p = sub.add_parser("window-bind")
    p.add_argument("--task-id", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--window-id", required=True)
    p.add_argument("--role", choices=("intake", "controller", "writer", "reviewer", "observer", "integration_lead"), required=True)
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_window_bind)

    p = sub.add_parser("window-release")
    p.add_argument("--task-id", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--window-id", required=True)
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_window_release)

    p = sub.add_parser("instruction-advance")
    p.add_argument("--task-id", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--window-id", required=True)
    p.add_argument("--expected-version", type=int, required=True)
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_instruction_advance)

    p = sub.add_parser("worker-register")
    p.add_argument("--task-id", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--window-id", required=True)
    p.add_argument("--worker-id", required=True)
    p.add_argument("--role", choices=("controller", "writer", "reviewer", "observer"), required=True)
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_worker_register)

    p = sub.add_parser("wp-register")
    p.add_argument("--task-id", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--window-id", required=True)
    p.add_argument("--wp-id", required=True)
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_wp_register)

    p = sub.add_parser("wp-claim")
    p.add_argument("--task-id", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--window-id", required=True)
    p.add_argument("--worker-id", required=True)
    p.add_argument("--wp-id", required=True)
    p.add_argument("--expected-version", type=int, required=True)
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_wp_claim)

    p = sub.add_parser("wp-complete")
    p.add_argument("--task-id", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--window-id", required=True)
    p.add_argument("--worker-id", required=True)
    p.add_argument("--wp-id", required=True)
    p.add_argument("--expected-version", type=int, required=True)
    p.add_argument("--command-id", required=True)
    p.set_defaults(func=cmd_wp_complete)

    for name, func in (("context-issue", cmd_context_issue), ("context-read", cmd_context_read)):
        p = sub.add_parser(name)
        p.add_argument("--task-id", required=True)
        p.add_argument("--run-id", required=True)
        p.add_argument("--window-id", required=True)
        p.add_argument("--instruction-version", type=int, default=1)
        if name == "context-issue":
            p.add_argument("--max-bytes", type=int, default=96_000)
        p.set_defaults(func=func)
    return parser


def main(argv: list[str] | None = None, *, default_root: str | None = None) -> int:
    args = build_parser(default_root).parse_args(argv)
    try:
        return int(args.func(args))
    except OrchestrationError as exc:
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
