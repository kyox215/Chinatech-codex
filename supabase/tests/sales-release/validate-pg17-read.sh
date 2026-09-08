#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=repairdesk_sales_release_20260907
db="$1"
if [[ ! "$db" =~ ^sales_synthetic_[0-9]{14}$ ]]; then echo 'Invalid synthetic database' >&2; exit 1; fi
if [ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" != none ]; then echo 'Synthetic container must have network=none' >&2; exit 1; fi
out=artifacts/product-sales-transactions-20260907
run_psql() { docker exec -i -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -d"$db" "$@"; }
if [ "${2:-}" = '--update-list' ]; then
  run_psql < "$out/pg17-list-increment.sql" > "$out/pg17-list-increment.log" 2>&1
fi
run_psql < supabase/tests/sales-release/read-model.sql > "$out/pg17-read-model.log" 2>&1
if rg -q 'not ok|Looks like you failed' "$out/pg17-read-model.log"; then cat "$out/pg17-read-model.log"; exit 1; fi
printf 'PG17 list, legacy read, readiness, output, roles and calendar edge checks passed. Database: %s\n' "$db"
