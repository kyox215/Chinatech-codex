#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=repairdesk_sales_release_20260907
db="$1"
inputs="${2:-}"
if [ -z "$inputs" ]; then
  inputs=artifacts/product-sales-transactions-20260907/generated-inputs
  node supabase/tests/sales-release/generate-read-verification.mjs --out-dir "$inputs"
fi
if [[ ! "$db" =~ ^sales_synthetic_[0-9]{14}$ ]]; then echo 'Invalid synthetic database' >&2; exit 1; fi
if [ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" != none ]; then echo 'Synthetic container must have network=none' >&2; exit 1; fi
docker exec -i -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -d"$db" < "$inputs/pg17-source-parity.sql" > artifacts/product-sales-transactions-20260907/pg17-source-parity.log 2>&1
printf 'Candidate function bodies match synthetic DB, original sale/gate preserved. Database: %s\n' "$db"
