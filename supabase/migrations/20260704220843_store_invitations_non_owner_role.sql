alter table public.store_invitations
  drop constraint if exists store_invitations_role_not_owner_check,
  add constraint store_invitations_role_not_owner_check
  check (role <> 'owner'::public.staff_role);

select pg_notify('pgrst', 'reload schema');
