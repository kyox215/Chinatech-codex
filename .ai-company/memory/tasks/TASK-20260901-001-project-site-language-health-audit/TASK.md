---
schema_version: 1
task_id: "TASK-20260901-001-project-site-language-health-audit"
title: "项目与网站优化及语言切换完整性审计"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead"
departments: ["DOC", "INT", "QA", "SEC", "UX"]
created_at: "2026-09-01T01:54:30Z"
updated_at: "2026-09-01T02:12:06Z"
closed_at: "2026-09-01T02:12:06Z"
---
# Task — 项目与网站优化及语言切换完整性审计

## Owner request

项目与网站优化及语言切换完整性审计

## Business value

为老板提供当前项目、生产网站和三语功能的证据化现状、风险优先级及后续优化路线

## Scope in

- Verify the current local branch, commit, worktree state, remote baseline and active production deployment using read-only commands.
- Map the current App Router, feature boundaries, quality gates, known legacy/dead-code debt and documentation drift that materially affect maintainability or delivery speed.
- Re-run the repository i18n literal audit and inspect the typed locale catalog, switcher, Cookie/SSR contract, tests and reachable page adoption.
- Inspect the publicly reachable production website at `https://www.chinatech.in` without credentials, mutations or customer data.
- Classify findings as P0/P1/P2 with evidence, impact, conditions and a recommended owner/order of work.
- Distinguish language infrastructure completeness, current reachable employee-page translation coverage, dynamic-data exclusions and customer/legal language boundaries.

## Scope out

- Business source, tests, dependencies, configuration, environment variables, database, auth, permissions, customer data or production changes.
- Logging into production, reading secrets or PII, submitting forms, creating records, changing locale for another user, or interacting with authenticated business flows.
- Commit, push, pull, branch rewrite, deployment, promotion, rollback, migration or destructive cleanup.
- Implementing any optimization found by the audit; follow-up implementation requires a separately frozen change contract.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Audit mode is read-only except for Registry and Task Memory evidence required by project governance.
- Do not treat every Han-script occurrence as a translation defect; classify reachability, ownership, canonical values and dynamic business data first.
- Public browser checks must use synthetic/no-login states and must not disclose secrets or customer PII in screenshots.

## Acceptance criteria

- [x] 验证当前 Git 与生产部署基线，不依赖上一轮历史结论
- [x] 输出项目和网站 P0/P1/P2 优化清单，每项含证据、影响与建议
- [x] 把语言切换与全站翻译分别判定为已完成、部分完成或未完成
- [x] 复现未翻译候选审计并区分生产可达、旧代码、动态数据与客户语言边界
- [x] 提供公开网站浏览器证据或明确记录认证阻塞
- [x] 不修改业务代码、配置、生产数据，不提交、不推送、不部署

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner wants a current optimization list and language-completeness report | observed | owner request | accepted |
| Previous i18n Release A closed on 2026-08-31 | observed | prior Task Memory and `ACTIVE_CONTEXT.md` | reverify current repository/deployment before reuse |
| Employee locale contract supports `zh-CN`, `it-IT`, `en` | observed | `docs/EMPLOYEE_INTERFACE_I18N.md` | verify implementation and runtime |
| Release A explicitly excluded deep order, customer, inventory, buyback, settings and customer/legal content | observed | i18n declarations | measure current remaining scope |
| Authenticated employee pages may be inaccessible without credentials | assumption | public production boundary | verify public route and record limitation; do not seek secrets |
| Current deployment, repository head and audit counts | verified fact | `EVIDENCE.md` E-002..E-006 | local/remote/production aligned at `8e349b06`; production READY; current audit 5,599 occurrences / 4,088 unique |

## Decision and approval points

- Classified T2 / R2 / L2: broad cross-domain audit with production observation, but no production mutation or implementation authority.
- Current web verification is required because the Owner asked about the live website and deployment/runtime state may change.
- Use four independent read-only views (architecture/debt, UX, QA/i18n, security/release) and retain the Integration Lead as the only final decision owner.
- Stop for any need to authenticate, expose secrets/PII, mutate production, install dependencies, edit business source or deploy.

## Work packages

- INT: current Git/deployment baseline, route/i18n implementation map, live public browser evidence and final integration.
- Architecture/project exploration (read-only): maintainability, legacy/dead code, file-size and documentation/quality debt.
- UX review (read-only): public production experience, locale affordance, responsive/a11y and state coverage.
- QA review (read-only): i18n completeness matrix, audit classification, test evidence and residual gaps.
- Security/release review (read-only): public surface, headers/caching/locale privacy, deployment and operational optimization risks.
- Memory closeout: evidence, prioritized backlog, deferred implementation packets and Registry closure.

## Definition of done

- Acceptance criteria have evidence.
- Every agent finding is accepted, rejected or deferred by the Integration Lead with a reason.
- Public visual evidence exists, or an exact authentication/browser limitation is recorded with substitute evidence.
- The final answer separately states whether switching mechanics are complete and whether full-site translations are complete.
- No business files, Git publication state or production state were changed.

## Closeout verdict

- No P0 defect was proven in the current switching infrastructure or public production smoke.
- Core switching is complete and production-active; full-site employee translation is only partially complete.
- Public `/r` correctly remains fixed Italian. Public Kiosk is not language-complete and currently mixes Italian, English and Chinese fallback/accessibility copy.
- The prioritized optimization and language-completeness report is recorded in `REPORT.md`; reproducible proof is indexed in `EVIDENCE.md`.
