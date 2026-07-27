-- Store-private shared memos and Todo V1.
-- Expand-only: creates server-only tables/RPC, extends private Realtime metadata,
-- and installs lifecycle fences. No existing business rows are rewritten.

set lock_timeout = '5s';

create table public.store_memos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  kind text not null check (kind in ('note', 'todo')),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  content text not null default '' check (char_length(content) <= 4000),
  todo_status text check (todo_status in ('pending', 'completed')),
  due_at timestamptz,
  assignee_membership_id uuid,
  created_by_membership_id uuid not null,
  updated_by_membership_id uuid not null,
  created_by_name_snapshot text not null check (char_length(created_by_name_snapshot) between 1 and 160),
  updated_by_name_snapshot text not null check (char_length(updated_by_name_snapshot) between 1 and 160),
  completed_by_membership_id uuid,
  completed_at timestamptz,
  archived_by_membership_id uuid,
  archived_at timestamptz,
  version bigint not null default 1 check (version >= 1),
  create_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_memos_id_store_unique unique(id, store_id),
  constraint store_memos_create_request_unique
    unique(store_id, created_by_membership_id, create_request_id),
  constraint store_memos_assignee_same_store_fkey
    foreign key (assignee_membership_id, store_id)
    references public.store_memberships(id, store_id) on update cascade on delete restrict,
  constraint store_memos_creator_same_store_fkey
    foreign key (created_by_membership_id, store_id)
    references public.store_memberships(id, store_id) on update cascade on delete restrict,
  constraint store_memos_updater_same_store_fkey
    foreign key (updated_by_membership_id, store_id)
    references public.store_memberships(id, store_id) on update cascade on delete restrict,
  constraint store_memos_completer_same_store_fkey
    foreign key (completed_by_membership_id, store_id)
    references public.store_memberships(id, store_id) on update cascade on delete restrict,
  constraint store_memos_archiver_same_store_fkey
    foreign key (archived_by_membership_id, store_id)
    references public.store_memberships(id, store_id) on update cascade on delete restrict,
  constraint store_memos_kind_fields_check check (
    (kind = 'note' and todo_status is null and due_at is null
      and assignee_membership_id is null and completed_by_membership_id is null
      and completed_at is null)
    or
    (kind = 'todo' and todo_status is not null
      and ((todo_status = 'completed' and completed_by_membership_id is not null and completed_at is not null)
        or (todo_status = 'pending' and completed_by_membership_id is null and completed_at is null)))
  ),
  constraint store_memos_archive_fields_check check (
    (archived_at is null and archived_by_membership_id is null)
    or (archived_at is not null and archived_by_membership_id is not null)
  ),
  constraint store_memos_time_order_check check (
    updated_at >= created_at
    and (completed_at is null or completed_at >= created_at)
    and (archived_at is null or archived_at >= created_at)
  )
);

create table public.store_memo_operation_receipts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete restrict,
  actor_membership_id uuid not null,
  operation_type text not null check (operation_type in (
    'create', 'update', 'claim', 'complete', 'reopen', 'archive', 'restore'
  )),
  idempotency_key uuid not null,
  request_hash char(64) not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result_memo_id uuid not null,
  result_version bigint not null check (result_version >= 1),
  created_at timestamptz not null default now(),
  constraint store_memo_receipts_actor_same_store_fkey
    foreign key (actor_membership_id, store_id)
    references public.store_memberships(id, store_id) on update cascade on delete restrict,
  constraint store_memo_receipts_memo_same_store_fkey
    foreign key (result_memo_id, store_id)
    references public.store_memos(id, store_id) on update cascade on delete restrict,
  constraint store_memo_receipts_idempotency_unique
    unique(store_id, actor_membership_id, idempotency_key)
);

-- Generic authenticated BFF limiter. It stores only a SHA-256 scope, fixed-window
-- counters and expiry metadata; it is not a memo business table or tenant export row.
create table if not exists public.repairdesk_authenticated_rate_limits (
  scope_hash char(64) not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  bucket text not null check (bucket in ('read', 'write')),
  window_started_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  expires_at timestamptz not null,
  primary key (scope_hash, bucket, window_started_at),
  constraint repairdesk_authenticated_rate_limits_expiry_check
    check (expires_at > window_started_at)
);

create index if not exists repairdesk_authenticated_rate_limits_expiry_idx
  on public.repairdesk_authenticated_rate_limits(expires_at);

