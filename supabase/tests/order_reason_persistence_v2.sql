begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(
  to_regprocedure('public.repairdesk_reason_selection_v2_is_valid(jsonb,text)') is not null,
  'reason selection validator exists'
);
select ok(
  not public.repairdesk_reason_selection_v2_is_valid(null, 'terminal.correct'),
  'null reason selection is invalid'
);
select ok(
  public.repairdesk_reason_selection_v2_is_valid(
    '{"schema_version":2,"kind":"preset","primary_code":"data_fix","catalog_revision":"test.v1","context":"terminal.correct","internal_snapshot":{"locale":"zh-CN","labels":["资料纠正"],"text":"资料纠正"}}',
    'terminal.correct'
  ),
  'valid preset reason selection is accepted'
);
select ok(
  not public.repairdesk_reason_selection_v2_is_valid(
    '{"schema_version":2,"kind":"preset","primary_code":"other","catalog_revision":"test.v1","context":"terminal.correct","internal_snapshot":{"locale":"zh-CN","labels":["其他"],"text":"其他"}}',
    'terminal.correct'
  ),
  'preset kind cannot inject the reserved other code'
);
select ok(
  not public.repairdesk_reason_selection_v2_is_valid(
    '{"schema_version":2,"kind":"other","primary_code":"other","catalog_revision":"test.v1","context":"terminal.correct","internal_snapshot":{"locale":"zh-CN","labels":["其他"],"text":"其他"}}',
    'terminal.correct'
  ),
  'other reason requires a note'
);
select ok(
  public.repairdesk_reason_selection_v2_is_valid(
    '{"schema_version":2,"kind":"other","primary_code":"other","note":"经店主确认的其他原因","catalog_revision":"test.v1","context":"terminal.correct","internal_snapshot":{"locale":"zh-CN","labels":["其他"],"text":"经店主确认的其他原因"}}',
    'terminal.correct'
  ),
  'complete other reason is accepted'
);

select has_column('public', 'order_terminal_operations', 'reason_selection', 'terminal ledger stores reason selection');
select has_column('public', 'order_initial_deposit_corrections', 'reason_selection', 'deposit ledger stores reason selection');
select has_column('public', 'order_workflow_transitions', 'reason_policy_context', 'workflow edge stores reason context');
select has_column('public', 'order_workflow_transitions', 'reason_policy', 'workflow edge stores reason policy');
select has_column('public', 'order_workflow_transitions', 'reason_catalog_revision', 'workflow edge stores catalog revision');

select ok(to_regprocedure('public.repairdesk_apply_terminal_operation_v2(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,text,text)') is not null, 'terminal v2 coordinator exists');
select ok(to_regprocedure('public.repairdesk_correct_terminal_order_v2(uuid,uuid,uuid,timestamptz,uuid,jsonb,text,jsonb)') is not null, 'terminal correction v2 exists');
select ok(to_regprocedure('public.repairdesk_reopen_terminal_order_v2(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb)') is not null, 'terminal reopen v2 exists');
select ok(to_regprocedure('public.repairdesk_void_order_v2(uuid,uuid,uuid,timestamptz,uuid,text,jsonb,text)') is not null, 'terminal void v2 exists');
select ok(to_regprocedure('public.repairdesk_correct_initial_deposit_v2(uuid,uuid,uuid,timestamptz,uuid,numeric,text,jsonb)') is not null, 'deposit correction v2 exists');

select ok(not has_function_privilege('anon', to_regprocedure('public.repairdesk_apply_terminal_operation_v2(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,text,text)'), 'execute'), 'anon cannot execute terminal v2');
select ok(not has_function_privilege('authenticated', to_regprocedure('public.repairdesk_apply_terminal_operation_v2(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,text,text)'), 'execute'), 'authenticated cannot execute terminal v2');
select ok(has_function_privilege('service_role', to_regprocedure('public.repairdesk_apply_terminal_operation_v2(uuid,uuid,uuid,timestamptz,uuid,text,text,jsonb,jsonb,text,text)'), 'execute'), 'service role can execute terminal v2');
select ok(has_function_privilege('service_role', to_regprocedure('public.repairdesk_correct_initial_deposit_v2(uuid,uuid,uuid,timestamptz,uuid,numeric,text,jsonb)'), 'execute'), 'service role can execute deposit v2');
select ok(has_column_privilege('service_role', 'public.order_terminal_operations', 'reason_selection', 'update'), 'service role can update only the terminal reason snapshot');
select ok(not has_column_privilege('authenticated', 'public.order_terminal_operations', 'reason_selection', 'update'), 'authenticated cannot update terminal reason snapshot');
select ok(has_column_privilege('service_role', 'public.order_initial_deposit_corrections', 'reason_selection', 'update'), 'service role can update only the deposit reason snapshot');
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.order_terminal_operations'::regclass and conname = 'order_terminal_operations_reason_selection_v2_check' and convalidated),
  'terminal reason constraint is validated'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.order_initial_deposit_corrections'::regclass and conname = 'order_initial_deposit_reason_selection_v2_check' and convalidated),
  'deposit reason constraint is validated'
);

