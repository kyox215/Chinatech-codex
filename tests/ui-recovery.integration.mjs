// Actual local Auth/DB/API and browsers. Every fixture is generated and removed by this run.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { chromium, webkit, expect } from "@playwright/test";

const config = JSON.parse(readFileSync(process.env.CT_TEST_CONFIG || ".local/backend/connection.private.json", "utf8"));
for (const [value, port] of [[config.API_URL, "55421"], [config.DB_URL, "55422"]]) { const url = new URL(value); assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, port); }
const origin = process.env.CT_TEST_ORIGIN || "https://localhost:3118";
assert.equal(origin, "https://localhost:3118");
const sql = postgres(config.DB_URL, { max: 1, prepare: false });
const admin = createClient(config.API_URL, config.SECRET_KEY || config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const output = ".local/ui-feedback/recovery"; mkdirSync(output, { recursive: true });
const results = [];
async function operations(page) { return page.evaluate(async () => { const db = await new Promise((resolve, reject) => { const r = indexedDB.open("chinatech-device-recovery", 2); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); try { return await new Promise((resolve, reject) => { const r = db.transaction("operations").objectStore("operations").getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); } finally { db.close(); } }); }
try {
  for (const engine of [chromium, webkit]) {
    const storeId = randomUUID(), email = `ui-recovery-${randomBytes(6).toString("hex")}@example.test`, password = `Ct${randomBytes(20).toString("hex")}`;
    let userId, browser, context, page;
    const checked = [], runtimeErrors = [];
    try {
      await sql`insert into chinatech_v2.stores(id,name) values(${storeId},'Synthetic UI recovery')`;
      await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${storeId},${sql.json({ revision: 0, shopName: "DEMO recovery", address: "DEMO initial", phone: "", paper: "a4", repairWarrantyMonths: 6, retailWarrantyMonths: 12, suppliers: [], finance: [] })})`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error); userId = created.data.user.id;
      await sql`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${storeId},${userId},'owner','active',${["settings.edit", "staff.manage", "repairs.view", "customers.view", "retail.view"]})`;
      browser = await engine.launch(); context = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width: engine === webkit ? 390 : 1440, height: 1000 } });
      await context.exposeBinding("__uiRecoveryError", (_source, type, message) => runtimeErrors.push({ type, message }));
      await context.addInitScript(() => { addEventListener("error", event => window.__uiRecoveryError("error", event.message)); addEventListener("unhandledrejection", event => window.__uiRecoveryError("unhandledrejection", String(event.reason?.message ?? event.reason))); });
      const login = await context.request.post("/api/auth/login", { headers: { Origin: origin }, data: { email, password } }); assert.equal(login.status(), 200);
      page = await context.newPage(); page.on("dialog", dialog => dialog.accept());
      await page.goto("/app/settings"); const address = page.getByLabel("门店地址", { exact: true }), save = page.getByRole("button", { name: "保存设置", exact: true });
      const businessHeading = page.locator(".module-title h2"); const originalTitle = await businessHeading.textContent();
      await address.fill("DEMO normal delayed save");
      let release; const gate = new Promise(resolve => { release = resolve; }); let captured;
      await page.route("**/api/backend/command", async route => { captured = route.request().postDataJSON(); const response = await route.fetch(); await gate; await route.fulfill({ response }); });
      try { await save.click(); await expect.poll(() => Boolean(captured)).toBe(true); await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1); await expect(page.locator("section.panel.sync-recovery")).toHaveCount(0); await expect(address).toHaveValue("DEMO normal delayed save"); await expect(businessHeading).toHaveText(originalTitle); } finally { release(); }
      await expect(page.locator("[data-toast]")).toHaveCount(1); await page.unrouteAll({ behavior: "wait" }); await expect(page.locator("[data-toast]")).toHaveCount(0, { timeout: 2500 });
      checked.push("actual delayed save keeps content, single line, no recovery panel, confirmed Toast");
      await address.fill("DEMO offline prepared"); await context.setOffline(true); await save.click(); await expect.poll(async () => (await operations(page)).length).toBe(1); const prepared = (await operations(page))[0]; assert.equal(prepared.phase, "prepared"); await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
      await context.setOffline(false); await page.reload(); await expect(page.getByRole("button", { name: "重试原提交", exact: true })).toBeVisible();
      const before = await context.request.get("/api/backend/state"); assert.equal(before.status(), 200); assert.notEqual((await before.json()).settings.address, "DEMO offline prepared");
      await page.getByRole("button", { name: "重试原提交", exact: true }).click(); await expect.poll(async () => (await operations(page)).length).toBe(0);
      const [receiptCount] = await sql`select count(*)::int as count from chinatech_v2_private.command_receipts where store_id=${storeId} and request_id=${prepared.command.requestId}`; assert.equal(receiptCount.count, 1);
      const after = await context.request.get("/api/backend/state"); assert.equal((await after.json()).settings.address, "DEMO offline prepared"); checked.push("offline prepared survives online reload and retries the exact original ID once");
      await page.reload(); await address.fill("DEMO lost response"); let original;
      await page.route("**/api/backend/command", async route => { original = route.request().postDataJSON(); const response = await route.fetch(); assert.equal(response.status(), 200); await route.abort("failed"); });
      await save.click(); await expect(page.getByRole("button", { name: "核对提交结果", exact: true })).toBeVisible(); await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0); await expect(address).toHaveValue("DEMO lost response"); await expect(page.locator('.settings-content form button[type="submit"]').first()).toHaveText("待核对");
      await page.unrouteAll({ behavior: "wait" }); await page.getByRole("button", { name: "核对提交结果", exact: true }).click(); await expect.poll(async () => (await operations(page)).length).toBe(0);
      const [savedCount] = await sql`select count(*)::int as count from chinatech_v2_private.command_receipts where store_id=${storeId} and request_id=${original.requestId}`; assert.equal(savedCount.count, 1);
      checked.push("lost committed response retains input, stops busy feedback, recovers original receipt once");
      assert.deepEqual(runtimeErrors, []); results.push({ engine: engine.name(), checked, runtimeErrors });
    } catch (error) { if (page) await page.screenshot({ path: `${output}/${engine.name()}-failure.png`, fullPage: true }).catch(() => {}); throw error; }
    finally {
      if (page) await page.unrouteAll({ behavior: "wait" }).catch(() => {});
      if (context) { await context.setOffline(false).catch(() => {}); await context.request.post("/api/auth/logout", { headers: { Origin: origin } }).catch(() => {}); await context.close(); } if (browser) await browser.close();
      if (userId) await sql`delete from chinatech_v2_private.session_audit where actor_id=${userId} or target_user_id=${userId}`;
      await sql.begin(async tx => { for (const table of ["session_audit", "store_login_sessions", "audit_events", "command_receipts", "intake_photos", "procurement_records", "repair_intakes", "customer_devices", "customers", "store_state"]) await tx.unsafe(`delete from chinatech_v2_private.${table} where store_id=$1`, [storeId]); await tx`delete from chinatech_v2.store_memberships where store_id=${storeId}`; await tx`delete from chinatech_v2.stores where id=${storeId}`; });
      if (userId) { const deleted = await admin.auth.admin.deleteUser(userId); assert.ifError(deleted.error); }
      const [remaining] = await sql`select count(*)::int as count from chinatech_v2.stores where id=${storeId}`; assert.equal(remaining.count, 0);
    }
  }
  writeFileSync(`${output}/formal-results.json`, JSON.stringify({ status: "PASS", results, cleanup: "Only this run's two fresh synthetic users/stores; zero remaining stores", productionWrites: 0 }, null, 2)); console.log("Formal local UI recovery passed in Chromium and WebKit.");
} finally { await sql.end(); }
