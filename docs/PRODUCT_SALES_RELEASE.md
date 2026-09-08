# Product sales release candidate

This is the backend candidate for TASK-20260907-002. It is not a production execution receipt. Source is isolated in the product-sales release worktree. Integration, independent data/security review, UI acceptance, final RC checks and production approvals belong to the Integration Lead.

## Independent domain and compatibility

New code lives under `src/features/inventory/sales/{model,server,api}`. The archived lifecycle migration and its missing after-sales tables are not dependencies. Existing `repairdesk_complete_inventory_sale_v2` and `repairdesk_guard_inventory_v2_unit_sale` bodies remain unchanged. New guards protect only items owned by the new sales aggregate and serialize old direct payment/stock movement paths with new sales.

The new migrations are separately created CLI timestamps:

- `20260907132641_inventory_sales_release_expand.sql`: four tables, same-store foreign keys, immutable financial histories, RLS without browser policies, private guards, three dormant RPCs, and `store_settings.inventory_sales_print_language`.
- `20260907132655_inventory_sales_release_enable.sql`: prerequisite/RLS/trigger/table-ACL checks, followed by execute grants only to `service_role` for the three new RPCs. It changes no application flags.

Do not replay the archived lifecycle SQL. Expand adds no business rows, manufactures no stock units and replaces no old RPC. Rollback retains financial records and occupancy guards, disables the application flags, and revokes the three new service RPC grants. Dropping recorded sales or disabling the occupancy guards is not an application rollback.

All application sales switches default off. `INVENTORY_SALES_SCHEMA_READY=1` plus `INVENTORY_SALES_UI=1` enables new reads; schema-ready plus `INVENTORY_SALES_COMMANDS=1` enables commands. Both additionally require the independent `INVENTORY_SALES_STORE_ALLOWLIST`/`INVENTORY_SALES_ALL_STORES_ENABLED` rollout, with `INVENTORY_SALES_STORE_DENYLIST` taking precedence. Legacy V2/lifecycle flags cannot enable these paths.

When new tables and the print-language column do not exist, flags off reject new sales requests before database access. Old settings use `select("*")` and default language to `it`; their normal updates omit the new field. Setting the new language is rejected before a DB write unless SALES_SCHEMA_READY is enabled. Existing store-setting permissions, section validation and CAS still apply. No new column is requested in a legacy select or mandatory initialization insert.

## Frozen HTTP / client API

All paths are POST BFF suffixes under `/api/repairdesk/`. Clients import from `@/lib/repairdesk/api`; query helpers and store-scoped keys live under `sales/api`. Store and actor come only from authenticated server context. Bodies are strict and cannot supply them.

| Path                      | Body                                                               | Result                                                                                      |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `inventory/sales/list`    | `{queue,search,offset,limit}`; defaults `all,"",0,30`, limit 1–100 | One master inventory page with `rows`, `counts`, `total`, `offset`, `limit`, `capabilities` |
| `inventory/sales/summary` | `{id}` inventory item ID                                           | Current item/unit CAS, readiness, capabilities and nullable order                           |
| `inventory/sales/detail`  | `{id}` sale-order ID                                               | Summary plus ordered payments, nullable warranty and permitted customer summary             |
| `inventory/sales/receipt` | `{id,kind,payment_id?,language?}`; id is sale-order ID             | Current output gate plus nullable historical document                                       |
| `inventory/sales/command` | `{command,idempotency_key,payload}`                                | Committed result with item/unit/order versions, paid/balance cents and optional payment ID  |

List queues are `all`, `available`, `awaiting_payment`, `paid_pending_pickup`, `delivered`. `available` means in stock, including uninspected items. Only actual readiness may enable a sale. `counts.all` includes legacy history; `counts.available` and the three sales-status counts share the same search/store filter. `total` is the selected queue total before pagination. One set-based RPC and MVCC snapshot supply page and counts; no per-row summary requests or independently paginated legacy list is needed.

Rows contain the summary, product name/SKU/masked identifier/category/storage/RAM/color, and customer name/phone where permitted. SQL masks both live identifiers and sale-snapshot identifiers using the existing inventory last-four-character presentation; even owner list responses contain no full identifier. `order` and `stock_unit_id` can be null. Old sold records remain in `all` without pretending to have a new sales order. Old no-unit records remain readable with `stock_unit_required`, and never receive a generated stock unit.

Summary includes raw `item_status`, five current inspection values, nullable `list_price_cents`, `inspection_missing`, the real `/inventory/{id}/edit` route, `allowed_actions`, and granular capabilities. Capabilities distinguish UI/commands, reserve, collection, collection-plus-delivery, delivery, inspection/preparation, and printable kinds. Capabilities describe authority/availability; commands still enforce current database state, CAS, readiness and balance.

