---
updated_at: "2026-07-08T11:42:36Z"
---
# TASK-20260708-007 Platform Onboarding Direct Store

Status: verified
Owner: Hexiang Huang
Lead: Integration Lead
Risk: R2
Autonomy: L2

## Goal

Fix the platform approval page failure caused by missing `onboarding_requests.review_scope`, and align store registration so new store creation is self-service instead of requiring platform approval.

## Scope

- Platform onboarding queue read path.
- Legacy pending `create_store` onboarding rows.
- Focused platform onboarding tests and visual evidence.

## Out Of Scope

- Production database migration execution.
- Broad onboarding UI redesign.
- Destructive cleanup of unrelated dirty worktree files.
