-- Public short-lived capabilities; no Auth user or legacy license is synthesized.
create function chinatech_v2_private.desktop_version_parts(value text) returns integer[]
language sql immutable strict security invoker set search_path='' as $$
 select case when value ~ '^(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})$' then
  case when split_part(value,'.',1)::integer<=65535 and split_part(value,'.',2)::integer<=65535 and split_part(value,'.',3)::integer<=65535 then string_to_array(value,'.')::integer[] end
 end;
$$;
revoke all on function chinatech_v2_private.desktop_version_parts(text) from public,anon,authenticated;
grant execute on function chinatech_v2_private.desktop_version_parts(text) to chinatech_runtime;

alter table chinatech_v2_private.office_desktop_control add column minimum_version text not null default '0.0.0' check(chinatech_v2_private.desktop_version_parts(minimum_version) is not null);
-- Changed solely by the release pipeline after both public asset hashes verify.
alter table chinatech_v2_private.office_desktop_control add column release_ready boolean not null default false;
alter table chinatech_v2_private.office_desktop_control add column verified_version text check(verified_version is null or (chinatech_v2_private.desktop_version_parts(verified_version) is not null and chinatech_v2_private.desktop_version_parts(verified_version)>array[0,0,0]));
grant update(minimum_version) on chinatech_v2_private.office_desktop_control to chinatech_runtime;
alter table chinatech_v2_private.office_desktop_control_receipts add column requested_minimum_version text check(requested_minimum_version is null or chinatech_v2_private.desktop_version_parts(requested_minimum_version) is not null);
drop policy desktop_control_update on chinatech_v2_private.office_desktop_control;
create policy desktop_control_update on chinatech_v2_private.office_desktop_control for update to chinatech_runtime
 using(chinatech_v2_private.office_desktop_admin())
 with check(chinatech_v2_private.office_desktop_admin() and updated_by=auth.uid() and (minimum_version='0.0.0' or (release_ready and verified_version is not null and minimum_version=verified_version)));

create table chinatech_v2_private.office_desktop_public_grants (
 id uuid primary key,
 installation_id uuid not null,
 app_version text not null check(chinatech_v2_private.desktop_version_parts(app_version) is not null),
 actions text[] not null check(cardinality(actions) between 1 and 4 and actions <@ array['install','activate','uninstall','reinstall']::text[]),
 epoch bigint not null check(epoch>0),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 unique(id,installation_id),
 check(expires_at>created_at and expires_at<=created_at+interval '1 hour')
);
create index desktop_public_grants_installation_time on chinatech_v2_private.office_desktop_public_grants(installation_id,created_at desc);
alter table chinatech_v2_private.office_desktop_public_grants enable row level security;
alter table chinatech_v2_private.office_desktop_public_grants force row level security;
revoke all on chinatech_v2_private.office_desktop_public_grants from public,anon,authenticated;
grant select,insert on chinatech_v2_private.office_desktop_public_grants to chinatech_runtime;
create policy desktop_public_grant_read on chinatech_v2_private.office_desktop_public_grants for select to chinatech_runtime
 using(installation_id::text=current_setting('app.office_desktop_installation',true) and (id::text=current_setting('app.office_desktop_grant_id',true) or current_setting('app.office_desktop_public_issue',true)='true'));
create policy desktop_public_grant_create on chinatech_v2_private.office_desktop_public_grants for insert to chinatech_runtime
 with check(current_setting('app.office_desktop_public_issue',true)='true' and id::text=current_setting('app.office_desktop_grant_id',true) and installation_id::text=current_setting('app.office_desktop_installation',true)
 and exists(select 1 from chinatech_v2_private.office_desktop_control d cross join chinatech_v2_private.office_command_control c where d.singleton and d.enabled and c.singleton and c.enabled and epoch=c.command_version and chinatech_v2_private.desktop_version_parts(app_version)>=chinatech_v2_private.desktop_version_parts(d.minimum_version) and chinatech_v2_private.desktop_version_parts(app_version)<=array[0,2,0]));

create table chinatech_v2_private.office_desktop_public_jobs (
 id uuid primary key,
 grant_id uuid not null,
 installation_id uuid not null,
 action text not null check(action in('install','activate','uninstall','reinstall')),
 epoch bigint not null check(epoch>0),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 foreign key(grant_id,installation_id) references chinatech_v2_private.office_desktop_public_grants(id,installation_id),
 check(expires_at>created_at and expires_at<=created_at+interval '5 minutes')
);
alter table chinatech_v2_private.office_desktop_public_jobs enable row level security;
alter table chinatech_v2_private.office_desktop_public_jobs force row level security;
revoke all on chinatech_v2_private.office_desktop_public_jobs from public,anon,authenticated;
grant select,insert on chinatech_v2_private.office_desktop_public_jobs to chinatech_runtime;
create policy desktop_public_job_read on chinatech_v2_private.office_desktop_public_jobs for select to chinatech_runtime
 using(grant_id::text=current_setting('app.office_desktop_grant_id',true) and installation_id::text=current_setting('app.office_desktop_installation',true) and exists(select 1 from chinatech_v2_private.office_desktop_public_grants g where g.id=grant_id));
create policy desktop_public_job_create on chinatech_v2_private.office_desktop_public_jobs for insert to chinatech_runtime
 with check(grant_id::text=current_setting('app.office_desktop_grant_id',true) and installation_id::text=current_setting('app.office_desktop_installation',true)
 and exists(select 1 from chinatech_v2_private.office_desktop_public_grants g cross join chinatech_v2_private.office_command_control c where g.id=grant_id and g.installation_id=office_desktop_public_jobs.installation_id and g.expires_at>now() and office_desktop_public_jobs.expires_at<=g.expires_at and action=any(g.actions) and office_desktop_public_jobs.epoch=g.epoch and c.singleton and c.enabled and c.command_version=g.epoch));
