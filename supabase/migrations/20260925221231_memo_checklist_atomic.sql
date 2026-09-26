-- Structured checklist support for store Todo memos.
-- Expand-only: existing rows remain valid with an empty checklist. The V1 RPC
-- signature stays available as a compatibility wrapper and cannot bypass the
-- checklist-derived parent status.

set lock_timeout = '5s';

create or replace function private.repairdesk_memo_checklist_is_valid(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(value) <> 'array' then false else
    pg_catalog.jsonb_array_length(value) <= 100
      and not exists (
        select 1
        from pg_catalog.jsonb_array_elements(value) as item
        where pg_catalog.jsonb_typeof(item) <> 'object'
           or (item - 'id' - 'text' - 'completed') <> '{}'::jsonb
           or not (item ?& array['id','text','completed'])
           or coalesce(item->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           or pg_catalog.jsonb_typeof(item->'text') <> 'string'
           or item->>'text' <> pg_catalog.btrim(item->>'text')
           or pg_catalog.char_length(item->>'text') not between 1 and 200
           or pg_catalog.jsonb_typeof(item->'completed') <> 'boolean'
      )
      and (
        select pg_catalog.count(*) = pg_catalog.count(distinct item->>'id')
        from pg_catalog.jsonb_array_elements(value) as item
      )
    end;
$$;

create or replace function private.repairdesk_memo_checklist_total(value jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$ select case when pg_catalog.jsonb_typeof(value) = 'array' then pg_catalog.jsonb_array_length(value) else 0 end $$;

create or replace function private.repairdesk_memo_checklist_completed(value jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(pg_catalog.count(*) filter (where (item->>'completed')::boolean), 0)::integer
  from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(value) = 'array' then value else '[]'::jsonb end) as item;
$$;

create or replace function private.repairdesk_memo_checklist_search_text(value jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(pg_catalog.string_agg(item->>'text', E'\n' order by ordinal), '')
  from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(value) = 'array' then value else '[]'::jsonb end)
    with ordinality as entry(item, ordinal);
$$;

alter table public.store_memos
  add column checklist jsonb not null default '[]'::jsonb,
  add column checklist_total integer generated always as
    (private.repairdesk_memo_checklist_total(checklist)) stored,
  add column checklist_completed integer generated always as
    (private.repairdesk_memo_checklist_completed(checklist)) stored,
  add column checklist_search_text text generated always as
    (private.repairdesk_memo_checklist_search_text(checklist)) stored,
  add constraint store_memos_checklist_valid_check
    check (private.repairdesk_memo_checklist_is_valid(checklist)),
  add constraint store_memos_note_checklist_empty_check
    check (kind = 'todo' or checklist = '[]'::jsonb);

alter table public.store_memo_operation_receipts
  drop constraint store_memo_operation_receipts_operation_type_check,
  add constraint store_memo_operation_receipts_operation_type_check check (operation_type in (
    'create', 'update', 'claim', 'complete', 'reopen', 'archive', 'restore', 'set_checklist_item'
  ));

create or replace function public.repairdesk_mutate_store_memo_v2_rpc(
  p_store_id uuid,
  p_actor_user_id uuid,
  p_actor_membership_id uuid,
  p_operation text,
  p_operation_id uuid,
  p_memo_id uuid default null,
  p_expected_version bigint default null,
  p_kind text default null,
  p_title text default null,
  p_content text default null,
  p_due_at timestamptz default null,
  p_assignee_membership_id uuid default null,
  p_checklist jsonb default null,
  p_checklist_item_id uuid default null,
  p_checklist_item_completed boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.store_memberships%rowtype;
  v_memo public.store_memos%rowtype;
  v_receipt public.store_memo_operation_receipts%rowtype;
  v_hash char(64);
  v_display_name text;
  v_now timestamptz;
  v_request jsonb;
  v_next_checklist jsonb;
  v_next_status text;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended(p_store_id::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();
  select membership.* into v_actor
    from public.store_memberships membership
    join public.stores store_row on store_row.id = membership.store_id
    join public.store_lifecycles lifecycle on lifecycle.store_id = store_row.id
   where membership.id = p_actor_membership_id
     and membership.store_id = p_store_id
     and membership.user_id = p_actor_user_id
     and membership.status::text = 'active'
     and store_row.status::text = 'active'
     and lifecycle.phase::text = 'active'
   for update of membership;
  if not found then raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN'; end if;
  if p_operation not in ('create','update','claim','complete','reopen','archive','restore','set_checklist_item') then
    raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
  end if;
  if p_operation <> 'create' and p_expected_version is null then
    raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_actor_membership_id::text, 0)
  );

  v_request := pg_catalog.jsonb_build_object(
    'storeId', p_store_id,
    'actorMembershipId', p_actor_membership_id,
    'operation', p_operation,
    'memoId', p_memo_id,
    'expectedVersion', p_expected_version,
    'kind', p_kind,
    'title', p_title,
    'content', p_content,
    'dueAt', p_due_at,
    'assigneeMembershipId', p_assignee_membership_id
  );
  if p_checklist is not null then
    v_request := v_request || pg_catalog.jsonb_build_object('checklist', p_checklist);
  end if;
  if p_operation = 'set_checklist_item' then
    v_request := v_request || pg_catalog.jsonb_build_object(
      'checklistItemId', p_checklist_item_id,
      'checklistItemCompleted', p_checklist_item_completed
    );
  end if;
  v_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(v_request::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select * into v_receipt from public.store_memo_operation_receipts
   where store_id = p_store_id and actor_membership_id = p_actor_membership_id
     and idempotency_key = p_operation_id for update;
  if found then
    if v_receipt.request_hash <> v_hash then
      raise exception using errcode = 'P0001', message = 'MEMO_IDEMPOTENCY_CONFLICT';
    end if;
    select * into v_memo from public.store_memos
      where id = v_receipt.result_memo_id and store_id = p_store_id;
    return pg_catalog.jsonb_build_object(
      'memo', pg_catalog.to_jsonb(v_memo),
      'replayed', true,
      'appliedVersion', v_receipt.result_version
    );
  end if;

  v_display_name := coalesce(nullif(pg_catalog.btrim(v_actor.display_name), ''), pg_catalog.split_part(v_actor.email, '@', 1), '员工');

  if p_operation = 'create' then
    if v_actor.role::text = 'viewer' then raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN'; end if;
    v_next_checklist := coalesce(p_checklist, '[]'::jsonb);
    if p_kind not in ('note','todo') or nullif(pg_catalog.btrim(p_title),'') is null
       or pg_catalog.char_length(pg_catalog.btrim(p_title)) > 120
       or pg_catalog.char_length(coalesce(p_content,'')) > 4000
       or not private.repairdesk_memo_checklist_is_valid(v_next_checklist)
       or (p_kind = 'note' and v_next_checklist <> '[]'::jsonb) then
      raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
    end if;
    if p_kind = 'note' and (p_due_at is not null or p_assignee_membership_id is not null) then
      raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
    end if;
    if p_assignee_membership_id is not null and not exists(
      select 1 from public.store_memberships where id = p_assignee_membership_id
        and store_id = p_store_id and status::text = 'active') then
      raise exception using errcode = 'P0001', message = 'MEMO_ASSIGNEE_INVALID';
    end if;
    if v_actor.role::text in ('technician','sales')
       and p_assignee_membership_id is distinct from p_actor_membership_id
       and p_assignee_membership_id is not null then
      raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN';
    end if;
    v_next_status := case
      when p_kind = 'note' then null
      when private.repairdesk_memo_checklist_total(v_next_checklist) > 0
       and private.repairdesk_memo_checklist_total(v_next_checklist) = private.repairdesk_memo_checklist_completed(v_next_checklist)
        then 'completed'
      else 'pending'
    end;
    insert into public.store_memos(
      store_id, kind, title, content, checklist, todo_status, due_at, assignee_membership_id,
      created_by_membership_id, updated_by_membership_id,
      created_by_name_snapshot, updated_by_name_snapshot, create_request_id,
      completed_by_membership_id, completed_at
    ) values (
      p_store_id, p_kind, pg_catalog.btrim(p_title), coalesce(p_content,''), v_next_checklist,
      v_next_status,
      case when p_kind = 'todo' then p_due_at else null end,
      case when p_kind = 'todo' then p_assignee_membership_id else null end,
      p_actor_membership_id, p_actor_membership_id, v_display_name, v_display_name, p_operation_id,
      case when v_next_status = 'completed' then p_actor_membership_id else null end,
      case when v_next_status = 'completed' then v_now else null end
    ) returning * into v_memo;
  else
    select * into v_memo from public.store_memos
     where id = p_memo_id and store_id = p_store_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'MEMO_NOT_FOUND'; end if;
    if v_memo.version <> p_expected_version then
      raise exception using errcode = 'P0001', message = 'MEMO_VERSION_CONFLICT';
    end if;

    if p_operation in ('archive','restore') and v_actor.role::text not in ('owner','manager') then
      raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN';
    end if;
    if p_operation in ('update','claim','complete','reopen','set_checklist_item') and v_actor.role::text = 'viewer' then
      raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN';
    end if;
    if p_operation = 'update'
       and v_actor.role::text in ('technician','sales')
       and v_memo.created_by_membership_id <> p_actor_membership_id then
      raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN';
    end if;
    if p_operation in ('complete','reopen','set_checklist_item')
       and v_actor.role::text in ('technician','sales')
       and v_memo.created_by_membership_id <> p_actor_membership_id
       and v_memo.assignee_membership_id is distinct from p_actor_membership_id then
      raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN';
    end if;
    if p_operation <> 'restore' and v_memo.archived_at is not null then
      raise exception using errcode = 'P0001', message = 'MEMO_ARCHIVED';
    end if;

    if p_operation = 'update' then
      v_next_checklist := case when p_checklist is null then v_memo.checklist else p_checklist end;
      if nullif(pg_catalog.btrim(p_title),'') is null
         or pg_catalog.char_length(pg_catalog.btrim(p_title)) > 120
         or pg_catalog.char_length(coalesce(p_content,'')) > 4000
         or not private.repairdesk_memo_checklist_is_valid(v_next_checklist)
         or (v_memo.kind = 'note' and v_next_checklist <> '[]'::jsonb) then
        raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
      end if;
      if v_memo.kind = 'note' and (p_due_at is not null or p_assignee_membership_id is not null) then
        raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
      end if;
      if p_assignee_membership_id is not null and not exists(
        select 1 from public.store_memberships where id = p_assignee_membership_id
          and store_id = p_store_id and status::text = 'active') then
        raise exception using errcode = 'P0001', message = 'MEMO_ASSIGNEE_INVALID';
      end if;
      if v_actor.role::text in ('technician','sales')
         and p_assignee_membership_id is distinct from v_memo.assignee_membership_id
         and not (v_memo.assignee_membership_id is null and p_assignee_membership_id = p_actor_membership_id) then
        raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN';
      end if;
      v_next_status := case
        when v_memo.kind = 'note' then null
        when private.repairdesk_memo_checklist_total(v_next_checklist) = 0 then v_memo.todo_status
        when private.repairdesk_memo_checklist_total(v_next_checklist) = private.repairdesk_memo_checklist_completed(v_next_checklist) then 'completed'
        else 'pending'
      end;
      update public.store_memos set
        title=pg_catalog.btrim(p_title), content=coalesce(p_content,''), checklist=v_next_checklist,
        due_at=case when kind='todo' then p_due_at else null end,
        assignee_membership_id=case when kind='todo' then p_assignee_membership_id else null end,
        todo_status=v_next_status,
        completed_by_membership_id=case when v_next_status='completed' then coalesce(completed_by_membership_id,p_actor_membership_id) else null end,
        completed_at=case when v_next_status='completed' then coalesce(completed_at,v_now) else null end,
        updated_by_membership_id=p_actor_membership_id, updated_by_name_snapshot=v_display_name,
        updated_at=v_now, version=version+1 where id=v_memo.id returning * into v_memo;
    elsif p_operation = 'set_checklist_item' then
      if v_memo.kind <> 'todo' or p_checklist_item_id is null or p_checklist_item_completed is null then
        raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
      end if;
      if not exists (
        select 1 from pg_catalog.jsonb_array_elements(v_memo.checklist) item
        where item->>'id' = p_checklist_item_id::text
      ) then
        raise exception using errcode = 'P0001', message = 'MEMO_CHECKLIST_ITEM_NOT_FOUND';
      end if;
      select pg_catalog.jsonb_agg(
        case when item->>'id' = p_checklist_item_id::text
          then pg_catalog.jsonb_set(item, '{completed}', pg_catalog.to_jsonb(p_checklist_item_completed), false)
          else item end order by ordinal
      ) into v_next_checklist
      from pg_catalog.jsonb_array_elements(v_memo.checklist) with ordinality as entry(item, ordinal);
      v_next_status := case
        when private.repairdesk_memo_checklist_total(v_next_checklist) > 0
         and private.repairdesk_memo_checklist_total(v_next_checklist) = private.repairdesk_memo_checklist_completed(v_next_checklist)
          then 'completed'
        else 'pending'
      end;
      update public.store_memos set checklist=v_next_checklist, todo_status=v_next_status,
        completed_by_membership_id=case when v_next_status='completed' then p_actor_membership_id else null end,
        completed_at=case when v_next_status='completed' then coalesce(completed_at,v_now) else null end,
        updated_by_membership_id=p_actor_membership_id, updated_by_name_snapshot=v_display_name,
        updated_at=v_now, version=version+1 where id=v_memo.id returning * into v_memo;
    elsif p_operation = 'claim' then
      if v_memo.kind <> 'todo' or v_memo.todo_status <> 'pending' then
        raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
      end if;
      if v_memo.assignee_membership_id is not null then
        raise exception using errcode = 'P0001', message = 'MEMO_ALREADY_CLAIMED';
      end if;
      update public.store_memos set assignee_membership_id=p_actor_membership_id,
        updated_by_membership_id=p_actor_membership_id, updated_by_name_snapshot=v_display_name,
        updated_at=v_now, version=version+1 where id=v_memo.id returning * into v_memo;
    elsif p_operation = 'complete' then
      if v_memo.checklist_total > 0 then
        raise exception using errcode = 'P0001', message = 'MEMO_CHECKLIST_MANAGED';
      end if;
      if v_memo.kind <> 'todo' or v_memo.todo_status <> 'pending' then
        raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
      end if;
      update public.store_memos set todo_status='completed', completed_at=v_now,
        completed_by_membership_id=p_actor_membership_id,
        updated_by_membership_id=p_actor_membership_id, updated_by_name_snapshot=v_display_name,
        updated_at=v_now, version=version+1 where id=v_memo.id returning * into v_memo;
    elsif p_operation = 'reopen' then
      if v_memo.checklist_total > 0 then
        raise exception using errcode = 'P0001', message = 'MEMO_CHECKLIST_MANAGED';
      end if;
      if v_memo.kind <> 'todo' or v_memo.todo_status <> 'completed' then
        raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
      end if;
      update public.store_memos set todo_status='pending', completed_at=null,
        completed_by_membership_id=null, updated_by_membership_id=p_actor_membership_id,
        updated_by_name_snapshot=v_display_name, updated_at=v_now, version=version+1
        where id=v_memo.id returning * into v_memo;
    elsif p_operation = 'archive' then
      update public.store_memos set archived_at=v_now, archived_by_membership_id=p_actor_membership_id,
        updated_by_membership_id=p_actor_membership_id, updated_by_name_snapshot=v_display_name,
        updated_at=v_now, version=version+1 where id=v_memo.id returning * into v_memo;
    elsif p_operation = 'restore' then
      if v_memo.archived_at is null then
        raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
      end if;
      update public.store_memos set archived_at=null, archived_by_membership_id=null,
        updated_by_membership_id=p_actor_membership_id, updated_by_name_snapshot=v_display_name,
        updated_at=v_now, version=version+1 where id=v_memo.id returning * into v_memo;
    end if;
  end if;

  insert into public.store_memo_operation_receipts(
    store_id, actor_membership_id, operation_type, idempotency_key,
    request_hash, result_memo_id, result_version
  ) values (p_store_id, p_actor_membership_id, p_operation, p_operation_id,
    v_hash, v_memo.id, v_memo.version);

  insert into public.audit_logs(
    id, actor_id, actor_name, store_id, action, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid(), p_actor_user_id, v_display_name, p_store_id,
    'memo_' || p_operation, 'store_memo', v_memo.id,
    pg_catalog.jsonb_build_object('operation_id', p_operation_id, 'kind', v_memo.kind,
      'status', v_memo.todo_status, 'version', v_memo.version,
      'checklist_total', v_memo.checklist_total, 'checklist_completed', v_memo.checklist_completed), v_now
  );
  return pg_catalog.jsonb_build_object(
    'memo', pg_catalog.to_jsonb(v_memo),
    'replayed', false,
    'appliedVersion', v_memo.version
  );
end;
$$;

alter function public.repairdesk_mutate_store_memo_v2_rpc(
  uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid,jsonb,uuid,boolean
) owner to postgres;
revoke all on function public.repairdesk_mutate_store_memo_v2_rpc(
  uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid,jsonb,uuid,boolean
) from public, anon, authenticated;
grant execute on function public.repairdesk_mutate_store_memo_v2_rpc(
  uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid,jsonb,uuid,boolean
) to service_role;

create or replace function public.repairdesk_mutate_store_memo_rpc(
  p_store_id uuid,
  p_actor_user_id uuid,
  p_actor_membership_id uuid,
  p_operation text,
  p_operation_id uuid,
  p_memo_id uuid default null,
  p_expected_version bigint default null,
  p_kind text default null,
  p_title text default null,
  p_content text default null,
  p_due_at timestamptz default null,
  p_assignee_membership_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.repairdesk_mutate_store_memo_v2_rpc(
    p_store_id, p_actor_user_id, p_actor_membership_id, p_operation, p_operation_id,
    p_memo_id, p_expected_version, p_kind, p_title, p_content, p_due_at,
    p_assignee_membership_id, null, null, null
  );
$$;

alter function public.repairdesk_mutate_store_memo_rpc(
  uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid
) owner to postgres;
revoke all on function public.repairdesk_mutate_store_memo_rpc(
  uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid
) from public, anon, authenticated;
grant execute on function public.repairdesk_mutate_store_memo_rpc(
  uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid
) to service_role;

comment on column public.store_memos.checklist is 'Ordered structured Todo checklist; empty for notes.';
comment on function public.repairdesk_mutate_store_memo_v2_rpc(
  uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid,jsonb,uuid,boolean
) is 'Atomic memo and checklist mutation with ACL, CAS, idempotency, aggregate status, audit and revision.';

select pg_catalog.pg_notify('pgrst', 'reload schema');

reset lock_timeout;
