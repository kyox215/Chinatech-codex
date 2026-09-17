"""Bounded real-connection phone-ownership races, run only by Integration Lead.

Uses the fixed local project container from the existing race harness. Seeds only
synthetic records, retains them for review, and never accepts credentials/remote
connection strings or overwrites evidence. No production target is available.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import uuid

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('contact_races', Path(__file__).with_name('order_customer_contact_cas_races.py'))
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
STORE = '00000000-0000-4000-8000-000000029700'
ACTOR = '00000000-0000-4000-8000-000000029701'
CUSTOMER_A = '00000000-0000-4000-8000-000000029720'
CUSTOMER_B = '00000000-0000-4000-8000-000000029722'
ORDER_A = '00000000-0000-4000-8000-000000029730'
ORDER_B = '00000000-0000-4000-8000-000000029732'
harness.STORE, harness.ACTOR = STORE, ACTOR
query, race = harness.query, harness.race


def sql_json(value):
    return "'" + json.dumps(value, sort_keys=True).replace("'", "''") + "'::jsonb"


def phone(number):
    return '+3900000' + str(number)


def profile(primary, contacts):
    return {'name': 'Synthetic phone race', 'phone_e164': primary,
            'phone_raw': primary.replace('+', ''), 'contact_phones': contacts}


def customer_state(customer):
    return json.loads(query(f"select jsonb_build_object('id',id,'primary',phone_e164,'version',updated_at::text,'contacts',contact_phones) from public.customers where store_id='{STORE}' and id='{customer}';"))


def create_profile(primary, contacts):
    target = str(uuid.uuid4())
    return f"select public.repairdesk_create_customer_v1('{STORE}','{ACTOR}','{target}',{sql_json(profile(primary,contacts))});\n"


def update_profile(customer, contacts):
    before = customer_state(customer)
    return f"select public.repairdesk_update_customer_v1('{STORE}','{ACTOR}','{customer}','{before['version']}',{sql_json(profile(before['primary'],contacts))});\n"


def create_order(primary, contacts, operation=None):
    payload = {'customer_name': 'Synthetic new order', 'customer_phone': primary,
               'phone_e164': primary, 'phone_raw': primary.replace('+', ''), 'contact_phones': contacts,
               'customer_identity_resolution': {'mode': 'auto'}, 'device_brand': 'Test', 'device_model': 'Race',
               'order': {'order_type': 'quick_repair','status':'new','workflow_status':'intake',
                         'payment_status':'unpaid','approval_flow_status':'not_required','parts_status':'not_required',
                         'notify_status':'not_sent','issue_description':'Synthetic race', 'quotation_amount':50,
                         'deposit_amount':0,'balance_amount':50,'is_paid':False,'technician_name':'Owner',
                         'device_custody_status':'with_shop','warranty_text':'6 months','warranty_months':6,
                         'fault_prices':[],'operator_name':'Owner'}}
    fingerprint = hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()
    return f"select public.repairdesk_create_order_v2('{STORE}','{ACTOR}','{operation or uuid.uuid4()}','{fingerprint}',{sql_json(payload)});\n"


def mutate_order(order, contacts):
    before = harness.snapshot(order)
    return harness.rpc(order,before,{'contact_phones':contacts},str(uuid.uuid4()))


def counts():
    return json.loads(query(f"""select jsonb_build_object(
      'customers',(select count(*) from public.customers where store_id='{STORE}'),
      'devices',(select count(*) from public.devices where store_id='{STORE}'),
      'orders',(select count(*) from public.repair_orders where store_id='{STORE}'),
      'events',(select count(*) from public.order_events where store_id='{STORE}'),
      'created_receipts',(select count(*) from public.repairdesk_order_create_operations where store_id='{STORE}' and status='created'))"""))


def seed():
    if query(f"select exists(select 1 from public.stores where id='{STORE}');") != 'f':
        raise RuntimeError('Synthetic fixture exists; preserve it and its evidence.')
    source = (ROOT / 'supabase/tests/order_mutations_atomic_v3.sql').read_text()
    fixture = source[source.index('insert into auth.users'):source.index('create function pg_temp.mutate')]
    fixture = fixture.replace('0077','0297').replace('mutation-', 'creation-phone-race-')
    fixture = fixture.replace('MUTATION_TEST','CREATE_PHONE_RACE').replace('MUTATION_OTHER','CREATE_PHONE_OTHER')
    order_sql = fixture[fixture.index('insert into public.repair_orders'):]
    fixture += f"""insert into public.customers(id,store_id,name,phone_e164,phone_raw) values
      ('{CUSTOMER_B}','{STORE}','Synthetic peer','{phone(29722)}','{phone(29722)[1:]}');
      insert into public.devices(id,store_id,customer_id,brand,model,serial_or_imei) values
      ('00000000-0000-4000-8000-000000029723','{STORE}','{CUSTOMER_B}','Test','Peer','');\n"""
    fixture += order_sql.replace(ORDER_A,ORDER_B).replace(CUSTOMER_A,CUSTOMER_B).replace('000000029721','000000029723')
    query("BEGIN; SET LOCAL statement_timeout='20s';\n"+fixture+'COMMIT;')


def conflict_case(name, first_sql, second_sql, losing_order=None, losing_customer=None):
    before = harness.snapshot(losing_order) if losing_order else (customer_state(losing_customer) if losing_customer else None)
    result = race(name, first_sql, second_sql)
    after = harness.snapshot(losing_order) if losing_order else (customer_state(losing_customer) if losing_customer else None)
    result['passed'] = result['first'].get('ok') is True and result['second'].get('code') == 'customer_phone_conflict' and before == after
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output',required=True,type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT) or output.exists():
        raise RuntimeError('Use a new evidence path in this project.')
    seed()
    checks = []
    checks.append(conflict_case('creation-phone-v2-v4',
        create_order(phone(29800),[phone(29801)]),mutate_order(ORDER_B,[phone(29801)]),losing_order=ORDER_B))
    before = counts()
    second = conflict_case('creation-phone-profile-v2',
        create_profile(phone(29802),[phone(29803)]),create_order(phone(29804),[phone(29803)]))
    after = counts()
    second['passed'] &= after['customers'] == before['customers'] + 1 and all(after[k] == before[k] for k in ['devices','orders','events','created_receipts'])
    checks.append(second)
    checks.append(conflict_case('creation-phone-update-v4',
        update_profile(CUSTOMER_A,[phone(29805)]),mutate_order(ORDER_B,[phone(29805)]),losing_order=ORDER_B))
    checks.append(conflict_case('creation-phone-reverse-arrays',
        update_profile(CUSTOMER_A,[phone(29806),phone(29807)]),
        update_profile(CUSTOMER_B,[phone(29807),phone(29806)]),losing_customer=CUSTOMER_B))
    before = counts()
    fifth = conflict_case('creation-phone-v4-profile',
        mutate_order(ORDER_B,[phone(29808)]),create_profile(phone(29809),[phone(29808)]))
    after = counts()
    fifth['passed'] &= after['customers'] == before['customers'] and after['events'] == before['events'] + 1
    checks.append(fifth)
    before = counts()
    replay_sql = create_order(phone(29810),[phone(29811)],str(uuid.uuid4()))
    sixth = race('creation-phone-idempotent',replay_sql,replay_sql)
    after = counts()
    sixth['passed'] = (sixth['first'].get('ok') is True and sixth['second'].get('replayed') is True
                       and sixth['first']['id'] == sixth['second']['id']
                       and all(after[k] == before[k] + 1 for k in ['customers','devices','orders','events','created_receipts']))
    checks.append(sixth)
    for check in checks:
        check['passed'] = bool(check['passed'] and check['a_exit'] == 0 and check['b_exit'] == 0 and check['b_waited_on_lock'])
    evidence = {'container':harness.CMD[3],'synthetic_store':STORE,'checks':checks,'passed':all(c['passed'] for c in checks)}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps({'passed':evidence['passed'],'cases':len(checks),'output':str(output)}))
    if not evidence['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
