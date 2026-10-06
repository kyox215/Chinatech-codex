import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const configPath = process.env.CT_LOCAL_CONFIG;
if (!configPath || !path.isAbsolute(configPath)) throw new Error("An explicit isolated local configuration is required.");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const localHost = value => ["127.0.0.1", "localhost"].includes(value);
if (!localHost(new URL(config.API_URL).hostname) || new URL(config.API_URL).port !== "55421" || !localHost(new URL(config.DB_URL).hostname) || new URL(config.DB_URL).port !== "55422") throw new Error("Only the isolated rebuild backend is accepted.");
const api = process.env.CT_RETAIL_RECORD_API_URL || "http://127.0.0.1:3117";
if (!localHost(new URL(api).hostname) || new URL(api).protocol !== "http:") throw new Error("Only a local candidate API is accepted.");
const origin = api.replace("127.0.0.1", "localhost");
const sql = postgres(config.DB_URL, { max: 1, prepare: false });
const admin = createClient(config.API_URL, config.SECRET_KEY || config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = randomBytes(6).toString("hex"), password = "Ct" + randomBytes(20).toString("hex");
const storeIds = [randomUUID(), randomUUID()], sessions = [], checks = [];
const permissions = ["retail.view", "retail.edit", "retail.inspect", "retail.price", "retail.sell", "sale.payment", "sale.deliver", "customers.view", "financial.read", "financial.edit"];
const settings = { revision: 0, shopName: "Synthetic retail record test", address: "Synthetic address", phone: "", paper: "a4", repairWarrantyMonths: 6, retailWarrantyMonths: 12, suppliers: [], finance: [] };
function pass(label) { checks.push(label); console.log("PASS " + label); }
function expect(response, status) { assert.equal(response.status, status, response.data?.message || "Unexpected status"); return response.data; }
async function request(who, endpoint, body, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(api + endpoint, { method, redirect: "manual", headers: { Origin: origin, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(who ? { Cookie: [...who.cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (who) for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0], index = pair.indexOf("="); who.cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
  return { status: response.status, data: await response.json() };
}
async function user(label, role, storeId, granted) {
  const email = `ct-retail-record-${label}-${suffix}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(error);
  await sql`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${storeId},${data.user.id},${role},'active',${granted})`;
  const who = { id: data.user.id, email, cookies: new Map() }; sessions.push(who); expect(await request(who, "/api/auth/login", { email, password }), 200); return who;
}
async function state(who) { return expect(await request(who, "/api/backend/state"), 200); }
async function command(who, storeId, kind, payload, requestId = randomUUID()) {
  const [member] = who ? await sql`select id from chinatech_v2.store_memberships where store_id=${storeId} and user_id=${who.id}` : [];
  return request(who, "/api/backend/command", { storeId, memberId: member?.id || randomUUID(), kind, payload, requestId });
}
async function counts() { const [row] = await sql`select (select count(*)::int from chinatech_v2_private.retail_units where store_id=${storeIds[0]}) units,(select count(*)::int from chinatech_v2_private.command_receipts where store_id=${storeIds[0]}) receipts,(select count(*)::int from chinatech_v2_private.audit_events where store_id=${storeIds[0]}) audit,(select count(*)::int from chinatech_v2_private.customers where store_id=${storeIds[0]}) customers,(select revision::int from chinatech_v2_private.store_state where store_id=${storeIds[0]}) revision`; return row; }
const records = Array.from({ length: 5 }, (_, index) => ({ id: randomUUID(), source: "seatable", sourceSnapshot: "a".repeat(64), sourceRow: index + 2, sourceStatus: index === 4 ? "已售" : "在售", condition: "翻新机", customerName: "Synthetic original buyer", customerPhone: "+393330001801", category: "手机", brand: "Apple", model: `Synthetic imported phone ${index}`, color: "NERO", memory: "8+128GB", paymentMethod: "Synthetic old method", askingPriceCents: 22000, salePriceCents: null, depositCents: 5000, costCents: 4500, notes: "Synthetic internal cost note", batteryPercent: null, identifier: "ORIGINAL-RAW-" + index, intakeAt: "2026-09-02T09:00:00Z", pickupDate: null, sourceUpdatedAt: "2026-09-03T10:00:00Z", importedAt: "2026-10-02T10:00:00Z", reviewReasons: [] }));
const preparation = (record = records[0], changes = {}) => ({ id: record.id, sourceSnapshot: record.sourceSnapshot, settingsRevision: 0, draft: { category: "phone", brand: "Apple", model: record.model, identifierKind: "unconfirmed", identifier: record.identifier, storeOwned: true, checks: { functional: false, ownership: false, data: false } }, ...changes });
async function originals() { return sql`select data::text,raw_data::text,source_snapshot,source_hash from chinatech_v2_private.retail_history_records where store_id=${storeIds[0]} order by source_row`; }

try {
  for (const id of storeIds) { await sql`insert into chinatech_v2.stores(id,name) values(${id},'Synthetic retail record integration')`; await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${id},${sql.json(settings)})`; }
  for (const record of records) await sql`insert into chinatech_v2_private.retail_history_records(store_id,id,source_snapshot,source_row,source_hash,data,raw_data,published) values(${storeIds[0]},${record.id},${record.sourceSnapshot},${record.sourceRow},${createHash("sha256").update(JSON.stringify(record)).digest("hex")},${sql.json(record)},${sql.json({ synthetic: true })},true)`;
  const owner = await user("owner", "owner", storeIds[0], permissions), viewer = await user("viewer", "viewer", storeIds[0], ["retail.view"]), editor = await user("editor", "technician", storeIds[0], ["retail.view", "retail.edit"]), other = await user("other", "owner", storeIds[1], permissions);
  const originalRows = await originals(), baseline = await counts();
  expect(await command(null, storeIds[0], "retail.prepare", preparation()), 401);
  expect(await command(viewer, storeIds[0], "retail.prepare", preparation()), 403);
  expect(await command(other, storeIds[0], "retail.prepare", preparation()), 403);
  expect(await command(other, storeIds[1], "retail.prepare", preparation()), 404);
  assert.deepEqual(await counts(), baseline); pass("anonymous, read-only and cross-store preparation deny all writes");
  expect(await command(owner, storeIds[0], "retail.prepare", preparation(records[0], { sourceSnapshot: "b".repeat(64) })), 409);
  expect(await command(owner, storeIds[0], "retail.prepare", preparation(records[0], { settingsRevision: 1 })), 409);
  for (const category of [["phone"], {}, null, 1]) { const payload = preparation(); payload.draft.category = category; expect(await command(owner, storeIds[0], "retail.prepare", payload), 400); }
  for (const extra of [{ costCents: 0 }, { priceCents: 1 }, { historyOrigin: { recordId: records[1].id } }]) { const payload = preparation(); Object.assign(payload.draft, extra); expect(await command(owner, storeIds[0], "retail.prepare", payload), 400); }
  expect(await command(owner, storeIds[0], "retail.prepare", preparation(records[4])), 400);
  assert.deepEqual(await counts(), baseline); assert.deepEqual(await originals(), originalRows); pass("stale source/defaults, invalid category, forged money/origin and sold source fail without receipt or data changes");
  const checked = preparation(); checked.draft.checks = { functional: true, ownership: true, data: true };
  expect(await command(editor, storeIds[0], "retail.prepare", checked), 403); assert.deepEqual(await counts(), baseline); pass("every positive saved inspection requires current inspector permission");
  const generic = { id: records[0].id, category: "phone", model: "Forged generic" };
  expect(await command(owner, storeIds[0], "retail", { type: "create", unit: generic }), 409);
  expect(await command(owner, storeIds[0], "retail", { type: "create", unit: { ...generic, historyOrigin: { recordId: records[0].id, sourceSnapshot: records[0].sourceSnapshot } } }), 400);
  assert.deepEqual(await counts(), baseline); pass("ordinary create cannot bypass original source preparation");
  const fault = "ct_retail_prepare_fault_" + suffix;
  await sql.unsafe(`create function chinatech_v2_private.${fault}() returns trigger language plpgsql as $$begin if new.kind='retail.prepare' and new.store_id='${storeIds[0]}'::uuid then raise exception 'Synthetic forced audit failure'; end if; return new; end$$; create trigger ${fault} before insert on chinatech_v2_private.audit_events for each row execute function chinatech_v2_private.${fault}()`);
  try { expect(await command(owner, storeIds[0], "retail.prepare", preparation(records[2])), 503); assert.deepEqual(await counts(), baseline); assert.deepEqual(await originals(), originalRows); }
  finally { await sql.unsafe(`drop trigger ${fault} on chinatech_v2_private.audit_events; drop function chinatech_v2_private.${fault}()`); }
  pass("audit failure rolls back unit, receipt, audit and revision together");
  const requestId = randomUUID(), payload = preparation();
  const prepared = expect(await command(editor, storeIds[0], "retail.prepare", payload, requestId), 200);
  assert.equal(prepared.retail.length, 1); assert.equal(prepared.retail[0].id, records[0].id); assert.equal(prepared.retail[0].code, "ST-0001"); assert.equal(prepared.retail[0].status, "inspecting"); assert.equal(prepared.retail[0].costCents, null);
  assert.equal(prepared.retailHistory[0].costCents, null); assert.equal(prepared.retailHistory[0].notes, null);
  const own = await state(owner); assert.equal(own.retail[0].costCents, 4500); assert.equal(own.retail[0].priceCents, 22000); assert.deepEqual(own.retail[0].sales, []); assert.equal(own.retail[0].warrantyMonths, 12);
  assert.deepEqual(await originals(), originalRows); pass("same ID/code inherit authoritative old costs; client financial projection stays redacted and old deposit is not a payment");
  const committed = await counts(); expect(await command(editor, storeIds[0], "retail.prepare", payload, requestId), 200); assert.deepEqual(await counts(), committed);
  expect(await command(editor, storeIds[0], "retail.prepare", { ...payload, draft: { ...payload.draft, model: "Changed retry" } }, requestId), 409);
  expect(await command(owner, storeIds[0], "retail.prepare", payload), 409); assert.deepEqual(await counts(), committed); pass("same intent retries once, changed intent and duplicate preparation conflict");
  const concurrent = await Promise.all([command(owner, storeIds[0], "retail.prepare", preparation(records[1])), command(owner, storeIds[0], "retail.prepare", preparation(records[1]))]); assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 409]); assert.equal((await counts()).units, 2); pass("concurrent preparations commit exactly one linked unit");
  await sql`update chinatech_v2.store_memberships set permissions=${["retail.view"]},revision=revision+1 where store_id=${storeIds[0]} and user_id=${editor.id}`;
  const afterConcurrent = await counts(); expect(await command(editor, storeIds[0], "retail.prepare", preparation(records[3])), 403); assert.deepEqual(await counts(), afterConcurrent); pass("revoked edit permission is checked at submission");
  async function unitCommand(value) { const current = (await state(owner)).retail.find(unit => unit.id === records[0].id); return expect(await command(owner, storeIds[0], "retail", { type: "command", id: current.id, version: current.version, command: value }), 200); }
  await unitCommand({ type: "inspect", checks: { functional: true, ownership: true, data: true } }); assert.equal((await state(owner)).retail.find(unit => unit.id === records[0].id).status, "inspecting");
  await unitCommand({ type: "approve" }); assert.equal((await state(owner)).retail.find(unit => unit.id === records[0].id).status, "available"); pass("saved checks remain inspecting until separate explicit approval");
  const saleId = randomUUID(), warranty = { months: 12, termsVersion: "retail-2026-10-v1", shopName: settings.shopName, address: settings.address, phone: settings.phone };
  await unitCommand({ type: "sell", saleId, customerPhone: "+393330001802", customerName: "Synthetic new buyer", priceCents: 22000, warranty, paymentUnreceived: true });
  const sale = (await state(owner)).retail.find(unit => unit.id === records[0].id).sales[0]; assert.equal(sale.paidCents, 0); assert.equal(sale.product.code, "ST-0001"); assert.equal(sale.costCents, 4500); assert.equal(sale.customerPhone, "+393330001802");
  await unitCommand({ type: "payment", saleId, entryId: randomUUID(), amountCents: 22000, date: sale.time.slice(0, 10), method: "cash", note: "Synthetic actual payment" });
  await unitCommand({ type: "deliver", saleId, deliveryDate: sale.time.slice(0, 10) });
  const final = (await state(owner)).retail.find(unit => unit.id === records[0].id); assert.equal(final.sales[0].paidCents, 22000); assert.equal(final.sales[0].delivered, true); assert.equal(final.historyOrigin.recordId, records[0].id); assert.deepEqual(await originals(), originalRows); pass("prepared item completes new buyer, actual payment and delivery while original history remains unchanged");
  if (process.env.CT_RETAIL_UI === "1") {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
    let stage = "login";
    try {
      await page.goto(origin + "/login"); await page.getByRole("textbox", { name: "电子邮件", exact: true }).fill(owner.email);
      await page.getByLabel("密码", { exact: true }).fill(password); await page.getByRole("button", { name: "登录工作台", exact: true }).click(); await page.waitForURL(/\/app\/dashboard$/);
      stage = "unified list"; await page.goto(origin + "/app/retail");
      assert.equal(await page.getByRole("link", { name: "单机管理", exact: true }).count(), 0);
      await page.getByRole("region", { name: "整机商品表格", exact: true }).getByRole("link").filter({ hasText: records[3].model }).click();
      await page.getByRole("heading", { name: "商品档案", exact: true }).waitFor();
      stage = "prepare"; const form = page.getByRole("form", { name: "核对商品资料", exact: true });
      await form.getByRole("checkbox", { name: "确认这是门店自有且当前在店的实物", exact: true }).check();
      for (const name of ["功能检测已完成", "所有权及账号锁已核验", "数据处理已核验"]) await form.getByRole("checkbox", { name, exact: true }).check();
      await form.getByRole("button", { name: "继续核对", exact: true }).click(); await form.getByRole("button", { name: "确认保存商品资料", exact: true }).click();
      await page.getByRole("button", { name: "记录检测", exact: true }).waitFor();
      assert.equal((await state(owner)).retail.find(unit => unit.id === records[3].id).status, "inspecting");
      stage = "explicit approval"; await page.getByRole("textbox", { name: "检测说明 / 变更原因", exact: true }).fill("Synthetic explicit approval");
      await page.getByRole("button", { name: "设为可售", exact: true }).click(); await page.getByRole("button", { name: "确认操作", exact: true }).click(); await page.getByRole("button", { name: "登记售出", exact: true }).waitFor();
      assert.equal((await state(owner)).retail.find(unit => unit.id === records[3].id).status, "available"); assert.deepEqual(await originals(), originalRows);
      for (const width of [1440, 1024, 390, 375]) { await page.setViewportSize({ width, height: 950 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({ path: `.local/retail-unified/formal-${width}.png`, fullPage: true }); }
      pass("formal authenticated browser saves source preparation, explicitly approves and reads the same unit back from real API at four widths");
    } catch (reason) { const safe = String(reason).replaceAll(password, "[redacted]"); throw new Error(`Formal browser failed at ${stage}: ${safe}`); }
    finally { await browser.close(); }
  }
  writeFileSync(".local/retail-unified/api-verification.json", JSON.stringify({ status: "PASS", timestamp: new Date().toISOString(), count: checks.length, checks, target: "isolated local API and database", productionWrites: 0 }, null, 2)); console.log(`PASS ${checks.length} isolated API checks`);
} finally {
  for (const who of sessions) await request(who, "/api/auth/logout", undefined, "POST").catch(() => {});
  await sql.end();
}
