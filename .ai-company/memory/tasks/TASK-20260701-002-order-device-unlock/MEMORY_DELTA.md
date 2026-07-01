# Memory Delta

- Order unlock secrets are privacy-sensitive. Keep plaintext/password/PIN/pattern values out of logs, audit payloads, list APIs, exports, print views, WhatsApp/SMS templates, and task memory.
- Use `normalizeDeviceUnlockInput()` for create/update/patch and tests instead of duplicating validation.
- When adding list fields to `repair_orders`, keep legacy select fallback free of optional columns so unmigrated schemas still load.
