-- Transparent buyback quote ledger.
-- Quote and verbal-response records are append-only and are written together with
-- the current inventory projection, timeline event and audit row in one transaction.

set lock_timeout = '5s';
set statement_timeout = '5min';

create table if not exists public.buyback_quote_revisions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  item_id uuid not null,
  revision_no integer not null check (revision_no > 0),
  kind text not null check (kind in ('initial', 'reprice')),
  quote_snapshot jsonb not null,
  change_reason text,
  idempotency_key uuid not null,
  request_hash text not null,
  actor_id uuid not null,
  actor_name text not null,
  created_at timestamptz not null default now(),
  constraint buyback_quote_revisions_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint buyback_quote_revisions_item_store_fkey
    foreign key (item_id, store_id) references public.inventory_items(id, store_id)
    on update cascade on delete cascade,
  constraint buyback_quote_revisions_actor_fkey
    foreign key (actor_id) references public.staff_profiles(id) on update cascade on delete restrict,
  constraint buyback_quote_revisions_snapshot_object
    check (jsonb_typeof(quote_snapshot) = 'object'),
  constraint buyback_quote_revisions_request_hash
    check (request_hash ~ '^[a-f0-9]{64}$'),
  unique (id, store_id, item_id),
  unique (store_id, item_id, revision_no),
  unique (store_id, idempotency_key)
);

create table if not exists public.buyback_quote_responses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  item_id uuid not null,
  quote_revision_id uuid not null,
  outcome text not null check (outcome in ('accepted', 'deferred', 'rejected')),
  reason_code text,
  note text,
  channel text not null default 'staff_recorded_verbal'
    check (channel = 'staff_recorded_verbal'),
  idempotency_key uuid not null,
  request_hash text not null,
  actor_id uuid not null,
  actor_name text not null,
  created_at timestamptz not null default now(),
  constraint buyback_quote_responses_store_fkey
    foreign key (store_id) references public.stores(id) on update cascade on delete restrict,
  constraint buyback_quote_responses_item_store_fkey
    foreign key (item_id, store_id) references public.inventory_items(id, store_id)
    on update cascade on delete cascade,
  constraint buyback_quote_responses_revision_fkey
    foreign key (quote_revision_id, store_id, item_id)
    references public.buyback_quote_revisions(id, store_id, item_id)
    on update cascade on delete restrict,
  constraint buyback_quote_responses_actor_fkey
    foreign key (actor_id) references public.staff_profiles(id) on update cascade on delete restrict,
  constraint buyback_quote_responses_request_hash
    check (request_hash ~ '^[a-f0-9]{64}$'),
  unique (store_id, idempotency_key)
);

create index if not exists buyback_quote_revisions_item_created_idx
  on public.buyback_quote_revisions (store_id, item_id, created_at desc);
create index if not exists buyback_quote_responses_item_created_idx
  on public.buyback_quote_responses (store_id, item_id, created_at desc);

alter table public.buyback_quote_revisions enable row level security;
alter table public.buyback_quote_responses enable row level security;
revoke all on table public.buyback_quote_revisions from public, anon, authenticated, service_role;
revoke all on table public.buyback_quote_responses from public, anon, authenticated, service_role;
grant select, insert, delete on table public.buyback_quote_revisions to service_role;
grant select, insert, delete on table public.buyback_quote_responses to service_role;

create or replace function public.repairdesk_reject_buyback_quote_ledger_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE'
     and public.repairdesk_purge_worker_write_allowed(old.store_id, 'delete') then
    return old;
  end if;
  raise exception using message = 'buyback quote ledger is append-only';
end;
$$;

drop trigger if exists buyback_quote_revisions_immutable on public.buyback_quote_revisions;
create trigger buyback_quote_revisions_immutable
before update or delete on public.buyback_quote_revisions
for each row execute function public.repairdesk_reject_buyback_quote_ledger_mutation();

drop trigger if exists buyback_quote_responses_immutable on public.buyback_quote_responses;
create trigger buyback_quote_responses_immutable
before update or delete on public.buyback_quote_responses
for each row execute function public.repairdesk_reject_buyback_quote_ledger_mutation();

