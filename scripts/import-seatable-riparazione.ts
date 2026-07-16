import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { buildSeaTableRiparazioneImport } from "../src/features/orders/import/seatable-riparazione";
import {
  isKnownRepairDeskDemoOrder,
  normalizeSeaTableImportProvenance,
  SEATABLE_IMPORT_MAPPER_VERSION,
  SEATABLE_IMPORT_PROVENANCE_VERSION,
} from "../src/features/orders/import/seatable-import-provenance";
import {
  assertSupabaseAdminReadTarget,
  assertSupabaseAdminMutationTarget,
  mutationConfirmation,
  parseCliArgs,
  stringArg,
} from "./lib/supabase-admin-safety";
import { writePrivateJson } from "./lib/secure-output";

const require = createRequire(import.meta.url);
const CLEAR_TABLES: { name: string; deleteColumn: string }[] = [
  {
    name: "customer_tag_assignments",
    deleteColumn: "customer_id",
  },
  { name: "customer_followups", deleteColumn: "id" },
  { name: "customer_interactions", deleteColumn: "id" },
  { name: "message_logs", deleteColumn: "id" },
  { name: "order_events", deleteColumn: "id" },
  { name: "repair_orders", deleteColumn: "id" },
  { name: "devices", deleteColumn: "id" },
  { name: "customers", deleteColumn: "id" },
];
const PREFLIGHT_TABLES = [
  "customers",
  "devices",
  "suppliers",
  "repair_orders",
  "order_events",
  "message_logs",
  "customer_tag_assignments",
  "customer_followups",
  "customer_interactions",
  "order_attachments",
  "order_payment_ledger",
] as const;

type SupabaseAdminClient = ReturnType<typeof createClient>;

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureNodeWebSocketTransport() {
  if (typeof globalThis.WebSocket !== "undefined") return;
  const WebSocket = require("ws") as typeof globalThis.WebSocket;
  Object.assign(globalThis, { WebSocket });
}