select ok(to_regprocedure('public.repairdesk_fact_selection_v2_is_valid(jsonb,text)') is not null, 'fact selection validator exists');
select ok(
  public.repairdesk_fact_selection_v2_is_valid(
    '{"schema_version":2,"field":"reported_symptom","codes":["no_power","not_charging"],"catalog_revision":"facts.v1"}',
    'reported_symptom'
  ),
  'valid fact selection is accepted'
);
select ok(
  not public.repairdesk_fact_selection_v2_is_valid(
    '{"schema_version":2,"field":"reported_symptom","codes":["no_power","no_power"],"catalog_revision":"facts.v1"}',
    'reported_symptom'
  ),
  'duplicate fact codes are rejected'
);
select has_column('public', 'repair_orders', 'intake_intent_selection', 'order stores intake intent');
select has_column('public', 'repair_orders', 'reported_symptoms_selection', 'order stores reported symptoms');
select has_column('public', 'repair_orders', 'diagnostic_findings_selection', 'order stores diagnostic findings');
select has_table('public', 'repair_order_episodes', 'repair episode table exists');
select has_table('public', 'repair_order_relations', 'related order table exists');
select has_table('public', 'repairdesk_related_order_operations', 'related order idempotency ledger exists');
select has_table('public', 'repairdesk_rework_disposition_operations', 'rework disposition idempotency ledger exists');
select ok((select relrowsecurity from pg_class where oid = 'public.repair_order_episodes'::regclass), 'repair episodes have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.repair_order_relations'::regclass), 'order relations have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.repairdesk_related_order_operations'::regclass), 'related operation ledger has RLS');
select ok(not has_function_privilege('authenticated', to_regprocedure('public.repairdesk_create_related_order_v2(uuid,uuid,uuid,timestamptz,uuid,text,jsonb,text)'), 'execute'), 'authenticated cannot create related order directly');
select ok(has_function_privilege('service_role', to_regprocedure('public.repairdesk_create_related_order_v2(uuid,uuid,uuid,timestamptz,uuid,text,jsonb,text)'), 'execute'), 'service role can create related order');
select ok(to_regprocedure('public.repairdesk_record_rework_disposition_v2(uuid,uuid,uuid,timestamptz,uuid,text,jsonb,text)') is not null, 'rework disposition coordinator exists');
select ok(not has_function_privilege('authenticated', to_regprocedure('public.repairdesk_record_rework_disposition_v2(uuid,uuid,uuid,timestamptz,uuid,text,jsonb,text)'), 'execute'), 'authenticated cannot record disposition directly');
select ok(has_function_privilege('service_role', to_regprocedure('public.repairdesk_record_rework_disposition_v2(uuid,uuid,uuid,timestamptz,uuid,text,jsonb,text)'), 'execute'), 'service role can record disposition');
select ok(to_regprocedure('public.repairdesk_apply_order_data_batch_v3(uuid,uuid,uuid,text,text)') is not null, 'workbook v3 apply coordinator exists');
select ok(to_regprocedure('public.repairdesk_rollback_order_data_batch_v3(uuid,uuid,uuid,text,text)') is not null, 'workbook v3 rollback coordinator exists');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.repair_order_episodes'::regclass and conname = 'repair_order_episodes_source_store_fkey'), 'episode source is same-store constrained');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.repair_order_episodes'::regclass and conname = 'repair_order_episodes_active_store_fkey'), 'episode active order is same-store constrained');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.repair_order_relations'::regclass and conname = 'repair_order_relations_source_store_fkey'), 'relation source is same-store constrained');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.repair_order_relations'::regclass and conname = 'repair_order_relations_related_store_fkey'), 'relation target is same-store constrained');
select ok(not has_table_privilege('service_role', 'public.repair_order_episodes', 'delete'), 'service role cannot delete repair episodes');
select ok(not has_table_privilege('service_role', 'public.repair_order_relations', 'delete'), 'service role cannot delete order relations');
select ok(not has_table_privilege('service_role', 'public.repairdesk_related_order_operations', 'delete'), 'service role cannot delete related operation evidence');
select ok(not has_table_privilege('service_role', 'public.repairdesk_rework_disposition_operations', 'delete'), 'service role cannot delete disposition operation evidence');

select * from finish();
rollback;