create or replace function public.repairdesk_create_buyback_quote_v1(
  p_store_id uuid,
  p_item_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_actor_email text,
  p_idempotency_key uuid,
  p_customer_id uuid,
  p_device jsonb,
  p_quote jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_revision_id uuid := gen_random_uuid();
  v_request_hash text := encode(extensions.digest(jsonb_build_object(
    'command', 'buyback_quote_create_v1',
    'item_id', p_item_id,
    'customer_id', p_customer_id,
    'device', p_device,
    'quote', p_quote
  )::text, 'sha256'), 'hex');
  v_existing public.buyback_quote_revisions%rowtype;
  v_public_no text;
  v_actor_name text;
  v_actor_email text;
  v_actor_role text;
begin
  if p_item_id is null or p_actor_id is null or p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_command');
  end if;
  if jsonb_typeof(p_device) <> 'object' or jsonb_typeof(p_quote) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if coalesce(p_quote ->> 'risk_level', '') = 'high'
     and coalesce((p_quote ->> 'hard_block')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if abs(
    coalesce((p_quote ->> 'final_offer')::numeric, 0)
    - greatest(0, coalesce((p_quote ->> 'reference_high')::numeric, 0)
      - coalesce((select sum((entry ->> 'amount')::numeric)
                    from jsonb_array_elements(coalesce(p_quote -> 'deductions', '[]'::jsonb)) entry), 0))
  ) >= 0.01 and nullif(btrim(coalesce(p_quote ->> 'manual_adjustment_reason', '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'reason_required');
  end if;

  select coalesce(membership.display_name, profile.display_name, 'Staff'),
         profile.email,
         membership.role::text
    into v_actor_name, v_actor_email, v_actor_role
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

  perform pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', p_store_id::text, 'buyback-quote-item', p_item_id::text), 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', p_store_id::text, 'buyback-quote-revision', p_idempotency_key::text), 0
  ));

  select * into v_existing
    from public.buyback_quote_revisions
   where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    select public_no into v_public_no from public.inventory_items
     where store_id = p_store_id and id = p_item_id;
    return jsonb_build_object(
      'ok', true, 'code', 'idempotent_replay', 'item_id', p_item_id,
      'quote_revision_id', v_existing.id, 'updated_at', v_existing.created_at,
      'public_no', v_public_no
    );
  end if;

  if exists (select 1 from public.inventory_items where store_id = p_store_id and id = p_item_id) then
    return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
  end if;
  if p_customer_id is not null and not exists (
    select 1 from public.customers where store_id = p_store_id and id = p_customer_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'customer_not_found');
  end if;

  insert into public.inventory_items (
    id, store_id, status, source_type, customer_id, category, brand, model, color,
    storage_capacity, serial_or_imei, imei_check_status, battery_health, buyback_price,
    list_price, repair_cost_amount, fees_amount, legacy_payload, created_by, updated_by,
    created_at, updated_at
  ) values (
    p_item_id, p_store_id, 'offer_made', 'buyback', p_customer_id, 'phone',
    btrim(coalesce(p_device ->> 'brand', '')),
    btrim(coalesce(p_device ->> 'model', '')),
    nullif(btrim(coalesce(p_device ->> 'color', '')), ''),
    nullif(btrim(coalesce(p_device ->> 'storage_capacity', '')), ''),
    nullif(btrim(coalesce(p_device ->> 'serial_or_imei', '')), ''),
    case when nullif(btrim(coalesce(p_device ->> 'serial_or_imei', '')), '') is null
      then 'unchecked' else 'unknown' end,
    case when (p_device ->> 'battery_health') ~ '^[0-9]+([.][0-9]+)?$'
      then least(100, greatest(0, (p_device ->> 'battery_health')::numeric)) else null end,
    0, 0, 0, 0,
    jsonb_build_object(
      'buyback_device', p_device - 'serial_or_imei',
      'buyback_quote', p_quote || jsonb_build_object(
        'current_revision_id', v_revision_id,
        'revision_no', 1,
        'intent_outcome', 'undecided',
        'quote_expires_at', p_quote ->> 'expires_at'
      )
    ),
    p_actor_id, p_actor_id, v_now, v_now
  ) returning public_no into v_public_no;

  insert into public.buyback_quote_revisions (
    id, store_id, item_id, revision_no, kind, quote_snapshot, change_reason,
    idempotency_key, request_hash, actor_id, actor_name, created_at
  ) values (
    v_revision_id, p_store_id, p_item_id, 1, 'initial', p_quote, '首次透明报价',
    p_idempotency_key, v_request_hash, p_actor_id, v_actor_name, v_now
  );

  insert into public.inventory_events (
    id, store_id, item_id, event_type, from_status, to_status, payload,
    operator_user_id, operator_name, operator_email, created_at
  ) values (
    gen_random_uuid(), p_store_id, p_item_id, 'buyback_quote_created', null,
    'offer_made', jsonb_build_object(
      'quote_revision_id', v_revision_id, 'revision_no', 1,
      'final_offer', p_quote -> 'final_offer', 'expires_at', p_quote -> 'expires_at'
    ), p_actor_id, v_actor_name, v_actor_email, v_now
  );

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id, action, entity_type,
    entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_email, v_actor_name, p_store_id,
    'buyback_quote_create', 'inventory_item', p_item_id::text,
    jsonb_build_object('quote_revision_id', v_revision_id, 'revision_no', 1), v_now
  );

  return jsonb_build_object(
    'ok', true, 'code', 'created', 'item_id', p_item_id,
    'quote_revision_id', v_revision_id, 'updated_at', v_now, 'public_no', v_public_no
  );
end;
$$;

create or replace function public.repairdesk_revise_buyback_quote_v1(
  p_store_id uuid,
  p_item_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_actor_email text,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_quote jsonb,
  p_change_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_item public.inventory_items%rowtype;
  v_existing public.buyback_quote_revisions%rowtype;
  v_revision_no integer;
  v_revision_id uuid := gen_random_uuid();
  v_request_hash text := encode(extensions.digest(jsonb_build_object(
    'command', 'buyback_quote_revise_v1', 'item_id', p_item_id,
    'quote', p_quote, 'change_reason', btrim(coalesce(p_change_reason, ''))
  )::text, 'sha256'), 'hex');
  v_actor_name text;
  v_actor_email text;
  v_actor_role text;
begin
  if p_item_id is null or p_actor_id is null or p_idempotency_key is null
     or p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_command');
  end if;
  select coalesce(membership.display_name, profile.display_name, 'Staff'),
         profile.email,
         membership.role::text
    into v_actor_name, v_actor_email, v_actor_role
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
  if v_actor_role is null or v_actor_role not in ('owner', 'manager') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', p_store_id::text, 'buyback-quote-revision', p_idempotency_key::text), 0
  ));

  select * into v_existing from public.buyback_quote_revisions
   where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true, 'code', 'idempotent_replay', 'item_id', p_item_id,
      'quote_revision_id', v_existing.id, 'updated_at', v_existing.created_at
    );
  end if;

  select * into v_item from public.inventory_items
   where store_id = p_store_id and id = p_item_id for update;
  if not found or v_item.source_type <> 'buyback' then
    return jsonb_build_object('ok', false, 'code', 'item_not_found');
  end if;
  if v_item.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if v_item.status::text not in ('intake', 'evaluating', 'offer_made', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;
  if length(btrim(coalesce(p_change_reason, ''))) < 2 then
    return jsonb_build_object('ok', false, 'code', 'reason_required');
  end if;
  if coalesce(p_quote ->> 'risk_level', '') = 'high'
     and coalesce((p_quote ->> 'hard_block')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if abs(
    coalesce((p_quote ->> 'final_offer')::numeric, 0)
    - greatest(0, coalesce((p_quote ->> 'reference_high')::numeric, 0)
      - coalesce((select sum((entry ->> 'amount')::numeric)
                    from jsonb_array_elements(coalesce(p_quote -> 'deductions', '[]'::jsonb)) entry), 0))
  ) >= 0.01 and nullif(btrim(coalesce(p_quote ->> 'manual_adjustment_reason', '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'reason_required');
  end if;

  select coalesce(max(revision_no), 0) + 1 into v_revision_no
    from public.buyback_quote_revisions
   where store_id = p_store_id and item_id = p_item_id;

  insert into public.buyback_quote_revisions (
    id, store_id, item_id, revision_no, kind, quote_snapshot, change_reason,
    idempotency_key, request_hash, actor_id, actor_name, created_at
  ) values (
    v_revision_id, p_store_id, p_item_id, v_revision_no, 'reprice', p_quote,
    btrim(p_change_reason), p_idempotency_key, v_request_hash, p_actor_id, v_actor_name, v_now
  );

  update public.inventory_items
     set status = 'offer_made',
         cancelled_at = null,
         legacy_payload = coalesce(legacy_payload, '{}'::jsonb) || jsonb_build_object(
           'buyback_quote', p_quote || jsonb_build_object(
             'current_revision_id', v_revision_id,
             'revision_no', v_revision_no,
             'intent_outcome', 'undecided',
             'quote_expires_at', p_quote ->> 'expires_at'
           )
         ),
         updated_by = p_actor_id,
         updated_at = v_now
   where store_id = p_store_id and id = p_item_id;

  insert into public.inventory_events (
    id, store_id, item_id, event_type, from_status, to_status, payload,
    operator_user_id, operator_name, operator_email, created_at
  ) values (
    gen_random_uuid(), p_store_id, p_item_id, 'buyback_quote_revised',
    v_item.status, 'offer_made', jsonb_build_object(
      'quote_revision_id', v_revision_id, 'revision_no', v_revision_no,
      'change_reason', btrim(p_change_reason), 'final_offer', p_quote -> 'final_offer'
    ), p_actor_id, v_actor_name, v_actor_email, v_now
  );
  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id, action, entity_type,
    entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_email, v_actor_name, p_store_id,
    'buyback_quote_revise', 'inventory_item', p_item_id::text,
    jsonb_build_object('quote_revision_id', v_revision_id, 'revision_no', v_revision_no), v_now
  );

  return jsonb_build_object(
    'ok', true, 'code', 'revised', 'item_id', p_item_id,
    'quote_revision_id', v_revision_id, 'updated_at', v_now
  );
end;
$$;

create or replace function public.repairdesk_record_buyback_quote_response_v1(
  p_store_id uuid,
  p_item_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_actor_email text,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_quote_revision_id uuid,
  p_outcome text,
  p_reason_code text,
  p_note text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_item public.inventory_items%rowtype;
  v_revision public.buyback_quote_revisions%rowtype;
  v_existing public.buyback_quote_responses%rowtype;
  v_response_id uuid := gen_random_uuid();
  v_request_hash text := encode(extensions.digest(jsonb_build_object(
    'command', 'buyback_quote_response_v1', 'item_id', p_item_id,
    'quote_revision_id', p_quote_revision_id, 'outcome', p_outcome,
    'reason_code', nullif(btrim(coalesce(p_reason_code, '')), ''),
    'note', nullif(btrim(coalesce(p_note, '')), '')
  )::text, 'sha256'), 'hex');
  v_next_status text;
  v_actor_name text;
  v_actor_email text;
  v_actor_role text;
begin
  if p_item_id is null or p_actor_id is null or p_idempotency_key is null
     or p_expected_updated_at is null or p_quote_revision_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_command');
  end if;
  select coalesce(membership.display_name, profile.display_name, 'Staff'),
         profile.email,
         membership.role::text
    into v_actor_name, v_actor_email, v_actor_role
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
  perform pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', p_store_id::text, 'buyback-quote-response', p_idempotency_key::text), 0
  ));

  select * into v_existing from public.buyback_quote_responses
   where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true, 'code', 'idempotent_replay', 'item_id', p_item_id,
      'quote_revision_id', v_existing.quote_revision_id,
      'response_id', v_existing.id, 'updated_at', v_existing.created_at
    );
  end if;
  if p_outcome not in ('accepted', 'deferred', 'rejected') then
    return jsonb_build_object('ok', false, 'code', 'invalid_outcome');
  end if;

  select * into v_item from public.inventory_items
   where store_id = p_store_id and id = p_item_id for update;
  if not found or v_item.source_type <> 'buyback' then
    return jsonb_build_object('ok', false, 'code', 'item_not_found');
  end if;
  if v_item.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if v_item.status::text = 'cancelled'
     or coalesce(v_item.legacy_payload #>> '{buyback_quote,intent_outcome}', '') in ('accepted', 'rejected') then
    return jsonb_build_object('ok', false, 'code', 'response_locked');
  end if;
  select * into v_revision from public.buyback_quote_revisions
   where store_id = p_store_id and item_id = p_item_id and id = p_quote_revision_id;
  if not found or coalesce(v_item.legacy_payload #>> '{buyback_quote,current_revision_id}', '') <> p_quote_revision_id::text then
    return jsonb_build_object('ok', false, 'code', 'stale_quote_revision');
  end if;
  if p_outcome = 'accepted' and (
    coalesce((v_revision.quote_snapshot ->> 'hard_block')::boolean, false)
    or coalesce((v_revision.quote_snapshot ->> 'final_offer')::numeric, 0) <= 0
    or (v_revision.quote_snapshot ->> 'expires_at')::timestamptz <= v_now
  ) then
    return jsonb_build_object('ok', false, 'code', 'quote_not_acceptable');
  end if;
  if p_outcome = 'rejected' and nullif(btrim(coalesce(p_reason_code, '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'reason_required');
  end if;
  v_next_status := case when p_outcome = 'rejected' then 'cancelled' else 'offer_made' end;

  insert into public.buyback_quote_responses (
    id, store_id, item_id, quote_revision_id, outcome, reason_code, note,
    idempotency_key, request_hash, actor_id, actor_name, created_at
  ) values (
    v_response_id, p_store_id, p_item_id, p_quote_revision_id, p_outcome,
    nullif(btrim(coalesce(p_reason_code, '')), ''),
    nullif(left(btrim(coalesce(p_note, '')), 240), ''),
    p_idempotency_key, v_request_hash, p_actor_id, v_actor_name, v_now
  );

  update public.inventory_items
     set status = v_next_status,
         cancelled_at = case when p_outcome = 'rejected' then v_now else cancelled_at end,
         legacy_payload = jsonb_set(
           coalesce(legacy_payload, '{}'::jsonb), '{buyback_quote}',
           coalesce(legacy_payload -> 'buyback_quote', '{}'::jsonb) || jsonb_build_object(
             'intent_outcome', p_outcome,
             'response_id', v_response_id,
             'response_recorded_at', v_now,
             'response_channel', 'staff_recorded_verbal'
           ), true
         ),
         updated_by = p_actor_id,
         updated_at = v_now
   where store_id = p_store_id and id = p_item_id;

  insert into public.inventory_events (
    id, store_id, item_id, event_type, from_status, to_status, payload,
    operator_user_id, operator_name, operator_email, created_at
  ) values (
    gen_random_uuid(), p_store_id, p_item_id, 'buyback_quote_response_recorded',
    v_item.status, v_next_status, jsonb_build_object(
      'quote_revision_id', p_quote_revision_id, 'response_id', v_response_id,
      'outcome', p_outcome, 'reason_code', nullif(btrim(coalesce(p_reason_code, '')), ''),
      'channel', 'staff_recorded_verbal'
    ), p_actor_id, v_actor_name, v_actor_email, v_now
  );
  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id, action, entity_type,
    entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_email, v_actor_name, p_store_id,
    'buyback_quote_response', 'inventory_item', p_item_id::text,
    jsonb_build_object('quote_revision_id', p_quote_revision_id, 'response_id', v_response_id, 'outcome', p_outcome), v_now
  );

  return jsonb_build_object(
    'ok', true, 'code', 'response_recorded', 'item_id', p_item_id,
    'quote_revision_id', p_quote_revision_id, 'response_id', v_response_id,
    'updated_at', v_now
  );
end;
$$;

revoke all on function public.repairdesk_create_buyback_quote_v1(
  uuid, uuid, uuid, text, text, uuid, uuid, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.repairdesk_revise_buyback_quote_v1(
  uuid, uuid, uuid, text, text, timestamptz, uuid, jsonb, text
) from public, anon, authenticated;
revoke all on function public.repairdesk_record_buyback_quote_response_v1(
  uuid, uuid, uuid, text, text, timestamptz, uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_create_buyback_quote_v1(
  uuid, uuid, uuid, text, text, uuid, uuid, jsonb, jsonb
) to service_role;
grant execute on function public.repairdesk_revise_buyback_quote_v1(
  uuid, uuid, uuid, text, text, timestamptz, uuid, jsonb, text
) to service_role;
grant execute on function public.repairdesk_record_buyback_quote_response_v1(
  uuid, uuid, uuid, text, text, timestamptz, uuid, uuid, text, text, text
) to service_role;

notify pgrst, 'reload schema';
reset statement_timeout;
reset lock_timeout;
