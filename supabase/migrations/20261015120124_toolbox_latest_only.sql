-- Append-only release identities. Runtime can pause; only the release pipeline may publish.
create table chinatech_v2_private.toolbox_releases(
 tool_id text not null check(tool_id in('office','windows-check','phone-assistant','smart-switch-lab','mimover-original')),
 release_id text not null check(release_id ~ '^[a-z0-9][a-z0-9.-]{0,95}$'),
 manifest jsonb not null check(coalesce(jsonb_typeof(manifest)='object' and manifest ?& array['releaseId','version','files','authenticodeSigned','prerelease'] and jsonb_typeof(manifest->'releaseId')='string' and manifest->>'releaseId'=release_id and jsonb_typeof(manifest->'version')='string' and length(manifest->>'version') between 1 and 96 and jsonb_typeof(manifest->'files')='array' and jsonb_array_length(manifest->'files')>0 and jsonb_typeof(manifest->'authenticodeSigned')='boolean' and jsonb_typeof(manifest->'prerelease')='boolean',false)),
 release_number bigint generated always as identity unique, ready boolean not null default false, created_at timestamptz not null default now(),primary key(tool_id,release_id));
create table chinatech_v2_private.toolbox_tools(
 tool_id text primary key check(tool_id in('office','windows-check','phone-assistant','smart-switch-lab','mimover-original')),position smallint not null unique,active_release_id text,enabled boolean not null default false,
 revision bigint not null default 0 check(revision>=0),updated_by uuid references chinatech_v2.accounts(id),updated_at timestamptz,
 foreign key(tool_id,active_release_id) references chinatech_v2_private.toolbox_releases(tool_id,release_id),check(not enabled or active_release_id is not null));
create table chinatech_v2_private.toolbox_admin_receipts(
 request_id uuid primary key,actor_id uuid not null references chinatech_v2.accounts(id),session_id uuid not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now());
insert into chinatech_v2_private.toolbox_releases(tool_id,release_id,manifest,ready) values('office','office-1.4.0','{"releaseId":"office-1.4.0","version":"1.4.0","authenticodeSigned":false,"publisherCertificateSha256":null,"websiteControlProtocol":3,"prerelease":true,"files":[{"architecture":"x64","bytes":65049274,"sha256":"977c07ae5b7c7ca21584a5a0cebdfb91a08c008ecfb930058d398fdf4827eaaf","href":"https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.4.0/ChinaTech-Office-Assistant-x64.exe"},{"architecture":"ARM64","bytes":61202604,"sha256":"03b29ea6b4f7473112db42c1f2edde771cb2df356f60fd0f39ea9810eca81b3f","href":"https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.4.0/ChinaTech-Office-Assistant-ARM64.exe"}]}',true);
insert into chinatech_v2_private.toolbox_tools(tool_id,position,active_release_id,enabled)
 select 'office',1,case when release_ready and verified_version='1.4.0' then 'office-1.4.0' end,enabled and release_ready and verified_version='1.4.0' from chinatech_v2_private.office_v3_control where singleton;
insert into chinatech_v2_private.toolbox_tools(tool_id,position) values('windows-check',2),('phone-assistant',3),('smart-switch-lab',4),('mimover-original',5);
alter table chinatech_v2_private.toolbox_releases enable row level security;
alter table chinatech_v2_private.toolbox_releases force row level security;
alter table chinatech_v2_private.toolbox_tools enable row level security;
alter table chinatech_v2_private.toolbox_tools force row level security;
alter table chinatech_v2_private.toolbox_admin_receipts enable row level security;
alter table chinatech_v2_private.toolbox_admin_receipts force row level security;
revoke all on chinatech_v2_private.toolbox_releases,chinatech_v2_private.toolbox_tools,chinatech_v2_private.toolbox_admin_receipts from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.toolbox_releases,chinatech_v2_private.toolbox_tools to chinatech_runtime;
grant update(enabled,revision,updated_by,updated_at) on chinatech_v2_private.toolbox_tools to chinatech_runtime;
grant select,insert on chinatech_v2_private.toolbox_admin_receipts to chinatech_runtime;
create policy toolbox_release_read on chinatech_v2_private.toolbox_releases for select to chinatech_runtime using(true);
create policy toolbox_tools_read on chinatech_v2_private.toolbox_tools for select to chinatech_runtime using(true);
create policy toolbox_tools_pause on chinatech_v2_private.toolbox_tools for update to chinatech_runtime
 using(chinatech_v2_private.office_desktop_admin()) with check(chinatech_v2_private.office_desktop_admin() and updated_by=auth.uid() and
 (not enabled or exists(select 1 from chinatech_v2_private.toolbox_releases r where r.tool_id=toolbox_tools.tool_id and r.release_id=toolbox_tools.active_release_id and r.ready)));
