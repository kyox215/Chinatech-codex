"""Typed fail-closed errors for the orchestration control plane."""


class OrchestrationError(RuntimeError):
    """Base class for expected orchestration failures."""


class RegistryUnavailable(OrchestrationError):
    """The registry cannot be opened or verified."""


class IdentityError(OrchestrationError):
    """An identity is missing, malformed, or bound to another resource."""


class BindingConflict(OrchestrationError):
    """A window, task, run, or worker binding conflicts with existing state."""


class VersionConflict(OrchestrationError):
    """A compare-and-swap version is stale or already claimed."""


class IdempotencyConflict(OrchestrationError):
    """A command ID was replayed with different content."""


class ContextConflict(OrchestrationError):
    """An immutable context version already exists with different content."""


class PermissionBoundaryError(OrchestrationError):
    """The requested action exceeds the role or phase boundary."""
