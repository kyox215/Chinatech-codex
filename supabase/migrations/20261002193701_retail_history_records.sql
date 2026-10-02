-- Imported source rows retain incomplete and contradictory facts without creating new transactions.
create table chinatech_v2_private.retail_history_records (
  store_id uuid not null references chinatech_v2.stores(id),
  id uuid not null,
  source_snapshot text not null check (source_snapshot ~ '^[0-9a-f]{64}$'),
  source_row integer not null check (source_row >= 2),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  raw_data jsonb not null check (jsonb_typeof(raw_data) = 'object'),
  imported_at timestamptz not null default now(),
  published boolean not null default false,
  primary key (store_id,id),
  unique (store_id,source_snapshot,source_row),
  check (data->>'id' = id::text),
  check (data->>'sourceSnapshot' = source_snapshot),
  check ((data->>'sourceRow')::integer = source_row)
);
alter table chinatech_v2_private.retail_history_records enable row level security;
revoke all on chinatech_v2_private.retail_history_records from public, anon, authenticated, chinatech_runtime;
-- The web runtime only reads the typed projection. Raw original cells remain private to the import operator.
grant select (store_id,id,source_snapshot,source_row,source_hash,data,imported_at) on chinatech_v2_private.retail_history_records to chinatech_runtime;
create policy retail_history_read on chinatech_v2_private.retail_history_records
  for select to chinatech_runtime
  using (published and chinatech_v2_private.member_access(store_id,'retail.view')
    and store_id::text = (select current_setting('app.store_id',true)));
