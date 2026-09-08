#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=repairdesk_sales_release_20260907
if [ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" != none ]; then
  echo 'Synthetic container must have network=none' >&2; exit 1
fi
# Refuse the wrong major version or a container without installable pgTAP before creating a DB.
preflight=$(docker exec -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -At -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -dpostgres -c "select current_setting('server_version_num')::integer between 170000 and 179999 and exists(select 1 from pg_available_extensions where name='pgtap')")
if [ "$preflight" != t ]; then echo 'Fixed synthetic container requires PG17 and pgTAP' >&2; exit 1; fi
stamp=$(date -u +%Y%m%d%H%M%S)
db="sales_synthetic_${stamp}"
out=artifacts/product-sales-transactions-20260907
mkdir -p "$out"
inputs="$out/generated-inputs"
node supabase/tests/sales-release/generate-read-verification.mjs --out-dir "$inputs"
run_psql() { docker exec -i -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -d"$db" "$@"; }
docker exec -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" createdb -h127.0.0.1 -U postgres "$db"
echo "$db" > "$out/pg17-database.txt"
run_psql -c 'select version()' > "$out/pg17-environment.log"
run_psql < supabase/tests/sales-release/pg17-bootstrap.sql > "$out/pg17-bootstrap.log" 2>&1
run_psql > "$out/pg17-original-bodies.log" <<'SQL'
create table public.synthetic_protected_bodies(signature text primary key,body text);
insert into public.synthetic_protected_bodies select p.oid::regprocedure::text,pg_get_functiondef(p.oid) from pg_proc p
where p.proname in ('repairdesk_complete_inventory_sale_v2','repairdesk_guard_inventory_v2_unit_sale');
SQL
run_psql < supabase/migrations/20260907132641_inventory_sales_release_expand.sql > "$out/pg17-expand.log" 2>&1
run_psql > "$out/pg17-dormant.log" <<'SQL'
do $$ begin
if has_function_privilege('service_role','public.repairdesk_inventory_sales_command(uuid,uuid,text,uuid,jsonb)','execute')
  or has_function_privilege('service_role','public.repairdesk_inventory_sales_read(uuid,uuid,text,uuid,text,uuid,text)','execute')
  or has_function_privilege('service_role','public.repairdesk_inventory_sales_list(uuid,uuid,jsonb)','execute') then
raise exception 'Expand must remain dormant'; end if;
if exists(select 1 from synthetic_protected_bodies s where pg_get_functiondef(to_regprocedure(s.signature))<>s.body) then
raise exception 'Applied original sale/gate body was modified'; end if;
end $$;
SQL
run_psql < supabase/migrations/20260907132655_inventory_sales_release_enable.sql > "$out/pg17-enable.log" 2>&1
run_psql < supabase/tests/sales-release/fixtures.sql > "$out/pg17-fixtures.log" 2>&1
bash supabase/tests/sales-release/validate-pg17.sh "$db"
bash supabase/tests/sales-release/validate-pg17-read.sh "$db"
bash supabase/tests/sales-release/validate-pg17-legacy-race.sh "$db"
run_psql < supabase/tests/sales-release/corrections.sql > "$out/pg17-corrections.log" 2>&1
if rg -q 'not ok|Looks like you failed' "$out/pg17-corrections.log"; then cat "$out/pg17-corrections.log"; exit 1; fi
bash supabase/tests/sales-release/validate-pg17-read-race.sh "$db" "$inputs"
bash supabase/tests/sales-release/verify-pg17-source.sh "$db" "$inputs"
