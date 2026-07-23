-- RepairDesk cross-device consistency foundation.
--
-- Adds a transaction-scoped store/domain revision sentinel, emits metadata-only
-- private Broadcast notifications for order-domain writes, and fixes private
-- Realtime authorization without exposing tenant membership tables.

set lock_timeout = '5s';

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_receive_repairdesk_realtime_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_topic ~* '^repairdesk:v1:store:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:(orders|customers|inventory|settings)$'
    and exists (
      select 1
      from public.store_memberships membership
      join public.stores store_row on store_row.id = membership.store_id
      where membership.user_id = auth.uid()
        and membership.status::text = 'active'
        and store_row.status::text = 'active'
        and membership.store_id = substring(
          p_topic
          from '^repairdesk:v1:store:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}):[a-z]+$'
        )::uuid
    );
$$;

alter function private.can_receive_repairdesk_realtime_topic(text) owner to postgres;
revoke all on function private.can_receive_repairdesk_realtime_topic(text)
  from public, anon, authenticated;
grant execute on function private.can_receive_repairdesk_realtime_topic(text)
  to authenticated;

alter table realtime.messages enable row level security;
revoke all on table realtime.messages from public, anon;
revoke insert, update, delete on table realtime.messages from authenticated;
grant select on table realtime.messages to authenticated;

drop policy if exists repairdesk_realtime_store_broadcast_receive
  on realtime.messages;

create policy repairdesk_realtime_store_broadcast_receive
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and private.can_receive_repairdesk_realtime_topic((select realtime.topic()))
);

create table if not exists public.repairdesk_store_domain_versions (
  store_id uuid not null
    references public.stores(id) on update cascade on delete cascade,
  domain text not null
    check (domain in ('orders', 'customers', 'inventory', 'settings')),
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  primary key (store_id, domain)
);

alter table public.repairdesk_store_domain_versions enable row level security;
revoke all on table public.repairdesk_store_domain_versions
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.repairdesk_store_domain_versions
  to service_role;

insert into public.repairdesk_store_domain_versions (store_id, domain, version, updated_at)
select distinct repair_order.store_id, 'orders', 1, now()
from public.repair_orders repair_order
where repair_order.store_id is not null
on conflict (store_id, domain) do nothing;

create or replace function private.bump_repairdesk_order_domain_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_mutation text;
  v_event_id uuid := gen_random_uuid();
begin
  if tg_op = 'DELETE' then
    v_store_id := old.store_id;
    v_mutation := 'deleted';
  elsif tg_op = 'INSERT' then
    v_store_id := new.store_id;
    v_mutation := 'created';
  else
    v_store_id := new.store_id;
    v_mutation := 'updated';
  end if;

  if v_store_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  insert into public.repairdesk_store_domain_versions (
    store_id,
    domain,
    version,
    updated_at
  )
  values (v_store_id, 'orders', 1, clock_timestamp())
  on conflict (store_id, domain)
  do update set
    version = public.repairdesk_store_domain_versions.version + 1,
    updated_at = excluded.updated_at;

  begin
    perform realtime.send(
      jsonb_build_object(
        'schemaVersion', 1,
        'eventId', v_event_id::text,
        'emittedAt', clock_timestamp()::text,
        'storeId', v_store_id::text,
        'domain', 'orders',
        'mutation', v_mutation,
        'queryGroups', jsonb_build_array('orders.all', 'customers.all')
      ),
      'repairdesk.realtime',
      'repairdesk:v1:store:' || v_store_id::text || ':orders',
      true
    );
  exception
    when others then
      raise warning 'RepairDesk order invalidation Broadcast failed for store %', v_store_id;
  end;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

alter function private.bump_repairdesk_order_domain_version() owner to postgres;
revoke all on function private.bump_repairdesk_order_domain_version()
  from public, anon, authenticated;

drop trigger if exists repairdesk_realtime_orders_revision on public.repair_orders;
create trigger repairdesk_realtime_orders_revision
after insert or update or delete on public.repair_orders
for each row execute function private.bump_repairdesk_order_domain_version();

drop trigger if exists repairdesk_realtime_order_events_revision on public.order_events;
create trigger repairdesk_realtime_order_events_revision
after insert or update or delete on public.order_events
for each row execute function private.bump_repairdesk_order_domain_version();

drop trigger if exists repairdesk_realtime_message_logs_revision on public.message_logs;
create trigger repairdesk_realtime_message_logs_revision
after insert or update or delete on public.message_logs
for each row execute function private.bump_repairdesk_order_domain_version();

drop trigger if exists repairdesk_realtime_order_attachments_revision on public.order_attachments;
create trigger repairdesk_realtime_order_attachments_revision
after insert or update or delete on public.order_attachments
for each row execute function private.bump_repairdesk_order_domain_version();

drop trigger if exists repairdesk_realtime_order_payment_ledger_revision on public.order_payment_ledger;
create trigger repairdesk_realtime_order_payment_ledger_revision
after insert or update or delete on public.order_payment_ledger
for each row execute function private.bump_repairdesk_order_domain_version();

drop trigger if exists repairdesk_realtime_order_deposit_corrections_revision
  on public.order_initial_deposit_corrections;
create trigger repairdesk_realtime_order_deposit_corrections_revision
after insert or update or delete on public.order_initial_deposit_corrections
for each row execute function private.bump_repairdesk_order_domain_version();

drop trigger if exists repairdesk_realtime_order_terminal_operations_revision
  on public.order_terminal_operations;
create trigger repairdesk_realtime_order_terminal_operations_revision
after insert or update or delete on public.order_terminal_operations
for each row execute function private.bump_repairdesk_order_domain_version();

drop trigger if exists repairdesk_realtime_order_line_costs_revision
  on public.repair_order_line_costs;
create trigger repairdesk_realtime_order_line_costs_revision
after insert or update or delete on public.repair_order_line_costs
for each row execute function private.bump_repairdesk_order_domain_version();

drop trigger if exists repairdesk_realtime_order_cost_revisions_revision
  on public.repair_order_line_cost_revisions;
create trigger repairdesk_realtime_order_cost_revisions_revision
after insert or update or delete on public.repair_order_line_cost_revisions
for each row execute function private.bump_repairdesk_order_domain_version();

drop trigger if exists repairdesk_realtime_order_part_allocations_revision
  on public.order_part_allocations;
create trigger repairdesk_realtime_order_part_allocations_revision
after insert or update or delete on public.order_part_allocations
for each row execute function private.bump_repairdesk_order_domain_version();

drop trigger if exists repairdesk_realtime_order_status_links_revision
  on public.repair_order_customer_status_links;
create trigger repairdesk_realtime_order_status_links_revision
after insert or update or delete on public.repair_order_customer_status_links
for each row execute function private.bump_repairdesk_order_domain_version();

comment on table public.repairdesk_store_domain_versions is
  'Server-only store/domain revision sentinel for lightweight cross-device consistency checks.';

comment on function private.can_receive_repairdesk_realtime_topic(text) is
  'Checks the current authenticated user against an exact private RepairDesk store topic without exposing tenant tables.';

comment on function private.bump_repairdesk_order_domain_version() is
  'Bumps the order-domain revision in the business transaction and emits a metadata-only private invalidation signal.';

select pg_notify('pgrst', 'reload schema');
