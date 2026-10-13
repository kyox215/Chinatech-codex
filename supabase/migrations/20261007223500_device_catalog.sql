-- Global reference names only; no existing device, repair or sale data changes.
create table chinatech_v2_private.device_catalog_control (
 singleton boolean primary key default true check(singleton),
 admin_user_id uuid references chinatech_v2.accounts(id),
 revision bigint not null default 0 check(revision>=0),
 updated_by uuid references chinatech_v2.accounts(id), updated_at timestamptz
);
alter table chinatech_v2_private.device_catalog_control enable row level security;
alter table chinatech_v2_private.device_catalog_control force row level security;
revoke all on chinatech_v2_private.device_catalog_control from public,anon,authenticated;
grant select on chinatech_v2_private.device_catalog_control to chinatech_runtime;
grant update(revision,updated_by,updated_at) on chinatech_v2_private.device_catalog_control to chinatech_runtime;
insert into chinatech_v2_private.device_catalog_control(singleton) values(true);

create function chinatech_v2_private.device_catalog_can_read() returns boolean language sql stable security invoker set search_path='' as $$
 select chinatech_v2_private.live_user() and chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid)
$$;
revoke all on function chinatech_v2_private.device_catalog_can_read() from public,anon,authenticated;
grant execute on function chinatech_v2_private.device_catalog_can_read() to chinatech_runtime;
create policy catalog_control_read on chinatech_v2_private.device_catalog_control for select to chinatech_runtime using(chinatech_v2_private.device_catalog_can_read());
create policy catalog_control_update on chinatech_v2_private.device_catalog_control for update to chinatech_runtime
 using(chinatech_v2_private.device_catalog_can_read() and admin_user_id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)
 with check(chinatech_v2_private.device_catalog_can_read() and admin_user_id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid and updated_by=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid);
create function chinatech_v2_private.device_catalog_can_manage() returns boolean language sql stable security invoker set search_path='' as $$
 select chinatech_v2_private.device_catalog_can_read() and exists(select 1 from chinatech_v2_private.device_catalog_control where singleton and admin_user_id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)
$$;
revoke all on function chinatech_v2_private.device_catalog_can_manage() from public,anon,authenticated;
grant execute on function chinatech_v2_private.device_catalog_can_manage() to chinatech_runtime;

create table chinatech_v2_private.device_catalog_entries (
 id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{1,99}$'),
 category text not null check(category in ('phone','tablet','laptop','desktop','console','other')),
 brand text not null, family text not null, enabled boolean not null,
 release_sort text not null, name_sort text not null, search_text text not null,
 identity_key text not null unique,
 version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object' and data->>'id'=id and data->>'category'=category and data->>'brand'=brand and data->>'family'=family and (data->>'enabled')::boolean=enabled)
);
create index device_catalog_filter on chinatech_v2_private.device_catalog_entries(category,brand,enabled,release_sort desc,name_sort,id);
create index device_catalog_family on chinatech_v2_private.device_catalog_entries(category,brand,family,enabled);
alter table chinatech_v2_private.device_catalog_entries enable row level security;
alter table chinatech_v2_private.device_catalog_entries force row level security;
revoke all on chinatech_v2_private.device_catalog_entries from public,anon,authenticated;
grant select,insert,update on chinatech_v2_private.device_catalog_entries to chinatech_runtime;
create policy catalog_entries_read on chinatech_v2_private.device_catalog_entries for select to chinatech_runtime using(chinatech_v2_private.device_catalog_can_read());
create policy catalog_entries_insert on chinatech_v2_private.device_catalog_entries for insert to chinatech_runtime with check(chinatech_v2_private.device_catalog_can_manage());
create policy catalog_entries_update on chinatech_v2_private.device_catalog_entries for update to chinatech_runtime using(chinatech_v2_private.device_catalog_can_manage()) with check(chinatech_v2_private.device_catalog_can_manage());

create table chinatech_v2_private.device_catalog_history (
 revision bigint primary key,
 actor_id uuid not null references chinatech_v2.accounts(id),
 session_id uuid not null, request_id uuid not null unique,
 changes jsonb not null check(jsonb_typeof(changes)='array'),
 created_at timestamptz not null default now()
);
alter table chinatech_v2_private.device_catalog_history enable row level security;
alter table chinatech_v2_private.device_catalog_history force row level security;
revoke all on chinatech_v2_private.device_catalog_history from public,anon,authenticated;
grant select,insert on chinatech_v2_private.device_catalog_history to chinatech_runtime;
create policy catalog_history_read on chinatech_v2_private.device_catalog_history for select to chinatech_runtime using(chinatech_v2_private.device_catalog_can_manage());
create policy catalog_history_insert on chinatech_v2_private.device_catalog_history for insert to chinatech_runtime with check(chinatech_v2_private.device_catalog_can_manage() and actor_id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid and session_id::text=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id');

create table chinatech_v2_private.device_catalog_receipts (
 request_id uuid primary key, actor_id uuid not null references chinatech_v2.accounts(id), session_id uuid not null,
 digest text not null check(digest ~ '^[a-f0-9]{64}$'), result jsonb not null check(jsonb_typeof(result)='object'),
 created_at timestamptz not null default now()
);
alter table chinatech_v2_private.device_catalog_receipts enable row level security;
alter table chinatech_v2_private.device_catalog_receipts force row level security;
revoke all on chinatech_v2_private.device_catalog_receipts from public,anon,authenticated;
grant select,insert on chinatech_v2_private.device_catalog_receipts to chinatech_runtime;
create policy catalog_receipt_read on chinatech_v2_private.device_catalog_receipts for select to chinatech_runtime using(chinatech_v2_private.device_catalog_can_manage() and actor_id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid);
create policy catalog_receipt_insert on chinatech_v2_private.device_catalog_receipts for insert to chinatech_runtime with check(chinatech_v2_private.device_catalog_can_manage() and actor_id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid and session_id::text=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id');
