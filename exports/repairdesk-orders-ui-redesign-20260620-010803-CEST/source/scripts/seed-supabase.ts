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

async function upsertRows(table: string, rows: unknown[]) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(stripUndefined(rows), { onConflict: "id" });
  if (error) throw new Error(`Seed ${table} failed: ${error.message}`);
  console.log(`Seeded ${rows.length} rows into ${table}`);
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running db:seed.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

await upsertRows("suppliers", suppliers);
await upsertRows("customers", customers);
await upsertRows("devices", devices);
await upsertRows("repair_orders", orders);
await upsertRows(
  "order_events",
  orders.flatMap((order) => getEvents(order.id)),
);
await upsertRows(
  "message_logs",
  orders.flatMap((order) => getMessages(order.id)),
);

console.log("RepairDesk Supabase seed complete.");
