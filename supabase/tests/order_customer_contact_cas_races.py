"""Three bounded real-connection races in the fixed project candidate container.

Creates synthetic fixtures once and retains them for inspection. No cleanup, remote
connection, credentials, schema edits, or production target is accepted. The root
Integration Lead runs this script; the implementation agent only prepares it.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
CMD = ['/opt/homebrew/bin/docker', 'exec', '-i',
       'supabase_db_repairdesk-experience-baseline-20260915',
       'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1']
STORE = '00000000-0000-4000-8000-000000019700'
ACTOR = '00000000-0000-4000-8000-000000019701'
ORDER_A = '00000000-0000-4000-8000-000000019730'
ORDER_B = '00000000-0000-4000-8000-000000019731'
ORDER_C = '00000000-0000-4000-8000-000000019732'
PREFIX = "BEGIN; SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='12s'; SET LOCAL ROLE service_role;\n"


def query(sql):
    result = subprocess.run(CMD, input=sql, capture_output=True, text=True, timeout=25)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def snapshot(order):
    return json.loads(query(f"""select jsonb_build_object('order',o.updated_at::text,
    'customer',c.updated_at::text,'events',(select count(*) from public.order_events where order_id=o.id),
    'audits',(select count(*) from public.audit_logs where entity_id=o.id::text),
    'receipts',(select count(*) from public.repairdesk_order_mutation_operations where order_id=o.id))
    from public.repair_orders o join public.customers c on c.id=o.customer_id and c.store_id=o.store_id
    where o.id='{order}' and o.store_id='{STORE}';"""))


def rpc(order, before, changes, operation):
    intent = json.dumps({'order': order, 'versions': [before['order'], before['customer']],
                         'changes': changes}, sort_keys=True)
    fingerprint = hashlib.sha256(intent.encode()).hexdigest()
    payload = json.dumps(changes).replace("'", "''")
    return f"select public.repairdesk_mutate_order_v4('{STORE}','{ACTOR}','{order}','{before['order']}','{operation}','{fingerprint}','patch','{{}}','{payload}','{before['customer']}');\n"


def race(name, first_sql, second_sql):
    lines = []
    ready = threading.Event()
    a = subprocess.Popen(CMD, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.STDOUT, text=True, bufsize=1)
    b = None

    def collect():
        for line in a.stdout:
            lines.append(line)
            if line.strip() == 'CONTACT_A_READY':
                ready.set()

    reader = threading.Thread(target=collect, daemon=True)
    reader.start()
    try:
        a.stdin.write(PREFIX + first_sql + "select 'CONTACT_A_READY';\n")
        a.stdin.flush()
        if not ready.wait(8):
            raise RuntimeError('First connection failed before holding its transaction: ' + ''.join(lines))
        b = subprocess.Popen(CMD, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, text=True)
        b.stdin.write(f"set application_name='{name}';\n" + PREFIX + second_sql + 'COMMIT;\n')
        b.stdin.close()
        b.stdin = None
        waiting = False
        deadline = time.monotonic() + 4
        while time.monotonic() < deadline:
            waiting = query(f"select coalesce(bool_or(wait_event_type='Lock'),false) from pg_stat_activity where application_name='{name}';") == 't'
            if waiting:
                break
            time.sleep(0.1)
        a.stdin.write('COMMIT;\n')
        a.stdin.close()
        a.wait(timeout=10)
        reader.join(timeout=2)
        second_output, _ = b.communicate(timeout=15)
        first_values = [json.loads(line) for line in lines if line.startswith('{')]
        second_values = [json.loads(line) for line in second_output.splitlines() if line.startswith('{')]
        if not first_values or not second_values:
            raise RuntimeError('Missing RPC results: ' + ''.join(lines) + second_output)
        return {'name': name, 'a_exit': a.returncode, 'b_exit': b.returncode,
                'b_waited_on_lock': waiting, 'first': first_values[-1], 'second': second_values[-1]}
    finally:
        if a.poll() is None:
            a.kill()
            a.wait(timeout=5)
        if b is not None and b.poll() is None:
            b.kill()
            b.wait(timeout=5)


def seed():
    if query(f"select exists(select 1 from public.stores where id='{STORE}');") != 'f':
        raise RuntimeError('Synthetic fixture already exists; preserve it and use its recorded evidence.')
    source = (ROOT / 'supabase/tests/order_mutations_atomic_v3.sql').read_text()
    fixture = source[source.index('insert into auth.users'):source.index('create function pg_temp.mutate')]
    fixture = fixture.replace('0000000077', '0000000197').replace('mutation-', 'contact-cas-race-')
    fixture = fixture.replace('MUTATION_TEST', 'CONTACT_CAS_RACE').replace('MUTATION_OTHER', 'CONTACT_CAS_OTHER')
    order_sql = fixture[fixture.index('insert into public.repair_orders'):]
    fixture += order_sql.replace(ORDER_A, ORDER_B)
    fixture += f"""insert into public.customers(id,store_id,name,phone_e164,phone_raw) values
    ('00000000-0000-4000-8000-000000019722','{STORE}','Synthetic peer','+390000019722','390000019722');
    insert into public.devices(id,store_id,customer_id,brand,model,serial_or_imei) values
    ('00000000-0000-4000-8000-000000019723','{STORE}','00000000-0000-4000-8000-000000019722','Test','Peer','');\n"""
    fixture += order_sql.replace(ORDER_A, ORDER_C).replace('000000019720', '000000019722').replace('000000019721', '000000019723')
    query("BEGIN; SET LOCAL statement_timeout='20s';\n" + fixture + 'COMMIT;')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise RuntimeError('Evidence output already exists; preserve it.')
    seed()
    checks = []
    before_a, before_b = snapshot(ORDER_A), snapshot(ORDER_B)
    first = race('contact-cas-other-order',
                 rpc(ORDER_A, before_a, {'contact_phones': ['+390000019750']}, str(uuid.uuid4())),
                 rpc(ORDER_B, before_b, {'contact_phones': ['+390000019751']}, str(uuid.uuid4())))
    after_a, after_b = snapshot(ORDER_A), snapshot(ORDER_B)
    first['passed'] = (first['first'].get('ok') is True and first['second'].get('code') == 'customer_stale_version'
                       and after_b['order'] == before_b['order'] and after_b['customer'] == after_a['customer']
                       and all(after_a[k] == before_a[k] + 1 and after_b[k] == before_b[k]
                               for k in ['events', 'audits', 'receipts']))
    checks.append(first)
    before_a, before_c = snapshot(ORDER_A), snapshot(ORDER_C)
    second = race('contact-cas-phone-lock',
                  rpc(ORDER_A, before_a, {'contact_phones': ['+390000019752']}, str(uuid.uuid4())),
                  rpc(ORDER_C, before_c, {'contact_phones': ['+390000019752']}, str(uuid.uuid4())))
    after_c = snapshot(ORDER_C)
    second['passed'] = second['first'].get('ok') is True and second['second'].get('code') == 'customer_phone_conflict' and after_c == before_c
    checks.append(second)
    before_a = snapshot(ORDER_A)
    operation = str(uuid.uuid4())
    sql = rpc(ORDER_A, before_a, {'contact_phones': []}, operation)
    third = race('contact-cas-replay-lock', sql, sql)
    after_a = snapshot(ORDER_A)
    third['passed'] = (third['first'].get('ok') is True and third['second'].get('replayed') is True
                       and all(third['first'][k] == third['second'][k] for k in ['updated_at', 'customer_updated_at'])
                       and all(after_a[k] == before_a[k] + 1 for k in ['events', 'audits', 'receipts']))
    checks.append(third)
    for check in checks:
        check['passed'] = check['passed'] and check['a_exit'] == check['b_exit'] == 0 and check['b_waited_on_lock']
    result = {'passed': all(check['passed'] for check in checks), 'checks': checks,
              'retained_synthetic_store': STORE, 'target': CMD[3]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
