#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=repairdesk_sales_release_20260907
db=sales_synthetic_20260907135506
if [ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" != none ]; then echo 'Synthetic container must have network=none' >&2; exit 1; fi
docker exec -i -e PGPASSWORD=repairdesk-sales-synthetic-only "$container" psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -U postgres -d"$db" < artifacts/product-sales-transactions-20260907/pg17-increment.sql > artifacts/product-sales-transactions-20260907/pg17-increment.log 2>&1
printf 'Fixed synthetic DB increment applied: %s\n' "$db"
