create table if not exists public.order_initial_deposit_corrections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  order_id uuid not null,
  idempotency_key uuid not null,
  actor_id uuid references auth.users(id) on update cascade on delete set null,
  actor_name_snapshot text not null,
  actor_role_snapshot text not null,
  reason text not null,
  deposit_before numeric(12, 2) not null,
  deposit_after numeric(12, 2) not null,
  balance_before numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  order_updated_at_before timestamptz not null,
  order_updated_at_after timestamptz not null,
  created_at timestamptz not null default now(),
  constraint order_initial_deposit_corrections_order_store_fkey
    foreign key (order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict,
  constraint order_initial_deposit_corrections_idempotency_unique unique (store_id, idempotency_key),
  constraint order_initial_deposit_corrections_amount_check check (
    deposit_before >= 0 and deposit_after >= 0 and
    deposit_before = round(deposit_before, 2) and deposit_after = round(deposit_after, 2) and
    balance_before >= 0 and balance_after >= 0 and
    balance_before = round(balance_before, 2) and balance_after = round(balance_after, 2)
  ),
  constraint order_initial_deposit_corrections_reason_check
    check (char_length(btrim(reason)) between 5 and 240)
);

create index if not exists order_initial_deposit_corrections_order_created_idx
  on public.order_initial_deposit_corrections (store_id, order_id, created_at desc);

alter table public.order_initial_deposit_corrections enable row level security;
revoke all on table public.order_initial_deposit_corrections from public, anon, authenticated, service_role;
grant select, insert on table public.order_initial_deposit_corrections to service_role;