Existing inspection/preparation uses `inventory/v2/workflow/apply`, not a lifecycle editor or a sales command. It requires existing `INVENTORY_V2_SCHEMA_READY`, `INVENTORY_V2_COMMANDS`, V2 store rollout and existing permissions: inspect requires `inventory:quality_check`; preparation transitions require `inventory:update`. Its body remains `{id,input:{expected_updated_at,idempotency_key,operation,inspection?,target_status?}}`. Inspect cannot be offered to the sales role, which lacks quality-check permission. A narrow UI must expose the actual missing checks and invoke the existing workflow; Quick Create never assigns pass values. The old edit route alone is not a claim that all five checks are editable there.

## Transactions and state

Money inputs are integer EUR cents from 1 through 10,000,000,000; versions are positive integers. Every command has item ID, exact stock-unit ID, `expected_item_updated_at`, and `expected_unit_version`. Append/pickup also carry sale-order ID and `expected_order_version`. Reuse the same idempotency key and unchanged payload after an uncertain network response. Changed payload/actor/command for an existing store key is a conflict. A successful replay returns stable facts without another payment or movement.

- `sale.create`: customer ID, positive `price_cents`, `agreed_at`, mandatory positive first `payment`, `used_device`, `warranty_months` (default 24), consent fields and `terms_version: "inventory-sales-2026-09-v1"`. Payment contains positive `amount_cents`, method, `occurred_at`, and optional note. A partial first payment retains the item; a full first payment may retain it or deliver atomically.
- `payment.append`: one positive payment up to the remaining balance; optional `deliver:true` requires this payment to clear the balance completely. Existing payment rows are never edited.
- `pickup.confirm`: actual `delivered_at`, with zero remaining balance. No new payment is accepted in this command.

Create and append default `deliver:false`. `deliver:true` requires `delivered_at`; a delivery date without delivery is invalid. No privileged override bypasses unpaid balance. Both create and atomic delivery preserve the original sold trigger's identifier, activation lock, data-wipe, functional, cosmetic and planned-price checks. Phone/cellular tablet identity must be a valid IMEI; other categories use the existing normalized serial identity. Item/unit commercial and identity projections must agree.

New states are partial payment (`awaiting_payment`), fully paid in store (`paid_pending_pickup`) and physically delivered (`delivered`). Both held states project item/unit to `reserved`. Delivery projects `sold`, records exactly one stock movement and starts exactly one immutable warranty version. A table CHECK independently requires a non-null delivery timestamp in delivered state.

| Operation                 | Existing required permissions, in addition to inventory read |
| ------------------------- | ------------------------------------------------------------ |
| Create with first payment | `inventory:sale`, `payment:collect`                          |
| Partial first payment     | Also `reservation:create`                                    |
| Append payment            | `payment:collect`                                            |
| Any delivery              | Also `pickup:confirm`                                        |
| Receipt                   | `inventory:sale`, `inventory:update`, `customer:detail`      |

The current owner/manager/sales matrix supports financial commands; technician/viewer cannot collect, deliver or issue sales output. DB RPCs independently verify active staff, store membership and store status. Inventory reads allow owner/manager/technician/sales; SQL and BFF both remove plain customer summaries for technician. Receipt plaintext additionally requires an active membership, the original inventory identifier read limiter (same store/member hash and read bucket), and a successful `read_sensitive` audit before returning the document. Product edit and sales output share the extracted `inventory-sensitive-identifier-read.ts` helper. Audit records contain category/object/count metadata only. Printable capabilities include the same `inventory:update` requirement. There are no browser execute grants or direct new-table ACLs, including for service-role writes.

After a new sale owns an item, legacy money inserts/edits/deletes, including refunds and adjustments, are refused unless an inserted sale payment matches the new immutable payment entry. This release adds no refund workflow. Item/unit identity, specifications and verification facts, identifier records and referenced variant facts cannot be changed while owned by a sale. Metadata-only variant upserts and edits of other unsold items remain available. Notes can change without resetting inspection or identity. Rejected ordinary product saves roll back, so collected items can still be delivered through the legitimate sales command.

Success appends compatible `inventory_transactions` rows, records events/audit/command-ledger facts, and advances inventory revision in the same transaction. Late failures roll back money, stock, revision and idempotency history together. Broadcasts contain only store/domain/mutation/query-group metadata after success; caches invalidate the affected store's inventory products/sales/lifecycle. Domain revision catch-up includes sales.

## Dates and printable evidence

The default warranty is 24 calendar months. Twelve months requires an explicitly used device, recorded customer agreement and agreement timestamp; a device graded new cannot use shortened terms. `agreed_at`, each payment's `occurred_at`, server recording time and `delivered_at` are separate facts. Delivery cannot precede agreement or a recorded payment. Future business timestamps beyond a five-minute clock tolerance are rejected.

Warranty starts only at actual delivery, using the delivery's `Europe/Rome` calendar date plus 12/24 calendar months. Leap-day/month-end clamping is PostgreSQL calendar arithmetic; it is not a fixed number of days or local JavaScript time arithmetic. Fully paid but held has no warranty start/end.

