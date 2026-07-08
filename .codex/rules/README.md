# Command rules

`default.rules` is a conservative baseline for commands that can mutate remote
systems, production infrastructure, registries, Git history, or databases.

Rules are only one layer. They do not replace:

- the active sandbox and approval policy;
- `.ai-company/policies/DECISION_RIGHTS.md`;
- release, data-migration, security, or incident runbooks;
- operator verification of the actual target environment.

After installing Codex, test important entries with:

```bash
codex execpolicy check --pretty \
  --rules .codex/rules/default.rules \
  -- git push origin main
```

Review this file for your stack before trusting the project configuration.
