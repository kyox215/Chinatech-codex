-- Phase 4 expand-only candidate. Do not apply until the product/data model and
-- linked migration-history gates have separate Owner approval.

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
  add column if not exists diagnostic_findings_selection jsonb,
  add column if not exists repair_line_items_selection jsonb;

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

alter table public.repair_orders
  drop constraint if exists repair_orders_repair_line_items_selection_v2_check;
alter table public.repair_orders
  add constraint repair_orders_repair_line_items_selection_v2_check
  check (
    repair_line_items_selection is null
    or public.repairdesk_fact_selection_v2_is_valid(
      repair_line_items_selection,
      'repair_outcome'
    )
  ) not valid;

alter table public.repair_orders validate constraint repair_orders_intake_intent_selection_v2_check;
alter table public.repair_orders validate constraint repair_orders_reported_symptoms_selection_v2_check;
alter table public.repair_orders validate constraint repair_orders_diagnostic_findings_selection_v2_check;
alter table public.repair_orders validate constraint repair_orders_repair_line_items_selection_v2_check;

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
  opened_by uuid references auth.users(id) on update cascade on delete set null,
  decided_by uuid references auth.users(id) on update cascade on delete set null,
  opened_at timestamptz not null default now(),
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

create index if not exists repair_order_episodes_source_opened_idx
  on public.repair_order_episodes (store_id, source_order_id, opened_at desc);
create index if not exists repair_order_relations_source_created_idx
  on public.repair_order_relations (store_id, source_order_id, created_at desc);
create index if not exists repair_order_relations_related_created_idx
  on public.repair_order_relations (store_id, related_order_id, created_at desc);

alter table public.repair_order_episodes enable row level security;
alter table public.repair_order_relations enable row level security;
alter table public.repairdesk_related_order_operations enable row level security;
revoke all on table public.repair_order_episodes from public, anon, authenticated, service_role;
revoke all on table public.repair_order_relations from public, anon, authenticated, service_role;
revoke all on table public.repairdesk_related_order_operations from public, anon, authenticated, service_role;
grant select, insert, update on table public.repair_order_episodes to service_role;
grant select, insert, update on table public.repair_order_relations to service_role;
grant select, insert, update on table public.repairdesk_related_order_operations to service_role;

create or replace function public.repairdesk_create_related_order_v2(
  p_store_id uuid,
  p_source_order_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_request_hash text,
  p_payload jsonb,
  p_relation_type text,
  p_triage_selection jsonb,
  p_triage_legacy_text text,
  p_disposition_selection jsonb,
  p_disposition_legacy_text text
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
  v_result jsonb;
  v_actor_email text;
  v_actor_name text;
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or p_source_order_id is null or p_actor_id is null
     or p_operation_id is null or coalesce(p_request_hash, '') !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_payload) <> 'object'
     or p_relation_type not in ('warranty_rework', 'related_new_fault', 'followup') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if public.repairdesk_reason_selection_v2_is_valid(
       p_triage_selection,
       'rework.triage'
     ) is not true
     or public.repairdesk_reason_selection_v2_is_valid(
       p_disposition_selection,
       'rework.disposition'
     ) is not true
     or char_length(btrim(coalesce(p_triage_legacy_text, ''))) not between 1 and 2000
     or char_length(btrim(coalesce(p_disposition_legacy_text, ''))) not between 1 and 2000 then
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
      return v_existing.response_summary || jsonb_build_object('replayed', true);
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
  if v_source.customer_id is null or v_source.device_id is null
     or nullif(p_payload ->> 'customer_id', '')::uuid is distinct from v_source.customer_id
     or nullif(p_payload ->> 'device_id', '')::uuid is distinct from v_source.device_id then
    return jsonb_build_object('ok', false, 'code', 'source_identity_mismatch');
  end if;

  select profile.email, coalesce(membership.display_name, profile.display_name, profile.email)
    into v_actor_email, v_actor_name
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
     and membership.role::text <> 'viewer'
   limit 1;
  if v_actor_name is null then return jsonb_build_object('ok', false, 'code', 'actor_forbidden'); end if;

  v_create_result := public.repairdesk_create_order_v2(
    p_store_id,
    p_actor_id,
    p_operation_id,
    p_request_hash,
    p_payload
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
     set original_order_id = p_source_order_id
   where store_id = p_store_id and id = v_related_order_id
     and original_order_id is null;

  insert into public.repair_order_episodes (
    store_id, source_order_id, active_order_id, status,
    triage_selection, triage_legacy_text,
    disposition_selection, disposition_legacy_text,
    opened_by, decided_by, opened_at, decided_at, created_at, updated_at
  ) values (
    p_store_id, p_source_order_id, v_related_order_id, 'decided',
    p_triage_selection, btrim(p_triage_legacy_text),
    p_disposition_selection, btrim(p_disposition_legacy_text),
    p_actor_id, p_actor_id, v_now, v_now, v_now, v_now
  )
  returning id into v_episode_id;

  insert into public.repair_order_relations (
    store_id, episode_id, source_order_id, related_order_id,
    relation_type, created_by, created_at
  ) values (
    p_store_id, v_episode_id, p_source_order_id, v_related_order_id,
    p_relation_type, p_actor_id, v_now
  );

  insert into public.order_events (
    id, store_id, order_id, event_type, payload, operator_name, created_at
  ) values (
    gen_random_uuid(), p_store_id, p_source_order_id, 'note',
    jsonb_build_object(
      'action', 'related_order_created',
      'related_order_id', v_related_order_id,
      'episode_id', v_episode_id,
      'relation_type', p_relation_type,
      'triage_selection', p_triage_selection,
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
    'create_related_order', 'repair_order', p_source_order_id::text,
    jsonb_build_object(
      'related_order_id', v_related_order_id,
      'episode_id', v_episode_id,
      'relation_type', p_relation_type
    ),
    v_now
  );

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'created',
    'source_order_id', p_source_order_id,
    'related_order_id', v_related_order_id,
    'episode_id', v_episode_id,
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
  uuid, uuid, uuid, uuid, text, jsonb, text, jsonb, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_create_related_order_v2(
  uuid, uuid, uuid, uuid, text, jsonb, text, jsonb, text, jsonb, text
) to service_role;

comment on column public.repair_orders.intake_intent_selection is
  'Current structured intake intent. Null means legacy/unclassified text.';
comment on table public.repair_order_episodes is
  'After-close return episode. Triage is not a warranty or free-repair decision.';
comment on table public.repair_order_relations is
  'Same-store auditable order relation; source finance and terminal evidence remain unchanged.';

notify pgrst, 'reload schema';
