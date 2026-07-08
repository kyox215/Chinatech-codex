# Memory Delta — TASK-20260619-232915-l2-029-enforce-real-sub-agent-spawning-for

## Candidate project facts

- Owner-requested AI employee / department execution now requires actual Codex sub-agent spawning when tools are available.
- Department labels in task files are not the same as real AI employee execution; future tasks must record spawned agent ids/roles or a concrete no-spawn reason.
- If sub-agent tooling is unavailable, unsafe, or disproportionate, the final report must state the no-spawn reason and whether department work was simulated, main-thread-only, or deferred.

## Candidate department updates

- Documentation: root rules, department design, multi-agent config, and integration checklist are the authority surfaces for this rule.
- QA: closeout should check actual agent ids/roles or no-spawn reason whenever departments were requested.
- Memory/Integration: task evidence must distinguish real spawned agents from departments considered but not spawned.

## Candidate decisions / ADRs

- Decision: explicit Owner request for departments/AI employees overrides the previous tendency to keep low-risk work single-threaded, unless a documented no-spawn exception applies.

## Candidate lessons and capability evidence

- L2-029 itself used real DOC and QA sub-agents to repair the process gap.
- QA reviewer identified closeout blockers before validation; DOC reviewer identified the missing task-package-template fields. Both were accepted.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
