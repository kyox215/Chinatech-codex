"""Real two-connection races against the task-owned Docker PG17 fixture only.
Run after orders_remediation_atomic.sql. Uses synthetic IDs, no network credentials.
"""
import argparse
import concurrent.futures
import json
import subprocess
import threading

parser = argparse.ArgumentParser()
parser.add_argument('--container', required=True)
parser.add_argument('--database', default='postgres')
args = parser.parse_args()
if not args.container.startswith('repairdesk_orders_remediation_'):
    raise SystemExit('Refusing non-task-owned container name')
STORE='00000000-0000-4000-8000-000000000001'
ACTOR='00000000-0000-4000-8000-000000000011'

def run(sql):
    result = subprocess.run(['docker','exec','-i',args.container,'psql','-U','postgres','-d',args.database,'-v','ON_ERROR_STOP=1','-Atq'],input=sql,text=True,capture_output=True,check=True)
    return [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]

def race(left, right):
    barrier = threading.Barrier(2)
    def worker(sql):
        barrier.wait()
        return run('begin; set local role service_role; '+sql+'; select pg_sleep(0.25); commit;')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        tasks=[pool.submit(worker,sql) for sql in (left,right)]
        return [task.result()[0] for task in tasks]

def transition(order_suffix,key_suffix,target):
    update={'status':target,'workflow_status':'repair' if target=='repairing' else 'closed'}
    if target=='completed':
        update.update(device_custody_status='with_customer',delivered_at='2026-09-26T10:00:00Z',completed_at='2026-09-26T10:00:00Z')
    payload={'from':'new','to':target,'transition_request_hash':'c'*64}
    return f"select public.repairdesk_apply_order_transition('{STORE}','00000000-0000-4000-8000-{order_suffix:012d}','{ACTOR}','2026-09-26T00:00:00Z','{json.dumps(update)}','status_changed','{json.dumps(payload)}','00000000-0000-4000-8000-{key_suffix:012d}')"

same=transition(42,53,'repairing')
results=race(same,same)
assert sorted(r['code'] for r in results)==['idempotent_replay','updated'], results
assert results[0]['updated_at']==results[1]['updated_at'],results
counts=run("select jsonb_build_object('count',count(*)) from public.order_events where order_id='00000000-0000-4000-8000-000000000042'")
assert counts[0]['count']==1, counts
print('PASS same operation in two connections: one mutation, same timestamp receipt')

run(f"insert into public.repair_orders(id,store_id,status,workflow_status,assignee_membership_id,device_custody_status,updated_at) values('00000000-0000-4000-8000-000000000043','{STORE}','new','intake','00000000-0000-4000-8000-000000000021','with_shop','2026-09-26T00:00:00Z')")
results=race(transition(43,54,'repairing'),transition(43,55,'completed'))
assert sorted(r['code'] for r in results)==['stale_version','updated'], results
print('PASS competing operations at one observed version: one winner, one stale rejection')

def config(mode,payload):
    return f"select public.repairdesk_save_order_workflow('{STORE}','{ACTOR}','{mode}','{json.dumps(payload)}')"
results=race(config('update_status',{'id':'00000000-0000-4000-8000-000000000031','is_default_create_status':True}),config('update_status',{'id':'00000000-0000-4000-8000-000000000032','is_default_create_status':True}))
assert all(r['is_default_create_status'] for r in results),results
counts=run(f"select jsonb_build_object('count',count(*)) from public.order_workflow_statuses where store_id='{STORE}' and is_default_create_status and enabled and allowed_for_create")
assert counts[0]['count']==1,counts
print('PASS concurrent default switches: serialized success, exactly one usable default')
results=race(config('transitions',{'from_status_code':'new','transitions':[{'to_status_code':'repairing','enabled':True,'is_primary':True}]}),config('transitions',{'from_status_code':'new','transitions':[{'to_status_code':'completed','enabled':True,'is_primary':True}]}))
assert all(r['ok'] for r in results),results
counts=run(f"select jsonb_build_object('enabled',count(*) filter(where enabled),'primary',count(*) filter(where enabled and is_primary)) from public.order_workflow_transitions where store_id='{STORE}' and from_status_code='new'")
assert counts[0]=={'enabled':1,'primary':1},counts
print('PASS concurrent edge replacements: complete last request, no mixed configuration')

