-- Prepared forward rollback template for the 2026-07-23 all-store Realtime release.
--
-- Do not run routinely and do not add this file to migration history unchanged.
-- If rollback is approved, create a NEW timestamped migration with `supabase migration new`,
-- copy the reviewed statements below, run linked dry-run, and apply that forward migration.
-- Keep private-channel RLS hardening and the domain-version table in place.

set lock_timeout = '5s';

drop trigger if exists repairdesk_realtime_orders_revision on public.repair_orders;
drop trigger if exists repairdesk_realtime_order_events_revision on public.order_events;
drop trigger if exists repairdesk_realtime_message_logs_revision on public.message_logs;
drop trigger if exists repairdesk_realtime_order_attachments_revision on public.order_attachments;
drop trigger if exists repairdesk_realtime_order_payment_ledger_revision
  on public.order_payment_ledger;
drop trigger if exists repairdesk_realtime_order_deposit_corrections_revision
  on public.order_initial_deposit_corrections;
drop trigger if exists repairdesk_realtime_order_terminal_operations_revision
  on public.order_terminal_operations;
drop trigger if exists repairdesk_realtime_order_line_costs_revision
  on public.repair_order_line_costs;
drop trigger if exists repairdesk_realtime_order_cost_revisions_revision
  on public.repair_order_line_cost_revisions;
drop trigger if exists repairdesk_realtime_order_part_allocations_revision
  on public.order_part_allocations;
drop trigger if exists repairdesk_realtime_order_status_links_revision
  on public.repair_order_customer_status_links;

-- App rollback must also set these Vercel production flags to 0 and redeploy:
-- NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED
-- REPAIRDESK_REALTIME_BROADCAST_ENABLED
-- NEXT_PUBLIC_REPAIRDESK_REVISION_CHECK_ENABLED