create or replace function public.repairdesk_correct_initial_deposit(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_deposit_amount numeric,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_email text;
  v_actor_name text;
  v_actor_role text;
  v_actor_membership_id uuid;
  v_existing public.order_initial_deposit_corrections%rowtype;
  v_order public.repair_orders%rowtype;
  v_workflow_bucket text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_correction_id uuid := gen_random_uuid();
  v_balance_after numeric(12, 2);
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_order_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_actor_id is null then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;
  if p_idempotency_key is null then return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key'); end if;
  if p_expected_updated_at is null then return jsonb_build_object('ok', false, 'code', 'missing_expected_version'); end if;
  if p_deposit_amount is null or p_deposit_amount < 0 or p_deposit_amount <> round(p_deposit_amount, 2) then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 240 then
    return jsonb_build_object('ok', false, 'code', 'invalid_reason');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );

  select profile.email, coalesce(membership.display_name, profile.display_name),
         membership.role::text, membership.id
    into v_actor_email, v_actor_name, v_actor_role, v_actor_membership_id
    from public.staff_profiles as profile
    join public.store_memberships as membership
      on membership.user_id = profile.id
     and membership.store_id = p_store_id
     and membership.status::text = 'active'
    join public.stores as store_row
      on store_row.id = membership.store_id and store_row.status::text = 'active'
   where profile.id = p_actor_id and profile.status::text = 'active'
   limit 1;

  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'sales', 'technician') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  select correction.* into v_existing
    from public.order_initial_deposit_corrections as correction
   where correction.store_id = p_store_id and correction.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.order_id <> p_order_id
       or v_existing.actor_id is distinct from p_actor_id
       or v_existing.deposit_after <> p_deposit_amount
       or v_existing.reason <> v_reason
       or v_existing.order_updated_at_before <> p_expected_updated_at then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true, 'code', 'idempotent_replay', 'correction_id', v_existing.id,
      'deposit_amount', v_existing.deposit_after, 'balance', v_existing.balance_after,
      'is_paid', v_existing.balance_after = 0, 'updated_at', v_existing.order_updated_at_after
    );
  end if;

  select order_row.* into v_order
    from public.repair_orders as order_row
   where order_row.store_id = p_store_id and order_row.id = p_order_id
   for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'order_not_found'); end if;
  if v_actor_role = 'technician' and v_order.assignee_membership_id is distinct from v_actor_membership_id then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if v_order.record_state::text <> 'active' or v_order.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'order_voided');
  end if;

  select status_row.bucket::text into v_workflow_bucket
    from public.order_workflow_statuses as status_row
   where status_row.store_id = p_store_id and status_row.code::text = v_order.status::text
   limit 1;
  if lower(coalesce(v_order.status::text, '')) in ('completed', 'cancelled')
     or lower(coalesce(v_order.exception_status::text, '')) = 'cancelled'
     or v_workflow_bucket in ('done', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'order_terminal');
  end if;
  if v_order.updated_at <> p_expected_updated_at then return jsonb_build_object('ok', false, 'code', 'stale_version'); end if;
  if p_deposit_amount > v_order.quotation_amount then return jsonb_build_object('ok', false, 'code', 'deposit_exceeds_quote'); end if;
  if v_order.approval_status::text in ('approved', 'rejected')
     or v_order.approval_flow_status::text = 'waiting_customer'
     or v_order.approval_sent_at is not null
     or v_order.approval_confirmed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'approval_already_touched');
  end if;
  if exists (
    select 1 from public.order_payment_ledger as ledger
     where ledger.store_id = p_store_id and ledger.order_id = p_order_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'payment_history_exists');
  end if;
  if v_order.balance_amount <> v_order.quotation_amount - v_order.deposit_amount then
    return jsonb_build_object('ok', false, 'code', 'finance_invariant_mismatch');
  end if;
  if p_deposit_amount = v_order.deposit_amount then
    return jsonb_build_object('ok', false, 'code', 'no_change');
  end if;

  v_balance_after := v_order.quotation_amount - p_deposit_amount;
  insert into public.order_initial_deposit_corrections (
    id, store_id, order_id, idempotency_key, actor_id, actor_name_snapshot,
    actor_role_snapshot, reason, deposit_before, deposit_after, balance_before,
    balance_after, order_updated_at_before, order_updated_at_after, created_at
  ) values (
    v_correction_id, p_store_id, p_order_id, p_idempotency_key, p_actor_id, v_actor_name,
    v_actor_role, v_reason, v_order.deposit_amount, p_deposit_amount, v_order.balance_amount,
    v_balance_after, v_order.updated_at, v_now, v_now
  );

  update public.repair_orders
     set deposit_amount = p_deposit_amount,
         balance_amount = v_balance_after,
         is_paid = v_balance_after = 0,
         payment_status = case when v_balance_after = 0 then 'paid'
                               when p_deposit_amount > 0 then 'partial' else 'unpaid' end,
         updated_at = v_now
   where store_id = p_store_id and id = p_order_id;

  insert into public.order_events (id, store_id, order_id, event_type, payload, operator_name, created_at)
  values (
    gen_random_uuid(), p_store_id, p_order_id, 'payment',
    jsonb_build_object(
      'action', 'initial_deposit_corrected', 'correction_id', v_correction_id,
      'deposit_before', v_order.deposit_amount, 'deposit_after', p_deposit_amount,
      'balance_before', v_order.balance_amount, 'balance_after', v_balance_after,
      'reason', v_reason, 'currency_code', v_order.currency_code
    ), v_actor_name, v_now
  );

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id, action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_email, v_actor_name, p_store_id,
    'initial_deposit_correction', 'repair_order', p_order_id::text,
    jsonb_build_object('correction_id', v_correction_id, 'reason', v_reason), v_now
  );

  return jsonb_build_object(
    'ok', true, 'code', 'recorded', 'correction_id', v_correction_id,
    'deposit_amount', p_deposit_amount, 'balance', v_balance_after,
    'is_paid', v_balance_after = 0, 'updated_at', v_now
  );
end;
$$;

revoke all on function public.repairdesk_correct_initial_deposit(
  uuid, uuid, uuid, timestamptz, uuid, numeric, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_correct_initial_deposit(
  uuid, uuid, uuid, timestamptz, uuid, numeric, text
) to service_role;