# Force a request to wait BEFORE authorization and revoke access while it waits.
# Observe pg_stat_activity instead of relying on timing to establish the interleaving.
import time

def revoke_while_waiting(lock_expression, request, revoke, restore, label, holder_revoke=False):
    holder = subprocess.Popen(['docker','exec','-i',args.container,'psql','-U','postgres','-d',args.database,'-v','ON_ERROR_STOP=1','-Atq'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    holder.stdin.write(f"begin; select pg_advisory_xact_lock({lock_expression}); select 'LOCKED';\n")
    holder.stdin.flush()
    while holder.stdout.readline().strip() != 'LOCKED':
        if holder.poll() is not None: raise AssertionError('lock holder exited')
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(run, "set application_name='orders_remediation_auth_wait'; set role service_role; " + request)
        try:
            waiting = False
            for _ in range(100):
                waiting = run("select jsonb_build_object('waiting',exists(select 1 from pg_stat_activity where application_name='orders_remediation_auth_wait' and wait_event_type='Lock'))")[0]['waiting']
                if waiting: break
                time.sleep(0.02)
            assert waiting, 'request did not reach expected lock'
            if holder_revoke:
                holder.stdin.write(revoke + '; commit;\n'); holder.stdin.flush()
            else:
                run(revoke)
                holder.stdin.write('commit;\n'); holder.stdin.flush()
            try:
                result = future.result(timeout=5)
                assert result[0].get('code')=='actor_forbidden', result
            except subprocess.CalledProcessError as error:
                assert 'actor_forbidden' in error.stderr, error.stderr
            print('PASS '+label)
        finally:
            holder.stdin.write('rollback;\n'); holder.stdin.close()
            holder.wait(timeout=5)
            run(restore)

workflow_lock=f"hashtextextended('{STORE}:order-workflow',0)"
operation_lock=f"hashtextextended('{STORE}:00000000-0000-4000-8000-000000000053',0)"
receipt=f"select public.repairdesk_order_transition_receipt('{STORE}','{ACTOR}','00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000053',repeat('c',64))"
revoke_member=f"update public.store_memberships set status='revoked' where user_id='{ACTOR}'"
restore_member=f"update public.store_memberships set status='active' where user_id='{ACTOR}'"
revoke_while_waiting(workflow_lock,config('update_status',{'id':'00000000-0000-4000-8000-000000000031','label':'Must not save'}),revoke_member,restore_member,'workflow rejects membership revoked during advisory wait')
revoke_while_waiting(operation_lock,receipt,revoke_member,restore_member,'receipt rejects membership revoked during advisory wait')
revoke_while_waiting(operation_lock,same,revoke_member,restore_member,'transition wrapper rejects membership revoked during advisory wait')
revoke_while_waiting(workflow_lock,config('update_status',{'id':'00000000-0000-4000-8000-000000000031','label':'Must not save'}),f"update public.staff_profiles set status='inactive' where id='{ACTOR}'",f"update public.staff_profiles set status='active' where id='{ACTOR}'",'workflow rejects staff profile disabled while waiting')
revoke_while_waiting(f"hashtextextended('{STORE}',0)",config('update_status',{'id':'00000000-0000-4000-8000-000000000031','label':'Must not save'}),f"update public.stores set status='paused' where id='{STORE}'; update public.store_lifecycles set phase='paused' where store_id='{STORE}'",f"update public.stores set status='active' where id='{STORE}'; update public.store_lifecycles set phase='active' where store_id='{STORE}'",'workflow waits for lifecycle lock and rejects committed pause without deadlock',holder_revoke=True)
