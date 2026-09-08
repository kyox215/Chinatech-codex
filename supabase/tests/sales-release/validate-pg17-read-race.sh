#!/usr/bin/env bash
# LOCAL instrumentation only. Never use these helper replacements against production.
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=repairdesk_sales_release_20260907
db="$1"
out=artifacts/product-sales-transactions-20260907
inputs="${2:-}"
if [ -z "$inputs" ]; then
  inputs="$out/generated-inputs"
  node supabase/tests/sales-release/generate-read-verification.mjs --out-dir "$inputs"
fi
if [[ ! "$db" =~ ^sales_synthetic_[0-9]{14}$ ]]; then echo 'Invalid synthetic database' >&2; exit 1; fi
if [ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" != none ]; then echo 'Synthetic container must have network=none' >&2; exit 1; fi
run_psql() { docker exec -i -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -d"$db" "$@"; }
mkdir -p "$out"
probe_dir=$(mktemp -d "$out/read-race.XXXXXX")
fifo="$probe_dir/controller.fifo"
mkfifo "$fifo"
cleanup() {
  result=$?
  trap - EXIT
  run_psql -c "select pg_terminate_backend(pid) from pg_stat_activity where datname=current_database() and application_name in ('sales_read_probe_reader','sales_read_probe_controller') and pid<>pg_backend_pid()" > "$out/pg17-read-race-cleanup.log" 2>&1 || result=1
  run_psql < "$inputs/pg17-read-race-restore.sql" > "$out/pg17-read-race-restore.log" 2>&1 || result=1
  rm -f "$fifo"
  rmdir "$probe_dir"
  exit "$result"
}
trap cleanup EXIT
run_psql < "$inputs/pg17-read-race-instrument.sql" > "$out/pg17-read-race-instrument.log" 2>&1
run_psql > "$out/pg17-read-race-setup.log" <<'SQL'
select synthetic_seed_item(91),synthetic_seed_item(92);
do $$ begin
 if synthetic_sales_call(91)->>'code'<>'completed' or synthetic_sales_call(92)->>'code'<>'completed' then raise exception 'Read probe fixture failed'; end if;
end $$;
SQL
for mode in volatile stable; do
  if [ "$mode" = volatile ]; then item=91; else item=92; fi
  run_psql -c "alter function public.repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text) $mode" > "$out/pg17-read-race-${mode}-volatility.log"
  run_psql -At < "$fifo" > "$out/pg17-read-race-${mode}-controller.log" 2>&1 &
  controller=$!
  exec 3>"$fifo"
  printf '%s\n' "set application_name='sales_read_probe_controller';" 'select pg_advisory_lock(71420260907);' >&3
  # Bounded SQL wait verifies that the controller really holds the barrier before starting reader.
  run_psql > "$out/pg17-read-race-${mode}-barrier.log" <<'SQL'
do $$ begin
 for attempt in 1..200 loop
  if exists(select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.datname=current_database() and a.application_name='sales_read_probe_controller' and l.locktype='advisory' and l.granted) then return; end if;
  perform pg_sleep(0.025);
 end loop;
 raise exception 'Read controller barrier did not start';
end $$;
SQL
  run_psql -At > "$out/pg17-read-race-${mode}-reader.log" 2>&1 <<SQL &
set application_name='sales_read_probe_reader';
insert into synthetic_requests(name,result) values('read-probe-$mode',repairdesk_inventory_sales_read('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','detail',(select id from inventory_sale_orders where inventory_item_id=synthetic_item_id($item)))) returning result;
SQL
  reader=$!
  # The hook runs after the order was read, immediately before the later payment/warranty SELECTs.
  run_psql >> "$out/pg17-read-race-${mode}-barrier.log" <<'SQL'
do $$ begin
 for attempt in 1..200 loop
  if exists(select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.datname=current_database() and a.application_name='sales_read_probe_reader' and l.locktype='advisory' and not l.granted) then return; end if;
  perform pg_sleep(0.025);
 end loop;
 raise exception 'Reader never reached verified interleaving barrier';
end $$;
SQL
  run_psql > "$out/pg17-read-race-${mode}-writer.log" <<SQL
insert into synthetic_requests(name,result) values('read-probe-$mode-writer',synthetic_sales_call($item,'payment.append',7000,true)) returning result;
do \$\$ begin if (select result->>'code' from synthetic_requests where name='read-probe-$mode-writer')<>'completed' then raise exception 'Concurrent delivery did not commit'; end if; end \$\$;
SQL
  printf '%s\n' 'select pg_advisory_unlock(71420260907);' '\q' >&3
  exec 3>&-
  controller_exit=0;wait "$controller" || controller_exit=$?
  reader_exit=0;wait "$reader" || reader_exit=$?
  printf 'controller %s\nreader %s\n' "$controller_exit" "$reader_exit" > "$out/pg17-read-race-${mode}-exit-codes.log"
  if [ "$controller_exit" != 0 ] || [ "$reader_exit" != 0 ]; then echo 'Read race child process failed' >&2; exit 1; fi
done
run_psql > "$out/pg17-read-race-assertions.log" <<'SQL'
do $$ declare old_result jsonb;fixed_result jsonb;latest_result jsonb;old_sum bigint;fixed_sum bigint; begin
 select result->'data' into old_result from synthetic_requests where name='read-probe-volatile';
 select result->'data' into fixed_result from synthetic_requests where name='read-probe-stable';
 if old_result is null or fixed_result is null then raise exception 'Read probe result missing'; end if;
 select sum((p->>'amount_cents')::bigint) into old_sum from jsonb_array_elements(old_result->'payments')p;
 select sum((p->>'amount_cents')::bigint) into fixed_sum from jsonb_array_elements(fixed_result->'payments')p;
 if old_result->'order'->>'paid_cents'<>'3000' or old_sum<>10000 or old_result->'warranty'='null'::jsonb then raise exception 'VOLATILE defect was not reproduced'; end if;
 if fixed_result->'order'->>'paid_cents'<>'3000' or fixed_sum<>3000 or fixed_result->'warranty'<>'null'::jsonb or fixed_result->'order'->>'status'<>'awaiting_payment' then raise exception 'STABLE read mixed transaction facts'; end if;
 latest_result:=repairdesk_inventory_sales_read('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','detail',(select id from inventory_sale_orders where inventory_item_id=synthetic_item_id(92)))->'data';
 if latest_result->'order'->>'paid_cents'<>'10000' or latest_result->'order'->>'status'<>'delivered' or latest_result->'warranty'='null'::jsonb then raise exception 'Fresh statement did not see committed delivery'; end if;
end $$;
select name,result->'data'->'order'->>'paid_cents' as order_paid,
 (select sum((p->>'amount_cents')::bigint) from jsonb_array_elements(result->'data'->'payments')p) as payment_sum,
 result->'data'->'order'->>'status' as order_status,result->'data'->'warranty' is distinct from 'null'::jsonb as warranty_present
from synthetic_requests where name in ('read-probe-volatile','read-probe-stable') order by name;
SQL
printf 'Reproduced VOLATILE mixed snapshot; STABLE held a coherent snapshot across real concurrent delivery. Database: %s\n' "$db"