async function fetchAllRows(
  client: ReturnType<typeof createClient>,
  table: string,
  storeId: string,
) {
  const pageSize = 1000;
  const rows: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("store_id", storeId)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Backup ${table} failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function backupRepairDeskDomain(
  client: ReturnType<typeof createClient>,
  backupDir: string,
  storeId: string,
) {
  const backup: Record<string, unknown[]> = {};
  for (const table of [...CLEAR_TABLES].reverse()) {
    backup[table.name] = await fetchAllRows(client, table.name, storeId);
  }
  const filePath = path.join(
    backupDir,
    `repairdesk-before-seatable-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  return writePrivateJson(filePath, backup);
}

async function clearRepairDeskDomain(client: ReturnType<typeof createClient>, storeId: string) {
  for (const table of CLEAR_TABLES) {
    const { error } = await client
      .from(table.name)
      .delete()
      .eq("store_id", storeId)
      .not(table.deleteColumn, "is", null);
    if (error) throw new Error(`Clear ${table.name} failed: ${error.message}`);
    console.log(`Cleared ${table.name}`);
  }
}

async function insertRows(client: ReturnType<typeof createClient>, table: string, rows: unknown[]) {
  const chunkSize = 500;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await client.from(table).insert(stripUndefined(chunk));
    if (error) throw new Error(`Insert ${table} failed: ${error.message}`);
  }
  console.log(`Inserted ${rows.length} rows into ${table}`);
}

async function upsertRows(client: ReturnType<typeof createClient>, table: string, rows: unknown[]) {
  const chunkSize = 500;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await client.from(table).upsert(stripUndefined(chunk));
    if (error) throw new Error(`Upsert ${table} failed: ${error.message}`);
  }
  console.log(`Upserted ${rows.length} rows into ${table}`);
}

async function prepareSuppliers(
  client: ReturnType<typeof createClient>,
  result: ReturnType<typeof buildSeaTableRiparazioneImport>,
  storeId: string,
) {
  const [{ data: storeRow, error: storeError }, { data: existingRows, error: supplierError }] =
    await Promise.all([
      client.from("stores").select("id").eq("id", storeId).maybeSingle(),
      client.from("suppliers").select("id,name,short_name").eq("store_id", storeId),
    ]);
  if (storeError) throw new Error(`Read stores failed: ${storeError.message}`);
  if (supplierError) throw new Error(`Read suppliers failed: ${supplierError.message}`);

  if (!maybeString(storeRow?.id)) {
    throw new Error("Target store was not found. Cannot import SeaTable suppliers.");
  }

  const existingByName = new Map<string, Record<string, unknown>>();
  for (const supplier of (existingRows ?? []) as Record<string, unknown>[]) {
    for (const value of [supplier.name, supplier.short_name]) {
      const key = maybeString(value).toLowerCase();
      if (key) existingByName.set(key, supplier);
    }
  }

  const supplierIdMap = new Map<string, string>();
  const suppliersToUpsert: Record<string, unknown>[] = [];
  for (const supplier of result.suppliers) {
    const row = supplier as Record<string, unknown>;
    const match =
      existingByName.get(maybeString(row.name).toLowerCase()) ??
      existingByName.get(maybeString(row.short_name).toLowerCase());
    const sourceId = maybeString(row.id);
    if (match) {
      supplierIdMap.set(sourceId, maybeString(match.id));
      continue;
    }
    suppliersToUpsert.push({ ...row, store_id: storeId });
  }

  for (const order of result.repairOrders as Record<string, unknown>[]) {
    const supplierId = maybeString(order.supplier_id);
    if (supplierId && supplierIdMap.has(supplierId)) {
      order.supplier_id = supplierIdMap.get(supplierId);
    }
  }

  return { suppliersToUpsert, storeId };
}

function maybeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function writeSecureJson(filePath: string, value: unknown) {
  return writePrivateJson(filePath, value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function countBy(rows: Record<string, unknown>[], field: string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = maybeString(row[field]) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function assertImportBundleIntegrity(result: ReturnType<typeof buildSeaTableRiparazioneImport>) {
  const customers = new Set(result.customers.map((row) => maybeString(row.id)));
  const devices = new Set(result.devices.map((row) => maybeString(row.id)));
  const orders = new Set(result.repairOrders.map((row) => maybeString(row.id)));
  const publicNumbers = result.repairOrders.map((row) => maybeString(row.public_no));
  const eventIds = result.orderEvents.map((row) => maybeString(row.id));
  const eventByOrderId = new Map(
    result.orderEvents.map((row) => [maybeString(row.order_id), row as Record<string, unknown>]),
  );
  const moneyViolations = result.repairOrders
    .filter((row) => Number(row.deposit_amount) > Number(row.quotation_amount))
    .map((row) => {
      const event = eventByOrderId.get(maybeString(row.id));
      const payload = event?.payload as Record<string, unknown> | undefined;
      return {
        source_row: Number(payload?.source_row ?? 0),
        public_no: row.public_no,
        quotation_amount: row.quotation_amount,
        deposit_amount: row.deposit_amount,
        reason: "deposit_exceeds_quotation",
      };
    });

  const duplicateCount = (values: string[]) => values.length - new Set(values).size;
  const violations = [
    ...result.devices
      .filter((row) => !customers.has(maybeString(row.customer_id)))
      .map((row) => `device:${maybeString(row.id)} missing customer`),
    ...result.repairOrders
      .filter(
        (row) =>
          !customers.has(maybeString(row.customer_id)) || !devices.has(maybeString(row.device_id)),
      )
      .map((row) => `order:${maybeString(row.id)} missing customer or device`),
    ...result.orderEvents
      .filter((row) => !orders.has(maybeString(row.order_id)))
      .map((row) => `event:${maybeString(row.id)} missing order`),
  ];
  const duplicates = {
    customer_ids: result.customers.length - customers.size,
    device_ids: result.devices.length - devices.size,
    order_ids: result.repairOrders.length - orders.size,
    event_ids: duplicateCount(eventIds),
    public_numbers: duplicateCount(publicNumbers),
  };
  if (violations.length || Object.values(duplicates).some((count) => count > 0)) {
    throw new Error(
      `Import bundle integrity failed: ${JSON.stringify({ violations: violations.slice(0, 10), duplicates })}`,
    );
  }
  return {
    referential_violations: 0,
    duplicates,
    money_invariant_violation_count: moneyViolations.length,
    money_invariant_violations: moneyViolations,
  };
}

function buildImportManifest(
  result: ReturnType<typeof buildSeaTableRiparazioneImport>,
  provenance: ReturnType<typeof normalizeSeaTableImportProvenance>,
) {
  const integrity = assertImportBundleIntegrity(result);
  const publicNumbers = result.repairOrders.map((row) => maybeString(row.public_no));
  return {
    schema_version: 1,
    provenance_version: SEATABLE_IMPORT_PROVENANCE_VERSION,
    mapper_version: SEATABLE_IMPORT_MAPPER_VERSION,
    generated_at: new Date().toISOString(),
    import_batch_id: provenance.importBatchId,
    target_store_id: provenance.targetStoreId ?? null,
    source: {
      system: "seatable",
      table: "RIPARAZIONE",
      file_name: provenance.sourceFileName,
      sha256: provenance.sourceFileSha256,
      fallback_timestamp: provenance.fallbackTimestamp,
    },
    expected: {
      customers: result.customers.length,
      devices: result.devices.length,
      suppliers: result.suppliers.length,
      repair_orders: result.repairOrders.length,
      order_events: result.orderEvents.length,
      quotation_total_eur: result.report.totalQuotation,
      deposit_total_eur: result.report.totalDeposit,
      warning_count: result.report.warnings.length,
      status_distribution: countBy(result.repairOrders, "status"),
      payment_distribution: countBy(result.repairOrders, "payment_status"),
      first_public_no: publicNumbers[0] ?? null,
      last_public_no: publicNumbers.at(-1) ?? null,
    },
    integrity,
    pii_mode: "pseudonymized_restricted",
    raw_source_rows_in_event_payload: false,
    production_blockers: {
      money_invariant_violations: integrity.money_invariant_violation_count,
    },
    production_mutation_authorized: false,
  };
}

async function countRowsByStore(client: SupabaseAdminClient, table: string, storeId: string) {
  const [{ count: targetCount, error: targetError }, { count: otherCount, error: otherError }] =
    await Promise.all([
      client.from(table).select("*", { count: "exact", head: true }).eq("store_id", storeId),
      client.from(table).select("*", { count: "exact", head: true }).neq("store_id", storeId),
    ]);
  if (targetError)
    throw new Error(`Preflight count ${table} for target store failed: ${targetError.message}`);
  if (otherError)
    throw new Error(`Preflight count ${table} for other stores failed: ${otherError.message}`);
  return { target_store: targetCount ?? 0, other_stores: otherCount ?? 0 };
}

async function findCollisions(
  client: SupabaseAdminClient,
  table: string,
  column: string,
  values: string[],
) {
  const collisions: { value: string; store_id: string | null }[] = [];
  const uniqueValues = [...new Set(values.filter(Boolean))];
  for (let index = 0; index < uniqueValues.length; index += 250) {
    const chunk = uniqueValues.slice(index, index + 250);
    const { data, error } = await client.from(table).select(`${column},store_id`).in(column, chunk);
    if (error)
      throw new Error(`Preflight collision check ${table}.${column} failed: ${error.message}`);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      collisions.push({
        value: maybeString(row[column]),
        store_id: maybeString(row.store_id) || null,
      });
    }
  }
  return collisions;
}

async function buildCleanupPreview(client: SupabaseAdminClient, storeId: string) {
  const { data, error } = await client
    .from("repair_orders")
    .select("id,public_no,customer_id,device_id,internal_tag")
    .eq("store_id", storeId)
    .like("public_no", "TEST-%")
    .ilike("internal_tag", "AI_TEST_BATCH_%");
  if (error) throw new Error(`Cleanup candidate query failed: ${error.message}`);

  const markerCandidates = ((data ?? []) as Record<string, unknown>[]).filter(
    isKnownRepairDeskDemoOrder,
  );
  const eventsByOrder = new Map<string, Record<string, unknown>[]>();
  const orderIds = markerCandidates.map((row) => maybeString(row.id));
  for (let index = 0; index < orderIds.length; index += 250) {
    const chunk = orderIds.slice(index, index + 250);
    const { data: eventRows, error: eventError } = await client
      .from("order_events")
      .select("id,order_id,payload")
      .eq("store_id", storeId)
      .in("order_id", chunk);
    if (eventError) throw new Error(`Cleanup evidence query failed: ${eventError.message}`);
    for (const event of (eventRows ?? []) as Record<string, unknown>[]) {
      const orderId = maybeString(event.order_id);
      eventsByOrder.set(orderId, [...(eventsByOrder.get(orderId) ?? []), event]);
    }
  }

  const provenOrders = markerCandidates.filter((order) => {
    const batch = maybeString(order.internal_tag).split(" · ")[0];
    return (eventsByOrder.get(maybeString(order.id)) ?? []).some((event) => {
      const payload = event.payload as Record<string, unknown> | null;
      return maybeString(payload?.batch) === batch;
    });
  });
  const provenOrderIds = provenOrders.map((order) => maybeString(order.id));
  const attachmentsByOrder = await fetchRelatedRowsByOrder(
    client,
    "order_attachments",
    "id,order_id",
    storeId,
    provenOrderIds,
  );
  const paymentsByOrder = await fetchRelatedRowsByOrder(
    client,
    "order_payment_ledger",
    "id,order_id",
    storeId,
    provenOrderIds,
  );
  const reviewedOrders = provenOrders.map((order) => {
    const orderId = maybeString(order.id);
    const eventCount = (eventsByOrder.get(orderId) ?? []).length;
    const attachmentCount = (attachmentsByOrder.get(orderId) ?? []).length;
    const paymentCount = (paymentsByOrder.get(orderId) ?? []).length;
    const blockers = [
      ...(eventCount > 2 ? ["additional_order_events"] : []),
      ...(attachmentCount > 0 ? ["has_attachments"] : []),
      ...(paymentCount > 0 ? ["has_payment_ledger_entries"] : []),
    ];
    return {
      id: order.id,
      public_no: order.public_no,
      batch: maybeString(order.internal_tag).split(" · ")[0],
      event_count: eventCount,
      attachment_count: attachmentCount,
      payment_ledger_count: paymentCount,
      blocked_reasons: blockers,
      eligible_for_owner_review: blockers.length === 0,
    };
  });

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    target_store_id: storeId,
    selection_rule:
      "public_no TEST-#### AND internal_tag AI_TEST_BATCH_* AND matching order_event payload.batch",
    proven_order_count: provenOrders.length,
    eligible_order_count: reviewedOrders.filter((order) => order.eligible_for_owner_review).length,
    blocked_order_count: reviewedOrders.filter((order) => !order.eligible_for_owner_review).length,
    marker_only_rejected_count: markerCandidates.length - provenOrders.length,
    orders: reviewedOrders,
    customer_device_cleanup_authorized: false,
    automatic_delete_enabled: false,
    production_mutation_authorized: false,
  };
}

async function fetchRelatedRowsByOrder(
  client: SupabaseAdminClient,
  table: string,
  select: string,
  storeId: string,
  orderIds: string[],
) {
  const rowsByOrder = new Map<string, Record<string, unknown>[]>();
  for (let index = 0; index < orderIds.length; index += 250) {
    const chunk = orderIds.slice(index, index + 250);
    const { data, error } = await client
      .from(table)
      .select(select)
      .eq("store_id", storeId)
      .in("order_id", chunk);
    if (error) throw new Error(`Cleanup guard query ${table} failed: ${error.message}`);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const orderId = maybeString(row.order_id);
      rowsByOrder.set(orderId, [...(rowsByOrder.get(orderId) ?? []), row]);
    }
  }
  return rowsByOrder;
}

async function runProductionPreflight(input: {
  client: SupabaseAdminClient;
  projectRef: string;
  storeId: string;
  ownerEmail: string;
  result: ReturnType<typeof buildSeaTableRiparazioneImport>;
  manifest: ReturnType<typeof buildImportManifest>;
}) {
  const { data: store, error: storeError } = await input.client
    .from("stores")
    .select("id,name,owner_user_id,status")
    .eq("id", input.storeId)
    .maybeSingle();
  if (storeError) throw new Error(`Preflight target store lookup failed: ${storeError.message}`);
  if (!store) throw new Error("Preflight target store does not exist.");
  if (store.status !== "active") throw new Error("Preflight target store must be active.");

  const { data: membership, error: membershipError } = await input.client
    .from("store_memberships")
    .select("id,user_id,role,status")
    .eq("store_id", input.storeId)
    .eq("email", input.ownerEmail.trim().toLowerCase())
    .maybeSingle();
  if (membershipError)
    throw new Error(`Preflight owner membership lookup failed: ${membershipError.message}`);
  if (!membership)
    throw new Error("Preflight owner membership was not found for the target store.");

  const storeOwnerMatches = maybeString(store.owner_user_id) === maybeString(membership.user_id);
  const ownerMembershipValid = membership.role === "owner" && membership.status === "active";
  if (!storeOwnerMatches || !ownerMembershipValid) {
    throw new Error(
      "Preflight owner identity or active owner membership does not match the target store.",
    );
  }

  const counts: Record<string, { target_store: number; other_stores: number }> = {};
  for (const table of PREFLIGHT_TABLES)
    counts[table] = await countRowsByStore(input.client, table, input.storeId);

  const collisionChecks = {
    customer_ids: await findCollisions(
      input.client,
      "customers",
      "id",
      input.result.customers.map((row) => maybeString(row.id)),
    ),
    device_ids: await findCollisions(
      input.client,
      "devices",
      "id",
      input.result.devices.map((row) => maybeString(row.id)),
    ),
    order_ids: await findCollisions(
      input.client,
      "repair_orders",
      "id",
      input.result.repairOrders.map((row) => maybeString(row.id)),
    ),
    public_numbers: await findCollisions(
      input.client,
      "repair_orders",
      "public_no",
      input.result.repairOrders.map((row) => maybeString(row.public_no)),
    ),
    event_ids: await findCollisions(
      input.client,
      "order_events",
      "id",
      input.result.orderEvents.map((row) => maybeString(row.id)),
    ),
  };
  const collisionCount = Object.values(collisionChecks).reduce((sum, rows) => sum + rows.length, 0);
  const cleanupPreview = await buildCleanupPreview(input.client, input.storeId);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    project_ref: input.projectRef,
    target_store: {
      id: input.storeId,
      name: store.name,
      status: store.status,
      owner_membership_role: membership.role,
      owner_membership_status: membership.status,
      owner_identity_matches: storeOwnerMatches,
      owner_email_sha256: sha256(input.ownerEmail.trim().toLowerCase()),
    },
    baseline_counts: counts,
    import_manifest: input.manifest,
    collision_count: collisionCount,
    collisions: collisionChecks,
    cleanup_preview: cleanupPreview,
    gates: {
      target_store_verified: true,
      active_owner_verified: true,
      collisions_clear: collisionCount === 0,
      money_invariants_clear: input.manifest.integrity.money_invariant_violation_count === 0,
      backup_verified: false,
      restore_rehearsal_verified: false,
      p1_review_approved: false,
      cleanup_preview_owner_approved: false,
      final_mutation_approved: false,
    },
    result:
      collisionCount === 0 && input.manifest.integrity.money_invariant_violation_count === 0
        ? "CONDITIONAL"
        : "FAIL",
    production_mutation_authorized: false,
  };
}

async function fetchTableColumns(supabaseUrl: string, serviceRoleKey: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Read Supabase REST schema failed: ${response.status} ${await response.text()}`,
    );
  }
  const spec = (await response.json()) as {
    definitions?: Record<string, { properties?: Record<string, unknown> }>;
    components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
  };
  const definitions = spec.definitions ?? spec.components?.schemas ?? {};
  return new Map(
    Object.entries(definitions).map(([table, schema]) => [
      table,
      new Set(Object.keys(schema.properties ?? {})),
    ]),
  );
}

