# Checkpoints

## 2026-06-30 Verified

- Added order-local display primitives for section headers, money strips, quote rows, and empty blocks.
- New-order sections now use `客户信息`, `设备信息`, `故障与诊断`, and `报价处理`.
- New-order and detail money summaries use `总额 / 定金 / 尾款`.
- Order detail finance and action dock reuse the same money strip and quote display row primitives.
- Mobile order detail payment summary uses the same money strip while preserving existing paid/payment status lines.
- E2E assertions now verify the shared money strip and aligned new-order headings.
- 3012 preview was refreshed to the verified local build.