create index store_memos_active_updated_idx
  on public.store_memos(store_id, archived_at, updated_at desc, id desc);
create index store_memos_pending_due_idx
  on public.store_memos(store_id, todo_status, due_at, id)
  where kind = 'todo' and archived_at is null;
create index store_memos_assignee_pending_idx
  on public.store_memos(store_id, assignee_membership_id, todo_status, due_at, id)
  where kind = 'todo' and archived_at is null;
create index store_memo_receipts_actor_recent_idx
  on public.store_memo_operation_receipts(store_id, actor_membership_id, created_at desc);

alter table public.store_memos enable row level security;
alter table public.store_memo_operation_receipts enable row level security;
alter table public.repairdesk_authenticated_rate_limits enable row level security;
revoke all on table public.store_memos from public, anon, authenticated, service_role;
revoke all on table public.store_memo_operation_receipts from public, anon, authenticated, service_role;
revoke all on table public.repairdesk_authenticated_rate_limits from public, anon, authenticated, service_role;
grant select, delete on table public.store_memos to service_role;
grant select, delete on table public.store_memo_operation_receipts to service_role;

drop trigger if exists repairdesk_lifecycle_fence_store_memos on public.store_memos;
create trigger repairdesk_lifecycle_fence_store_memos
before insert or update or delete on public.store_memos
for each row execute function public.repairdesk_enforce_active_store_write();

drop trigger if exists repairdesk_lifecycle_fence_store_memo_operation_receipts
  on public.store_memo_operation_receipts;
create trigger repairdesk_lifecycle_fence_store_memo_operation_receipts
before insert or update or delete on public.store_memo_operation_receipts
for each row execute function public.repairdesk_enforce_active_store_write();

create or replace function private.repairdesk_enforce_verified_memo_purge_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phase text;
begin
  select lifecycle.phase::text into v_phase
    from public.store_lifecycles lifecycle
   where lifecycle.store_id = old.store_id;
  if v_phase = 'active'
     or not public.repairdesk_purge_worker_write_allowed(old.store_id, 'delete') then
    raise exception using errcode = 'P0001', message = 'MEMO_HARD_DELETE_FORBIDDEN';
  end if;
  return old;
end;
$$;

alter function private.repairdesk_enforce_verified_memo_purge_delete() owner to postgres;
revoke all on function private.repairdesk_enforce_verified_memo_purge_delete()
  from public, anon, authenticated;

create trigger repairdesk_verified_purge_delete_store_memos
before delete on public.store_memos
for each row execute function private.repairdesk_enforce_verified_memo_purge_delete();

create trigger repairdesk_verified_purge_delete_store_memo_receipts
before delete on public.store_memo_operation_receipts
for each row execute function private.repairdesk_enforce_verified_memo_purge_delete();

alter table public.repairdesk_store_domain_versions
  drop constraint if exists repairdesk_store_domain_versions_domain_check;
alter table public.repairdesk_store_domain_versions
  add constraint repairdesk_store_domain_versions_domain_check
  check (domain in ('orders', 'customers', 'inventory', 'settings', 'memos'));

create or replace function private.can_receive_repairdesk_realtime_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_topic ~* '^repairdesk:v1:store:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:(orders|customers|inventory|settings|memos)$'
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
grant execute on function private.can_receive_repairdesk_realtime_topic(text) to authenticated;

create or replace function private.bump_repairdesk_memos_domain_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
  v_mutation text := case when tg_op = 'INSERT' then 'created' else 'updated' end;
  v_event_id uuid := gen_random_uuid();
  v_phase text;
begin
  -- Hard delete exists only inside the verified purge worker. Do not recreate a
  -- revision row or Broadcast while the tenant is being removed.
  if tg_op = 'DELETE' then return old; end if;

  select lifecycle.phase::text into v_phase
  from public.store_lifecycles lifecycle where lifecycle.store_id = v_store_id;
  if v_phase is distinct from 'active' then return new; end if;

  insert into public.repairdesk_store_domain_versions(store_id, domain, version, updated_at)
  values (v_store_id, 'memos', 1, clock_timestamp())
  on conflict (store_id, domain) do update set
    version = public.repairdesk_store_domain_versions.version + 1,
    updated_at = excluded.updated_at;

  begin
    perform realtime.send(
      jsonb_build_object(
        'schemaVersion', 1,
        'eventId', v_event_id::text,
        'emittedAt', clock_timestamp()::text,
        'storeId', v_store_id::text,
        'domain', 'memos',
        'mutation', v_mutation,
        'queryGroups', jsonb_build_array('memos.all')
      ),
      'repairdesk.realtime',
      'repairdesk:v1:store:' || v_store_id::text || ':memos',
      true
    );
  exception when others then
    raise warning 'RepairDesk memo invalidation Broadcast failed for store %', v_store_id;
  end;
  return new;
