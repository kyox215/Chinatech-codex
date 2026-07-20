begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to service_role;
-- Schema-only validation clones omit data privileges. These grants are scoped
-- to this rollback-only test transaction; production privileges are checked
-- separately against the linked catalog before rollout.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
select plan(26);

select is(
  public.repairdesk_store_lifecycle_contract_version(),
  2,
  'store lifecycle contract version 2 is installed'
);
select ok(
  not has_function_privilege('anon', 'public.repairdesk_store_lifecycle_contract_version()', 'execute'),
  'anon cannot probe the lifecycle contract'
);
select ok(
  not has_function_privilege('authenticated', 'public.repairdesk_store_lifecycle_contract_version()', 'execute'),
  'authenticated cannot probe the lifecycle contract'
);
select ok(
  has_function_privilege('service_role', 'public.repairdesk_store_lifecycle_contract_version()', 'execute'),
  'service role can probe the lifecycle contract'
);

select is(
  (
    with eligible as (
      select distinct column_row.table_schema, column_row.table_name
      from information_schema.columns column_row
      join pg_catalog.pg_class relation on relation.relname = column_row.table_name
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
       and namespace.nspname = column_row.table_schema
      where column_row.table_schema = 'public'
        and column_row.column_name = 'store_id'
        and relation.relkind in ('r', 'p')
        and not relation.relispartition
        and column_row.table_name not in (
          'audit_logs',
          'store_lifecycles',
          'store_lifecycle_preflights',
          'store_lifecycle_challenges',
          'store_lifecycle_operations',
          'store_export_jobs',
          'store_restore_proofs',
          'store_purge_jobs'
        )
    )
    select count(*)
    from eligible
    where not exists (
      select 1
      from pg_catalog.pg_trigger trigger_row
      join pg_catalog.pg_class relation on relation.oid = trigger_row.tgrelid
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = eligible.table_schema
        and relation.relname = eligible.table_name
        and not trigger_row.tgisinternal
        and trigger_row.tgname = left(
          'repairdesk_lifecycle_fence_' || eligible.table_name,
          63
        )
    )
  ),
  0::bigint,
  'every current store-scoped business table has a lifecycle fence'
);

insert into public.stores (id, store_code, name, slug, owner_user_id, status)
values
  (
    '90000000-0000-4000-8000-000000000010',
    'LIFECYCLE_CLEAN',
    'Lifecycle Clean',
    'lifecycle-clean',
    '90000000-0000-4000-8000-000000000001',
    'active'
  ),
  (
    '90000000-0000-4000-8000-000000000020',
    'LIFECYCLE_BLOCKED',
    'Lifecycle Blocked',
    'lifecycle-blocked',
    '90000000-0000-4000-8000-000000000001',
    'active'
  );

insert into public.store_memberships (
  id,
  store_id,
  user_id,
  email,
  display_name,
  role,
  status
)
values
  (
    '90000000-0000-4000-8000-000000000101',
    '90000000-0000-4000-8000-000000000010',
    '90000000-0000-4000-8000-000000000001',
    'lifecycle-owner@example.test',
    'Lifecycle Owner',
    'owner',
    'active'
  ),
  (
    '90000000-0000-4000-8000-000000000102',
    '90000000-0000-4000-8000-000000000010',
    '90000000-0000-4000-8000-000000000002',
    'lifecycle-staff@example.test',
    'Lifecycle Staff',
    'technician',
    'active'
  ),
  (
    '90000000-0000-4000-8000-000000000103',
    '90000000-0000-4000-8000-000000000020',
    '90000000-0000-4000-8000-000000000001',
    'lifecycle-owner@example.test',
    'Lifecycle Owner',
    'owner',
    'active'
  );

insert into public.store_invitations (
  id,
  store_id,
  email,
  role,
  token_hash,
  status,
  expires_at
)
values (
  '90000000-0000-4000-8000-000000000110',
  '90000000-0000-4000-8000-000000000010',
  'invite@example.test',
  'viewer',
  repeat('1', 64),
  'invited',
  now() + interval '1 day'
);

insert into public.store_kiosk_devices (
  id,
  store_id,
  label,
  status,
  device_token_hash,
  paired_by,
  paired_at
)
values (
  '90000000-0000-4000-8000-000000000120',
  '90000000-0000-4000-8000-000000000010',
  'Lifecycle Kiosk',
  'active',
  repeat('2', 64),
  '90000000-0000-4000-8000-000000000001',
  now()
);

insert into public.customer_kiosk_sessions (
  id,
  store_id,
  device_id,
  session_type,
  status,
  request_payload,
  expires_at
)
values (
  '90000000-0000-4000-8000-000000000121',
  '90000000-0000-4000-8000-000000000010',
  '90000000-0000-4000-8000-000000000120',
  'intake_contact',
  'active',
  '{}'::jsonb,
  now() + interval '1 day'
);

