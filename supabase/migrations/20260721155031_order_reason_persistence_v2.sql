-- Phase 3 expand-only candidate. Do not apply until the linked migration-history
-- gate, backup evidence, and Owner data approval are complete.

create or replace function public.repairdesk_reason_selection_v2_is_valid(
  p_selection jsonb,
  p_expected_context text
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
    and p_selection ->> 'kind' in ('preset', 'other')
    and p_selection ->> 'context' = p_expected_context
    and ((p_selection ->> 'kind' = 'other') = (p_selection ->> 'primary_code' = 'other'))
    and char_length(btrim(coalesce(p_selection ->> 'primary_code', ''))) between 1 and 120
    and char_length(btrim(coalesce(p_selection ->> 'catalog_revision', ''))) between 1 and 160
    and (
      not (p_selection ? 'detail_codes')
      or p_selection -> 'detail_codes' = '[]'::jsonb
    )
    and (
      p_selection ->> 'kind' <> 'other'
      or (
        p_selection ->> 'primary_code' = 'other'
        and char_length(btrim(coalesce(p_selection ->> 'note', ''))) between 1 and 1000
      )
    )
    and jsonb_typeof(p_selection -> 'internal_snapshot') = 'object'
    and p_selection #>> '{internal_snapshot,locale}' = 'zh-CN'
    and char_length(btrim(coalesce(p_selection #>> '{internal_snapshot,text}', ''))) between 1 and 2000
  ), false);
$$;

revoke all on function public.repairdesk_reason_selection_v2_is_valid(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_reason_selection_v2_is_valid(jsonb, text)
  to service_role;

create or replace function public.repairdesk_reason_selection_v2_audit_metadata(
  p_selection jsonb
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'schema_version', p_selection -> 'schema_version',
    'kind', p_selection -> 'kind',
    'context', p_selection -> 'context',
    'primary_code', p_selection -> 'primary_code',
    'detail_codes', p_selection -> 'detail_codes',
    'catalog_revision', p_selection -> 'catalog_revision',
    'has_note', coalesce(char_length(btrim(p_selection ->> 'note')) > 0, false)
  ));
$$;

revoke all on function public.repairdesk_reason_selection_v2_audit_metadata(jsonb)
  from public, anon, authenticated;
grant execute on function public.repairdesk_reason_selection_v2_audit_metadata(jsonb)
  to service_role;

alter table public.order_terminal_operations
  add column if not exists reason_selection jsonb;

alter table public.order_terminal_operations
  drop constraint if exists order_terminal_operations_reason_selection_v2_check;
alter table public.order_terminal_operations
  add constraint order_terminal_operations_reason_selection_v2_check
  check (
    reason_selection is null
    or public.repairdesk_reason_selection_v2_is_valid(
      reason_selection,
      case operation_type
        when 'correction' then 'terminal.correct'
        when 'reopen' then 'terminal.reopen'
        when 'void' then 'terminal.void'
        else reason_selection ->> 'context'
      end
    )
  ) not valid;
alter table public.order_terminal_operations
  validate constraint order_terminal_operations_reason_selection_v2_check;

alter table public.order_initial_deposit_corrections
  add column if not exists reason_selection jsonb;

alter table public.order_initial_deposit_corrections
  drop constraint if exists order_initial_deposit_reason_selection_v2_check;
alter table public.order_initial_deposit_corrections
  add constraint order_initial_deposit_reason_selection_v2_check
  check (
    reason_selection is null
    or public.repairdesk_reason_selection_v2_is_valid(
      reason_selection,
      'finance.initial_deposit_correction'
    )
  ) not valid;
alter table public.order_initial_deposit_corrections
  validate constraint order_initial_deposit_reason_selection_v2_check;

revoke insert, update, delete on table public.order_terminal_operations
  from anon, authenticated;
revoke insert, update, delete on table public.order_initial_deposit_corrections
  from anon, authenticated;
grant update (reason_selection) on table public.order_terminal_operations to service_role;
grant update (reason_selection) on table public.order_initial_deposit_corrections to service_role;

alter table public.order_workflow_transitions
  add column if not exists reason_policy_context text,
  add column if not exists reason_policy jsonb,
  add column if not exists reason_catalog_revision text;

alter table public.order_workflow_transitions
  drop constraint if exists order_workflow_transitions_reason_policy_check;
alter table public.order_workflow_transitions
  add constraint order_workflow_transitions_reason_policy_check
  check (
    (reason_policy_context is null and reason_policy is null and reason_catalog_revision is null)
    or coalesce((
      char_length(btrim(reason_policy_context)) between 1 and 160
      and jsonb_typeof(reason_policy) = 'object'
      and reason_policy ->> 'policy' in ('none', 'optional', 'required')
      and char_length(btrim(reason_catalog_revision)) between 1 and 160
    ), false)
  ) not valid;
alter table public.order_workflow_transitions
  validate constraint order_workflow_transitions_reason_policy_check;

create or replace function public.repairdesk_apply_terminal_operation_v2(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_operation text,
  p_reason text,
  p_reason_selection jsonb,
  p_changes jsonb default '{}'::jsonb,
  p_to_status text default null,
  p_confirm_public_no text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected_context text;
  v_existing public.order_terminal_operations%rowtype;
  v_result jsonb;
  v_operation_id uuid;
  v_row_count integer;
begin
  v_expected_context := case p_operation
    when 'correction' then 'terminal.correct'
    when 'reopen' then 'terminal.reopen'
    when 'void' then 'terminal.void'
    else null
  end;
  if v_expected_context is null
     or public.repairdesk_reason_selection_v2_is_valid(
       p_reason_selection,
       v_expected_context
     ) is not true
     or btrim(coalesce(p_reason, '')) is distinct from
        btrim(coalesce(p_reason_selection #>> '{internal_snapshot,text}', '')) then
    return jsonb_build_object('ok', false, 'code', 'invalid_reason_selection');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );
  select operation.* into v_existing
    from public.order_terminal_operations as operation
   where operation.store_id = p_store_id
     and operation.idempotency_key = p_idempotency_key;
  if found and (
    v_existing.order_id <> p_order_id
    or v_existing.actor_id is distinct from p_actor_id
    or v_existing.operation_type <> p_operation
    or v_existing.reason_selection is null
    or v_existing.reason_selection <> p_reason_selection
  ) then
    return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
  end if;

  v_result := public.repairdesk_apply_terminal_operation(
    p_store_id,
    p_order_id,
    p_actor_id,
    p_expected_updated_at,
    p_idempotency_key,
    p_operation,
    p_reason,
    coalesce(p_changes, '{}'::jsonb),
    p_to_status,
    p_confirm_public_no
  );
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    return v_result;
  end if;

  v_operation_id := nullif(v_result ->> 'operation_id', '')::uuid;
  update public.order_terminal_operations
     set reason_selection = p_reason_selection
   where store_id = p_store_id and id = v_operation_id;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then raise exception 'terminal operation snapshot invariant failed'; end if;
  update public.order_events
     set payload = jsonb_set(payload, '{reason_selection}', p_reason_selection, true)
   where store_id = p_store_id
     and order_id = p_order_id
     and payload ->> 'operation_id' = v_operation_id::text;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then raise exception 'terminal event snapshot invariant failed'; end if;
  update public.audit_logs
     set metadata = jsonb_set(
       coalesce(metadata, '{}'::jsonb),
       '{reason_selection}',
       public.repairdesk_reason_selection_v2_audit_metadata(p_reason_selection),
       true
     )
   where store_id = p_store_id
     and entity_type = 'repair_order'
     and entity_id = p_order_id::text
     and metadata ->> 'operation_id' = v_operation_id::text;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then raise exception 'terminal audit snapshot invariant failed'; end if;
  return v_result;
end;
$$;

revoke all on function public.repairdesk_apply_terminal_operation_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, text, jsonb, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_apply_terminal_operation_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, text, jsonb, jsonb, text, text
) to service_role;

create or replace function public.repairdesk_correct_terminal_order_v2(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_changes jsonb,
  p_reason text,
  p_reason_selection jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.repairdesk_apply_terminal_operation_v2(
    p_store_id, p_order_id, p_actor_id, p_expected_updated_at, p_idempotency_key,
    'correction', p_reason, p_reason_selection, p_changes, null, null
  );
$$;

create or replace function public.repairdesk_reopen_terminal_order_v2(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_to_status text,
  p_reason text,
  p_reason_selection jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.repairdesk_apply_terminal_operation_v2(
    p_store_id, p_order_id, p_actor_id, p_expected_updated_at, p_idempotency_key,
    'reopen', p_reason, p_reason_selection, '{}'::jsonb, p_to_status, null
  );
$$;

create or replace function public.repairdesk_void_order_v2(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_reason text,
  p_reason_selection jsonb,
  p_confirm_public_no text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.repairdesk_apply_terminal_operation_v2(
    p_store_id, p_order_id, p_actor_id, p_expected_updated_at, p_idempotency_key,
    'void', p_reason, p_reason_selection, '{}'::jsonb, null, p_confirm_public_no
  );
$$;

revoke all on function public.repairdesk_correct_terminal_order_v2(
  uuid, uuid, uuid, timestamptz, uuid, jsonb, text, jsonb
) from public, anon, authenticated;
revoke all on function public.repairdesk_reopen_terminal_order_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.repairdesk_void_order_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_correct_terminal_order_v2(
  uuid, uuid, uuid, timestamptz, uuid, jsonb, text, jsonb
) to service_role;
grant execute on function public.repairdesk_reopen_terminal_order_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, text, jsonb
) to service_role;
grant execute on function public.repairdesk_void_order_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, jsonb, text
) to service_role;

create or replace function public.repairdesk_correct_initial_deposit_v2(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_deposit_amount numeric,
  p_reason text,
  p_reason_selection jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.order_initial_deposit_corrections%rowtype;
  v_result jsonb;
  v_correction_id uuid;
  v_row_count integer;
begin
  if public.repairdesk_reason_selection_v2_is_valid(
    p_reason_selection,
    'finance.initial_deposit_correction'
  ) is not true
     or btrim(coalesce(p_reason, '')) is distinct from
        btrim(coalesce(p_reason_selection #>> '{internal_snapshot,text}', '')) then
    return jsonb_build_object('ok', false, 'code', 'invalid_reason_selection');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );
  select correction.* into v_existing
    from public.order_initial_deposit_corrections as correction
   where correction.store_id = p_store_id
     and correction.idempotency_key = p_idempotency_key;
  if found and (
    v_existing.order_id <> p_order_id
    or v_existing.actor_id is distinct from p_actor_id
    or v_existing.reason_selection is null
    or v_existing.reason_selection <> p_reason_selection
  ) then
    return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
  end if;

  v_result := public.repairdesk_correct_initial_deposit(
    p_store_id,
    p_order_id,
    p_actor_id,
    p_expected_updated_at,
    p_idempotency_key,
    p_deposit_amount,
    p_reason
  );
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    return v_result;
  end if;

  v_correction_id := nullif(v_result ->> 'correction_id', '')::uuid;
  update public.order_initial_deposit_corrections
     set reason_selection = p_reason_selection
   where store_id = p_store_id and id = v_correction_id;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then raise exception 'deposit correction snapshot invariant failed'; end if;
  update public.order_events
     set payload = jsonb_set(payload, '{reason_selection}', p_reason_selection, true)
   where store_id = p_store_id
     and order_id = p_order_id
     and payload ->> 'correction_id' = v_correction_id::text;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then raise exception 'deposit event snapshot invariant failed'; end if;
  update public.audit_logs
     set metadata = jsonb_set(
       coalesce(metadata, '{}'::jsonb),
       '{reason_selection}',
       public.repairdesk_reason_selection_v2_audit_metadata(p_reason_selection),
       true
     )
   where store_id = p_store_id
     and entity_type = 'repair_order'
     and entity_id = p_order_id::text
     and metadata ->> 'correction_id' = v_correction_id::text;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then raise exception 'deposit audit snapshot invariant failed'; end if;
  return v_result;
end;
$$;

revoke all on function public.repairdesk_correct_initial_deposit_v2(
  uuid, uuid, uuid, timestamptz, uuid, numeric, text, jsonb
) from public, anon, authenticated;
grant execute on function public.repairdesk_correct_initial_deposit_v2(
  uuid, uuid, uuid, timestamptz, uuid, numeric, text, jsonb
) to service_role;

comment on column public.order_terminal_operations.reason_selection is
  'Nullable immutable v2 reason snapshot. Legacy rows remain null.';
comment on column public.order_initial_deposit_corrections.reason_selection is
  'Nullable immutable v2 reason snapshot. Legacy rows remain null.';
comment on column public.order_workflow_transitions.reason_policy_context is
  'Optional edge-specific reason context; status-level defaults are not authoritative.';

notify pgrst, 'reload schema';
