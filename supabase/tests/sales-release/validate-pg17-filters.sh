#!/usr/bin/env bash
# LOCAL synthetic read-only regression. Installs only the current list function, preserving ACL.
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=repairdesk_sales_release_20260907
db="$1"
[[ "$db" =~ ^sales_synthetic_[0-9]{14}$ ]] || { echo 'Invalid synthetic database' >&2; exit 1; }
[[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" = none ]] || { echo 'Synthetic container must have network=none' >&2; exit 1; }
out=artifacts/product-sales-wired-20260907
mkdir -p "$out"
if [[ "${2:-}" != --tests-only ]]; then
node --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync('supabase/migrations/20260907132641_inventory_sales_release_expand.sql','utf8');
const match=source.match(/create function public\.repairdesk_inventory_sales_list\([\s\S]*?\$\$;/);
if(!match) throw new Error('Candidate list function not found');
writeFileSync('artifacts/product-sales-wired-20260907/list-filter-increment.sql','begin;\n'+match[0].replace('create function','create or replace function')+'\ncommit;\n');
JS
fi
run_psql() { docker exec -i -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -d"$db" "$@"; }
if [[ "${2:-}" != --tests-only ]]; then
  run_psql < "$out/list-filter-increment.sql" > "$out/pg17-list-filter-increment.log" 2>&1
fi
run_psql < supabase/tests/sales-release/list-filters.sql > "$out/pg17-list-filters.log" 2>&1
if rg -q 'not ok|Looks like you failed' "$out/pg17-list-filters.log"; then cat "$out/pg17-list-filters.log"; exit 1; fi
printf 'PG17 filtered list focused assertions passed. Database: %s\n' "$db"
