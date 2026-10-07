-- Global Office control only. No changes to store business data or legacy schemas.
create table chinatech_v2_private.office_command_control (
 singleton boolean primary key default true check(singleton=true),
 admin_user_id uuid references chinatech_v2.accounts(id),
 enabled boolean not null default false,
 command_version bigint not null default 1 check(command_version>0),
 revision bigint not null default 0 check(revision>=0),
 updated_at timestamptz,
 updated_by uuid references chinatech_v2.accounts(id)
);
alter table chinatech_v2_private.office_command_control enable row level security;
alter table chinatech_v2_private.office_command_control force row level security;
revoke all on chinatech_v2_private.office_command_control from public,anon,authenticated;
grant select on chinatech_v2_private.office_command_control to chinatech_runtime;
grant update(enabled,command_version,revision,updated_at,updated_by) on chinatech_v2_private.office_command_control to chinatech_runtime;
create policy office_runtime_read on chinatech_v2_private.office_command_control for select to chinatech_runtime using(true);
create policy office_admin_update on chinatech_v2_private.office_command_control for update to chinatech_runtime
 using(chinatech_v2_private.live_user() and admin_user_id=auth.uid())
 with check(chinatech_v2_private.live_user() and admin_user_id=auth.uid() and updated_by=auth.uid());
insert into chinatech_v2_private.office_command_control(singleton) values(true);

create table chinatech_v2_private.office_command_receipts (
 request_id uuid primary key,
 actor_id uuid not null references chinatech_v2.accounts(id),
 session_id uuid not null,
 requested_enabled boolean not null,
 expected_revision bigint not null check(expected_revision>=0),
 result jsonb not null check(jsonb_typeof(result)='object'),
 created_at timestamptz not null default now()
);
alter table chinatech_v2_private.office_command_receipts enable row level security;
alter table chinatech_v2_private.office_command_receipts force row level security;
revoke all on chinatech_v2_private.office_command_receipts from public,anon,authenticated;
grant select,insert on chinatech_v2_private.office_command_receipts to chinatech_runtime;
create policy office_receipt_read on chinatech_v2_private.office_command_receipts for select to chinatech_runtime
 using(actor_id=auth.uid() and chinatech_v2_private.live_user());
create policy office_receipt_insert on chinatech_v2_private.office_command_receipts for insert to chinatech_runtime
 with check(actor_id=auth.uid() and session_id::text=auth.jwt()->>'session_id' and chinatech_v2_private.live_user()
 and exists(select 1 from chinatech_v2_private.office_command_control where singleton and admin_user_id=auth.uid()));
