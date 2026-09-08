#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=repairdesk_sales_release_20260907
db=sales_synthetic_20260907135506
out=artifacts/product-sales-transactions-20260907
if [ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" != none ]; then echo 'Synthetic container must have network=none' >&2; exit 1; fi
run_psql() { docker exec -i -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -d"$db" "$@"; }
run_psql < "$out/pg17-correction-increment.sql" > "$out/pg17-correction-increment.log" 2>&1
for suite in corrections transactions read-model; do
  run_psql < "supabase/tests/sales-release/$suite.sql" > "$out/pg17-correction-$suite.log" 2>&1
  if rg -q 'not ok|Looks like you failed' "$out/pg17-correction-$suite.log"; then cat "$out/pg17-correction-$suite.log"; exit 1; fi
done
printf 'Targeted DATA/SEC correction and transaction/read regressions passed. Database: %s\n' "$db"
