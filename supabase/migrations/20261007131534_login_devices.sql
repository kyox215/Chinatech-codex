-- Project-local session controls; shared Auth configuration and records are untouched.
begin;
create table chinatech_v2_private.login_session_controls (
 id boolean primary key default true check(id), enabled boolean not null default false
);
insert into chinatech_v2_private.login_session_controls(id) values(true);
alter table chinatech_v2_private.login_session_controls enable row level security;
alter table chinatech_v2_private.login_session_controls force row level security;
create table chinatech_v2_private.login_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  remember boolean not null default false,
  browser text not null default '', os text not null default '',
  revoked_at timestamptz,
  revision integer not null default 1
);
create index on chinatech_v2_private.login_sessions(user_id, created_at desc, session_id);
create table chinatech_v2_private.store_login_sessions (
  store_id uuid not null references chinatech_v2.stores(id),
  session_id uuid not null references chinatech_v2_private.login_sessions(session_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz,
  revision integer not null default 1,
  primary key(store_id,session_id)
);
create index on chinatech_v2_private.store_login_sessions(store_id,user_id,last_active_at desc);
create table chinatech_v2_private.session_audit (
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  store_id uuid,
  target_user_id uuid not null references auth.users(id),
  kind text not null,
  target_session_id uuid,
  created_at timestamptz not null default now(),
  primary key(actor_id,request_id)
);
-- Adopt only sessions existing at migration time; later missing records fail closed.
insert into chinatech_v2_private.login_sessions(session_id,user_id,created_at,last_active_at,remember)
select s.id,s.user_id,s.created_at,now(),true from auth.sessions s join chinatech_v2.accounts a on a.id=s.user_id;

create function chinatech_v2_private.enroll_login_session(keep_login boolean, browser_name text, os_name text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    join chinatech_v2.accounts a on a.id=u.id where s.id::text=auth.jwt()->>'session_id'
    and s.user_id=auth.uid() and u.email_confirmed_at is not null and a.account_status='active'
    and (s.not_after is null or s.not_after>now())) then raise exception 'Invalid login session'; end if;
  insert into chinatech_v2_private.login_sessions(session_id,user_id,remember,browser,os)
    values((auth.jwt()->>'session_id')::uuid,auth.uid(),keep_login,left(browser_name,40),left(os_name,40))
    on conflict(session_id) do nothing;
end;
$$;
revoke all on function chinatech_v2_private.enroll_login_session(boolean,text,text) from public;
grant execute on function chinatech_v2_private.enroll_login_session(boolean,text,text) to chinatech_runtime;

create or replace function chinatech_v2_private.live_user()
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(
 select 1 from auth.users u join chinatech_v2.accounts a on a.id=u.id join auth.sessions s on s.user_id=u.id
 left join chinatech_v2_private.login_sessions l on l.session_id=s.id and l.user_id=u.id
 where u.id=auth.uid() and u.email_confirmed_at is not null and a.account_status='active'
 and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now())
 and ((l.session_id is null and not (select enabled from chinatech_v2_private.login_session_controls where id))
 or (l.session_id is not null and l.revoked_at is null and l.last_active_at>now()-interval '30 days')));
$$;
create or replace function chinatech_v2_private.member_access(target_store uuid, permission text default null)
returns boolean language sql stable security definer set search_path='' as $$
select chinatech_v2_private.live_user() and exists(select 1 from chinatech_v2.store_memberships m
 where m.store_id=target_store and m.user_id=auth.uid() and m.membership_status='active'
 and (permission is null or permission=any(m.permissions)))
 and not exists(select 1 from chinatech_v2_private.store_login_sessions s
 where s.store_id=target_store and s.session_id::text=auth.jwt()->>'session_id' and s.revoked_at is not null);
$$;