insert into public.store_lifecycle_preflights (
  id,
  store_id,
  lifecycle_revision,
  catalog_fingerprint,
  snapshot_hash,
  state,
  counts,
  blockers,
  holds,
  storage_summary,
  actor_id,
  expires_at
)
values
  (
    '90000000-0000-4000-8000-000000000130',
    '90000000-0000-4000-8000-000000000010',
    1,
    repeat('c', 64),
    repeat('a', 64),
    'eligible',
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '{"complete":true}'::jsonb,
    '90000000-0000-4000-8000-000000000001',
    now() + interval '15 minutes'
  ),
  (
    '90000000-0000-4000-8000-000000000131',
    '90000000-0000-4000-8000-000000000020',
    1,
    repeat('d', 64),
    repeat('b', 64),
    'eligible',
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '{"complete":true}'::jsonb,
    '90000000-0000-4000-8000-000000000001',
    now() + interval '15 minutes'
  );

insert into public.store_lifecycle_challenges (
  id,
  store_id,
  actor_id,
  operation_kind,
  lifecycle_revision,
  preflight_snapshot_hash,
  assurance_level,
  status,
  expires_at
)
values
  (
    '90000000-0000-4000-8000-000000000140',
    '90000000-0000-4000-8000-000000000010',
    '90000000-0000-4000-8000-000000000001',
    'request_close',
    1,
    repeat('a', 64),
    'aal2',
    'issued',
    now() + interval '10 minutes'
  ),
  (
    '90000000-0000-4000-8000-000000000141',
    '90000000-0000-4000-8000-000000000020',
    '90000000-0000-4000-8000-000000000001',
    'request_close',
    1,
    repeat('b', 64),
    'aal2',
    'issued',
    now() + interval '10 minutes'
  );

insert into public.message_templates (store_id, code, type, body)
values (
  '90000000-0000-4000-8000-000000000010',
  'LIFECYCLE_ACTIVE_WRITE',
  'test',
  'active write succeeds'
);
select is(
  (
    select count(*)
    from public.message_templates
    where store_id = '90000000-0000-4000-8000-000000000010'
      and code = 'LIFECYCLE_ACTIVE_WRITE'
  ),
  1::bigint,
  'ordinary writes succeed while the lifecycle is active'
);

insert into public.customers (id, store_id, name, phone_e164, phone_raw)
values (
  '90000000-0000-4000-8000-000000000150',
  '90000000-0000-4000-8000-000000000020',
  'Lifecycle Test Customer',
  '+390000000020',
  '390000000020'
);
insert into public.repair_orders (
  id,
  store_id,
  public_no,
  order_type,
  status,
  customer_id,
  issue_description,
  quotation_amount,
  deposit_amount,
  balance_amount,
  fault_prices,
  device_custody_status
)
values (
  '90000000-0000-4000-8000-000000000151',
  '90000000-0000-4000-8000-000000000020',
  'LIFECYCLE-BLOCK-1',
  'quick_repair',
  'new',
  '90000000-0000-4000-8000-000000000150',
  'Open order inserted after preflight',
  0,
  0,
  0,
  '[]'::jsonb,
  'with_customer'
);
select is(
  (public.repairdesk_store_close_blockers('90000000-0000-4000-8000-000000000020')->>'open_orders')::integer,
  1,
  'live close blockers see an order created after the preflight'
);

create temporary table lifecycle_test_results (
  label text primary key,
  payload jsonb,
  error_message text
) on commit drop;
grant all on table lifecycle_test_results to service_role;

set local role service_role;
do $$
begin
  begin
    perform public.repairdesk_request_store_close_rpc(
      '90000000-0000-4000-8000-000000000020',
      '90000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000160',
      1,
      '90000000-0000-4000-8000-000000000141',
      repeat('b', 64),
      'Lifecycle Blocked',
      '00000020',
      'test_close'
    );
    insert into lifecycle_test_results (label) values ('blocked_close');
  exception when others then
    insert into lifecycle_test_results (label, error_message)
    values ('blocked_close', sqlerrm);
  end;
end;
$$;
reset role;

select is(
  (select error_message from lifecycle_test_results where label = 'blocked_close'),
  'STORE_LIFECYCLE_BLOCKED',
  'the close transaction rejects a new live blocker'
);
select is(
  (select phase from public.store_lifecycles where store_id = '90000000-0000-4000-8000-000000000020'),
  'active',
  'a blocked close leaves the store active'
);
select is(
  (select status from public.store_lifecycle_challenges where id = '90000000-0000-4000-8000-000000000141'),
  'issued',
  'a blocked close does not consume the challenge'
);

