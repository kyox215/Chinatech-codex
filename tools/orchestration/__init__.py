"""RepairDesk cross-session orchestration core.

Phase 0A provides project identity, a shared SQLite registry, explicit window
bindings, immutable context packets, and fail-closed compatibility helpers.
It deliberately does not create worktrees, integrate branches, push, deploy,
or mutate production systems.
"""

from .errors import (
    BindingConflict,
    ContextConflict,
    IdentityError,
    IdempotencyConflict,
    OrchestrationError,
    PermissionBoundaryError,
    RegistryUnavailable,
    VersionConflict,
)
from .identity import ProjectIdentity, identify_project, resolve_runtime_root
from .store import OrchestrationStore

__all__ = [
    "BindingConflict",
    "ContextConflict",
    "IdentityError",
    "IdempotencyConflict",
    "OrchestrationError",
    "OrchestrationStore",
    "ProjectIdentity",
    "PermissionBoundaryError",
    "RegistryUnavailable",
    "VersionConflict",
    "identify_project",
    "resolve_runtime_root",
]

__version__ = "0.1.0"
