import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { buildSeaTableRiparazioneImport } from "../src/features/orders/import/seatable-riparazione";

const CLEAR_CONFIRMATION = "CLEAR_REPAIRDESK";
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

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const [key, inlineValue] = item.slice(2).split("=");
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index++;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

function getStringArg(args: Map<string, string | boolean>, key: string) {
  const value = args.get(key);
  return typeof value === "string" ? value : undefined;
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureNodeWebSocketTransport() {
  if (typeof globalThis.WebSocket !== "undefined") return;
  const WebSocket = require("ws") as typeof globalThis.WebSocket;
  Object.assign(globalThis, { WebSocket });
}

async function fetchAllRows(client: ReturnType<typeof createClient>, table: string) {
  const pageSize = 1000;
  const rows: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Backup ${table} failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function backupRepairDeskDomain(client: ReturnType<typeof createClient>, backupDir: string) {
  mkdirSync(backupDir, { recursive: true });
  const backup: Record<string, unknown[]> = {};
  for (const table of [...CLEAR_TABLES].reverse()) {
    backup[table.name] = await fetchAllRows(client, table.name);
  }
  const filePath = path.join(
    backupDir,
    `repairdesk-before-seatable-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(filePath, JSON.stringify(backup, null, 2));
  return filePath;
}

async function clearRepairDeskDomain(client: ReturnType<typeof createClient>) {
  for (const table of CLEAR_TABLES) {
    const { error } = await client.from(table.name).delete().not(table.deleteColumn, "is", null);
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
) {
  const [{ data: storeRows, error: storeError }, { data: existingRows, error: supplierError }] =
    await Promise.all([
      client.from("stores").select("id").limit(1),
      client.from("suppliers").select("id,name,short_name"),
    ]);
  if (storeError) throw new Error(`Read stores failed: ${storeError.message}`);
  if (supplierError) throw new Error(`Read suppliers failed: ${supplierError.message}`);

  const storeId = maybeString(storeRows?.[0]?.id);
  if (!storeId) throw new Error("No store found. Cannot import SeaTable suppliers.");

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

function printReport(result: ReturnType<typeof buildSeaTableRiparazioneImport>) {
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
        warning.value ? ` (${warning.value})` : ""
      }`,
    );
  }
  if (report.warnings.length > 30) {
    console.log(`... ${report.warnings.length - 30} more warnings`);
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = parseArgs(process.argv.slice(2));
const filePath = getStringArg(args, "file");
const apply = args.get("apply") === true;
const confirm = getStringArg(args, "confirm");
const backupDir = getStringArg(args, "backup-dir") ?? "/tmp";
const delimiter = getStringArg(args, "delimiter");
const limitArg = getStringArg(args, "limit");
const limit = limitArg ? Number(limitArg) : undefined;

if (!filePath) {
  throw new Error(
    "Usage: npm run db:import:seatable -- --file /tmp/riparazione.csv [--apply --confirm CLEAR_REPAIRDESK]",
  );
}

const csv = readFileSync(filePath, "utf8");
const result = buildSeaTableRiparazioneImport(csv, {
  delimiter,
  limit: Number.isFinite(limit) ? limit : undefined,
});
printReport(result);

if (!apply) {
  console.log("Dry-run only. Add --apply --confirm CLEAR_REPAIRDESK to write Supabase.");
  process.exit(0);
}

if (confirm !== CLEAR_CONFIRMATION) {
  throw new Error(`Refusing to clear database. Pass --confirm ${CLEAR_CONFIRMATION} to apply.`);
}

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

ensureNodeWebSocketTransport();

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tableColumns = await fetchTableColumns(supabaseUrl, serviceRoleKey);
const backupPath = await backupRepairDeskDomain(supabase, backupDir);
console.log(`Backup written to ${backupPath}`);
await clearRepairDeskDomain(supabase);
const { suppliersToUpsert, storeId } = await prepareSuppliers(supabase, result);
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
console.log("SeaTable RIPARAZIONE import complete.");
