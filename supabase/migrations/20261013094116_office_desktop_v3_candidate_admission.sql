-- Owner-created, exact-scope candidate acceptance; public release readiness is unchanged.
create table chinatech_v2_private.office_v3_candidate_grants (
 id uuid primary key default gen_random_uuid(), installation_id uuid not null, key_hash text not null,
 app_version text not null check(chinatech_v2_private.desktop_version_parts(app_version) is not null),
 architecture text not null check(architecture in('win-x64','win-arm64')),
 action text not null check(action in('install','activate','uninstall','close','reinstall')),
 plan jsonb not null check(jsonb_typeof(plan)='object'), plan_hash text not null check(plan_hash ~ '^[a-f0-9]{64}$'),
 binary_sha text not null check(binary_sha ~ '^[a-f0-9]{64}$'), source_commit text not null check(source_commit ~ '^[a-f0-9]{40}$'),
 active boolean not null default true, revision bigint not null default 0 check(revision>=0),
 max_committed_jobs smallint not null default 1 check(max_committed_jobs=1),
 created_by uuid not null references chinatech_v2.accounts(id), created_at timestamptz not null default now(),
 admit_until timestamptz not null default now()+interval '4 hours', revoked_at timestamptz,
 foreign key(installation_id,key_hash) references chinatech_v2_private.office_v3_devices(installation_id,key_hash),
 check(admit_until>created_at and admit_until<=created_at+interval '4 hours'),
 check((active and revoked_at is null) or (not active and revoked_at is not null))
);
create index office_v3_candidate_lookup on chinatech_v2_private.office_v3_candidate_grants(installation_id,key_hash,app_version,architecture,action,plan_hash) where active;
alter table chinatech_v2_private.office_v3_candidate_grants enable row level security;
alter table chinatech_v2_private.office_v3_candidate_grants force row level security;
revoke all on chinatech_v2_private.office_v3_candidate_grants from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.office_v3_candidate_grants to chinatech_runtime;
create policy office_v3_candidate_read on chinatech_v2_private.office_v3_candidate_grants for select to chinatech_runtime
 using(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true)
 and current_setting('app.office_v3_op',true) in('admission','start','commit'));

-- Even direct owner revocation shares the server's locks. Scope is append-only;
-- a different candidate or plan requires a new grant rather than rewriting facts.
create function chinatech_v2_private.office_v3_candidate_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('office-v3:control',140));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('office-v3:grant:'||coalesce(new.id,old.id)::text,140));
 if tg_op='DELETE' then raise exception 'Candidate grants are retained; revoke instead' using errcode='23514'; end if;
 if tg_op='UPDATE' and ((to_jsonb(new)-array['active','revision','revoked_at'])<>(to_jsonb(old)-array['active','revision','revoked_at'])
   or not old.active or new.active or new.revision<>old.revision+1 or new.revoked_at is null) then
  raise exception 'Candidate scope is immutable; only one-way revocation is permitted' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function chinatech_v2_private.office_v3_candidate_guard() from public,anon,authenticated,chinatech_runtime;
create trigger office_v3_candidate_guard before insert or update or delete on chinatech_v2_private.office_v3_candidate_grants
 for each row execute function chinatech_v2_private.office_v3_candidate_guard();

alter table chinatech_v2_private.office_v3_intents
 add column admission_mode text not null default 'public' check(admission_mode in('public','candidate')),
 add column candidate_grant_id uuid references chinatech_v2_private.office_v3_candidate_grants(id),
 add column candidate_revision bigint,
 add check((admission_mode='public' and candidate_grant_id is null and candidate_revision is null)
 or (admission_mode='candidate' and candidate_grant_id is not null and candidate_revision is not null and candidate_revision>=0));
alter table chinatech_v2_private.office_v3_commits
 add column admission_mode text not null default 'public' check(admission_mode in('public','candidate')),
 add column candidate_grant_id uuid references chinatech_v2_private.office_v3_candidate_grants(id),
 add column candidate_revision bigint,
 add check((admission_mode='public' and candidate_grant_id is null and candidate_revision is null)
 or (admission_mode='candidate' and candidate_grant_id is not null and candidate_revision is not null and candidate_revision>=0)),
 add check(admission_mode<>'candidate' or resume_until=created_at+interval '7 days');
