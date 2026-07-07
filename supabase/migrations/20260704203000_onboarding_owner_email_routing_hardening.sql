-- Phase 1 SG2: owner-email routing hardening.
-- Keep requester join routing private: applicants cannot submit raw target_store_id joins.
-- Keep owner-email lookup exact and efficient by normalizing stored emails.

update public.staff_profiles
set email = lower(email)
where email is not null
  and email <> lower(email);

update public.store_memberships
set email = lower(email)
where email is not null
  and email <> lower(email);

update public.store_invitations
set email = lower(email)
where email is not null
  and email <> lower(email);

update public.onboarding_requests
set
  email = lower(email),
  target_owner_email = lower(target_owner_email)
where email <> lower(email)
   or (target_owner_email is not null and target_owner_email <> lower(target_owner_email));

alter table public.staff_profiles
  drop constraint if exists staff_profiles_email_lowercase_check,
  add constraint staff_profiles_email_lowercase_check
    check (email = lower(email));

alter table public.store_memberships
  drop constraint if exists store_memberships_email_lowercase_check,
  add constraint store_memberships_email_lowercase_check
    check (email = lower(email));

alter table public.store_invitations
  drop constraint if exists store_invitations_email_lowercase_check,
  add constraint store_invitations_email_lowercase_check
    check (email = lower(email));

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
      or target_owner_email is not null
    );

create index if not exists store_memberships_owner_email_lookup_idx
  on public.store_memberships (email, role, status, store_id)
  where role in ('owner', 'manager') and status = 'active';
