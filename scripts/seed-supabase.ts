import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  customers,
  devices,
  getEvents,
  getMessages,
  orders,
  suppliers,
} from "../src/lib/mock/fixtures";
import {
  assertSupabaseAdminMutationTarget,
  parseCliArgs,
  stringArg,
} from "./lib/supabase-admin-safety";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const contents = readFileSync(path, "utf8");
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

function rowsForStore<T extends object>(rows: T[], storeId: string) {
  return rows.map((row) => ({ ...row, store_id: storeId }));
}

async function upsertRows(table: string, rows: unknown[]) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(stripUndefined(rows), { onConflict: "id" });
  if (error) throw new Error(`Seed ${table} failed: ${error.message}`);
  console.log(`Seeded ${rows.length} rows into ${table}`);
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = parseCliArgs(process.argv.slice(2));
const apply = args.get("apply") === true;
const projectRef = stringArg(args, "project-ref");
const storeId = stringArg(args, "store-id");
const confirmation = stringArg(args, "confirm");

if (!apply) {
  console.log(
    `Dry-run only. Planned fixture rows: suppliers=${suppliers.length}, customers=${customers.length}, devices=${devices.length}, orders=${orders.length}.`,
  );
  console.log("Seed apply is restricted to an explicit local Supabase target.");
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before db:seed.");
}

const target = assertSupabaseAdminMutationTarget({
  apply,
  supabaseUrl,
  projectRef,
  storeId,
  confirmation,
  localOnly: true,
});

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

await upsertRows("suppliers", rowsForStore(suppliers, target.storeId));
await upsertRows("customers", rowsForStore(customers, target.storeId));
await upsertRows("devices", rowsForStore(devices, target.storeId));
await upsertRows("repair_orders", rowsForStore(orders, target.storeId));
await upsertRows(
  "order_events",
  rowsForStore(
    orders.flatMap((order) => getEvents(order.id)),
    target.storeId,
  ),
);
await upsertRows(
  "message_logs",
  rowsForStore(
    orders.flatMap((order) => getMessages(order.id)),
    target.storeId,
  ),
);

console.log("RepairDesk Supabase seed complete.");
