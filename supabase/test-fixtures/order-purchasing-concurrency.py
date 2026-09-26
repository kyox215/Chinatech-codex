# Run only against a disposable schema+fixture database in a local Docker container.
# Usage: python3 order-purchasing-concurrency.py DATABASE CONTAINER
import concurrent.futures, json, subprocess, sys, time, uuid
DB=sys.argv[1]
CONTAINER=sys.argv[2]
CMD=['docker','exec','-i','-e','PGPASSWORD=local-test-only',CONTAINER,'psql','-U','supabase_admin','-d',DB,'-X','-qAt','-v','ON_ERROR_STOP=1']
STORE='10000000-0000-4000-8000-000000000010'; ACTOR='10000000-0000-4000-8000-000000000001'; SUPPLIER='10000000-0000-4000-8000-000000000201'
def sql(q):
 r=subprocess.run(CMD,input="set statement_timeout='8s';\n"+q,text=True,capture_output=True,timeout=15)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout.strip()
def order():
 i=str(uuid.uuid4());sql(f"insert into public.repair_orders(id,store_id) values('{i}','{STORE}');");return i
def save(o,i=None,rev=0):
 return f"select public.repairdesk_save_order_purchase('{STORE}','{ACTOR}',{repr(i) if i else 'null'},'{o}',null,'Concurrent screen','{SUPPLIER}','12.50',1,'needed',{rev},'{uuid.uuid4()}');"
def part(o):
 r=json.loads(sql(save(o)));assert r['ok'],r;return r['line']['id']
def batch(ids):
 items=json.dumps([{'id':i,'expected_revision':1} for i in ids]);return f"select public.repairdesk_batch_order_purchases('{STORE}','{ACTOR}','mark_ordered','{items}'::jsonb,null,'{uuid.uuid4()}');"
def pair(a,b,delay=0):
 with concurrent.futures.ThreadPoolExecutor(2) as pool:
  fa=pool.submit(sql,a)
  time.sleep(delay)
  fb=pool.submit(sql,b)
  return fa.result(),fb.result()
# Deterministically expose inverse order/child lock ordering.
o=order(); p=part(o)
a=f"begin; select id from public.repair_orders where id='{o}' for update; select pg_sleep(0.5);"+save(o,p,1)+"commit;"
ra,rb=pair(a,batch([p]),0.1)
assert 'stale_revision' in rb,(ra,rb)
print('PASS save-vs-batch: parent lock waits safely, stale child version rejected')
# Widen the concurrent update window. This fixture function never enters production.
sql("create or replace function public.op_test_delay() returns trigger language plpgsql as $$ begin perform pg_sleep(0.2); return new; end $$; create trigger op_test_delay before update on public.order_part_purchases for each row execute function public.op_test_delay();")
try:
 for iteration in range(3):
  o=order(); a=part(o); b=part(o)
  results=pair(batch([a]),batch([b]))
  for value in results: assert all(x['ok'] for x in json.loads(value)['results']),value
  assert sql(f"select parts_status from public.repair_orders where id='{o}';")=='ordered'
 print('PASS concurrent sibling parts: 3 runs preserve ordered aggregate')
 o1,o2=order(),order(); a,b,c,d=part(o1),part(o2),part(o2),part(o1)
 results=pair(batch([a,b]),batch([c,d]))
 for value in results: assert all(x['ok'] for x in json.loads(value)['results']),value
 assert sql(f"select count(*) from public.repair_orders where id in ('{o1}','{o2}') and parts_status='ordered';")=='2'
 print('PASS opposing multi-order batches: no deadlock, both aggregates correct')
finally:
 sql('drop trigger op_test_delay on public.order_part_purchases; drop function public.op_test_delay();')
print('order_purchasing_concurrency_passed')
