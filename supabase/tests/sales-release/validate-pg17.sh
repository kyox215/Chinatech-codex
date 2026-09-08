#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=repairdesk_sales_release_20260907
db="$1"
if [[ ! "$db" =~ ^sales_synthetic_[0-9]{14}$ ]]; then echo 'Invalid synthetic database' >&2; exit 1; fi
if [ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" != none ]; then echo 'Synthetic container must have network=none' >&2; exit 1; fi
out=artifacts/product-sales-transactions-20260907
run_psql() { docker exec -i -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -d"$db" "$@"; }
run_psql -c 'grant select,update on public.synthetic_requests to service_role' > /dev/null
run_psql < supabase/tests/sales-release/transactions.sql > "$out/pg17-transactions.log" 2>&1
if rg -q 'not ok|Looks like you failed' "$out/pg17-transactions.log"; then cat "$out/pg17-transactions.log"; exit 1; fi
# Both contenders use the SAME previously-read versions and distinct idempotency keys.
run_psql > "$out/pg17-concurrency-setup.log" <<'SQL'
insert into synthetic_requests(name,key,payload) values('race-sale-a',gen_random_uuid(),synthetic_sales_payload(21)),('race-sale-b',gen_random_uuid(),synthetic_sales_payload(21));
select synthetic_sales_call(22);
insert into synthetic_requests(name,key,payload) values('race-payment-a',gen_random_uuid(),synthetic_sales_payload(22,'payment.append',7000)),('race-payment-b',gen_random_uuid(),synthetic_sales_payload(22,'payment.append',7000));
SQL
race() {
  local kind="$1"; local command="$2"
  local pids=()
  for contender in a b; do
    (
      run_psql -At > "$out/pg17-race-${kind}-${contender}.log" <<SQL
begin;
set local role service_role;
update synthetic_requests set result=repairdesk_inventory_sales_command('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','$command',key,payload) where name='race-${kind}-${contender}' returning result;
select pg_sleep(1);
commit;
SQL
    ) &
    pids+=("$!")
  done
  local failed=0
  : > "$out/pg17-race-${kind}-exit-codes.log"
  for pid in "${pids[@]}"; do
    code=0; wait "$pid" || code=$?
    printf '%s %s\n' "$pid" "$code" >> "$out/pg17-race-${kind}-exit-codes.log"
    if [ "$code" != 0 ]; then failed=1; fi
  done
  if [ "$failed" != 0 ]; then echo "Concurrent psql process failed" >&2; return 1; fi
}
race sale sale.create
race payment payment.append
run_psql > "$out/pg17-concurrency-assertions.log" <<'SQL'
do $$ begin
if (select count(*) from synthetic_requests where name like 'race-%' and result is not null)<>4 then raise exception 'missing race result'; end if;
if (select count(*) from synthetic_requests where name like 'race-sale-%' and result->>'code' in ('already_sold','stale_version'))<>1 then raise exception 'missing sale conflict'; end if;
if (select count(*) from synthetic_requests where name like 'race-payment-%' and result->>'code'='stale_version')<>1 then raise exception 'missing payment conflict'; end if;
if (select count(*) from synthetic_requests where name like 'race-sale-%' and result->>'code'='completed')<>1 then raise exception 'double-sale race'; end if;
if (select count(*) from inventory_sale_orders where inventory_item_id=synthetic_item_id(21))<>1 then raise exception 'double-sale order'; end if;
if (select count(*) from synthetic_requests where name like 'race-payment-%' and result->>'code'='completed')<>1 then raise exception 'double-payment race'; end if;
if (select paid_cents from inventory_sale_orders where inventory_item_id=synthetic_item_id(22))<>10000 then raise exception 'double-payment balance'; end if;
if (select count(*) from inventory_sale_payment_entries p join inventory_sale_orders o on o.id=p.sale_order_id where o.inventory_item_id=synthetic_item_id(22))<>2 then raise exception 'double-payment ledger'; end if;
end $$;
select name,result->>'code' as result from synthetic_requests where name like 'race-%' order by name;
SQL
# Application rollback: revoke the three exact new entrypoints; keep all recorded facts and guards.
run_psql > "$out/pg17-rollback.log" <<'SQL'
begin;
revoke execute on function public.repairdesk_inventory_sales_command(uuid,uuid,text,uuid,jsonb) from service_role;
revoke execute on function public.repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text) from service_role;
revoke execute on function public.repairdesk_inventory_sales_list(uuid,uuid,jsonb) from service_role;
do $$ begin
if has_function_privilege('service_role','public.repairdesk_inventory_sales_command(uuid,uuid,text,uuid,jsonb)','execute')
 or has_function_privilege('service_role','public.repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text)','execute')
 or has_function_privilege('service_role','public.repairdesk_inventory_sales_list(uuid,uuid,jsonb)','execute') then raise exception 'rollback ACL failure'; end if;
if (select count(*) from inventory_sale_orders)<>2 then raise exception 'rollback lost data'; end if;
end $$;
rollback;
SQL
printf 'PG17 synthetic transaction, ACL/RLS, rollback and concurrent sale/payment checks passed. Database: %s\n' "$db"