function filterRowsForTable(
  tableColumns: Map<string, Set<string>>,
  table: string,
  rows: unknown[],
  extra: Record<string, unknown> = {},
) {
  const columns = tableColumns.get(table);
  if (!columns) return rows;
  return rows.map((item) => {
    const source = { ...(item as Record<string, unknown>), ...extra };
    return Object.fromEntries(Object.entries(source).filter(([key]) => columns.has(key)));
  });
}

function printReport(
  result: ReturnType<typeof buildSeaTableRiparazioneImport>,
  options: { showWarningValues?: boolean } = {},
) {
  const { report } = result;
  console.log("SeaTable RIPARAZIONE import preview");
  console.log(`Rows: ${report.importedRows}/${report.totalRows}`);
  console.log(`Customers: ${report.customerCount}`);
  console.log(`Devices: ${report.deviceCount}`);
  console.log(`Suppliers: ${report.supplierCount}`);
  console.log(`Orders: ${report.orderCount}`);
  console.log(`Quotation total: €${report.totalQuotation.toFixed(2)}`);
  console.log(`Deposit total: €${report.totalDeposit.toFixed(2)}`);
  console.log(`Warnings: ${report.warnings.length}`);
  for (const warning of report.warnings.slice(0, 30)) {
    console.log(
      `- row ${warning.row} ${warning.field}: ${warning.message}${
        options.showWarningValues && warning.value ? ` (${warning.value})` : ""
      }`,
    );
  }
  if (report.warnings.length > 30) {
    console.log(`... ${report.warnings.length - 30} more warnings`);
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = parseCliArgs(process.argv.slice(2));
const filePath = stringArg(args, "file");
const apply = args.get("apply") === true;
const confirm = stringArg(args, "confirm");
const backupDir = stringArg(args, "backup-dir");
const projectRef = stringArg(args, "project-ref");
const requestedStoreId = stringArg(args, "store-id");
const delimiter = stringArg(args, "delimiter");
const limitArg = stringArg(args, "limit");
const previewOut = stringArg(args, "preview-out");
const manifestOut = stringArg(args, "manifest-out");
const preflightOut = stringArg(args, "preflight-out");
const cleanupPreviewOut = stringArg(args, "cleanup-preview-out");
const privateBundleOut = stringArg(args, "private-bundle-out");
const importBatchId = stringArg(args, "import-batch-id");
const fallbackDate = stringArg(args, "fallback-date");
const ownerEmailArg = stringArg(args, "owner-email");
const ownerEmail = process.env.SEATABLE_OWNER_EMAIL?.trim() || ownerEmailArg;
const preflightProd = args.get("preflight-prod") === true;
const previewIncludePii = args.get("preview-include-pii") === true;
const showWarningValues = args.get("show-warning-values") === true;
const privateOutputConfirmed = args.get("confirm-private-output") === true;
const moneyOveragePolicyArg = stringArg(args, "money-overage-policy") || "preserve_source";
if (
  !["preserve_source", "raise_quotation_to_deposit", "cap_deposit_to_quotation"].includes(
    moneyOveragePolicyArg,
  )
) {
  throw new Error(
    "--money-overage-policy must be preserve_source, raise_quotation_to_deposit, or cap_deposit_to_quotation.",
  );
}
const limit = limitArg ? Number(limitArg) : undefined;

if (!filePath) {
  throw new Error(
    "Usage: npm run db:import:seatable -- --file /tmp/riparazione.csv [--import-batch-id <id> --fallback-date <ISO> --manifest-out <private-path>] [--preview-out <private-path>] [--preflight-prod --project-ref <ref> --store-id <uuid> --preflight-out <private-path> --cleanup-preview-out <private-path>] [--apply --project-ref local --store-id <uuid> --backup-dir <private-path> --confirm <target phrase>]. Production preflight reads owner email from SEATABLE_OWNER_EMAIL.",
  );
}

if ((previewIncludePii || showWarningValues) && !privateOutputConfirmed) {
  throw new Error(
    "PII preview or warning values require --confirm-private-output and an owner-only output directory outside the repository.",
  );
}
if (preflightProd && ownerEmailArg) {
  throw new Error(
    "Production owner email must be supplied through SEATABLE_OWNER_EMAIL, not a command-line argument.",
  );
}

const csv = readFileSync(filePath, "utf8");
const sourceFileSha256 = sha256(csv);
if (importBatchId && !fallbackDate) {
  throw new Error("--fallback-date is required with --import-batch-id for deterministic replay.");
}
const provenance = importBatchId
  ? normalizeSeaTableImportProvenance({
      importBatchId,
      sourceFileName: path.basename(filePath),
      sourceFileSha256,
      fallbackTimestamp: fallbackDate!,
      ...(requestedStoreId ? { targetStoreId: requestedStoreId } : {}),
    })
  : undefined;
if ((manifestOut || preflightProd || preflightOut || cleanupPreviewOut) && !provenance) {
  throw new Error("--import-batch-id is required for manifest and production preflight modes.");
}
if ((preflightOut || cleanupPreviewOut) && !preflightProd) {
  throw new Error("--preflight-out and --cleanup-preview-out require --preflight-prod.");
}
const result = buildSeaTableRiparazioneImport(csv, {
  delimiter,
  limit: Number.isFinite(limit) ? limit : undefined,
  provenance,
  moneyOveragePolicy: moneyOveragePolicyArg as
    | "preserve_source"
    | "raise_quotation_to_deposit"
    | "cap_deposit_to_quotation",
});
printReport(result, { showWarningValues });
if (previewOut) {
  const previewPath = writePreviewOutput(previewOut, result, {
    includePii: previewIncludePii,
    provenance,
  });
  console.log(`Detailed preview written to ${previewPath}`);
}
const manifest = provenance ? buildImportManifest(result, provenance) : undefined;
if (privateBundleOut) {
  if (!provenance?.targetStoreId) {
    throw new Error("--private-bundle-out requires target-bound provenance and --store-id.");
  }
  const targetStoreId = provenance.targetStoreId;
  const payload = {
    customers: result.customers.map((row) => ({ ...row, store_id: targetStoreId })),
    devices: result.devices.map((row) => ({ ...row, store_id: targetStoreId })),
    suppliers: result.suppliers.map((row) => ({ ...row, store_id: targetStoreId })),
    repair_orders: result.repairOrders.map((row) => ({ ...row, store_id: targetStoreId })),
    order_events: result.orderEvents.map((row) => ({ ...row, store_id: targetStoreId })),
  };
  writeSecureJson(privateBundleOut, {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    target_store_id: targetStoreId,
    import_batch_id: provenance.importBatchId,
    source_file_sha256: provenance.sourceFileSha256,
    payload_sha256: sha256(JSON.stringify(payload)),
    payload,
  });
  console.log(`Private PII import bundle written with mode 0600 to ${privateBundleOut}`);
}
if (manifestOut && manifest) {
  console.log(`Import manifest written to ${writeSecureJson(manifestOut, manifest)}`);
}

if (preflightProd) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for preflight.");
  }
  if (!ownerEmail || !preflightOut || !cleanupPreviewOut || !manifest) {
    throw new Error(
      "Production preflight requires SEATABLE_OWNER_EMAIL, --preflight-out, --cleanup-preview-out, and --import-batch-id.",
    );
  }
  const target = assertSupabaseAdminReadTarget({
    supabaseUrl,
    projectRef,
    storeId: requestedStoreId,
  });
  ensureNodeWebSocketTransport();
  const preflightClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const report = await runProductionPreflight({
    client: preflightClient,
    projectRef: target.projectRef,
    storeId: target.storeId,
    ownerEmail,
    result,
    manifest,
  });
  writeSecureJson(preflightOut, report);
  writeSecureJson(cleanupPreviewOut, report.cleanup_preview);
  console.log(`Read-only production preflight written to ${preflightOut}`);
  console.log(`Read-only cleanup candidate preview written to ${cleanupPreviewOut}`);
  if (report.result === "FAIL") process.exitCode = 2;
}

