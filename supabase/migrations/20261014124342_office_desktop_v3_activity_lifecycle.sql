-- One bounded, sanitized activity projection per committed job. No raw output,
-- account names, document contents or local paths are accepted or persisted.
create table chinatech_v2_private.office_v3_activity (
 job_id uuid primary key references chinatech_v2_private.office_v3_commits(job_id),
 installation_id uuid not null, key_hash text not null, plan_hash text not null,
 stage text not null check(stage in('Detect','Download','Remove','Install','Components','Activate','Finished','CloseApps','RestoreApps')),
 error_code text check(error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
 last_activity_at timestamptz not null,
 foreign key(job_id,installation_id,key_hash,plan_hash) references chinatech_v2_private.office_v3_intents(job_id,installation_id,key_hash,plan_hash)
);
alter table chinatech_v2_private.office_v3_activity enable row level security;
alter table chinatech_v2_private.office_v3_activity force row level security;
revoke all on chinatech_v2_private.office_v3_activity from public,anon,authenticated,chinatech_runtime;
grant select,insert on chinatech_v2_private.office_v3_activity to chinatech_runtime;
grant update(stage,error_code,last_activity_at) on chinatech_v2_private.office_v3_activity to chinatech_runtime;
create policy office_v3_activity_read on chinatech_v2_private.office_v3_activity for select to chinatech_runtime
 using((installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true)) or chinatech_v2_private.office_desktop_admin());
create policy office_v3_activity_insert on chinatech_v2_private.office_v3_activity for insert to chinatech_runtime
 with check(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true)
 and current_setting('app.office_v3_op',true)='activity' and job_id::text=current_setting('app.office_v3_job',true)
 and last_activity_at between statement_timestamp()-interval '10 seconds' and statement_timestamp()+interval '1 second'
 and exists(select 1 from chinatech_v2_private.office_v3_commits c where c.job_id=office_v3_activity.job_id and c.installation_id=office_v3_activity.installation_id and c.key_hash=office_v3_activity.key_hash and c.plan_hash=office_v3_activity.plan_hash and c.resume_until>now())
 and not exists(select 1 from chinatech_v2_private.office_v3_outcomes o where o.job_id=office_v3_activity.job_id and o.status='completed'));
create policy office_v3_activity_update on chinatech_v2_private.office_v3_activity for update to chinatech_runtime
 using(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true)
 and current_setting('app.office_v3_op',true)='activity' and job_id::text=current_setting('app.office_v3_job',true)
 and last_activity_at<=statement_timestamp()-interval '60 seconds')
 with check(installation_id::text=current_setting('app.office_v3_installation',true) and key_hash=current_setting('app.office_v3_key_hash',true)
 and current_setting('app.office_v3_op',true)='activity' and job_id::text=current_setting('app.office_v3_job',true)
 and last_activity_at between statement_timestamp()-interval '10 seconds' and statement_timestamp()+interval '1 second'
 and exists(select 1 from chinatech_v2_private.office_v3_commits c where c.job_id=office_v3_activity.job_id and c.installation_id=office_v3_activity.installation_id and c.key_hash=office_v3_activity.key_hash and c.plan_hash=office_v3_activity.plan_hash and c.resume_until>now())
 and not exists(select 1 from chinatech_v2_private.office_v3_outcomes o where o.job_id=office_v3_activity.job_id and o.status='completed'));
alter table chinatech_v2_private.office_v3_receipts drop constraint office_v3_receipts_endpoint_check;
alter table chinatech_v2_private.office_v3_receipts add check(endpoint in('session','admission','start','commit','resume','outcome','activity'));

-- Cleanup retains recovery/replay dependencies and candidate-grant audit facts.
-- Runtime receives no DELETE grant. This narrowly scoped private function is the
-- sole maintenance capability; no table, cutoff, SQL, user or schema parameters.
create table chinatech_v2_private.office_v3_cleanup_receipts (
 request_id uuid primary key, actor_id uuid not null references chinatech_v2.accounts(id), session_id uuid not null,
 expected_digest text not null check(expected_digest ~ '^[a-f0-9]{64}$'), result jsonb not null,
 created_at timestamptz not null default now()
);
alter table chinatech_v2_private.office_v3_cleanup_receipts enable row level security;
alter table chinatech_v2_private.office_v3_cleanup_receipts force row level security;
revoke all on chinatech_v2_private.office_v3_cleanup_receipts from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.office_v3_cleanup_receipts to chinatech_runtime;
create policy office_v3_cleanup_receipts_read on chinatech_v2_private.office_v3_cleanup_receipts for select to chinatech_runtime
 using(chinatech_v2_private.office_desktop_admin() and actor_id=auth.uid());
