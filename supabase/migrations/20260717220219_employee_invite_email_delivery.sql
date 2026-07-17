set lock_timeout = '5s';

alter table public.store_invitations
  add column if not exists email_delivery_status text not null default 'not_requested',
  add column if not exists email_delivery_method text,
  add column if not exists email_delivery_generation bigint not null default 0,
  add column if not exists email_delivery_attempt_count integer not null default 0,
  add column if not exists last_email_delivery_attempt_at timestamptz,
  add column if not exists last_email_delivered_at timestamptz,
  add column if not exists last_email_delivery_error_code text,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid;

alter table public.store_invitations
  drop constraint if exists store_invitations_email_delivery_status_check,
  add constraint store_invitations_email_delivery_status_check
    check (email_delivery_status in ('not_requested', 'pending', 'sent', 'failed')),
  drop constraint if exists store_invitations_email_delivery_method_check,
  add constraint store_invitations_email_delivery_method_check
    check (
      email_delivery_method is null
      or email_delivery_method in ('supabase_invite', 'supabase_magic_link')
    ),
  drop constraint if exists store_invitations_email_delivery_generation_check,
  add constraint store_invitations_email_delivery_generation_check
    check (email_delivery_generation >= 0),
  drop constraint if exists store_invitations_email_delivery_attempt_count_check,
  add constraint store_invitations_email_delivery_attempt_count_check
    check (email_delivery_attempt_count >= 0),
  drop constraint if exists store_invitations_last_email_delivery_error_code_check,
  add constraint store_invitations_last_email_delivery_error_code_check
    check (
      last_email_delivery_error_code is null
      or (
        char_length(last_email_delivery_error_code) between 1 and 64
        and last_email_delivery_error_code ~ '^[a-z0-9_]+$'
      )
    );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_invitations_revoked_by_fkey'
      and conrelid = 'public.store_invitations'::regclass
  ) then
    alter table public.store_invitations
      add constraint store_invitations_revoked_by_fkey
      foreign key (revoked_by) references auth.users(id)
      on update cascade on delete set null
      not valid;
  end if;
end;
$$;

alter table public.store_invitations
  validate constraint store_invitations_revoked_by_fkey;

create index if not exists store_invitations_delivery_retry_idx
  on public.store_invitations (store_id, email_delivery_status, last_email_delivery_attempt_at)
  where status = 'invited'::public.store_membership_status;

create or replace function public.repairdesk_accept_store_invitation_rpc(
  p_invitation_id uuid,
  p_user_id uuid,
  p_verified_email text,
  p_display_name text
)
returns table (
  store_id uuid,
  store_name text,
  store_slug text,
  role public.staff_role,
  invitation_status public.store_membership_status,
  accepted_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_email text := lower(btrim(p_verified_email));
  v_display_name text := nullif(btrim(p_display_name), '');
  v_store_id uuid;
  v_store public.stores%rowtype;
  v_invitation public.store_invitations%rowtype;
  v_lifecycle_active boolean := true;
  v_lifecycle_relation regclass;
begin
  if p_user_id is null
     or v_email = ''
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = 'P0001', message = 'STORE_INVITATION_IDENTITY_MISMATCH';
  end if;

  select invitation.store_id
    into v_store_id
    from public.store_invitations invitation
   where invitation.id = p_invitation_id;

  if v_store_id is null then
    raise exception using errcode = 'P0001', message = 'STORE_INVITATION_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_store_id::text, 0)
  );

  select * into v_store
    from public.stores
   where id = v_store_id
   for update;

  select * into v_invitation
    from public.store_invitations
   where id = p_invitation_id
   for update;

  if v_store.id is null
     or v_store.status <> 'active'::public.store_status then
    raise exception using errcode = 'P0001', message = 'STORE_INVITATION_STORE_INACTIVE';
  end if;

  v_lifecycle_relation := pg_catalog.to_regclass('public.store_lifecycles');
  if v_lifecycle_relation is not null then
    execute pg_catalog.format(
      'select exists (select 1 from %s where store_id = $1 and phase = $2)',
      v_lifecycle_relation
    )
      into v_lifecycle_active
      using v_store_id, 'active';
  end if;

  if not v_lifecycle_active then
    raise exception using errcode = 'P0001', message = 'STORE_INVITATION_STORE_INACTIVE';
  end if;

  if v_invitation.id is null
     or v_invitation.store_id <> v_store_id
     or v_invitation.status <> 'invited'::public.store_membership_status
     or v_invitation.expires_at <= v_now then
    raise exception using errcode = 'P0001', message = 'STORE_INVITATION_INVALID';
  end if;

  if lower(v_invitation.email) <> v_email then
    raise exception using errcode = 'P0001', message = 'STORE_INVITATION_IDENTITY_MISMATCH';
  end if;

  if v_invitation.role = 'owner'::public.staff_role then
    raise exception using errcode = 'P0001', message = 'STORE_INVITATION_ROLE_FORBIDDEN';
  end if;

  if exists (
    select 1
      from public.store_memberships membership
     where membership.store_id = v_store_id
       and membership.user_id = p_user_id
       and membership.status = 'active'::public.store_membership_status
  ) then
    raise exception using errcode = 'P0001', message = 'STORE_INVITATION_ALREADY_MEMBER';
  end if;

  insert into public.store_memberships (
    store_id,
    user_id,
    email,
    display_name,
    role,
    status,
    created_at,
    updated_at
  ) values (
    v_store_id,
    p_user_id,
    v_email,
    coalesce(v_display_name, split_part(v_email, '@', 1)),
    v_invitation.role,
    'active'::public.store_membership_status,
    v_now,
    v_now
  )
  on conflict on constraint store_memberships_store_user_unique
  do update set
    email = excluded.email,
    display_name = excluded.display_name,
    role = excluded.role,
    status = 'active'::public.store_membership_status,
    updated_at = excluded.updated_at;

  update public.store_invitations invitation
     set status = 'active'::public.store_membership_status,
         accepted_at = v_now,
         updated_at = v_now,
         last_email_delivery_error_code = null
   where invitation.id = p_invitation_id;

  insert into public.audit_logs (
    id,
    actor_id,
    actor_email,
    actor_name,
    store_id,
    action,
    entity_type,
    entity_id,
    after_data,
    metadata,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_user_id,
    v_email,
    coalesce(v_display_name, split_part(v_email, '@', 1)),
    v_store_id,
    'accept_invitation',
    'store_invitation',
    p_invitation_id::text,
    jsonb_build_object(
      'id', p_invitation_id,
      'store_id', v_store_id,
      'role', v_invitation.role,
      'status', 'active',
      'accepted_at', v_now
    ),
    jsonb_build_object('source', 'email_or_onboarding'),
    v_now
  );

  return query
  select
    v_store.id,
    v_store.name,
    v_store.slug,
    v_invitation.role,
    'active'::public.store_membership_status,
    v_now;
end;
$$;

revoke all on function public.repairdesk_accept_store_invitation_rpc(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.repairdesk_accept_store_invitation_rpc(
  uuid, uuid, text, text
) to service_role;

notify pgrst, 'reload schema';
