-- One current minute per opaque source/device key; denied HTTP attempts commit here
-- before their business transaction. No raw IP, UUID, body, bearer or signature is stored.
create table chinatech_v2_private.office_v3_rate_buckets (
 kind text not null check(kind in('source','instance')), key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),
 minute bigint not null check(minute>=0), requests integer not null check(requests between 1 and 1000000),
 primary key(kind,key_hash)
);
alter table chinatech_v2_private.office_v3_rate_buckets enable row level security;
alter table chinatech_v2_private.office_v3_rate_buckets force row level security;
revoke all on chinatech_v2_private.office_v3_rate_buckets from public,anon,authenticated,chinatech_runtime;
grant select,insert on chinatech_v2_private.office_v3_rate_buckets to chinatech_runtime;
grant update(minute,requests) on chinatech_v2_private.office_v3_rate_buckets to chinatech_runtime;
create policy office_v3_rate_read on chinatech_v2_private.office_v3_rate_buckets for select to chinatech_runtime
 using(current_setting('app.office_v3_op',true)='request-rate' and kind=current_setting('app.office_v3_rate_kind',true) and key_hash=current_setting('app.office_v3_rate_key',true));
create policy office_v3_rate_insert on chinatech_v2_private.office_v3_rate_buckets for insert to chinatech_runtime
 with check(current_setting('app.office_v3_op',true)='request-rate' and kind=current_setting('app.office_v3_rate_kind',true) and key_hash=current_setting('app.office_v3_rate_key',true)
 and minute=floor(extract(epoch from statement_timestamp())/60)::bigint and requests=1);
create policy office_v3_rate_update on chinatech_v2_private.office_v3_rate_buckets for update to chinatech_runtime
 using(current_setting('app.office_v3_op',true)='request-rate' and kind=current_setting('app.office_v3_rate_kind',true) and key_hash=current_setting('app.office_v3_rate_key',true))
 with check(current_setting('app.office_v3_op',true)='request-rate' and kind=current_setting('app.office_v3_rate_kind',true) and key_hash=current_setting('app.office_v3_rate_key',true)
 and minute=floor(extract(epoch from statement_timestamp())/60)::bigint);
-- Future owner maintenance may remove long-inactive keys after defining retention.
-- Runtime deliberately has no DELETE permission and does not run such cleanup.