if (!apply) {
  console.log(
    "No mutation performed. Destructive apply remains restricted to an explicit local Supabase target.",
  );
  if (!process.exitCode) process.exitCode = 0;
} else {
  await applyLocalImport();
}

async function applyLocalImport() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const target = assertSupabaseAdminMutationTarget({
    apply,
    supabaseUrl,
    projectRef,
    storeId: requestedStoreId,
    confirmation: confirm,
    localOnly: true,
    backupDir,
    requireBackupDir: true,
  });
  console.log(
    `Expected confirmation phrase: ${mutationConfirmation(target.projectRef, target.storeId)}`,
  );

  ensureNodeWebSocketTransport();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const tableColumns = await fetchTableColumns(supabaseUrl, serviceRoleKey);
  const backupPath = await backupRepairDeskDomain(supabase, target.backupDir!, target.storeId);
  console.log(`Backup written to ${backupPath}`);
  await clearRepairDeskDomain(supabase, target.storeId);
  const { suppliersToUpsert, storeId } = await prepareSuppliers(supabase, result, target.storeId);
  await upsertRows(
    supabase,
    "suppliers",
    filterRowsForTable(tableColumns, "suppliers", suppliersToUpsert),
  );
  await insertRows(
    supabase,
    "customers",
    filterRowsForTable(tableColumns, "customers", result.customers, { store_id: storeId }),
  );
  await insertRows(
    supabase,
    "devices",
    filterRowsForTable(tableColumns, "devices", result.devices, { store_id: storeId }),
  );
  await insertRows(
    supabase,
    "repair_orders",
    filterRowsForTable(tableColumns, "repair_orders", result.repairOrders, { store_id: storeId }),
  );
  await insertRows(
    supabase,
    "order_events",
    filterRowsForTable(tableColumns, "order_events", result.orderEvents, { store_id: storeId }),
  );
  console.log("SeaTable RIPARAZIONE local import complete.");
}