end;
$$;

alter function private.bump_repairdesk_memos_domain_version() owner to postgres;
revoke all on function private.bump_repairdesk_memos_domain_version() from public, anon, authenticated;

-- Forward repair: a verified tenant purge must not recreate an order revision
-- after deleting the tenant's last order-domain row. Active-store deletes still bump.
create or replace function private.bump_repairdesk_order_domain_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
  v_mutation text := case
    when tg_op = 'DELETE' then 'deleted'
    when tg_op = 'INSERT' then 'created'
    else 'updated'
  end;
  v_event_id uuid := gen_random_uuid();
  v_phase text;
begin
  if v_store_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' and public.repairdesk_purge_worker_write_allowed(v_store_id, 'delete') then
    select lifecycle.phase::text into v_phase
      from public.store_lifecycles lifecycle where lifecycle.store_id = v_store_id;
    if v_phase is distinct from 'active' then return old; end if;
  end if;

  insert into public.repairdesk_store_domain_versions(store_id, domain, version, updated_at)
  values (v_store_id, 'orders', 1, pg_catalog.clock_timestamp())
  on conflict (store_id, domain) do update set
    version = public.repairdesk_store_domain_versions.version + 1,
    updated_at = excluded.updated_at;
  begin
    perform realtime.send(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 1,
        'eventId', v_event_id::text,
        'emittedAt', pg_catalog.clock_timestamp()::text,
        'storeId', v_store_id::text,
        'domain', 'orders',
        'mutation', v_mutation,
        'queryGroups', pg_catalog.jsonb_build_array('orders.all', 'customers.all')
      ),
      'repairdesk.realtime',
      'repairdesk:v1:store:' || v_store_id::text || ':orders',
      true
    );
  exception when others then
    raise warning 'RepairDesk order invalidation Broadcast failed for store %', v_store_id;
  end;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

alter function private.bump_repairdesk_order_domain_version() owner to postgres;
revoke all on function private.bump_repairdesk_order_domain_version()
  from public, anon, authenticated;

create trigger repairdesk_realtime_memos_revision
after insert or update or delete on public.store_memos
for each row execute function private.bump_repairdesk_memos_domain_version();

create or replace function public.repairdesk_consume_authenticated_rate_limit_rpc(
  p_scope_hash char(64),
  p_bucket text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_window timestamptz := pg_catalog.date_trunc('minute', v_now);
  v_count integer;
  v_limit integer;
begin
  if p_scope_hash is null or p_scope_hash !~ '^[0-9a-f]{64}$'
     or p_bucket not in ('read', 'write') then
    raise exception using errcode = 'P0001', message = 'RATE_LIMIT_INVALID_INPUT';
  end if;
  v_limit := case when p_bucket = 'write' then 30 else 120 end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_scope_hash::text || ':' || p_bucket, 0)
  );
  delete from public.repairdesk_authenticated_rate_limits
   where ctid in (
     select ctid from public.repairdesk_authenticated_rate_limits
      where expires_at < v_now order by expires_at limit 100
   );
  insert into public.repairdesk_authenticated_rate_limits(
    scope_hash, bucket, window_started_at, attempt_count, expires_at
  ) values (p_scope_hash, p_bucket, v_window, 1, v_window + interval '2 minutes')
  on conflict (scope_hash, bucket, window_started_at) do update set
    attempt_count = public.repairdesk_authenticated_rate_limits.attempt_count + 1,
    expires_at = excluded.expires_at
  returning attempt_count into v_count;

  return pg_catalog.jsonb_build_object(
    'allowed', v_count <= v_limit,
    'attemptCount', v_count,
    'limit', v_limit,
    'windowStartedAt', v_window
  );
end;
$$;

alter function public.repairdesk_consume_authenticated_rate_limit_rpc(char,text)
  owner to postgres;
revoke all on function public.repairdesk_consume_authenticated_rate_limit_rpc(char,text)
  from public, anon, authenticated;
