#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=repairdesk_sales_release_20260907
if [ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" != none ]; then
  echo 'Synthetic container must have network=none' >&2; exit 1
fi
preflight=$(docker exec -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -At -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -dpostgres -c "select current_setting('server_version_num')::integer between 170000 and 179999 and exists(select 1 from pg_available_extensions where name='pgtap')")
if [ "$preflight" != t ]; then echo 'Requires synthetic PG17 with pgTAP' >&2; exit 1; fi
stamp=$(date -u +%Y%m%d%H%M%S)
db="sales_workflow_${stamp}_$$"
out=artifacts/sales-daily-workflow-20260926/backend
mkdir -p "$out"
run_psql() { docker exec -i -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -d"$db" "$@"; }
docker exec -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" createdb -h127.0.0.1 -U postgres "$db"
echo "$db" > "$out/pg17-database.txt"
run_psql -c 'select version()' > "$out/pg17-environment.log"
for source in \
  supabase/tests/sales-release/pg17-bootstrap.sql \
  supabase/migrations/20260709235000_supplier_permission_grants.sql \
  supabase/migrations/20260712002317_global_staff_permission_grants.sql \
  supabase/migrations/20260907132641_inventory_sales_release_expand.sql \
  supabase/migrations/20260907132655_inventory_sales_release_enable.sql \
  supabase/tests/sales-release/fixtures.sql \
  supabase/migrations/20260926110000_inventory_sales_workflow.sql; do
  run_psql < "$source" > "$out/$(basename "$source").log" 2>&1 || { cat "$out/$(basename "$source").log"; exit 1; }
done
run_psql < supabase/tests/sales-workflow/workflow.sql > "$out/pg17-workflow.log" 2>&1 || { cat "$out/pg17-workflow.log"; exit 1; }
if rg -q 'not ok|Looks like you failed' "$out/pg17-workflow.log"; then cat "$out/pg17-workflow.log"; exit 1; fi
cat "$out/pg17-workflow.log"
# Independent sessions prove version-zero serialization and concurrent idempotency.
run_psql > "$out/pg17-race-setup.log" <<'SQL'
grant select,update on public.synthetic_requests to service_role;
select public.synthetic_sales_call(21),public.synthetic_sales_call(22);
insert into public.synthetic_requests(name,key,payload)
select 'workflow-cas-'||x,gen_random_uuid(),jsonb_build_object('sale_order_id',o.id)
from public.inventory_sale_orders o cross join (values('a'),('b')) v(x)
where o.inventory_item_id=public.synthetic_item_id(21);
insert into public.synthetic_requests(name,key,payload)
select 'workflow-replay-'||x,'99000000-0000-4000-8000-000000000001',jsonb_build_object('sale_order_id',o.id)
from public.inventory_sale_orders o cross join (values('a'),('b')) v(x)
where o.inventory_item_id=public.synthetic_item_id(22);
SQL
for race in cas replay; do
  pids=()
  for contender in a b; do
    (
      run_psql -At > "$out/pg17-race-${race}-${contender}.log" <<SQL
begin;
set local role service_role;
update public.synthetic_requests set result=public.repairdesk_inventory_sales_workflow_command(
  '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  (payload->>'sale_order_id')::uuid,0,key,'issue.open','{"kind":"other","summary":"Concurrent synthetic check"}')
where name='workflow-${race}-${contender}' returning result->>'code';
select pg_sleep(1);
commit;
SQL
    ) &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do wait "$pid"; done
done
run_psql > "$out/pg17-race-assertions.log" <<'SQL'
do $$ begin
  if (select count(*) from synthetic_requests where name like 'workflow-cas-%' and result->>'code'='completed')<>1
    or (select count(*) from synthetic_requests where name like 'workflow-cas-%' and result->>'code'='stale_version')<>1 then raise exception 'CAS race failed'; end if;
  if (select count(*) from synthetic_requests where name like 'workflow-replay-%' and result->>'code'='completed')<>1
    or (select count(*) from synthetic_requests where name like 'workflow-replay-%' and result->>'code'='idempotent_replay')<>1 then raise exception 'idempotency race failed'; end if;
  if (select count(*) from inventory_sales_workflow_events)<>2 or (select count(*) from inventory_sales_workflow_issues)<>2 then raise exception 'duplicate workflow effects'; end if;
end $$;
SQL
shasum -a 256 supabase/migrations/20260926110000_inventory_sales_workflow.sql supabase/tests/sales-workflow/workflow.sql > "$out/source-sha256.txt"
echo "Synthetic workflow verification passed: $db"