create policy toolbox_receipt_read on chinatech_v2_private.toolbox_admin_receipts for select to chinatech_runtime using(chinatech_v2_private.office_desktop_admin() and actor_id=auth.uid());
create policy toolbox_receipt_insert on chinatech_v2_private.toolbox_admin_receipts for insert to chinatech_runtime with check(chinatech_v2_private.office_desktop_admin() and actor_id=auth.uid() and session_id::text=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id');
create function chinatech_v2_private.toolbox_release_immutable() returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'immutable release';end$$;
revoke all on function chinatech_v2_private.toolbox_release_immutable() from public,anon,authenticated;
create trigger toolbox_release_immutable before update or delete on chinatech_v2_private.toolbox_releases for each row execute function chinatech_v2_private.toolbox_release_immutable();
-- Seals stale deployments as well as current endpoints. Identity/audit tables remain.
update chinatech_v2_private.office_command_control set enabled=false,command_version=command_version+1,revision=revision+1;
alter table chinatech_v2_private.office_command_control add constraint office_legacy_commands_retired check(not enabled);
update chinatech_v2_private.office_desktop_control set enabled=false;
alter table chinatech_v2_private.office_desktop_control add constraint office_legacy_desktop_retired check(not enabled);
-- Deferred check permits one atomic publish/pause transaction; old UI cannot lower minimum or desynchronise the switches.
create function chinatech_v2_private.toolbox_office_consistent() returns trigger language plpgsql set search_path=pg_catalog as $$
declare t record;c record;r record;
begin
 select * into t from chinatech_v2_private.toolbox_tools where tool_id='office';
 if t.active_release_id is null then return null;end if;
 select * into c from chinatech_v2_private.office_v3_control where singleton;
 select * into r from chinatech_v2_private.toolbox_releases where tool_id='office' and release_id=t.active_release_id;
 if c.minimum_version is distinct from (r.manifest->>'version') or c.verified_version is distinct from (r.manifest->>'version') or c.enabled is distinct from t.enabled or c.release_ready is distinct from r.ready then raise exception 'latest release mismatch' using errcode='23514';end if;
 return null;
end$$;
revoke all on function chinatech_v2_private.toolbox_office_consistent() from public,anon,authenticated;
create constraint trigger toolbox_office_consistent after insert or update on chinatech_v2_private.toolbox_tools deferrable initially deferred for each row execute function chinatech_v2_private.toolbox_office_consistent();
create constraint trigger toolbox_v3_consistent after insert or update on chinatech_v2_private.office_v3_control deferrable initially deferred for each row execute function chinatech_v2_private.toolbox_office_consistent();
create function chinatech_v2_private.toolbox_office_new_job() returns trigger language plpgsql set search_path=pg_catalog as $$
declare i record;t record;r record;
begin
 if tg_table_name='office_v3_commits' then select * into i from chinatech_v2_private.office_v3_intents where job_id=new.job_id;else i:=new;end if;
 if i.admission_mode='candidate' then return new;end if;
 -- Serialization agrees with website commit/publish. It never applies to recovery/outcomes.
 perform pg_advisory_xact_lock(hashtextextended('office-v3:control',140));
 select * into t from chinatech_v2_private.toolbox_tools where tool_id='office';
 select * into r from chinatech_v2_private.toolbox_releases where tool_id='office' and release_id=t.active_release_id;
 if not coalesce(t.enabled and r.ready and i.app_version=(r.manifest->>'version'),false) then raise exception 'update required' using errcode='42501';end if;
 return new;
end$$;
revoke all on function chinatech_v2_private.toolbox_office_new_job() from public,anon,authenticated;
create trigger toolbox_new_intent before insert on chinatech_v2_private.office_v3_intents for each row execute function chinatech_v2_private.toolbox_office_new_job();
create trigger toolbox_new_commit before insert on chinatech_v2_private.office_v3_commits for each row execute function chinatech_v2_private.toolbox_office_new_job();

-- Forward-only publication identity, independent of version-string formatting.
create function chinatech_v2_private.toolbox_forward_release() returns trigger language plpgsql set search_path=pg_catalog as $$
declare previous_number bigint;next_number bigint;
begin
 if new.active_release_id is not distinct from old.active_release_id then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('office-v3:control',140));
 perform pg_advisory_xact_lock(hashtextextended('toolbox-controls',140));
 if new.active_release_id is null then raise exception 'retired release cannot be restored' using errcode='23514';end if;
 select release_number into next_number from chinatech_v2_private.toolbox_releases where tool_id=new.tool_id and release_id=new.active_release_id and ready;
 select release_number into previous_number from chinatech_v2_private.toolbox_releases where tool_id=old.tool_id and release_id=old.active_release_id;
 if next_number is null or (previous_number is not null and next_number<=previous_number) then raise exception 'release publication must advance' using errcode='23514';end if;
 return new;
