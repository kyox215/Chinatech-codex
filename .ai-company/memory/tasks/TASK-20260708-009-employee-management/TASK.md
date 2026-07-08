# TASK-20260708-009-employee-management

## Goal

完善员工注册到设置页员工管理闭环：店主/店长可邀请员工，员工可注册/登录后接受邀请或提交加入申请，店主可在设置中审批、查看、改角色、停用和恢复员工。

## Scope

- Settings employee management UI.
- Store member server APIs for role update, disable, and restore.
- Type/API/schema/router updates.
- Focused tests for permissions, data lifecycle, and UI behavior.
- Visual verification for Settings employee management.

## Out Of Scope

- Production database migration or production deploy unless owner separately approves.
- Owner transfer and removing last owner beyond defensive guardrails.
- Employee performance metrics.
- External email delivery integration.

## Constraints

- Main thread is the single business-code writer.
- Implementation used isolated worktree `/tmp/repairdesk-employee-management` from `origin/main`.
- Preserve unrelated dirty changes in the original worktree.
- Sub-agents were read-only reviewers.
- No secrets or full customer PII in task memory or screenshots.

## Acceptance

- Store owner can view active/inactive members, pending invitations, invite links, and store join requests in Settings.
- Store owner can approve/reject join requests and choose final non-owner role.
- Authorized owner/manager can invite ordinary members according to permission matrix.
- Authorized owner/manager can update ordinary member role, disable, and restore members according to permission matrix.
- Service layer prevents cross-store member changes, manager self-escalation, manager granting manager, disabling/restoring owner improperly, and self-disable/self-role-edit.
- UI handles loading, empty, error, mobile, long email, disabled member, pending invite, and pending request states.
- Focused tests pass and final evidence records actual commands.

## Agent Results

- Product analyst `019f42c0-60b3-7ba2-9204-1390799b9d3f`: confirmed existing invitation/code/request flows and identified missing role update, disable, restore.
- Data reviewer `019f42c0-84ed-7df1-bb8c-d4ee851e107c`: confirmed no schema migration is required for base lifecycle; use `store_memberships.role/status`.
- Security reviewer `019f42c0-a840-7d40-9a20-293b27000069`: required server-side member-list permission, target membership store scoping, manager grant restriction, self-disable protection, and minimized audit.
- UX reviewer `019f42c0-c523-7d20-86f3-e380c8cf2c8c`: required clearer Settings employee management UI, search/filter, status/actions, loading/empty/error states, and mobile-safe layout.
