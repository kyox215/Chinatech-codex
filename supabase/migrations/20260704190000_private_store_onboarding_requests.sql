alter table public.onboarding_requests
  add column if not exists target_owner_email text,
  add column if not exists request_note text,
  add column if not exists review_scope text not null default 'platform',
  add column if not exists reviewed_by_membership_id uuid;

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
      on update cascade on delete set null;
  end if;
end $$;

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
