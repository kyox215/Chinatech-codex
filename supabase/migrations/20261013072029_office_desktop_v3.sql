-- Isolated v3 capabilities. Legacy Office tables, policies and endpoints remain unchanged.
create table chinatech_v2_private.office_v3_control (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 minimum_version text not null default '1.4.0' check(chinatech_v2_private.desktop_version_parts(minimum_version) is not null),
 verified_version text check(verified_version is null or chinatech_v2_private.desktop_version_parts(verified_version) is not null),
 release_ready boolean not null default false, revision bigint not null default 0 check(revision>=0),
 updated_by uuid references chinatech_v2.accounts(id), updated_at timestamptz,
 check(not release_ready or verified_version is not null)
);
insert into chinatech_v2_private.office_v3_control(singleton) values(true);
create table chinatech_v2_private.office_v3_devices (
 installation_id uuid primary key, key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),
 public_key text not null check(length(public_key)=122), created_at timestamptz not null default now(), unique(installation_id,key_hash)
);
create table chinatech_v2_private.office_v3_sessions (
 id uuid primary key, installation_id uuid not null, key_hash text not null,
 app_version text not null check(chinatech_v2_private.desktop_version_parts(app_version) is not null),
 token text not null check(length(token)<=16000), created_at timestamptz not null, expires_at timestamptz not null,
 foreign key(installation_id,key_hash) references chinatech_v2_private.office_v3_devices(installation_id,key_hash),
 check(expires_at>created_at and expires_at<=created_at+interval '1 hour')
);
create table chinatech_v2_private.office_v3_intents (
 job_id uuid primary key, installation_id uuid not null, key_hash text not null, session_id uuid not null references chinatech_v2_private.office_v3_sessions(id),
 action text not null check(action in('install','activate','uninstall','close','reinstall')),
 architecture text not null check(architecture in('win-x64','win-arm64')), app_version text not null,
 plan jsonb not null check(jsonb_typeof(plan)='object'), plan_hash text not null check(plan_hash ~ '^[a-f0-9]{64}$'),
 control_revision bigint not null check(control_revision>=0), token text not null check(length(token)<=16000),
 created_at timestamptz not null, start_before timestamptz not null,
 foreign key(installation_id,key_hash) references chinatech_v2_private.office_v3_devices(installation_id,key_hash),
 unique(job_id,installation_id,key_hash,plan_hash), check(start_before>created_at and start_before<=created_at+interval '5 minutes')
);
create index office_v3_intents_recent on chinatech_v2_private.office_v3_intents(created_at desc,job_id desc);
create table chinatech_v2_private.office_v3_commits (
 job_id uuid primary key, installation_id uuid not null, key_hash text not null, plan_hash text not null,
 permit_token text not null check(length(permit_token)<=16000), created_at timestamptz not null,
 resume_until timestamptz not null, foreign key(job_id,installation_id,key_hash,plan_hash) references chinatech_v2_private.office_v3_intents(job_id,installation_id,key_hash,plan_hash),
 check(resume_until>created_at and resume_until<=created_at+interval '30 days')
);
create table chinatech_v2_private.office_v3_outcomes (
 job_id uuid not null references chinatech_v2_private.office_v3_commits(job_id), sequence integer not null check(sequence>0),
 installation_id uuid not null, key_hash text not null, status text not null check(status in('completed','failed','cancelled','paused')),
 checkpoint_hash text not null check(checkpoint_hash ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default now(),
 primary key(job_id,sequence), foreign key(installation_id,key_hash) references chinatech_v2_private.office_v3_devices(installation_id,key_hash)
);
create table chinatech_v2_private.office_v3_receipts (
 installation_id uuid not null, key_hash text not null, request_id uuid not null, nonce text not null check(length(nonce)=43),
 endpoint text not null check(endpoint in('session','start','commit','resume','outcome')),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'), source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 response jsonb not null check(jsonb_typeof(response)='object'), created_at timestamptz not null default now(),
 primary key(installation_id,request_id), unique(installation_id,nonce),
 foreign key(installation_id,key_hash) references chinatech_v2_private.office_v3_devices(installation_id,key_hash)
);
create index office_v3_receipt_rate on chinatech_v2_private.office_v3_receipts(source_hash,created_at desc);
create index office_v3_receipt_installation_rate on chinatech_v2_private.office_v3_receipts(installation_id,created_at desc);
create table chinatech_v2_private.office_v3_admin_receipts (
 request_id uuid primary key, actor_id uuid not null references chinatech_v2.accounts(id), session_id uuid not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default now()
);
alter table chinatech_v2_private.office_v3_control enable row level security;
alter table chinatech_v2_private.office_v3_control force row level security;
revoke all on chinatech_v2_private.office_v3_control from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.office_v3_control to chinatech_runtime;
alter table chinatech_v2_private.office_v3_devices enable row level security;
alter table chinatech_v2_private.office_v3_devices force row level security;
revoke all on chinatech_v2_private.office_v3_devices from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.office_v3_devices to chinatech_runtime;
grant insert on chinatech_v2_private.office_v3_devices to chinatech_runtime;
alter table chinatech_v2_private.office_v3_sessions enable row level security;
alter table chinatech_v2_private.office_v3_sessions force row level security;
revoke all on chinatech_v2_private.office_v3_sessions from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.office_v3_sessions to chinatech_runtime;
grant insert on chinatech_v2_private.office_v3_sessions to chinatech_runtime;
alter table chinatech_v2_private.office_v3_intents enable row level security;
alter table chinatech_v2_private.office_v3_intents force row level security;
revoke all on chinatech_v2_private.office_v3_intents from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.office_v3_intents to chinatech_runtime;
grant insert on chinatech_v2_private.office_v3_intents to chinatech_runtime;
alter table chinatech_v2_private.office_v3_commits enable row level security;
alter table chinatech_v2_private.office_v3_commits force row level security;
revoke all on chinatech_v2_private.office_v3_commits from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.office_v3_commits to chinatech_runtime;
grant insert on chinatech_v2_private.office_v3_commits to chinatech_runtime;
alter table chinatech_v2_private.office_v3_outcomes enable row level security;
alter table chinatech_v2_private.office_v3_outcomes force row level security;
revoke all on chinatech_v2_private.office_v3_outcomes from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.office_v3_outcomes to chinatech_runtime;
grant insert on chinatech_v2_private.office_v3_outcomes to chinatech_runtime;
alter table chinatech_v2_private.office_v3_receipts enable row level security;
alter table chinatech_v2_private.office_v3_receipts force row level security;
revoke all on chinatech_v2_private.office_v3_receipts from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.office_v3_receipts to chinatech_runtime;
grant insert on chinatech_v2_private.office_v3_receipts to chinatech_runtime;
alter table chinatech_v2_private.office_v3_admin_receipts enable row level security;
alter table chinatech_v2_private.office_v3_admin_receipts force row level security;
revoke all on chinatech_v2_private.office_v3_admin_receipts from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.office_v3_admin_receipts to chinatech_runtime;
grant insert on chinatech_v2_private.office_v3_admin_receipts to chinatech_runtime;
grant update(enabled,minimum_version,revision,updated_by,updated_at) on chinatech_v2_private.office_v3_control to chinatech_runtime;
create policy office_v3_control_read on chinatech_v2_private.office_v3_control for select to chinatech_runtime using(true);
create policy office_v3_control_update on chinatech_v2_private.office_v3_control for update to chinatech_runtime
 using(chinatech_v2_private.office_desktop_admin()) with check(chinatech_v2_private.office_desktop_admin() and updated_by=auth.uid()
 and (minimum_version='1.4.0' or (release_ready and chinatech_v2_private.desktop_version_parts(minimum_version)<=chinatech_v2_private.desktop_version_parts(verified_version))));
create policy office_v3_devices_read on chinatech_v2_private.office_v3_devices for select to chinatech_runtime using(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true));
create policy office_v3_devices_insert on chinatech_v2_private.office_v3_devices for insert to chinatech_runtime with check(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) and current_setting('app.office_v3_op',true)='session');
create policy office_v3_sessions_read on chinatech_v2_private.office_v3_sessions for select to chinatech_runtime using(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true));
create policy office_v3_sessions_insert on chinatech_v2_private.office_v3_sessions for insert to chinatech_runtime with check(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) and current_setting('app.office_v3_op',true)='session' and id::text=current_setting('app.office_v3_request',true));
create policy office_v3_intents_read on chinatech_v2_private.office_v3_intents for select to chinatech_runtime using(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) or chinatech_v2_private.office_desktop_admin());
create policy office_v3_intents_insert on chinatech_v2_private.office_v3_intents for insert to chinatech_runtime with check(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) and current_setting('app.office_v3_op',true)='start' and job_id::text=current_setting('app.office_v3_job',true) and exists(select 1 from chinatech_v2_private.office_v3_control c where c.singleton and c.enabled and c.release_ready and control_revision=c.revision and chinatech_v2_private.desktop_version_parts(app_version)>=chinatech_v2_private.desktop_version_parts(c.minimum_version) and chinatech_v2_private.desktop_version_parts(app_version)<=chinatech_v2_private.desktop_version_parts(c.verified_version)) and exists(select 1 from chinatech_v2_private.office_v3_sessions s where s.id=session_id and s.installation_id=office_v3_intents.installation_id and s.key_hash=office_v3_intents.key_hash and s.expires_at>now()));
create policy office_v3_commits_read on chinatech_v2_private.office_v3_commits for select to chinatech_runtime using(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) or chinatech_v2_private.office_desktop_admin());
create policy office_v3_commits_insert on chinatech_v2_private.office_v3_commits for insert to chinatech_runtime with check(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) and current_setting('app.office_v3_op',true)='commit' and job_id::text=current_setting('app.office_v3_job',true) and exists(select 1 from chinatech_v2_private.office_v3_intents i where i.job_id=office_v3_commits.job_id and i.installation_id=office_v3_commits.installation_id and i.key_hash=office_v3_commits.key_hash and i.plan_hash=office_v3_commits.plan_hash and i.start_before>now()) and exists(select 1 from chinatech_v2_private.office_v3_control c join chinatech_v2_private.office_v3_intents i on i.job_id=office_v3_commits.job_id where c.singleton and c.enabled and c.release_ready and chinatech_v2_private.desktop_version_parts(i.app_version)>=chinatech_v2_private.desktop_version_parts(c.minimum_version) and chinatech_v2_private.desktop_version_parts(i.app_version)<=chinatech_v2_private.desktop_version_parts(c.verified_version)));
create policy office_v3_outcomes_read on chinatech_v2_private.office_v3_outcomes for select to chinatech_runtime using(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) or chinatech_v2_private.office_desktop_admin());
create policy office_v3_outcomes_insert on chinatech_v2_private.office_v3_outcomes for insert to chinatech_runtime with check(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) and current_setting('app.office_v3_op',true)='outcome' and job_id::text=current_setting('app.office_v3_job',true) and exists(select 1 from chinatech_v2_private.office_v3_commits c where c.job_id=office_v3_outcomes.job_id and c.installation_id=office_v3_outcomes.installation_id and c.key_hash=office_v3_outcomes.key_hash));
create policy office_v3_receipts_read on chinatech_v2_private.office_v3_receipts for select to chinatech_runtime using((installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true)) or (current_setting('app.office_v3_op',true) in('session','start') and source_hash=current_setting('app.office_v3_source_hash',true)));
create policy office_v3_receipts_insert on chinatech_v2_private.office_v3_receipts for insert to chinatech_runtime with check(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true) and request_id::text=current_setting('app.office_v3_request',true) and endpoint=current_setting('app.office_v3_op',true) and source_hash=current_setting('app.office_v3_source_hash',true));
create policy office_v3_admin_receipt_read on chinatech_v2_private.office_v3_admin_receipts for select to chinatech_runtime using(chinatech_v2_private.office_desktop_admin() and actor_id=auth.uid());
create policy office_v3_admin_receipt_insert on chinatech_v2_private.office_v3_admin_receipts for insert to chinatech_runtime with check(chinatech_v2_private.office_desktop_admin() and actor_id=auth.uid() and session_id::text=auth.jwt()->>'session_id');