create unique index office_v3_candidate_single_commit on chinatech_v2_private.office_v3_commits(candidate_grant_id) where candidate_grant_id is not null;
alter table chinatech_v2_private.office_v3_receipts drop constraint office_v3_receipts_endpoint_check;
alter table chinatech_v2_private.office_v3_receipts add check(endpoint in('session','admission','start','commit','resume','outcome'));

drop policy office_v3_intents_insert on chinatech_v2_private.office_v3_intents;
create policy office_v3_intents_insert on chinatech_v2_private.office_v3_intents for insert to chinatech_runtime with check(
 installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true)
 and current_setting('app.office_v3_op',true)='start' and job_id::text=current_setting('app.office_v3_job',true)
 and exists(select 1 from chinatech_v2_private.office_v3_sessions s where s.id=session_id and s.installation_id=office_v3_intents.installation_id and s.key_hash=office_v3_intents.key_hash and s.expires_at>now())
 and exists(select 1 from chinatech_v2_private.office_v3_control c where c.singleton and c.enabled and control_revision=c.revision
 and chinatech_v2_private.desktop_version_parts(app_version)>=chinatech_v2_private.desktop_version_parts(c.minimum_version) and (
  (admission_mode='public' and c.release_ready and chinatech_v2_private.desktop_version_parts(app_version)>=chinatech_v2_private.desktop_version_parts(c.minimum_version)
   and chinatech_v2_private.desktop_version_parts(app_version)<=chinatech_v2_private.desktop_version_parts(c.verified_version))
  or (admission_mode='candidate' and exists(select 1 from chinatech_v2_private.office_v3_candidate_grants g
   where g.id=candidate_grant_id and g.active and g.revision=candidate_revision and g.created_at<=now() and g.admit_until>now()
   and start_before<=g.admit_until and g.installation_id=office_v3_intents.installation_id and g.key_hash=office_v3_intents.key_hash
   and g.app_version=office_v3_intents.app_version and g.architecture=office_v3_intents.architecture and g.action=office_v3_intents.action
   and g.plan_hash=office_v3_intents.plan_hash and g.plan=office_v3_intents.plan
   and not exists(select 1 from chinatech_v2_private.office_v3_commits x where x.candidate_grant_id=g.id)))
 )));
drop policy office_v3_commits_insert on chinatech_v2_private.office_v3_commits;
create policy office_v3_commits_insert on chinatech_v2_private.office_v3_commits for insert to chinatech_runtime with check(
 installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true)
 and current_setting('app.office_v3_op',true)='commit' and job_id::text=current_setting('app.office_v3_job',true)
 and exists(select 1 from chinatech_v2_private.office_v3_intents i join chinatech_v2_private.office_v3_control c on c.singleton
  where i.job_id=office_v3_commits.job_id and i.installation_id=office_v3_commits.installation_id and i.key_hash=office_v3_commits.key_hash
  and i.plan_hash=office_v3_commits.plan_hash and i.start_before>now() and c.enabled and i.admission_mode=office_v3_commits.admission_mode
  and i.candidate_grant_id is not distinct from office_v3_commits.candidate_grant_id and i.candidate_revision is not distinct from office_v3_commits.candidate_revision
  and chinatech_v2_private.desktop_version_parts(i.app_version)>=chinatech_v2_private.desktop_version_parts(c.minimum_version)
  and ((i.admission_mode='public' and c.release_ready
   and chinatech_v2_private.desktop_version_parts(i.app_version)>=chinatech_v2_private.desktop_version_parts(c.minimum_version)
   and chinatech_v2_private.desktop_version_parts(i.app_version)<=chinatech_v2_private.desktop_version_parts(c.verified_version))
   or (i.admission_mode='candidate' and exists(select 1 from chinatech_v2_private.office_v3_candidate_grants g where g.id=i.candidate_grant_id
    and g.active and g.revision=i.candidate_revision and g.created_at<=now() and g.admit_until>now()
    and g.installation_id=i.installation_id and g.key_hash=i.key_hash and g.app_version=i.app_version and g.architecture=i.architecture
    and g.action=i.action and g.plan_hash=i.plan_hash and g.plan=i.plan
    and not exists(select 1 from chinatech_v2_private.office_v3_commits x where x.candidate_grant_id=g.id))))));
drop policy office_v3_receipts_read on chinatech_v2_private.office_v3_receipts;
create policy office_v3_receipts_read on chinatech_v2_private.office_v3_receipts for select to chinatech_runtime
 using((installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true))
 or (current_setting('app.office_v3_op',true) in('session','admission','start') and source_hash=current_setting('app.office_v3_source_hash',true)));