alter table chinatech_v2_private.login_sessions enable row level security;
alter table chinatech_v2_private.login_sessions force row level security;
alter table chinatech_v2_private.store_login_sessions enable row level security;
alter table chinatech_v2_private.store_login_sessions force row level security;
alter table chinatech_v2_private.session_audit enable row level security;
alter table chinatech_v2_private.session_audit force row level security;
create function chinatech_v2_private.owns_session_store(target_store uuid,target_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select chinatech_v2_private.live_user() and exists(select 1 from chinatech_v2.store_memberships actor
 join chinatech_v2.store_memberships target on target.store_id=actor.store_id
 where actor.store_id=target_store and actor.user_id=auth.uid() and actor.role='owner'
 and actor.membership_status='active' and target.user_id=target_user
 and target.membership_status='active'
 and chinatech_v2_private.member_access(target_store));
$$;
revoke all on function chinatech_v2_private.owns_session_store(uuid,uuid) from public;
grant execute on function chinatech_v2_private.owns_session_store(uuid,uuid) to chinatech_runtime;
create policy session_read on chinatech_v2_private.login_sessions for select to chinatech_runtime using(
 user_id=auth.uid() or exists(select 1 from chinatech_v2_private.store_login_sessions sl
 where sl.session_id=login_sessions.session_id and chinatech_v2_private.owns_session_store(sl.store_id,sl.user_id)));
create policy session_update on chinatech_v2_private.login_sessions for update to chinatech_runtime
 using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy store_session on chinatech_v2_private.store_login_sessions to chinatech_runtime
 using(user_id=auth.uid() or chinatech_v2_private.owns_session_store(store_id,user_id))
 with check((user_id=auth.uid() and chinatech_v2_private.member_access(store_id)) or chinatech_v2_private.owns_session_store(store_id,user_id));
create policy session_audit on chinatech_v2_private.session_audit to chinatech_runtime
 using(actor_id=auth.uid()) with check(actor_id=auth.uid());
grant select,update on chinatech_v2_private.login_sessions to chinatech_runtime;
grant select,insert,update on chinatech_v2_private.store_login_sessions to chinatech_runtime;
grant select,insert on chinatech_v2_private.session_audit to chinatech_runtime;
create function chinatech_v2_private.session_auth_active(target_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from auth.sessions s join chinatech_v2_private.login_sessions l on l.session_id=s.id
 where s.id=target_session and (s.not_after is null or s.not_after>now())
 and (l.user_id=auth.uid() or exists(select 1 from chinatech_v2_private.store_login_sessions sl
 where sl.session_id=s.id and chinatech_v2_private.owns_session_store(sl.store_id,sl.user_id))));
$$;
create function chinatech_v2_private.lock_store_session(target_store uuid,target_session uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from chinatech_v2_private.store_login_sessions s where s.store_id=target_store
 and s.session_id=target_session and chinatech_v2_private.owns_session_store(target_store,s.user_id)) then
 raise exception 'Session access denied'; end if;
 perform 1 from chinatech_v2_private.login_sessions where session_id=target_session for update;
end;
$$;
revoke all on function chinatech_v2_private.session_auth_active(uuid) from public;
revoke all on function chinatech_v2_private.lock_store_session(uuid,uuid) from public;
grant execute on function chinatech_v2_private.session_auth_active(uuid),chinatech_v2_private.lock_store_session(uuid,uuid) to chinatech_runtime;
create or replace function chinatech_v2_private.sync_topic_access(target_topic text)
returns boolean language sql stable security definer set search_path='' as $$
select chinatech_v2_private.live_user() and exists(select 1 from chinatech_v2.store_memberships m
 where m.user_id=auth.uid() and m.membership_status='active'
 and target_topic='ct:store:'||m.store_id::text and chinatech_v2_private.member_access(m.store_id));
$$;
-- Only the compatibility interval may lazily adopt an Auth session absent from the ledger.
create function chinatech_v2_private.adopt_cutover_login_session()
returns void language plpgsql security definer set search_path='' as $$
begin
 if not (select enabled from chinatech_v2_private.login_session_controls where id) then
  perform chinatech_v2_private.enroll_login_session(true,'','');
 end if;
end;
$$;
revoke all on function chinatech_v2_private.adopt_cutover_login_session() from public,anon,authenticated;
grant execute on function chinatech_v2_private.adopt_cutover_login_session() to chinatech_runtime;
-- Execute once AFTER deployment/verification, using the migration administrator.
-- Missing legacy sessions created during cutover are adopted; tombstones stay intact.
create function chinatech_v2_private.enable_login_session_controls()
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into chinatech_v2_private.login_sessions(session_id,user_id,created_at,last_active_at,remember)
 select s.id,s.user_id,s.created_at,now(),true from auth.sessions s join chinatech_v2.accounts a on a.id=s.user_id
 on conflict(session_id) do nothing;
 update chinatech_v2_private.login_session_controls set enabled=true where id;
end;
$$;
revoke all on function chinatech_v2_private.enable_login_session_controls() from public,anon,authenticated,chinatech_runtime;
commit;
