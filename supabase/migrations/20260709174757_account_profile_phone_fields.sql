alter table public.staff_profiles
  add column if not exists phone_e164 text,
  add column if not exists phone_verified_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_profiles_phone_e164_format_check'
      and conrelid = 'public.staff_profiles'::regclass
  ) then
    alter table public.staff_profiles
      add constraint staff_profiles_phone_e164_format_check
      check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
      not valid;
  end if;
end $$;

alter table public.staff_profiles
  validate constraint staff_profiles_phone_e164_format_check;

create index if not exists staff_profiles_phone_e164_idx
  on public.staff_profiles (phone_e164)
  where phone_e164 is not null;

select pg_notify('pgrst', 'reload schema');
