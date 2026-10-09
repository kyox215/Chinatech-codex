-- Admission only: never changes global Office epoch or any license revision.
create table chinatech_v2_private.office_desktop_control (
 singleton boolean primary key default true check(singleton=true),
 enabled boolean not null default true,
 revision bigint not null default 0 check(revision>=0),
 updated_at timestamptz,
 updated_by uuid references chinatech_v2.accounts(id)
);
alter table chinatech_v2_private.office_desktop_control enable row level security;
alter table chinatech_v2_private.office_desktop_control force row level security;
revoke all on chinatech_v2_private.office_desktop_control from public,anon,authenticated;
grant select on chinatech_v2_private.office_desktop_control to chinatech_runtime;
grant update(enabled,revision,updated_at,updated_by) on chinatech_v2_private.office_desktop_control to chinatech_runtime;
create policy desktop_control_read on chinatech_v2_private.office_desktop_control for select to chinatech_runtime using(true);
create policy desktop_control_update on chinatech_v2_private.office_desktop_control for update to chinatech_runtime
 using(chinatech_v2_private.office_desktop_admin())
 with check(chinatech_v2_private.office_desktop_admin() and updated_by=auth.uid());
insert into chinatech_v2_private.office_desktop_control(singleton) values(true);

create table chinatech_v2_private.office_desktop_control_receipts (
 request_id uuid primary key,
 actor_id uuid not null references chinatech_v2.accounts(id),
 session_id uuid not null,
 requested_enabled boolean not null,
 expected_revision bigint not null check(expected_revision>=0),
 created_at timestamptz not null default now()
);
alter table chinatech_v2_private.office_desktop_control_receipts enable row level security;
alter table chinatech_v2_private.office_desktop_control_receipts force row level security;
revoke all on chinatech_v2_private.office_desktop_control_receipts from public,anon,authenticated;
grant select,insert on chinatech_v2_private.office_desktop_control_receipts to chinatech_runtime;
create policy desktop_control_receipt_read on chinatech_v2_private.office_desktop_control_receipts for select to chinatech_runtime
 using(chinatech_v2_private.office_desktop_admin() and actor_id=auth.uid());
create policy desktop_control_receipt_create on chinatech_v2_private.office_desktop_control_receipts for insert to chinatech_runtime
 with check(chinatech_v2_private.office_desktop_admin() and actor_id=auth.uid() and session_id::text=auth.jwt()->>'session_id');
