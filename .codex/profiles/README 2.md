# Codex permission profile examples

These snippets are **examples**, not auto-loaded project configuration. Copy the
selected profile into your own Codex config or choose equivalent permissions in
the Codex UI.

- `standard.toml`: normal repository work; asks before escalation.
- `audit-readonly.toml`: codebase inspection and governance audits.
- `high-risk-plan.toml`: plan-only posture for production, security, finance, or destructive work.

Project policy always applies in addition to the active Codex sandbox and
approval settings. A profile never grants business approval.
