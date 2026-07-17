# Handoff

Current phase: release validation.

Resume from the isolated worktree and run `git status --short --branch`. Do not use or clean the primary dirty worktree. Implementation, production DB/Auth configuration and local gates are complete. Validate the scoped diff, run the required checkpoint, push the isolated branch commit to `origin/main`, then verify Vercel deployment and production `/auth/confirm` behavior. Do not send a real invitation without an explicitly provided employee test inbox.
