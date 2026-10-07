-- Separate desktop licenses. Public Office commands and store business facts are unchanged.
create function chinatech_v2_private.office_desktop_admin() returns boolean
language sql stable security invoker set search_path='' as $$
 select chinatech_v2_private.live_user() and exists(select 1 from chinatech_v2_private.office_command_control where singleton and admin_user_id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid);
$$;
revoke all on function chinatech_v2_private.office_desktop_admin() from public,anon,authenticated;
grant execute on function chinatech_v2_private.office_desktop_admin() to chinatech_runtime;

create table chinatech_v2_private.office_desktop_licenses (
 id uuid primary key,
 key_hash text unique not null check(key_hash ~ '^[a-f0-9]{64}$'),
 label text not null check(length(label) between 1 and 80),
 enabled boolean not null default true,
 expires_at timestamptz not null,
 max_devices integer not null check(max_devices between 1 and 100),
 actions text[] not null check(cardinality(actions) between 1 and 4 and actions <@ array['install','activate','uninstall','reinstall']::text[]),
 revision bigint not null default 1 check(revision>0),
 created_by uuid not null references chinatech_v2.accounts(id),
 updated_by uuid not null references chinatech_v2.accounts(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table chinatech_v2_private.office_desktop_licenses enable row level security;
alter table chinatech_v2_private.office_desktop_licenses force row level security;
revoke all on chinatech_v2_private.office_desktop_licenses from public,anon,authenticated;
grant select,insert on chinatech_v2_private.office_desktop_licenses to chinatech_runtime;
grant update(enabled,revision,updated_by,updated_at) on chinatech_v2_private.office_desktop_licenses to chinatech_runtime;
create policy desktop_license_read on chinatech_v2_private.office_desktop_licenses for select to chinatech_runtime
 using(chinatech_v2_private.office_desktop_admin() or key_hash=current_setting('app.office_desktop_key_hash',true));
create policy desktop_license_create on chinatech_v2_private.office_desktop_licenses for insert to chinatech_runtime
 with check(chinatech_v2_private.office_desktop_admin() and created_by=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid and updated_by=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid);
create policy desktop_license_update on chinatech_v2_private.office_desktop_licenses for update to chinatech_runtime
 using(chinatech_v2_private.office_desktop_admin()) with check(chinatech_v2_private.office_desktop_admin() and updated_by=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid);

create table chinatech_v2_private.office_desktop_devices (
 license_id uuid not null references chinatech_v2_private.office_desktop_licenses(id),
 installation_id uuid not null,
 registered_at timestamptz not null default now(),
 primary key(license_id,installation_id)
);
alter table chinatech_v2_private.office_desktop_devices enable row level security;
alter table chinatech_v2_private.office_desktop_devices force row level security;
revoke all on chinatech_v2_private.office_desktop_devices from public,anon,authenticated;
grant select,insert on chinatech_v2_private.office_desktop_devices to chinatech_runtime;
create policy desktop_device_read on chinatech_v2_private.office_desktop_devices for select to chinatech_runtime
 using(exists(select 1 from chinatech_v2_private.office_desktop_licenses l where l.id=license_id));
create policy desktop_device_register on chinatech_v2_private.office_desktop_devices for insert to chinatech_runtime
 with check(installation_id::text=current_setting('app.office_desktop_installation',true) and exists(select 1 from chinatech_v2_private.office_desktop_licenses l where l.id=license_id and l.enabled and l.expires_at>now()));

create table chinatech_v2_private.office_desktop_jobs (
 id uuid primary key,
 license_id uuid not null,
 installation_id uuid not null,
 action text not null check(action in('install','activate','uninstall','reinstall')),
 epoch bigint not null check(epoch>0),
 license_revision bigint not null check(license_revision>0),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 foreign key(license_id,installation_id) references chinatech_v2_private.office_desktop_devices(license_id,installation_id)
);
alter table chinatech_v2_private.office_desktop_jobs enable row level security;
alter table chinatech_v2_private.office_desktop_jobs force row level security;
revoke all on chinatech_v2_private.office_desktop_jobs from public,anon,authenticated;
grant select,insert on chinatech_v2_private.office_desktop_jobs to chinatech_runtime;
create policy desktop_job_read on chinatech_v2_private.office_desktop_jobs for select to chinatech_runtime
 using(exists(select 1 from chinatech_v2_private.office_desktop_licenses l where l.id=license_id) and (chinatech_v2_private.office_desktop_admin() or installation_id::text=current_setting('app.office_desktop_installation',true)));
create policy desktop_job_create on chinatech_v2_private.office_desktop_jobs for insert to chinatech_runtime
 with check(installation_id::text=current_setting('app.office_desktop_installation',true) and exists(select 1 from chinatech_v2_private.office_desktop_licenses l cross join chinatech_v2_private.office_command_control c where l.id=license_id and l.enabled and l.expires_at>now() and action=any(l.actions) and l.revision=license_revision and c.singleton and c.enabled and c.command_version=epoch));

create table chinatech_v2_private.office_desktop_receipts (
 id uuid primary key,
 actor_id uuid not null references chinatech_v2.accounts(id),
 session_id uuid not null,
 fingerprint text not null,
 created_at timestamptz not null default now()
);
alter table chinatech_v2_private.office_desktop_receipts enable row level security;
alter table chinatech_v2_private.office_desktop_receipts force row level security;
revoke all on chinatech_v2_private.office_desktop_receipts from public,anon,authenticated;
grant select,insert on chinatech_v2_private.office_desktop_receipts to chinatech_runtime;
create policy desktop_receipt_read on chinatech_v2_private.office_desktop_receipts for select to chinatech_runtime
 using(chinatech_v2_private.office_desktop_admin() and actor_id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid);
create policy desktop_receipt_create on chinatech_v2_private.office_desktop_receipts for insert to chinatech_runtime
 with check(chinatech_v2_private.office_desktop_admin() and actor_id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid and session_id::text=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id');