grant execute on function public.repairdesk_consume_authenticated_rate_limit_rpc(char,text)
  to service_role;

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
begin
  -- This must be the first transactional operation: it participates in the same
  -- store lifecycle lock order as close/revoke/purge.
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
  if p_operation not in ('create','update','claim','complete','reopen','archive','restore') then
    raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
  end if;
  if p_operation <> 'create' and p_expected_version is null then
    raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
  end if;

  -- Serialize receipt lookup for this actor after the lifecycle lock.
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

  v_display_name := coalesce(nullif(btrim(v_actor.display_name), ''), split_part(v_actor.email, '@', 1), '员工');

  if p_operation = 'create' then
    if v_actor.role::text = 'viewer' then raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN'; end if;
    if p_kind not in ('note','todo') or nullif(btrim(p_title),'') is null
       or char_length(btrim(p_title)) > 120 or char_length(coalesce(p_content,'')) > 4000 then
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
    insert into public.store_memos(
      store_id, kind, title, content, todo_status, due_at, assignee_membership_id,
      created_by_membership_id, updated_by_membership_id,
      created_by_name_snapshot, updated_by_name_snapshot, create_request_id
    ) values (
      p_store_id, p_kind, btrim(p_title), coalesce(p_content,''),
      case when p_kind = 'todo' then 'pending' else null end,
      case when p_kind = 'todo' then p_due_at else null end,
      case when p_kind = 'todo' then p_assignee_membership_id else null end,
      p_actor_membership_id, p_actor_membership_id, v_display_name, v_display_name, p_operation_id
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
    if p_operation in ('update','claim','complete','reopen') and v_actor.role::text = 'viewer' then
      raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN';
    end if;
    if p_operation = 'update'
       and v_actor.role::text in ('technician','sales')
       and v_memo.created_by_membership_id <> p_actor_membership_id then
      raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN';
    end if;
    if p_operation in ('complete','reopen')
       and v_actor.role::text in ('technician','sales')
       and v_memo.created_by_membership_id <> p_actor_membership_id
       and v_memo.assignee_membership_id is distinct from p_actor_membership_id then
      raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN';
    end if;
    if p_operation not in ('restore') and v_memo.archived_at is not null then
      raise exception using errcode = 'P0001', message = 'MEMO_ARCHIVED';
    end if;

    if p_operation = 'update' then
      if nullif(btrim(p_title),'') is null or char_length(btrim(p_title)) > 120
         or char_length(coalesce(p_content,'')) > 4000 then
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
         and not (
           v_memo.assignee_membership_id is null
           and p_assignee_membership_id = p_actor_membership_id
         ) then
        raise exception using errcode = 'P0001', message = 'MEMO_FORBIDDEN';
      end if;
      update public.store_memos set title=btrim(p_title), content=coalesce(p_content,''),
        due_at=case when kind='todo' then p_due_at else null end,
        assignee_membership_id=case when kind='todo' then p_assignee_membership_id else null end,
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
      if v_memo.kind <> 'todo' or v_memo.todo_status <> 'pending' then
        raise exception using errcode = 'P0001', message = 'MEMO_VALIDATION_FAILED';
      end if;
      update public.store_memos set todo_status='completed', completed_at=v_now,
        completed_by_membership_id=p_actor_membership_id,
        updated_by_membership_id=p_actor_membership_id, updated_by_name_snapshot=v_display_name,
        updated_at=v_now, version=version+1 where id=v_memo.id returning * into v_memo;
    elsif p_operation = 'reopen' then
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
    jsonb_build_object('operation_id', p_operation_id, 'kind', v_memo.kind,
      'status', v_memo.todo_status, 'version', v_memo.version), v_now
  );
  return pg_catalog.jsonb_build_object(
    'memo', pg_catalog.to_jsonb(v_memo),
    'replayed', false,
    'appliedVersion', v_memo.version
  );
end;
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

comment on table public.store_memos is 'Store-private plain-text notes and Todo items; BFF/service-role only.';
comment on table public.store_memo_operation_receipts is 'Metadata-only memo mutation idempotency receipts.';
comment on table public.repairdesk_authenticated_rate_limits is 'PII-free fixed-window authenticated BFF attempt counters with two-minute TTL.';
comment on function public.repairdesk_mutate_store_memo_rpc(
  uuid,uuid,uuid,text,uuid,uuid,bigint,text,text,text,timestamptz,uuid
) is 'Atomic store-scoped memo mutation with ACL, optimistic version, idempotency, metadata-only audit and revision.';

select pg_notify('pgrst', 'reload schema');

reset lock_timeout;
