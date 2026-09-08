#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=repairdesk_sales_release_20260907
db="$1"
if [[ ! "$db" =~ ^sales_synthetic_[0-9]{14}$ ]]; then echo 'Invalid synthetic database' >&2; exit 1; fi
if [ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" != none ]; then echo 'Synthetic container must have network=none' >&2; exit 1; fi
out=artifacts/product-sales-transactions-20260907
run_psql() { docker exec -i -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -d"$db" "$@"; }
run_psql > "$out/pg17-legacy-race-setup.log" <<'SQL'
select synthetic_seed_item(61);
insert into synthetic_requests(name,key,payload) values('legacy-race-new',gen_random_uuid(),synthetic_sales_payload(61)),('legacy-race-old',gen_random_uuid(),null);
-- Invoker rights preserve the real service role table INSERT and trigger boundary.
create function public.synthetic_legacy_payment_race() returns jsonb language plpgsql as $$
begin
 insert into public.inventory_transactions(id,store_id,item_id,transaction_type,amount,method,actor_id,created_at)
 values(gen_random_uuid(),'10000000-0000-4000-8000-000000000001',public.synthetic_item_id(61),'sale_payment',30,'cash','20000000-0000-4000-8000-000000000001',now());
 return jsonb_build_object('ok',true,'code','completed');
exception when check_violation then return jsonb_build_object('ok',false,'code','legacy_conflict','sqlstate',sqlstate);
end $$;
SQL
pids=()
for contender in new old; do
  (
    if [ "$contender" = new ]; then
      command="public.repairdesk_inventory_sales_command('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','sale.create',key,payload)"
    else command='public.synthetic_legacy_payment_race()'; fi
    run_psql -At > "$out/pg17-legacy-race-${contender}.log" <<SQL
begin;
set local role service_role;
update public.synthetic_requests set result=$command where name='legacy-race-$contender' returning result;
select pg_sleep(1);
commit;
SQL
  ) &
  pids+=("$!")
done
failed=0
for pid in "${pids[@]}"; do
  code=0; wait "$pid" || code=$?
  printf '%s %s\n' "$pid" "$code" >> "$out/pg17-legacy-race-exit-codes.log"
  if [ "$code" != 0 ]; then failed=1; fi
done
if [ "$failed" != 0 ]; then echo 'Legacy race psql process failed' >&2; exit 1; fi
run_psql > "$out/pg17-legacy-race-assertions.log" <<'SQL'
do $$ declare new_result text;old_result text;order_count integer; begin
 select result->>'code' into new_result from synthetic_requests where name='legacy-race-new';
 select result->>'code' into old_result from synthetic_requests where name='legacy-race-old';
 if new_result is null or old_result is null then raise exception 'Missing legacy race outcome'; end if;
 if not ((new_result='completed' and old_result='legacy_conflict') or (old_result='completed' and new_result='already_sold')) then raise exception 'Unexpected race pair: %, %',new_result,old_result; end if;
 if (select count(*) from inventory_transactions where item_id=synthetic_item_id(61) and transaction_type='sale_payment')<>1 then raise exception 'Double payment across old/new paths'; end if;
 select count(*) into order_count from inventory_sale_orders where inventory_item_id=synthetic_item_id(61);
 if order_count<>(case when new_result='completed' then 1 else 0 end) then raise exception 'Incorrect aggregate race result'; end if;
 if (select count(*) from inventory_sale_payment_entries p join inventory_sale_orders o on o.id=p.sale_order_id where o.inventory_item_id=synthetic_item_id(61))<>order_count then raise exception 'Incorrect payment ledger race result'; end if;
end $$;
select name,result from synthetic_requests where name like 'legacy-race-%' order by name;
SQL
printf 'PG17 old direct payment versus new sale concurrency passed. Database: %s\n' "$db"
