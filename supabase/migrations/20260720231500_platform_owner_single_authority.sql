set lock_timeout = '5s';
set statement_timeout = '60s';

do $$
declare
  v_active_total bigint;
  v_valid_owner bigint;
  v_invalid_platform_decisions bigint;
begin
  select
    count(*) filter (where pa.status = 'active'),
    count(*) filter (
      where pa.status = 'active'
        and pa.email = 'kyox120@gmail.com'
        and lower(trim(u.email)) = 'kyox120@gmail.com'
        and u.email_confirmed_at is not null
    )
  into v_active_total, v_valid_owner
  from public.platform_admins pa
  left join auth.users u on u.id = pa.user_id;

  if v_active_total <> 1 or v_valid_owner <> 1 then
    raise exception using
      errcode = '23514',
      message = 'platform owner preflight failed: require exactly one active verified canonical owner';
  end if;

  select count(*)
  into v_invalid_platform_decisions
  from public.onboarding_requests r
  left join public.platform_admins pa on pa.user_id = r.reviewed_by
  left join auth.users u on u.id = pa.user_id
  where r.review_scope = 'platform'
    and r.status in ('approved', 'rejected')
    and (
      r.reviewed_by is null
      or pa.status is distinct from 'active'
      or pa.email is distinct from 'kyox120@gmail.com'
      or lower(trim(u.email)) is distinct from 'kyox120@gmail.com'
      or u.email_confirmed_at is null
    );

  if v_invalid_platform_decisions <> 0 then
    raise exception using
      errcode = '23514',
      message = 'platform owner preflight failed: invalid historical platform decisions require review';
  end if;
end
$$;

alter table public.platform_admins
  add constraint platform_admins_single_active_owner_email
  check (status <> 'active' or email = 'kyox120@gmail.com') not valid;

alter table public.platform_admins
  validate constraint platform_admins_single_active_owner_email;

create function public.repairdesk_enforce_platform_owner_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_auth_email text;
  v_email_confirmed_at timestamptz;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select lower(trim(u.email)), u.email_confirmed_at
  into v_auth_email, v_email_confirmed_at
  from auth.users u
  where u.id = new.user_id;

  if new.email <> 'kyox120@gmail.com'
    or v_auth_email is distinct from 'kyox120@gmail.com'
    or v_email_confirmed_at is null then
    raise exception using
      errcode = '42501',
      message = 'only the verified project owner may be an active platform administrator';
  end if;

  return new;
end;
$$;

create trigger platform_admins_enforce_single_owner
before insert or update of user_id, email, status
on public.platform_admins
for each row
execute function public.repairdesk_enforce_platform_owner_identity();

create function public.repairdesk_enforce_platform_decision_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.review_scope = 'platform'
    and new.status in ('approved', 'rejected') then
    if new.reviewed_by is null or not exists (
      select 1
      from public.platform_admins pa
      join auth.users u on u.id = pa.user_id
      where pa.user_id = new.reviewed_by
        and pa.status = 'active'
        and pa.email = 'kyox120@gmail.com'
        and lower(trim(u.email)) = 'kyox120@gmail.com'
        and u.email_confirmed_at is not null
    ) then
      raise exception using
        errcode = '42501',
        message = 'only the verified project owner may record a platform approval decision';
    end if;
  end if;

  return new;
end;
$$;

create trigger onboarding_requests_enforce_platform_decision_owner
before insert or update of review_scope, status, reviewed_by
on public.onboarding_requests
for each row
execute function public.repairdesk_enforce_platform_decision_owner();

revoke all on function public.repairdesk_enforce_platform_owner_identity()
from public, anon, authenticated;
revoke all on function public.repairdesk_enforce_platform_decision_owner()
from public, anon, authenticated;

comment on constraint platform_admins_single_active_owner_email on public.platform_admins is
  'Only kyox120@gmail.com may hold active platform administrator authority.';

select pg_notify('pgrst', 'reload schema');

reset statement_timeout;
reset lock_timeout;
