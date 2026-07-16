-- Keep the immutable finance history of a cancelled order, but prevent any new
-- collection from being recorded against it. Idempotent replay remains valid
-- because both replay checks happen before the cancellation guard.
create or replace function public.repairdesk_record_order_payment(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_amount numeric,
  p_method text,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid
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
  v_existing public.order_payment_ledger%rowtype;
  v_order public.repair_orders%rowtype;
  v_payment_id uuid := gen_random_uuid();
  v_method text := btrim(coalesce(p_method, ''));
  v_balance_after numeric(12, 2);
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_order_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;
  if char_length(v_method) < 1 or char_length(v_method) > 64 then
    return jsonb_build_object('ok', false, 'code', 'invalid_method');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_store_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select profile.email, coalesce(membership.display_name, profile.display_name), membership.role::text
    into v_actor_email, v_actor_name, v_actor_role
    from public.staff_profiles as profile
    join public.store_memberships as membership
      on membership.user_id = profile.id
     and membership.store_id = p_store_id
     and membership.status::text = 'active'
    join public.stores as store_row
      on store_row.id = membership.store_id
     and store_row.status::text = 'active'
   where profile.id = p_actor_id
     and profile.status::text = 'active'
   limit 1;

  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  select ledger.*
    into v_existing
    from public.order_payment_ledger as ledger
   where ledger.store_id = p_store_id
     and ledger.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.order_id <> p_order_id
       or v_existing.actor_id is distinct from p_actor_id
       or v_existing.amount <> p_amount
       or v_existing.payment_method <> v_method
       or v_existing.order_updated_at_before <> p_expected_updated_at then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'payment_id', v_existing.id,
      'balance', v_existing.balance_after,
      'is_paid', v_existing.balance_after = 0,
      'updated_at', v_existing.order_updated_at_after
    );
  end if;

  select order_row.*
    into v_order
    from public.repair_orders as order_row
   where order_row.store_id = p_store_id
     and order_row.id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;

  select ledger.*
    into v_existing
    from public.order_payment_ledger as ledger
   where ledger.store_id = p_store_id
     and ledger.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.order_id <> p_order_id
       or v_existing.actor_id is distinct from p_actor_id
       or v_existing.amount <> p_amount
       or v_existing.payment_method <> v_method
       or v_existing.order_updated_at_before <> p_expected_updated_at then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'payment_id', v_existing.id,
      'balance', v_existing.balance_after,
      'is_paid', v_existing.balance_after = 0,
      'updated_at', v_existing.order_updated_at_after
    );
  end if;

  if lower(coalesce(v_order.status::text, '')) = 'cancelled'
     or lower(coalesce(v_order.exception_status::text, '')) = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'order_cancelled');
  end if;

  if v_order.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if v_order.is_paid or v_order.balance_amount <= 0 then
    return jsonb_build_object('ok', false, 'code', 'already_settled');
  end if;
  if p_amount > v_order.balance_amount then
    return jsonb_build_object('ok', false, 'code', 'overpayment');
  end if;

  v_balance_after := v_order.balance_amount - p_amount;

  insert into public.order_payment_ledger (
    id,
    store_id,
    order_id,
    idempotency_key,
    actor_id,
    actor_name_snapshot,
    amount,
    payment_method,
    currency_code,
    balance_before,
    balance_after,
    order_updated_at_before,
    order_updated_at_after,
    created_at
  ) values (
    v_payment_id,
    p_store_id,
    p_order_id,
    p_idempotency_key,
    p_actor_id,
    v_actor_name,
    p_amount,
    v_method,
    v_order.currency_code,
    v_order.balance_amount,
    v_balance_after,
    v_order.updated_at,
    v_now,
    v_now
  );

  update public.repair_orders
     set balance_amount = v_balance_after,
         is_paid = v_balance_after = 0,
         payment_status = case when v_balance_after = 0 then 'paid' else 'partial' end,
         updated_at = v_now
   where store_id = p_store_id
     and id = p_order_id;

  insert into public.order_events (
    id,
    store_id,
    order_id,
    event_type,
    payload,
    operator_name,
    created_at
  ) values (
    gen_random_uuid(),
    p_store_id,
    p_order_id,
    'payment',
    jsonb_build_object(
      'amount', p_amount,
      'method', v_method,
      'balance', v_balance_after,
      'currency_code', v_order.currency_code,
      'payment_id', v_payment_id
    ),
    v_actor_name,
    v_now
  );

  insert into public.audit_logs (
    id,
    actor_id,
    actor_email,
    actor_name,
    store_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_email,
    v_actor_name,
    p_store_id,
    'payment',
    'repair_order',
    p_order_id::text,
    jsonb_build_object('payment_id', v_payment_id),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'recorded',
    'payment_id', v_payment_id,
    'balance', v_balance_after,
    'is_paid', v_balance_after = 0,
    'updated_at', v_now
  );
end;
$$;

revoke all on function public.repairdesk_record_order_payment(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  timestamptz,
  uuid
) from public, anon, authenticated;

grant execute on function public.repairdesk_record_order_payment(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  timestamptz,
  uuid
) to service_role;