function writePreviewOutput(
  filePath: string,
  result: ReturnType<typeof buildSeaTableRiparazioneImport>,
  options: {
    includePii?: boolean;
    provenance?: ReturnType<typeof normalizeSeaTableImportProvenance>;
  } = {},
) {
  const customersById = new Map(
    result.customers.map((row) => [maybeString((row as Record<string, unknown>).id), row]),
  );
  const devicesById = new Map(
    result.devices.map((row) => [maybeString((row as Record<string, unknown>).id), row]),
  );
  const eventByOrderId = new Map(
    result.orderEvents.map((row) => [maybeString(row.order_id), row as Record<string, unknown>]),
  );
  const rows = result.repairOrders.map((orderRow) => {
    const order = orderRow as Record<string, unknown>;
    const customer = customersById.get(maybeString(order.customer_id)) as
      | Record<string, unknown>
      | undefined;
    const device = devicesById.get(maybeString(order.device_id)) as
      | Record<string, unknown>
      | undefined;
    const issueDescription = maybeString(order.issue_description);
    const accessoryNotes = maybeString(order.accessory_notes);
    const phone = maybeString(customer?.phone_e164);
    const backupPhones = Array.isArray(customer?.contact_phones) ? customer.contact_phones : [];
    const piiFields = options.includePii
      ? {
          customer_name: customer?.name ?? null,
          phone: phone || null,
          backup_phones: backupPhones,
          issue_description: issueDescription,
          accessory_notes: accessoryNotes || null,
        }
      : {
          customer_name_present: Boolean(maybeString(customer?.name)),
          phone_present: Boolean(phone),
          backup_phone_count: backupPhones.length,
          issue_description_length: issueDescription.length,
          accessory_notes_present: Boolean(accessoryNotes),
        };
    const event = eventByOrderId.get(maybeString(order.id));
    const payload = event?.payload as Record<string, unknown> | undefined;
    return {
      source_row: Number(payload?.source_row ?? 0),
      public_no: order.public_no,
      status: order.status,
      status_raw: order.status_raw,
      workflow_status: order.workflow_status,
      parts_status: order.parts_status,
      notify_status: order.notify_status,
      ...piiFields,
      brand: device?.brand ?? null,
      model: device?.model ?? null,
      serial_or_imei_present: Boolean(maybeString(device?.serial_or_imei)),
      quotation_amount: order.quotation_amount,
      deposit_amount: order.deposit_amount,
      balance_amount: order.balance_amount,
      payment_status: order.payment_status,
      created_at: order.created_at,
    };
  });
  return writePrivateJson(filePath, {
    generated_at: new Date().toISOString(),
    source: "SeaTable RIPARAZIONE CSV dry-run",
    import_batch_id: options.provenance?.importBatchId ?? null,
    source_file_sha256: options.provenance?.sourceFileSha256 ?? null,
    pii_mode: options.includePii ? "included_restricted" : "pseudonymized_restricted",
    report: {
      ...result.report,
      warnings: result.report.warnings.map((warning) =>
        options.includePii || !warning.value
          ? warning
          : {
              ...warning,
              value: "[redacted]",
            },
      ),
    },
    rows,
  });
}