set local role service_role;
insert into lifecycle_test_results (label, payload)
select 'closed', public.repairdesk_request_store_close_rpc(
  '90000000-0000-4000-8000-000000000010',
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000161',
  1,
  '90000000-0000-4000-8000-000000000140',
  repeat('a', 64),
  'Lifecycle Clean',
  '00000010',
  'test_close'
);
reset role;

select is((select payload->>'phase' from lifecycle_test_results where label = 'closed'), 'closing', 'an eligible store enters closing');
select is((select (payload->>'revision')::bigint from lifecycle_test_results where label = 'closed'), 2::bigint, 'close increments the lifecycle revision');
select is(
  (select status::text from public.store_memberships where id = '90000000-0000-4000-8000-000000000102'),
  'inactive',
  'close disables non-owner memberships'
);
select is(
  (select status::text from public.store_invitations where id = '90000000-0000-4000-8000-000000000110'),
  'inactive',
  'close revokes pending invitations'
);
select ok(
  (
    select status = 'revoked' and device_token_hash is null and pairing_code_hash is null
    from public.store_kiosk_devices
    where id = '90000000-0000-4000-8000-000000000120'
  ),
  'close revokes kiosk device credentials'
);
select is(
  (select status from public.customer_kiosk_sessions where id = '90000000-0000-4000-8000-000000000121'),
  'cancelled',
  'close cancels active kiosk sessions'
);
select is(
  (select status::text from public.store_memberships where id = '90000000-0000-4000-8000-000000000101'),
  'active',
  'the primary owner keeps recovery-only access'
);

do $$
begin
  begin
    insert into public.message_templates (store_id, code, type, body)
    values (
      '90000000-0000-4000-8000-000000000010',
      'LIFECYCLE_CLOSED_WRITE',
      'test',
      'this must be rejected'
    );
    insert into lifecycle_test_results (label) values ('closed_write');
  exception when others then
    insert into lifecycle_test_results (label, error_message)
    values ('closed_write', sqlerrm);
  end;
end;
$$;
select is(
  (select error_message from lifecycle_test_results where label = 'closed_write'),
  'STORE_LIFECYCLE_WRITE_BLOCKED',
  'ordinary writes fail closed after closing begins'
);

set local role service_role;
insert into lifecycle_test_results (label, payload)
select 'close_replay', public.repairdesk_request_store_close_rpc(
  '90000000-0000-4000-8000-000000000010',
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000161',
  1,
  '90000000-0000-4000-8000-000000000140',
  repeat('a', 64),
  'Lifecycle Clean',
  '00000010',
  'test_close'
);
reset role;
select is(
  (select (payload->>'replayed')::boolean from lifecycle_test_results where label = 'close_replay'),
  true,
  'the same close operation replays its stored result'
);
select is(
  (select state from public.store_lifecycle_operations where operation_id = '90000000-0000-4000-8000-000000000161'),
  'completed',
  'the close operation records a durable completed result'
);

insert into public.store_lifecycle_challenges (
  id,
  store_id,
  actor_id,
  operation_kind,
  lifecycle_revision,
  assurance_level,
  status,
  expires_at
)
values (
  '90000000-0000-4000-8000-000000000142',
  '90000000-0000-4000-8000-000000000010',
  '90000000-0000-4000-8000-000000000001',
  'restore',
  2,
  'aal2',
  'issued',
  now() + interval '10 minutes'
);

set local role service_role;
insert into lifecycle_test_results (label, payload)
select 'restored', public.repairdesk_restore_store_rpc(
  '90000000-0000-4000-8000-000000000010',
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000162',
  2,
  '90000000-0000-4000-8000-000000000142'
);
reset role;

select is((select payload->>'phase' from lifecycle_test_results where label = 'restored'), 'active', 'restore returns the store to active');
select is((select (payload->>'revision')::bigint from lifecycle_test_results where label = 'restored'), 3::bigint, 'restore increments the lifecycle revision');
select is(
  (select status::text from public.store_memberships where id = '90000000-0000-4000-8000-000000000102'),
  'inactive',
  'restore does not reactivate old staff access'
);
select is(
  (select status::text from public.store_invitations where id = '90000000-0000-4000-8000-000000000110'),
  'inactive',
  'restore does not revive old invitations'
);
select is(
  (select status from public.store_kiosk_devices where id = '90000000-0000-4000-8000-000000000120'),
  'revoked',
  'restore does not revive kiosk credentials'
);

update public.message_templates
set body = 'restored write succeeds'
where store_id = '90000000-0000-4000-8000-000000000010'
  and code = 'LIFECYCLE_ACTIVE_WRITE';
select is(
  (
    select body
    from public.message_templates
    where store_id = '90000000-0000-4000-8000-000000000010'
      and code = 'LIFECYCLE_ACTIVE_WRITE'
  ),
  'restored write succeeds',
  'ordinary writes resume only after restore'
);

select * from finish();
rollback;
