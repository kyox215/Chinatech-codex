alter table public.onboarding_requests
  add column if not exists approved_role public.staff_role;

update public.onboarding_requests
set approved_role = case
  when requested_role = 'owner'::public.staff_role then 'viewer'::public.staff_role
  else requested_role
end
where approved_role is null
  and request_type = 'join_store'
  and status = 'approved';

alter table public.onboarding_requests
  drop constraint if exists onboarding_requests_approved_role_not_owner_check,
  add constraint onboarding_requests_approved_role_not_owner_check
  check (approved_role is null or approved_role <> 'owner'::public.staff_role);

select pg_notify('pgrst', 'reload schema');
