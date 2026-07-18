# Agent Packages — Phase 3A

## Architecture / API

- Agent: `/root/phase3a_arch_api`
- Mode: `read_only`
- Independent output: provider/quota/usage architecture, deterministic routing, runtime/cost interfaces, file map, tests and rollback.
- Forbidden: edits, dependencies, secrets, live calls, DB mutation, push/deploy, nested agents.

## Data / Security

- Agent: `/root/phase3a_data_security`
- Mode: `read_only`
- Independent output: durable atomic reservation schema/RPC, RLS/Grants, threat model, retention, migration gates and rollback.
- Forbidden: edits, SQL execution, secrets, live data/provider, push/deploy, nested agents.

## Product / QA / Release

- Agent: `/root/phase3a_product_qa_release`
- Mode: `read_only`
- Independent output: cost-optimized PRD, flows/states, acceptance/evidence matrix, release/observe/rollback and Owner decisions.
- Forbidden: edits, secrets, live calls, DB mutation, push/deploy, nested agents.

## Integration plan

Main thread verifies file evidence, de-duplicates recommendations, resolves conflicts against AGENTS/master plan, records accepted/rejected items, and remains the only writer/final verifier.
