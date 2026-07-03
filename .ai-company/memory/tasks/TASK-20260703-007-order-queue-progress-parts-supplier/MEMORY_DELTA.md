---
task_id: TASK-20260703-007-order-queue-progress-parts-supplier
updated_at: "2026-07-03T23:22:46+02:00"
---
# Memory Delta

Durable rule candidate: do not overload `repair_orders.supplier_id` for parts purchasing because current order side-status logic treats it as external repair/mail-in supplier. Parts-purchase supplier marking should use independent nullable `parts_supplier_id`, sourced from Settings suppliers, and must not automatically change order workflow or parts status unless explicitly approved.
