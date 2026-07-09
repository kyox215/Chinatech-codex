---
schema_version: 1
task_id: "TASK-20260709-018-order-load-customer-relationship"
updated_at: "2026-07-09T15:18:30Z"
---
# Memory Delta

## Reusable Lesson

When a Supabase/PostgREST query embeds `customers` from `repair_orders`, use the explicit same-store relationship:

```txt
customer:customers!repair_orders_customer_same_store_fkey(...)
```

Do not use:

```txt
customer:customers(...)
```

Reason: production can contain both `repair_orders_customer_id_fkey1` and `repair_orders_customer_same_store_fkey`, which makes the unqualified embed ambiguous and breaks `/orders`.

## Long-Term Follow-Up

- Consider a repository-wide lint/test helper for ambiguous PostgREST embeds when multi-store same-store FKs exist.
- Supabase migration history remains divergent; do not run broad `supabase db push` as part of this incident fix.
