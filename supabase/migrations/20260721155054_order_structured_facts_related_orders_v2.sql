-- Phase 4 expand-only candidate. Do not apply until the product/data model and
-- linked migration-history gates have separate Owner approval.

set lock_timeout = '5s';

create or replace function public.repairdesk_fact_selection_v2_is_valid(
  p_selection jsonb,
  p_expected_field text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((
    jsonb_typeof(p_selection) = 'object'
    and p_selection ->> 'schema_version' = '2'
    and p_selection ->> 'field' = p_expected_field
    and jsonb_typeof(p_selection -> 'codes') = 'array'
    and jsonb_array_length(p_selection -> 'codes') between 1 and 20
    and not exists (
      select 1
      from jsonb_array_elements(p_selection -> 'codes') as item(value)
      where jsonb_typeof(item.value) <> 'string'
         or char_length(btrim(item.value #>> '{}')) not between 1 and 120
    )
    and (
      select count(*) = count(distinct item.value #>> '{}')
      from jsonb_array_elements(p_selection -> 'codes') as item(value)
    )
    and char_length(btrim(coalesce(p_selection ->> 'catalog_revision', ''))) between 1 and 160
    and (
      not (p_selection -> 'codes' ? 'other')
      or char_length(btrim(coalesce(p_selection ->> 'other_note', ''))) between 1 and 1000
    )
  ), false);
$$;

revoke all on function public.repairdesk_fact_selection_v2_is_valid(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_fact_selection_v2_is_valid(jsonb, text)
  to service_role;

alter table public.repair_orders
  add column if not exists intake_intent_selection jsonb,
  add column if not exists reported_symptoms_selection jsonb,
  add column if not exists diagnostic_findings_selection jsonb;

alter table public.repair_orders
  drop constraint if exists repair_orders_intake_intent_selection_v2_check;
alter table public.repair_orders
  add constraint repair_orders_intake_intent_selection_v2_check
  check (
    intake_intent_selection is null
    or public.repairdesk_fact_selection_v2_is_valid(
      intake_intent_selection,
      'intake_intent'
    )
  ) not valid;

alter table public.repair_orders
  drop constraint if exists repair_orders_reported_symptoms_selection_v2_check;
alter table public.repair_orders
  add constraint repair_orders_reported_symptoms_selection_v2_check
  check (
    reported_symptoms_selection is null
    or public.repairdesk_fact_selection_v2_is_valid(
      reported_symptoms_selection,
      'reported_symptom'
    )
  ) not valid;

alter table public.repair_orders
  drop constraint if exists repair_orders_diagnostic_findings_selection_v2_check;
alter table public.repair_orders
  add constraint repair_orders_diagnostic_findings_selection_v2_check
  check (
    diagnostic_findings_selection is null
    or public.repairdesk_fact_selection_v2_is_valid(
      diagnostic_findings_selection,
      'diagnostic_finding'
    )
  ) not valid;

alter table public.repair_orders validate constraint repair_orders_intake_intent_selection_v2_check;
alter table public.repair_orders validate constraint repair_orders_reported_symptoms_selection_v2_check;
alter table public.repair_orders validate constraint repair_orders_diagnostic_findings_selection_v2_check;

create or replace function public.repairdesk_create_order_v3(
  p_store_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_request_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_intake jsonb := p_payload #> '{order,intake_intent_selection}';
  v_symptoms jsonb := p_payload #> '{order,reported_symptoms_selection}';
  v_findings jsonb := p_payload #> '{order,diagnostic_findings_selection}';
  v_row_count integer;
begin
  if (v_intake is not null and public.repairdesk_fact_selection_v2_is_valid(v_intake, 'intake_intent') is not true)
     or (v_symptoms is not null and public.repairdesk_fact_selection_v2_is_valid(v_symptoms, 'reported_symptom') is not true)
     or (v_findings is not null and public.repairdesk_fact_selection_v2_is_valid(v_findings, 'diagnostic_finding') is not true) then
    return jsonb_build_object('ok', false, 'code', 'invalid_fact_selection');
  end if;

  v_result := public.repairdesk_create_order_v2(
    p_store_id,
    p_actor_id,
    p_operation_id,
    p_request_hash,
    p_payload
  );
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
     or coalesce((v_result ->> 'replayed')::boolean, false) then
    return v_result;
  end if;

  v_order_id := nullif(v_result ->> 'id', '')::uuid;
  update public.repair_orders
     set intake_intent_selection = v_intake,
         reported_symptoms_selection = v_symptoms,
         diagnostic_findings_selection = v_findings
   where store_id = p_store_id and id = v_order_id;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then raise exception 'structured order projection invariant failed'; end if;

  update public.order_events
     set payload = payload || jsonb_strip_nulls(jsonb_build_object(
       'intake_intent_selection', v_intake,
       'reported_symptoms_selection', v_symptoms,
       'diagnostic_findings_selection', v_findings
     ))
   where store_id = p_store_id
     and order_id = v_order_id
     and event_type::text = 'created';
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then raise exception 'structured order event invariant failed'; end if;
  return v_result;
end;
$$;

revoke all on function public.repairdesk_create_order_v3(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.repairdesk_create_order_v3(uuid, uuid, uuid, text, jsonb)
  to service_role;

create table if not exists public.repair_order_episodes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  source_order_id uuid not null,
  active_order_id uuid not null,
  status text not null default 'open',
  triage_selection jsonb not null,
  triage_legacy_text text not null,
  disposition_selection jsonb,
  disposition_legacy_text text,
  triaged_by uuid references auth.users(id) on update cascade on delete set null,
  decided_by uuid references auth.users(id) on update cascade on delete set null,
  triaged_at timestamptz not null default now(),
  decided_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repair_order_episodes_id_store_unique unique (id, store_id),
  constraint repair_order_episodes_active_unique unique (store_id, active_order_id),
  constraint repair_order_episodes_source_store_fkey
    foreign key (source_order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict,
  constraint repair_order_episodes_active_store_fkey
    foreign key (active_order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict,
  constraint repair_order_episodes_status_check
    check (status in ('open', 'decided', 'closed')),
  constraint repair_order_episodes_triage_check
    check (public.repairdesk_reason_selection_v2_is_valid(triage_selection, 'rework.triage')),
  constraint repair_order_episodes_disposition_check
    check (
      (disposition_selection is null and disposition_legacy_text is null and decided_at is null)
      or coalesce((
        public.repairdesk_reason_selection_v2_is_valid(
          disposition_selection,
          'rework.disposition'
        )
        and char_length(btrim(coalesce(disposition_legacy_text, ''))) between 1 and 2000
        and decided_at is not null
      ), false)
    ),
  constraint repair_order_episodes_triage_text_check
    check (char_length(btrim(triage_legacy_text)) between 1 and 2000)
);

create table if not exists public.repair_order_relations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  episode_id uuid,
  source_order_id uuid not null,
  related_order_id uuid not null,
  relation_type text not null,
  created_by uuid references auth.users(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repair_order_relations_pair_unique
    unique (store_id, source_order_id, related_order_id),
  constraint repair_order_relations_distinct_orders_check
    check (source_order_id <> related_order_id),
  constraint repair_order_relations_type_check
    check (relation_type in ('warranty_rework', 'related_new_fault', 'followup')),
  constraint repair_order_relations_episode_store_fkey
    foreign key (episode_id, store_id) references public.repair_order_episodes(id, store_id)
    on update cascade on delete restrict,
  constraint repair_order_relations_source_store_fkey
    foreign key (source_order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict,
  constraint repair_order_relations_related_store_fkey
    foreign key (related_order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict
);

create table if not exists public.repairdesk_related_order_operations (
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  actor_id uuid not null references auth.users(id) on update cascade on delete restrict,
  operation_id uuid not null,
  request_hash text not null,
  source_order_id uuid not null,
  related_order_id uuid,
  episode_id uuid,
  response_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, actor_id, operation_id),
  constraint repairdesk_related_order_operations_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint repairdesk_related_order_operations_source_store_fkey
    foreign key (source_order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict,
  constraint repairdesk_related_order_operations_related_store_fkey
    foreign key (related_order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict,
  constraint repairdesk_related_order_operations_episode_store_fkey
    foreign key (episode_id, store_id) references public.repair_order_episodes(id, store_id)
    on update cascade on delete restrict
);

create table if not exists public.repairdesk_rework_disposition_operations (
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  actor_id uuid not null references auth.users(id) on update cascade on delete restrict,
  operation_id uuid not null,
  request_hash text not null,
  episode_id uuid not null,
  active_order_id uuid not null,
  response_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, actor_id, operation_id),
  constraint repairdesk_rework_disposition_operations_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint repairdesk_rework_disposition_operations_episode_store_fkey
    foreign key (episode_id, store_id) references public.repair_order_episodes(id, store_id)
    on update cascade on delete restrict,
  constraint repairdesk_rework_disposition_operations_order_store_fkey
    foreign key (active_order_id, store_id) references public.repair_orders(id, store_id)
    on update cascade on delete restrict
);

create index if not exists repair_order_episodes_source_triaged_idx
  on public.repair_order_episodes (store_id, source_order_id, triaged_at desc);
create unique index if not exists repair_order_episodes_one_open_source_idx
  on public.repair_order_episodes (store_id, source_order_id)
  where status = 'open';
create index if not exists repair_order_relations_source_created_idx
  on public.repair_order_relations (store_id, source_order_id, created_at desc);
create index if not exists repair_order_relations_related_created_idx
  on public.repair_order_relations (store_id, related_order_id, created_at desc);

alter table public.repair_order_episodes enable row level security;
alter table public.repair_order_relations enable row level security;
alter table public.repairdesk_related_order_operations enable row level security;
alter table public.repairdesk_rework_disposition_operations enable row level security;
revoke all on table public.repair_order_episodes from public, anon, authenticated, service_role;
revoke all on table public.repair_order_relations from public, anon, authenticated, service_role;
revoke all on table public.repairdesk_related_order_operations from public, anon, authenticated, service_role;
revoke all on table public.repairdesk_rework_disposition_operations from public, anon, authenticated, service_role;
grant select, insert, update on table public.repair_order_episodes to service_role;
grant select, insert, update on table public.repair_order_relations to service_role;
grant select, insert, update on table public.repairdesk_related_order_operations to service_role;
grant select, insert, update on table public.repairdesk_rework_disposition_operations to service_role;

create or replace function public.repairdesk_create_related_order_v2(
  p_store_id uuid,
  p_source_order_id uuid,
  p_actor_id uuid,
  p_expected_source_updated_at timestamptz,
  p_operation_id uuid,
  p_request_hash text,
  p_triage_selection jsonb,
  p_triage_legacy_text text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.repairdesk_related_order_operations%rowtype;
  v_source public.repair_orders%rowtype;
  v_related public.repair_orders%rowtype;
  v_create_result jsonb;
  v_related_order_id uuid;
  v_episode_id uuid;
  v_relation_id uuid;
  v_result jsonb;
  v_payload jsonb;
  v_actor_email text;
  v_actor_name text;
  v_actor_role text;
  v_actor_membership_id uuid;
  v_default_warranty_months integer := 6;
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_source_order_id is null or p_actor_id is null
     or p_expected_source_updated_at is null
     or p_operation_id is null or coalesce(p_request_hash, '') !~ '^[0-9a-f]{64}$'
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if public.repairdesk_reason_selection_v2_is_valid(
       p_triage_selection,
       'rework.triage'
     ) is not true
     or char_length(btrim(coalesce(p_triage_legacy_text, ''))) not between 1 and 2000
     or btrim(p_triage_legacy_text) is distinct from
        btrim(coalesce(p_triage_selection #>> '{internal_snapshot,text}', '')) then
    return jsonb_build_object('ok', false, 'code', 'invalid_rework_selection');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_store_id::text || ':' || p_actor_id::text || ':' || p_operation_id::text,
      0
    )
  );
  select operation.* into v_existing
    from public.repairdesk_related_order_operations as operation
   where operation.store_id = p_store_id
     and operation.actor_id = p_actor_id
     and operation.operation_id = p_operation_id;
  if found then
    if v_existing.request_hash <> p_request_hash
       or v_existing.source_order_id <> p_source_order_id then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    if v_existing.response_summary is not null then
      return v_existing.response_summary || jsonb_build_object(
        'code', 'idempotent_replay', 'replayed', true
      );
    end if;
  end if;

  select order_row.* into v_source
    from public.repair_orders as order_row
   where order_row.store_id = p_store_id and order_row.id = p_source_order_id
   for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'source_order_not_found'); end if;
  if v_source.record_state::text <> 'active' or v_source.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'source_order_voided');
  end if;
  if v_source.updated_at is distinct from p_expected_source_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_source_order');
  end if;
  if v_source.status::text <> 'completed' then
    return jsonb_build_object('ok', false, 'code', 'source_order_not_terminal');
  end if;
  if v_source.customer_id is null or v_source.device_id is null then
    return jsonb_build_object('ok', false, 'code', 'source_identity_missing');
  end if;
  if exists (
    select 1 from public.repair_order_episodes as episode
     where episode.store_id = p_store_id
       and episode.source_order_id = p_source_order_id
       and episode.status = 'open'
  ) then
    return jsonb_build_object('ok', false, 'code', 'open_rework_episode_exists');
  end if;

  select profile.email, coalesce(membership.display_name, profile.display_name, profile.email),
         membership.role::text, membership.id
    into v_actor_email, v_actor_name, v_actor_role, v_actor_membership_id
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
     and (
       membership.role::text in ('owner', 'manager', 'sales')
       or (
         membership.role::text = 'technician'
         and membership.id is not distinct from v_source.assignee_membership_id
       )
     )
   limit 1;
  if v_actor_name is null then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;

  v_default_warranty_months := coalesce((
    select settings.default_order_warranty_months
      from public.store_settings as settings
     where settings.store_id = p_store_id
     limit 1
  ), 6);

  v_payload := jsonb_build_object(
    'customer_id', v_source.customer_id,
    'device_id', v_source.device_id,
    'customer_identity_resolution', jsonb_build_object('mode', 'auto'),
    'contact_phones', coalesce(to_jsonb(v_source.contact_phones), '[]'::jsonb),
    'order', jsonb_build_object(
      'order_type', v_source.order_type,
      'status', 'rework',
      'workflow_status', 'intake',
      'exception_status', 'rework',
      'payment_status', 'unpaid',
      'approval_flow_status', 'not_required',
      'parts_status', 'not_required',
      'notify_status', 'not_sent',
      'issue_description', btrim(p_triage_legacy_text),
      'quotation_amount', 0,
      'deposit_amount', 0,
      'balance_amount', 0,
      'is_paid', false,
      'technician_name', v_actor_name,
      'assignee_membership_id', case when v_actor_role = 'technician' then v_actor_membership_id else null end,
      'device_custody_status', 'with_shop',
      'warranty_text', v_default_warranty_months::text || '个月',
      'warranty_months', v_default_warranty_months,
      'fault_prices', '[]'::jsonb,
      'cost_inputs', '[]'::jsonb
    )
  );

  v_create_result := public.repairdesk_create_order_v2(
    p_store_id,
    p_actor_id,
    p_operation_id,
    p_request_hash,
    v_payload
  );
  if coalesce((v_create_result ->> 'ok')::boolean, false) is not true then
    return v_create_result;
  end if;
  if v_create_result ->> 'code' <> 'created'
     or coalesce((v_create_result ->> 'replayed')::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
  end if;
  v_related_order_id := nullif(v_create_result ->> 'id', '')::uuid;

  insert into public.repairdesk_related_order_operations (
    store_id, actor_id, operation_id, request_hash, source_order_id, created_at, updated_at
  ) values (
    p_store_id, p_actor_id, p_operation_id, p_request_hash, p_source_order_id, v_now, v_now
  );

  select order_row.* into v_related
    from public.repair_orders as order_row
   where order_row.store_id = p_store_id and order_row.id = v_related_order_id
   for update;
  if not found
     or v_related.customer_id is distinct from v_source.customer_id
     or v_related.device_id is distinct from v_source.device_id then
    raise exception 'related order identity invariant failed';
  end if;

  update public.repair_orders
     set original_order_id = p_source_order_id,
         updated_at = clock_timestamp()
   where store_id = p_store_id and id = v_related_order_id
     and original_order_id is null
  returning * into v_related;

  insert into public.repair_order_episodes (
    store_id, source_order_id, active_order_id, status,
    triage_selection, triage_legacy_text,
    triaged_by, triaged_at, created_at, updated_at
  ) values (
    p_store_id, p_source_order_id, v_related_order_id, 'open',
    p_triage_selection, btrim(p_triage_legacy_text),
    p_actor_id, v_now, v_now, v_now
  )
  returning id into v_episode_id;

  insert into public.repair_order_relations (
    store_id, episode_id, source_order_id, related_order_id,
    relation_type, created_by, created_at
  ) values (
    p_store_id, v_episode_id, p_source_order_id, v_related_order_id,
    'followup', p_actor_id, v_now
  ) returning id into v_relation_id;

  insert into public.order_events (
    id, store_id, order_id, event_type, payload, operator_name, created_at
  ) values (
    gen_random_uuid(), p_store_id, p_source_order_id, 'note',
    jsonb_build_object(
      'action', 'related_order_created',
      'related_order_id', v_related_order_id,
      'episode_id', v_episode_id,
      'relation_type', 'followup',
      'triage_selection', p_triage_selection
    ),
    v_actor_name,
    v_now
  );

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id, action,
    entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_email, v_actor_name, p_store_id,
    'create_related_order', 'repair_order', p_source_order_id::text,
    jsonb_build_object(
      'related_order_id', v_related_order_id,
      'episode_id', v_episode_id,
      'relation_type', 'followup',
      'triage_selection', public.repairdesk_reason_selection_v2_audit_metadata(p_triage_selection)
    ),
    v_now
  );

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'created',
    'source_order_id', p_source_order_id,
    'related_order_id', v_related_order_id,
    'episode_id', v_episode_id,
    'relation_id', v_relation_id,
    'relation_type', 'followup',
    'episode_status', 'open',
    'related_updated_at', v_related.updated_at,
    'replayed', false
  );
  update public.repairdesk_related_order_operations
     set related_order_id = v_related_order_id,
         episode_id = v_episode_id,
         response_summary = v_result,
         updated_at = v_now
   where store_id = p_store_id
     and actor_id = p_actor_id
     and operation_id = p_operation_id;
  return v_result;
end;
$$;

revoke all on function public.repairdesk_create_related_order_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_create_related_order_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, jsonb, text
) to service_role;

create or replace function public.repairdesk_record_rework_disposition_v2(
  p_store_id uuid,
  p_active_order_id uuid,
  p_actor_id uuid,
  p_expected_active_updated_at timestamptz,
  p_operation_id uuid,
  p_request_hash text,
  p_disposition_selection jsonb,
  p_disposition_legacy_text text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.repairdesk_rework_disposition_operations%rowtype;
  v_episode public.repair_order_episodes%rowtype;
  v_active public.repair_orders%rowtype;
  v_relation_type text;
  v_actor_email text;
  v_actor_name text;
  v_actor_role text;
  v_actor_membership_id uuid;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_active_order_id is null or p_actor_id is null
     or p_expected_active_updated_at is null or p_operation_id is null
     or coalesce(p_request_hash, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if public.repairdesk_reason_selection_v2_is_valid(
       p_disposition_selection,
       'rework.disposition'
     ) is not true
     or char_length(btrim(coalesce(p_disposition_legacy_text, ''))) not between 1 and 2000
     or btrim(p_disposition_legacy_text) is distinct from
        btrim(coalesce(p_disposition_selection #>> '{internal_snapshot,text}', '')) then
    return jsonb_build_object('ok', false, 'code', 'invalid_rework_selection');
  end if;

  v_relation_type := case p_disposition_selection ->> 'primary_code'
    when 'warranty_original_item' then 'warranty_rework'
    when 'unrelated_new_fault' then 'related_new_fault'
    when 'customer_damage' then 'related_new_fault'
    when 'warranty_expired' then 'related_new_fault'
    when 'unable_to_determine' then 'followup'
    else null
  end;
  if v_relation_type is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_rework_disposition');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_store_id::text || ':' || p_actor_id::text || ':' || p_operation_id::text,
      0
    )
  );
  select operation.* into v_existing
    from public.repairdesk_rework_disposition_operations as operation
   where operation.store_id = p_store_id
     and operation.actor_id = p_actor_id
     and operation.operation_id = p_operation_id;
  if found then
    if v_existing.request_hash <> p_request_hash
       or v_existing.active_order_id <> p_active_order_id then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return v_existing.response_summary || jsonb_build_object(
      'code', 'idempotent_replay', 'replayed', true
    );
  end if;

  select order_row.* into v_active
    from public.repair_orders as order_row
   where order_row.store_id = p_store_id and order_row.id = p_active_order_id
   for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'active_order_not_found'); end if;
  if v_active.record_state::text <> 'active' or v_active.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'active_order_voided');
  end if;
  if v_active.updated_at is distinct from p_expected_active_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_active_order');
  end if;
  if v_active.status::text <> 'rework' or v_active.original_order_id is null then
    return jsonb_build_object('ok', false, 'code', 'active_order_not_rework');
  end if;
  if nullif(btrim(coalesce(v_active.diagnosis_result, '')), '') is null
     and v_active.diagnostic_findings_selection is null then
    return jsonb_build_object('ok', false, 'code', 'diagnosis_required');
  end if;

  select episode.* into v_episode
    from public.repair_order_episodes as episode
   where episode.store_id = p_store_id
     and episode.active_order_id = p_active_order_id
     and episode.status = 'open'
   for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'open_rework_episode_not_found'); end if;

  select profile.email, coalesce(membership.display_name, profile.display_name, profile.email),
         membership.role::text, membership.id
    into v_actor_email, v_actor_name, v_actor_role, v_actor_membership_id
    from public.staff_profiles as profile
    join public.store_memberships as membership
      on membership.user_id = profile.id
     and membership.store_id = p_store_id
     and membership.status::text = 'active'
   where profile.id = p_actor_id
     and profile.status::text = 'active'
     and (
       membership.role::text in ('owner', 'manager')
       or (
         membership.role::text = 'technician'
         and membership.id is not distinct from v_active.assignee_membership_id
       )
     )
   limit 1;
  if v_actor_name is null then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;

  insert into public.repairdesk_rework_disposition_operations (
    store_id, actor_id, operation_id, request_hash, episode_id, active_order_id,
    created_at, updated_at
  ) values (
    p_store_id, p_actor_id, p_operation_id, p_request_hash, v_episode.id,
    p_active_order_id, v_now, v_now
  );

  update public.repair_order_episodes
     set disposition_selection = p_disposition_selection,
         disposition_legacy_text = btrim(p_disposition_legacy_text),
         decided_by = p_actor_id,
         decided_at = v_now,
         status = case
           when p_disposition_selection ->> 'primary_code' = 'unable_to_determine' then 'open'
           else 'decided'
         end,
         updated_at = v_now
   where id = v_episode.id and store_id = p_store_id;

  update public.repair_order_relations
     set relation_type = v_relation_type,
         updated_at = v_now
   where store_id = p_store_id and episode_id = v_episode.id;

  insert into public.order_events (
    id, store_id, order_id, event_type, payload, operator_name, created_at
  ) values (
    gen_random_uuid(), p_store_id, p_active_order_id, 'note',
    jsonb_build_object(
      'action', 'rework_disposition_recorded',
      'episode_id', v_episode.id,
      'source_order_id', v_episode.source_order_id,
      'relation_type', v_relation_type,
      'disposition_selection', p_disposition_selection
    ),
    v_actor_name,
    v_now
  );

  insert into public.order_events (
    id, store_id, order_id, event_type, payload, operator_name, created_at
  ) values (
    gen_random_uuid(), p_store_id, v_episode.source_order_id, 'note',
    jsonb_build_object(
      'action', 'related_rework_disposition_recorded',
      'related_order_id', p_active_order_id,
      'episode_id', v_episode.id,
      'relation_type', v_relation_type,
      'disposition_selection', p_disposition_selection
    ),
    v_actor_name,
    v_now
  );

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id, action,
    entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid()::text, p_actor_id, v_actor_email, v_actor_name, p_store_id,
    'record_rework_disposition', 'repair_order', p_active_order_id::text,
    jsonb_build_object(
      'episode_id', v_episode.id,
      'source_order_id', v_episode.source_order_id,
      'relation_type', v_relation_type,
      'disposition_selection', public.repairdesk_reason_selection_v2_audit_metadata(
        p_disposition_selection
      )
    ),
    v_now
  );

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'recorded',
    'source_order_id', v_episode.source_order_id,
    'related_order_id', p_active_order_id,
    'episode_id', v_episode.id,
    'relation_type', v_relation_type,
    'episode_status', case
      when p_disposition_selection ->> 'primary_code' = 'unable_to_determine' then 'open'
      else 'decided'
    end,
    'replayed', false
  );
  update public.repairdesk_rework_disposition_operations
     set response_summary = v_result, updated_at = v_now
   where store_id = p_store_id
     and actor_id = p_actor_id
     and operation_id = p_operation_id;
  return v_result;
end;
$$;

revoke all on function public.repairdesk_record_rework_disposition_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_record_rework_disposition_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, jsonb, text
) to service_role;

create or replace function public.repairdesk_apply_order_data_batch_v3(
  p_batch_id uuid,
  p_store_id uuid,
  p_actor_id uuid,
  p_actor_email text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_row record;
  v_order record;
  v_now timestamptz;
  v_changed integer := 0;
begin
  if not exists (
    select 1 from public.order_data_batches as batch
    where batch.id = p_batch_id
      and batch.store_id = p_store_id
      and batch.template_version = 'repairdesk-order-data-v3'
  ) then
    raise exception 'order_data_v3_batch_required' using errcode = '22023';
  end if;

  v_result := public.repairdesk_apply_order_data_batch(
    p_batch_id, p_store_id, p_actor_id, p_actor_email, p_actor_name
  );

  for v_row in
    select batch_row.id, batch_row.action, batch_row.normalized_data,
           batch_row.result_order_id, batch_row.before_data
      from public.order_data_batch_rows as batch_row
     where batch_row.batch_id = p_batch_id
       and batch_row.store_id = p_store_id
       and batch_row.status = 'applied'
       and not (batch_row.before_data ? 'structured_facts_v3_applied')
       and (
         batch_row.normalized_data ? 'intake_intent_selection'
         or batch_row.normalized_data ? 'reported_symptoms_selection'
         or batch_row.normalized_data ? 'diagnostic_findings_selection'
       )
     order by batch_row.row_number
     for update
  loop
    select order_row.id, order_row.intake_intent_selection,
           order_row.reported_symptoms_selection, order_row.diagnostic_findings_selection
      into v_order
      from public.repair_orders as order_row
     where order_row.store_id = p_store_id
       and order_row.id::text = v_row.result_order_id::text
     for update;
    if not found then
      raise exception 'order_data_v3_order_not_found' using errcode = 'P0002';
    end if;

    v_now := clock_timestamp();
    update public.repair_orders as order_row
       set intake_intent_selection = case
             when v_row.normalized_data ? 'intake_intent_selection'
               then v_row.normalized_data -> 'intake_intent_selection'
             else order_row.intake_intent_selection
           end,
           reported_symptoms_selection = case
             when v_row.normalized_data ? 'reported_symptoms_selection'
               then v_row.normalized_data -> 'reported_symptoms_selection'
             else order_row.reported_symptoms_selection
           end,
           diagnostic_findings_selection = case
             when v_row.normalized_data ? 'diagnostic_findings_selection'
               then v_row.normalized_data -> 'diagnostic_findings_selection'
             else order_row.diagnostic_findings_selection
           end,
           updated_at = v_now
     where order_row.store_id = p_store_id
       and order_row.id = v_order.id;

    update public.order_data_batch_rows as batch_row
       set before_data = case
             when v_row.action = 'update' then
               batch_row.before_data
               || jsonb_build_object(
                 'order',
                 coalesce(batch_row.before_data -> 'order', '{}'::jsonb)
                 || jsonb_build_object(
                   'intake_intent_selection', v_order.intake_intent_selection,
                   'reported_symptoms_selection', v_order.reported_symptoms_selection,
                   'diagnostic_findings_selection', v_order.diagnostic_findings_selection
                 )
               )
               || jsonb_build_object('structured_facts_v3_applied', true)
             else batch_row.before_data
               || jsonb_build_object('structured_facts_v3_applied', true)
           end,
           after_updated_at = v_now
     where batch_row.id = v_row.id;

    insert into public.order_events (
      id, store_id, order_id, event_type, payload, operator_name, created_at
    ) values (
      gen_random_uuid(), p_store_id, v_order.id, 'note',
      jsonb_build_object(
        'source', 'order_data_import',
        'batch_id', p_batch_id,
        'action', 'structured_facts_v3_applied',
        'changed_fields', array(
          select key from jsonb_object_keys(v_row.normalized_data) as key
          where key in (
            'intake_intent_selection',
            'reported_symptoms_selection',
            'diagnostic_findings_selection'
          )
        )
      ),
      coalesce(nullif(p_actor_name, ''), '店主'), v_now
    );
    v_changed := v_changed + 1;
  end loop;

  if v_changed > 0 then
    update public.audit_logs as audit_row
       set metadata = audit_row.metadata || jsonb_build_object(
         'structured_fact_rows', v_changed,
         'template_version', 'repairdesk-order-data-v3'
       )
     where audit_row.store_id = p_store_id
       and audit_row.action = 'import_apply'
       and audit_row.entity_type = 'order_data_batch'
       and audit_row.entity_id = p_batch_id::text;
  end if;
  return v_result;
end;
$$;

revoke all on function public.repairdesk_apply_order_data_batch_v3(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_apply_order_data_batch_v3(
  uuid, uuid, uuid, text, text
) to service_role;

create or replace function public.repairdesk_rollback_order_data_batch_v3(
  p_batch_id uuid,
  p_store_id uuid,
  p_actor_id uuid,
  p_actor_email text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_row record;
  v_now timestamptz;
  v_changed integer := 0;
begin
  if not exists (
    select 1 from public.order_data_batches as batch
    where batch.id = p_batch_id
      and batch.store_id = p_store_id
      and batch.template_version = 'repairdesk-order-data-v3'
  ) then
    raise exception 'order_data_v3_batch_required' using errcode = '22023';
  end if;

  v_result := public.repairdesk_rollback_order_data_batch(
    p_batch_id, p_store_id, p_actor_id, p_actor_email, p_actor_name
  );

  for v_row in
    select batch_row.id, batch_row.result_order_id, batch_row.before_data
      from public.order_data_batch_rows as batch_row
     where batch_row.batch_id = p_batch_id
       and batch_row.store_id = p_store_id
       and batch_row.action = 'update'
       and batch_row.status = 'rolled_back'
       and batch_row.before_data ? 'structured_facts_v3_applied'
       and not (batch_row.before_data ? 'structured_facts_v3_rolled_back')
     order by batch_row.row_number
     for update
  loop
    v_now := clock_timestamp();
    update public.repair_orders as order_row
       set intake_intent_selection = nullif(
             v_row.before_data #> '{order,intake_intent_selection}', 'null'::jsonb
           ),
           reported_symptoms_selection = nullif(
             v_row.before_data #> '{order,reported_symptoms_selection}', 'null'::jsonb
           ),
           diagnostic_findings_selection = nullif(
             v_row.before_data #> '{order,diagnostic_findings_selection}', 'null'::jsonb
           ),
           updated_at = v_now
     where order_row.store_id = p_store_id
       and order_row.id::text = v_row.result_order_id::text;
    if not found then
      raise exception 'order_data_v3_rollback_order_not_found' using errcode = 'P0002';
    end if;
    update public.order_data_batch_rows
       set before_data = before_data || jsonb_build_object(
         'structured_facts_v3_rolled_back', true
       )
     where id = v_row.id;
    v_changed := v_changed + 1;
  end loop;

  if v_changed > 0 then
    update public.audit_logs as audit_row
       set metadata = audit_row.metadata || jsonb_build_object(
         'structured_fact_rows', v_changed,
         'structured_facts_restored', true
       )
     where audit_row.store_id = p_store_id
       and audit_row.action = 'import_rollback'
       and audit_row.entity_type = 'order_data_batch'
       and audit_row.entity_id = p_batch_id::text;
  end if;
  return v_result;
end;
$$;

revoke all on function public.repairdesk_rollback_order_data_batch_v3(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_rollback_order_data_batch_v3(
  uuid, uuid, uuid, text, text
) to service_role;

comment on column public.repair_orders.intake_intent_selection is
  'Current structured intake intent. Null means legacy/unclassified text.';
comment on table public.repair_order_episodes is
  'After-close return episode. Triage is not a warranty or free-repair decision.';
comment on table public.repair_order_relations is
  'Same-store auditable order relation; source finance and terminal evidence remain unchanged.';

reset lock_timeout;
notify pgrst, 'reload schema';
