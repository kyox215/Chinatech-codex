# Memory Delta

- Order detail dialog width should be controlled through shared `detailWorkspace` primitives, not per-screen 1000px overrides.
- In local mock/E2E mode, onboarding status needs an active mock store to let business pages render their full workspaces.
- For this checkout, prefer `localhost` over `127.0.0.1` for Playwright preview verification until the request-origin guard is adjusted.