end$$;
revoke all on function chinatech_v2_private.toolbox_forward_release() from public,anon,authenticated;
create trigger toolbox_forward_release before update of active_release_id on chinatech_v2_private.toolbox_tools for each row execute function chinatech_v2_private.toolbox_forward_release();
-- Common proof-bound tasks for standalone first-party tools. No customer/file content is stored.
create table chinatech_v2_private.toolbox_devices(
 installation_id uuid primary key,key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),public_key text not null check(length(public_key)=122),created_at timestamptz not null default now(),unique(installation_id,key_hash));
create table chinatech_v2_private.toolbox_jobs(
 job_id uuid primary key,tool_id text not null,release_id text not null,app_version text not null,
 installation_id uuid not null,key_hash text not null,action text not null check(action in('detect','send','receive')),
 scope_hash text not null check(scope_hash ~ '^[a-f0-9]{64}$'),request_id uuid not null,nonce text not null check(length(nonce)=43),fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 completed_at timestamptz,completion_hash text check(completion_hash ~ '^[a-f0-9]{64}$'),check((completed_at is null)=(completion_hash is null)),permit jsonb not null check(jsonb_typeof(permit)='object'),created_at timestamptz not null,expires_at timestamptz not null,
 foreign key(tool_id,release_id) references chinatech_v2_private.toolbox_releases(tool_id,release_id),foreign key(installation_id,key_hash) references chinatech_v2_private.toolbox_devices(installation_id,key_hash),
 unique(installation_id,request_id),unique(installation_id,nonce),check(expires_at>created_at and expires_at<=created_at+interval '30 days'));
alter table chinatech_v2_private.toolbox_devices enable row level security;
alter table chinatech_v2_private.toolbox_devices force row level security;
alter table chinatech_v2_private.toolbox_jobs enable row level security;
alter table chinatech_v2_private.toolbox_jobs force row level security;
revoke all on chinatech_v2_private.toolbox_devices,chinatech_v2_private.toolbox_jobs from public,anon,authenticated,chinatech_runtime;
grant select,insert on chinatech_v2_private.toolbox_devices,chinatech_v2_private.toolbox_jobs to chinatech_runtime;
create policy toolbox_device_read on chinatech_v2_private.toolbox_devices for select to chinatech_runtime using(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true));
create policy toolbox_device_insert on chinatech_v2_private.toolbox_devices for insert to chinatech_runtime with check(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) and current_setting('app.office_v3_op',true)='tool-start');
create policy toolbox_job_read on chinatech_v2_private.toolbox_jobs for select to chinatech_runtime using(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true));
create policy toolbox_job_insert on chinatech_v2_private.toolbox_jobs for insert to chinatech_runtime with check(
 installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) and current_setting('app.office_v3_op',true)='tool-start'
 and exists(select 1 from chinatech_v2_private.toolbox_tools t join chinatech_v2_private.toolbox_releases r on r.tool_id=t.tool_id and r.release_id=t.active_release_id where t.tool_id=toolbox_jobs.tool_id and t.active_release_id=toolbox_jobs.release_id and t.enabled and r.ready and r.manifest->>'version'=toolbox_jobs.app_version));
create function chinatech_v2_private.toolbox_lock_job_start() returns trigger language plpgsql set search_path=pg_catalog as $$
begin perform pg_advisory_xact_lock(hashtextextended('office-v3:control',140));return new;end$$;
revoke all on function chinatech_v2_private.toolbox_lock_job_start() from public,anon,authenticated;
create trigger toolbox_lock_job_start before insert on chinatech_v2_private.toolbox_jobs for each row execute function chinatech_v2_private.toolbox_lock_job_start();

grant update(completed_at,completion_hash) on chinatech_v2_private.toolbox_jobs to chinatech_runtime;
create policy toolbox_job_complete on chinatech_v2_private.toolbox_jobs for update to chinatech_runtime using(
 installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) and current_setting('app.office_v3_op',true)='tool-outcome' and completed_at is null)
 with check(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) and completed_at is not null and completion_hash is not null);
create function chinatech_v2_private.toolbox_completion_immutable() returns trigger language plpgsql set search_path=pg_catalog as $$
begin if old.completed_at is not null and (new.completed_at is distinct from old.completed_at or new.completion_hash is distinct from old.completion_hash) then raise exception 'completed task is immutable' using errcode='23514';end if;return new;end$$;
revoke all on function chinatech_v2_private.toolbox_completion_immutable() from public,anon,authenticated;
create trigger toolbox_completion_immutable before update on chinatech_v2_private.toolbox_jobs for each row execute function chinatech_v2_private.toolbox_completion_immutable();
