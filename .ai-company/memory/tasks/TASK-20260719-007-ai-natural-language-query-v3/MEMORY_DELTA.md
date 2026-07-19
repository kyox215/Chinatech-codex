# Memory Delta — TASK-20260719-007

Validated durable rules:

- Model-generated order filters are proposals only; every restrictive field must be independently validated against the user utterance before repository execution.
- A date expression that is invalid, reversed or structurally ambiguous must return clarification and must never degrade to a broader device-only query.
- Archive/all-history requests require explicit archive permission and fail closed; they must not silently fall back to active orders.
- Query UIs should show exact applied scope, dates and source (`user` / `system` / `server`) while keeping usage and scope details collapsible.
- “更换过屏幕” can only be described as quote/service evidence with the current data model; it is not proof that the repair was completed.