create function chinatech_v2_private.office_v3_cleanup(p_execute boolean default false,p_expected_digest text default null,p_request_id uuid default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare
 cutoff timestamptz:=now()-interval '90 days'; jobs uuid[]; sessions uuid[]; devices uuid[]; admins uuid[];
 receipt_keys jsonb; rate_keys jsonb; counts jsonb; plan jsonb; digest text; result jsonb; prior chinatech_v2_private.office_v3_cleanup_receipts;
begin
 if not chinatech_v2_private.office_desktop_admin() then raise exception 'Office administrator required' using errcode='42501'; end if;
 if p_execute and (current_setting('app.office_v3_cleanup_execute',true) is distinct from 'true' or p_request_id is null or p_expected_digest is null or p_expected_digest !~ '^[a-f0-9]{64}$') then
  raise exception 'Cleanup execution is disabled or unconfirmed' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('office-v3:cleanup',140));
 if p_execute then
  select * into prior from chinatech_v2_private.office_v3_cleanup_receipts where request_id=p_request_id;
  if found then
   if prior.actor_id<>auth.uid() or prior.session_id::text<>auth.jwt()->>'session_id' or prior.expected_digest<>p_expected_digest then raise exception 'Cleanup request conflict' using errcode='40001'; end if;
   return prior.result;
  end if;
 end if;
 -- Prevent concurrent capability/activity creation between scope calculation and
 -- deletion. Reads continue; expiry is additionally older than ninety days.
 lock table chinatech_v2_private.office_v3_devices,chinatech_v2_private.office_v3_sessions,chinatech_v2_private.office_v3_intents,
 chinatech_v2_private.office_v3_commits,chinatech_v2_private.office_v3_outcomes,chinatech_v2_private.office_v3_activity,
 chinatech_v2_private.office_v3_receipts,chinatech_v2_private.office_v3_admin_receipts,chinatech_v2_private.office_v3_rate_buckets
 in share row exclusive mode;
 select coalesce(array_agg(job_id order by job_id),array[]::uuid[]) into jobs from (
  select i.job_id from chinatech_v2_private.office_v3_intents i left join chinatech_v2_private.office_v3_commits c using(job_id)
  where i.start_before<cutoff and (c.job_id is null or c.resume_until<cutoff)
  and not exists(select 1 from chinatech_v2_private.office_v3_outcomes o where o.job_id=i.job_id and o.created_at>=cutoff)
  and not exists(select 1 from chinatech_v2_private.office_v3_activity a where a.job_id=i.job_id and a.last_activity_at>=cutoff)
  order by i.job_id limit 1000
 ) j;
 select coalesce(jsonb_agg(jsonb_build_array(installation_id,request_id) order by installation_id,request_id),'[]'::jsonb) into receipt_keys from (
  select r.installation_id,r.request_id from chinatech_v2_private.office_v3_receipts r where r.created_at<cutoff
  and not exists(select 1 from chinatech_v2_private.office_v3_commits c where c.installation_id=r.installation_id and not(c.job_id=any(jobs)))
  and not exists(select 1 from chinatech_v2_private.office_v3_intents i where i.installation_id=r.installation_id and not(i.job_id=any(jobs)))
  order by r.installation_id,r.request_id limit 10000
 ) r;
 select coalesce(array_agg(id order by id),array[]::uuid[]) into sessions from (
  select s.id from chinatech_v2_private.office_v3_sessions s where s.expires_at<cutoff
  and not exists(select 1 from chinatech_v2_private.office_v3_intents i where i.session_id=s.id and not(i.job_id=any(jobs)))
  order by s.id limit 1000
 ) s;
 select coalesce(array_agg(installation_id order by installation_id),array[]::uuid[]) into devices from (
  select d.installation_id from chinatech_v2_private.office_v3_devices d where d.created_at<cutoff
  and not exists(select 1 from chinatech_v2_private.office_v3_sessions s where s.installation_id=d.installation_id and not(s.id=any(sessions)))
  and not exists(select 1 from chinatech_v2_private.office_v3_intents i where i.installation_id=d.installation_id and not(i.job_id=any(jobs)))
  and not exists(select 1 from chinatech_v2_private.office_v3_receipts r where r.installation_id=d.installation_id and not receipt_keys @> jsonb_build_array(jsonb_build_array(r.installation_id,r.request_id)))
  and not exists(select 1 from chinatech_v2_private.office_v3_candidate_grants g where g.installation_id=d.installation_id)
  order by d.installation_id limit 1000
 ) d;
 select coalesce(array_agg(request_id order by request_id),array[]::uuid[]) into admins from (
  select request_id from chinatech_v2_private.office_v3_admin_receipts where created_at<cutoff order by request_id limit 1000
 ) a;
 select coalesce(jsonb_agg(jsonb_build_array(kind,key_hash) order by kind,key_hash),'[]'::jsonb) into rate_keys from (
  select kind,key_hash from chinatech_v2_private.office_v3_rate_buckets where minute<floor(extract(epoch from cutoff)/60)::bigint order by kind,key_hash limit 10000
 ) r;
 counts:=jsonb_build_object('jobs',cardinality(jobs),'outcomes',(select count(*) from chinatech_v2_private.office_v3_outcomes where job_id=any(jobs)),
 'activity',(select count(*) from chinatech_v2_private.office_v3_activity where job_id=any(jobs)),
 'commits',(select count(*) from chinatech_v2_private.office_v3_commits where job_id=any(jobs)),
 'receipts',jsonb_array_length(receipt_keys),'sessions',cardinality(sessions),'devices',cardinality(devices),'adminReceipts',cardinality(admins),'rateBuckets',jsonb_array_length(rate_keys));
 plan:=jsonb_build_object('jobs',jobs,'receiptKeys',receipt_keys,'sessions',sessions,'devices',devices,'adminReceipts',admins,'rateKeys',rate_keys,'counts',counts);
 digest:=encode(sha256(convert_to(plan::text,'UTF8')),'hex');
 result:=jsonb_build_object('retentionDays',90,'expiredBefore',cutoff,'digest',digest,'counts',counts,'dryRun',not p_execute,'candidateGrantsRetained',true);
 if not p_execute then return result; end if;
 if digest<>p_expected_digest then raise exception 'Cleanup scope changed; preview again' using errcode='40001'; end if;
 delete from chinatech_v2_private.office_v3_outcomes where job_id=any(jobs);
 delete from chinatech_v2_private.office_v3_activity where job_id=any(jobs);
 delete from chinatech_v2_private.office_v3_commits where job_id=any(jobs);
 delete from chinatech_v2_private.office_v3_intents where job_id=any(jobs);
 delete from chinatech_v2_private.office_v3_receipts r where receipt_keys @> jsonb_build_array(jsonb_build_array(r.installation_id,r.request_id));
 delete from chinatech_v2_private.office_v3_sessions where id=any(sessions);
 delete from chinatech_v2_private.office_v3_devices where installation_id=any(devices);
 delete from chinatech_v2_private.office_v3_admin_receipts where request_id=any(admins);
 delete from chinatech_v2_private.office_v3_rate_buckets r where rate_keys @> jsonb_build_array(jsonb_build_array(r.kind,r.key_hash));
 insert into chinatech_v2_private.office_v3_cleanup_receipts(request_id,actor_id,session_id,expected_digest,result)
 values(p_request_id,auth.uid(),(auth.jwt()->>'session_id')::uuid,p_expected_digest,result);
 return result;
