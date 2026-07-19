# Architecture Decision — Trust boundary for model-planned order filters

## Status

Accepted for implementation, pending verification.

## Context

The provider returns a strict structured tool call, but strict structure does not prove semantic fidelity to the user request. Explicit model mode currently bypasses the deterministic device parser, and the service accepts a valid search call whose device/search filters may be empty or unrelated.

## Decision

- Treat the provider plan as a proposal, not an authorization to broaden scope.
- Derive a bounded trusted device constraint from the original message using the shared order entity rule.
- Reconcile the provider call at the service boundary before repository access.
- Preserve provider-selected non-device structured filters when compatible.
- Execute only the existing tenant-bound repository functions.
- Validate returned device labels against the effective trusted constraint and fail closed on an invariant violation.
- Record the model as used and charged even if its proposed device filter is corrected.

## Consequences

- Device relevance becomes deterministic for supported brands/models in local and model modes.
- The parser vocabulary remains deliberately bounded; unsupported brands can still rely on the model but do not gain the same hard guard until explicitly added.
- No database, public API or client contract change is required.
- Tests must distinguish provider invocation from effective repository filters.

## Alternatives rejected

- Prompt/schema description only: format conformance cannot guarantee semantic correctness.
- Run local deterministic plan instead of provider in model mode: violates the user's explicit processing choice and usage semantics.
- Filter only rendered cards: can produce incorrect totals and miss matching rows outside the fetched page.
- Generic full-text search for model numbers: admits unrelated order/customer/identifier matches.
