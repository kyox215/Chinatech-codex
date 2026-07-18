# Plan

1. P0/P1：实现并验证脱敏预检和结构化工单数据访问原因。完成。
2. P2/P3：实现双状态控制面、近期 TOTP、一次性 challenge、CAS/幂等重命名、可逆关闭/归档/恢复、Kiosk/邀请/离线/write-gate，入口默认关闭。完成。
3. P4/P5：实现 DB+Storage export、三类 hash、restore proof、approval-locked purge worker、lease/checkpoint/retry、FK 排序、cycle break、zero proof 和 non-PII tombstone。完成。
4. 完成全量测试、build、隔离 migration/PLpgSQL/事务验证、浏览器截图和 runbook。完成。
5. 停在生产 migration、环境开关、真实 rename/close/restore/export/purge 的审批门前。已遵守。