end $$;
revoke all on function chinatech_v2_private.office_v3_cleanup(boolean,text,uuid) from public,anon,authenticated;
grant execute on function chinatech_v2_private.office_v3_cleanup(boolean,text,uuid) to chinatech_runtime;

-- Preserve completed outcomes even if a runtime caller bypasses the API. Other
-- outcome states remain recoverable under their original unexpired permit.
create function chinatech_v2_private.office_v3_outcome_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('office-v3:job:'||new.job_id::text,140));
 if not exists(select 1 from chinatech_v2_private.office_v3_commits c where c.job_id=new.job_id and c.installation_id=new.installation_id and c.key_hash=new.key_hash and c.resume_until>now())
 or exists(select 1 from chinatech_v2_private.office_v3_outcomes o where o.job_id=new.job_id and o.status='completed')
 or new.sequence<>(select coalesce(max(o.sequence),0)+1 from chinatech_v2_private.office_v3_outcomes o where o.job_id=new.job_id) then
  raise exception 'Outcome is expired, completed or out of sequence' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function chinatech_v2_private.office_v3_outcome_guard() from public,anon,authenticated,chinatech_runtime;
create trigger office_v3_outcome_guard before insert on chinatech_v2_private.office_v3_outcomes
 for each row execute function chinatech_v2_private.office_v3_outcome_guard();
