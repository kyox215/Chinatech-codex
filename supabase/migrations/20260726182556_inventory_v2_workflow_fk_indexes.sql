-- Production migration history version: 20260726182556.
set lock_timeout = '5s';

create index if not exists inventory_workflow_command_ledger_item_fk_idx
  on public.inventory_workflow_command_ledger (inventory_item_id, store_id);

create index if not exists inventory_workflow_command_ledger_unit_fk_idx
  on public.inventory_workflow_command_ledger (stock_unit_id, store_id);

create index if not exists inventory_workflow_command_ledger_actor_fk_idx
  on public.inventory_workflow_command_ledger (actor_id);
