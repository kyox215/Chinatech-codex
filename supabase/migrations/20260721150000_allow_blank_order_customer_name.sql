do $migration$
declare
  v_signature regprocedure := to_regprocedure(
    'public.repairdesk_create_order_v2(uuid,uuid,uuid,text,jsonb)'
  );
  v_definition text;
  v_updated_definition text;
  v_required_name_guard constant text := E'      if v_customer_name = '''' then\n        return jsonb_build_object(''ok'', false, ''code'', ''customer_name_required'');\n      end if;\n';
begin
  if v_signature is null then
    raise exception 'repairdesk_create_order_v2 is missing';
  end if;

  select pg_get_functiondef(v_signature) into v_definition;
  v_updated_definition := replace(v_definition, v_required_name_guard, '');

  if v_updated_definition = v_definition then
    raise exception 'expected customer_name_required guard was not found';
  end if;

  execute v_updated_definition;
end
$migration$;

comment on function public.repairdesk_create_order_v2(uuid, uuid, uuid, text, jsonb)
  is 'Atomically resolves customer identity and creates an order; a new customer may have a blank name.';

notify pgrst, 'reload schema';