Each payment has a permanent ID, sequence, receipt number and paid/balance-after snapshots. A payment reprint contains history only through that sequence and its original balance; it never inherits later delivery or warranty. Customer/product/store document facts are captured at sale agreement. Current `StoreOutputIdentity` is returned separately as `output_identity` together with the active `store_id`, kind and chosen language. If current identity cannot output, the BFF returns its block reason/recovery target and `document:null` without reading receipt PII. A ready current gate still requires a complete historical seller name, address and contact. The SQL receipt RPC independently returns `historical_store_identity_incomplete` when those original facts are missing; the BFF maps this to HTTP 409 and a clear instruction to contact the store responsible person to inspect original records. Payment/detail remain available, and no financial fact is discarded. Updating current settings cannot repair or overwrite that historic snapshot; do not offer a misleading settings-repair link. A valid historical document retains its original identity snapshot. Language is explicit it/en/zh or current store default it.

## Reproducible synthetic verification

Both read RPCs are `STABLE`, so their internal SELECTs see one statement snapshot across order, payment and warranty projections. The controlled race harness uses a temporary synthetic barrier after the order read, verifies that the reader is blocked, commits a real final payment/delivery, then releases the reader. It must reproduce the old VOLATILE mixed snapshot and verify the STABLE coherent snapshot; instrumentation and volatility are restored by its exit trap.

Only the disposable PG17 container `repairdesk_sales_release_20260907` is used, with network `none`, no host ports and no real data. Fixtures use fake UUIDs. Bootstrap uses task schema metadata (222 columns, 99 constraints) plus identified, already-applied original helper/trigger bodies; external auth/catalog/order/supplier tables are minimal synthetic stubs. Metadata omitted numeric typmods, so monetary assertions independently use integer cents. The bootstrap is not a production migration.

The fresh runner is `bash supabase/tests/sales-release/run-pg17.sh`. It first requires the fixed container to run PostgreSQL 17 with pgTAP available, before creating a new DB. Before creating a DB, it runs the source-controlled Node generator `supabase/tests/sales-release/generate-read-verification.mjs` to derive the read-race instrument/restore and ten-body parity SQL from the current expand migration. Generated inputs go to `artifacts/.../generated-inputs`; prior artifacts are never required. The fresh chain passes that directory to read-race/parity helpers, while standalone helper calls generate their own inputs. It creates a new `sales_synthetic_<timestamp>` DB, applies bootstrap → expand → dormant/unchanged-original-body checks → enable → fixtures → transactions/races/rollback → read-model edges → old/new payment race → correction counterexamples → controlled read race → source parity. Existing successful stages are not repeatedly rebuilt during debugging. The source-only package check is `node supabase/tests/sales-release/verify-source-input-closure.mjs`: it copies only tests and the two migrations into an empty checkout, resolves the default chain, checks shell syntax, and generates all inputs from an unrelated working directory with no existing artifacts. It also verifies that a temporary candidate-source change reaches the generated inputs. This check executes no SQL. Targeted increment scripts are synthetic recovery evidence only and are not production migrations; the optional `--update-list` recovery branch is outside the fresh default chain.

Evidence is under `artifacts/product-sales-transactions-20260907/`. The DATA/SEC correction suite passed 28 counterexamples and re-ran the unchanged 55 transaction / 41 read assertions successfully. The controlled read race reproduced the old VOLATILE order-paid 3000 / payment-sum 10000 / new-warranty mismatch; STABLE returned paid 3000 / sum 3000 / no warranty, and a fresh statement saw the committed delivery. Temporary hooks were restored and all ten source bodies passed parity. Current PG17 transaction suite passed 55 assertions; read-model suite passed 41, including list/legacy/permission/default language/DST/date/atomic-final-payment edges. Separate scripts require both concurrency processes to exit successfully and return exactly one expected conflict, with one financial outcome. Candidate source-parity checks compare all ten new SQL function bodies against the installed synthetic candidate and preserve the two original sale/gate bodies.

Node evidence covers strict contracts, authenticated BFF/API wiring, disabled/no-schema compatibility, permission combinations, PII/output identity gates, store-scoped invalidation and settings CAS. Exact final commands/results are in `HANDOFF.md`. Full RC tests/build and UI screenshot evidence belong to the later integrated candidate. This backend-only slice has no related task page to screenshot; SQL/Node logs are its direct evidence.

## Sales-only integration — 2026-09-08

This release carries only inventory/product sales and its two migrations on the current main order-mutation and device-keyboard baseline. It excludes the older combined candidate's order drafts, multi-credential changes and credential migration. The existing `order/update`, `order/patch` and `order/finance` routes retain the current atomic v3 behavior.

Apply the two reviewed sales migrations explicitly through the project migration interface; their source timestamps precede newer applied order migrations. Do not batch replay other pending migrations. Validate new tables, RLS, triggers, RPC identities and ACLs between expand and enable. First rollout is the existing ChinaTech store allowlist, with other stores disabled.

Application rollback disables sales commands and, if necessary, sales UI/schema switches, returns to a deployment that retains current order fixes, and revokes the three new service RPC grants. Keep financial tables, immutable history and occupancy guards. The observed physical backup is not a performed production restore drill; full database restoration requires an independently reviewed recovery and reconciliation plan.
