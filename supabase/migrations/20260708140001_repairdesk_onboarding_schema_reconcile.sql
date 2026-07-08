-- Reconcile production onboarding_requests schema with the private-store onboarding code path.
-- This migration is intentionally expand-only and idempotent. It repairs environments where
-- earlier 20260704 onboarding migrations were not fully applied.

alter table public.onboarding_requests
  add column if not exists target_owner_email text,
  add column if not exists request_note text,
  add column if not exists review_scope text,
  add column if not exists reviewed_by_membership_id uuid,
  add column if not exists approved_role public.staff_role,
  add column if not exists resulting_store_id uuid;

update public.onboarding_requests
set
  email = lower(email),
  target_owner_email = case
    when target_owner_email is null then null
    else lower(target_owner_email)
  end,
  review_scope = coalesce(review_scope, 'platform')
where email <> lower(email)
   or target_owner_email is distinct from lower(target_owner_email)
   or review_scope is null;

update public.onboarding_requests
set approved_role = case
  when requested_role = 'owner'::public.staff_role then 'viewer'::public.staff_role
  else requested_role
end
where approved_role is null
  and request_type = 'join_store'
  and status = 'approved';

update public.onboarding_requests
set approved_role = 'viewer'::public.staff_role
where approved_role = 'owner'::public.staff_role;

alter table public.onboarding_requests
  alter column review_scope set default 'platform',
  alter column review_scope set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'onboarding_requests_review_scope_check'
      and conrelid = 'public.onboarding_requests'::regclass
  ) then
    alter table public.onboarding_requests
      add constraint onboarding_requests_review_scope_check
      check (review_scope in ('platform', 'store'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'onboarding_requests_reviewed_membership_fkey'
      and conrelid = 'public.onboarding_requests'::regclass
  ) then
    alter table public.onboarding_requests
      add constraint onboarding_requests_reviewed_membership_fkey
      foreign key (reviewed_by_membership_id) references public.store_memberships(id)
      on update cascade on delete set null
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'onboarding_requests_result_store_fkey'
      and conrelid = 'public.onboarding_requests'::regclass
  ) then
    alter table public.onboarding_requests
      add constraint onboarding_requests_result_store_fkey
      foreign key (resulting_store_id) references public.stores(id)
      on update cascade on delete set null
      not valid;
  end if;
end $$;

alter table public.onboarding_requests
  drop constraint if exists onboarding_requests_email_lowercase_check,
  add constraint onboarding_requests_email_lowercase_check
    check (
      email = lower(email)
      and (target_owner_email is null or target_owner_email = lower(target_owner_email))
    );

alter table public.onboarding_requests
  drop constraint if exists onboarding_requests_join_store_private_target_check,
  add constraint onboarding_requests_join_store_private_target_check
    check (
      request_type <> 'join_store'
      or target_store_id is not null
      or target_owner_email is not null
    );

alter table public.onboarding_requests
  drop constraint if exists onboarding_requests_approved_role_not_owner_check,
  add constraint onboarding_requests_approved_role_not_owner_check
    check (approved_role is null or approved_role <> 'owner'::public.staff_role);

alter table public.onboarding_requests
  drop constraint if exists onboarding_requests_kind_data;

alter table public.onboarding_requests
  add constraint onboarding_requests_kind_data
  check (
    (request_type = 'create_store' and desired_store_name is not null)
    or (
      request_type = 'join_store'
      and (
        target_store_id is not null
        or nullif(btrim(target_owner_email), '') is not null
      )
    )
  );

create index if not exists onboarding_requests_target_owner_email_status_idx
  on public.onboarding_requests (lower(target_owner_email), status, created_at asc)
  where target_owner_email is not null;

create index if not exists onboarding_requests_review_scope_status_idx
  on public.onboarding_requests (review_scope, status, created_at asc);

select pg_notify('pgrst', 'reload schema');
