import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import sharp from "sharp";
import ts from "typescript";

// Explicitly opt in against this project's isolated local stack. No production target is accepted.
const configPath = process.env.CT_LOCAL_CONFIG;
if (!configPath || !path.isAbsolute(configPath)) throw new Error("CT_LOCAL_CONFIG must point to the authorized project's private local connection file.");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const localHost = value => ["127.0.0.1", "localhost"].includes(value);
if (!localHost(new URL(config.API_URL).hostname) || new URL(config.API_URL).port !== "55421"
  || !localHost(new URL(config.DB_URL).hostname) || new URL(config.DB_URL).port !== "55422") throw new Error("Only the isolated rebuild stack on 55421/55422 is accepted.");
const api = process.env.CT_REWORK_API_URL ?? "http://127.0.0.1:3131";
if (!localHost(new URL(api).hostname) || new URL(api).protocol !== "http:") throw new Error("The candidate API must be a local HTTP server.");
const origin = process.env.CT_REWORK_API_ORIGIN ?? api.replace("127.0.0.1", "localhost");
const sql = postgres(config.DB_URL, { max: 1, prepare: false });
const admin = createClient(config.API_URL, config.SECRET_KEY || config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = randomBytes(6).toString("hex"), password = "Ct" + randomBytes(20).toString("hex");
const storeIds = [randomUUID(), randomUUID()], sessions = [], checks = [];
const permissions = ["retail.view", "retail.edit", "retail.inspect", "retail.price", "retail.sell", "sale.payment", "sale.reconcile", "sale.deliver", "sale.debt", "sale.refund", "sale.aftersales", "financial.read", "financial.edit", "repairs.view", "repairs.edit", "customers.view", "customers.edit", "settings.edit", "staff.manage"];
const settings = { revision: 0, shopName: "Synthetic rework test store", address: "Synthetic address", phone: "", paper: "a4", repairWarrantyMonths: 6, retailWarrantyMonths: 12, suppliers: [{ id: "test-supplier", name: "Synthetic supplier", phone: "", website: "", active: true }], finance: [] };
const ids = () => "LOCAL-" + randomBytes(8).toString("hex").toUpperCase();
const urls = new Map();
function domainUrl(name) {
  if (urls.has(name)) return urls.get(name);
  let code = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  code = code.replace(/from "(\.\.?\/[^\"]+)"/g, (_match, dependency) => `from "${domainUrl(path.posix.normalize(path.posix.join(path.posix.dirname(name), dependency)))}"`);
  const url = "data:text/javascript;base64," + Buffer.from(code + `\n//# sourceURL=lib/${name}.js`).toString("base64"); urls.set(name, url); return url;
}
const intakeDomain = await import(domainUrl("repair-intake-record")), workflowDomain = await import(domainUrl("repair-workflow")), retailDomain = await import(domainUrl("retail"));
function pass(name) { checks.push(name); console.log("PASS " + name); }
function expect(response, status) { assert.equal(response.status, status, typeof response.data?.message === "string" ? response.data.message : "Unexpected API status"); return response.data; }
async function request(who, endpoint, body, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(api + endpoint, { method, redirect: "manual", headers: { Origin: origin, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(who ? { Cookie: [...who.cookies].map(([key, value]) => key + "=" + value).join("; ") } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (who) for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0], index = pair.indexOf("="); who.cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
  let data; try { data = await response.json(); } catch { data = { message: "Non-JSON API response" }; }
  return { status: response.status, data };
}
async function user(label, role, storeId, granted) {
  const email = `ct-rework-${label}-${suffix}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Synthetic " + label } }); assert.ifError(error);
  await sql`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${storeId},${data.user.id},${role},'active',${granted})`;
  const who = { id: data.user.id, email, cookies: new Map() }; expect(await request(who, "/api/auth/login", { email, password }), 200); sessions.push(who); return who;
}
async function state(who) { return expect(await request(who, "/api/backend/state"), 200); }
async function command(who, storeId, kind, payload, requestId = randomUUID()) {
  const [member] = who ? await sql`select id from chinatech_v2.store_memberships where store_id=${storeId} and user_id=${who.id}` : [];
  return request(who, "/api/backend/command", { storeId, memberId: member?.id ?? randomUUID(), kind, payload, requestId });
}
const emptyServices = { screen: { quality: "", technology: "" }, battery: { quality: "", appleService: "" }, port: { quality: "" } };
function receipt(id = ids(), changes = {}) { return { id, createdAt: "2026-10-01 10:00:00", updatedAt: "2026-10-01 10:00:00", previewAt: "2026-10-01 10:00:00", customerName: "Synthetic customer", phone: "+393330000777", email: "", category: "手机", brand: "Apple", model: "Synthetic phone", color: "蓝色", serial: "SYNTHETIC-" + suffix, issue: "Synthetic diagnosis", accessories: [], services: structuredClone(emptyServices), priority: "普通", photoCount: 0, ...changes }; }
async function stage(who, id, status, note = "Synthetic explicit stage change") { const current = await state(who); return command(who, current.storeId, "repair.workflow", { id, command: { type: "stage", status, note }, revision: current.workflows[id]?.revision ?? 0 }); }
async function sourceInput(who, sourceId, changes = {}) { const current = await state(who), source = current.intakes.find(row => row.id === sourceId); return { sourceId, sourceRevision: source.revision, workflowRevision: current.workflows[sourceId]?.revision ?? 0, repairId: ids(), reason: "Synthetic repeated fault", custody: "store", ...changes }; }
async function ledgerCounts(storeId) { const [row] = await sql`select (select count(*)::int from chinatech_v2_private.repair_intakes where store_id=${storeId}) repairs,(select count(*)::int from chinatech_v2_private.customer_devices where store_id=${storeId}) devices,(select count(*)::int from chinatech_v2_private.customers where store_id=${storeId}) customers,(select revision::int from chinatech_v2_private.store_state where store_id=${storeId}) revision`; return row; }

try {
  for (const id of storeIds) { await sql`insert into chinatech_v2.stores(id,name) values(${id},'Synthetic rework integration')`; await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${id},${sql.json(settings)})`; }
  const owner = await user("owner", "owner", storeIds[0], permissions), viewer = await user("viewer", "viewer", storeIds[0], ["repairs.view"]), other = await user("other", "owner", storeIds[1], permissions), editor = await user("editor", "technician", storeIds[0], ["repairs.view", "repairs.edit"]);
  const jpeg = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#6157ff" } }).jpeg().toBuffer(), photo = { id: randomUUID(), slot: "front", mime: "image/jpeg", base64: jpeg.toString("base64") };
  const oldPolicy = { months: 6, shopName: settings.shopName, address: settings.address, phone: settings.phone };
  const original = receipt(ids(), { services: { ...emptyServices, screen: { quality: "assembled", technology: "oled" } }, accessories: ["Synthetic old accessory"], priority: "紧急", custody: "customer", photoCount: 1, photos: [{ id: photo.id, slot: photo.slot }], itemQuotes: [{ item: "屏幕", amountCents: 9900 }], policy: oldPolicy });
  const signature = { id: randomUUID(), signedAt: "2026-10-01 10:00:00", language: "it", termsVersion: "repair-intake-2026-10-v1", strokes: [[{ x: 0.1, y: 0.2 }, { x: 0.6, y: 0.8 }]], snapshot: intakeDomain.intakeSignatureSnapshot(original, oldPolicy) };
  expect(await command(owner, storeIds[0], "intake.save", { data: original, revision: 0, signatureCount: 0, signature, photos: [photo] }), 200);
  let input = await sourceInput(owner, original.id), counts = await ledgerCounts(storeIds[0]);
  expect(await command(null, storeIds[0], "repair.rework", input), 401); expect(await command(viewer, storeIds[0], "repair.rework", input), 403);
  expect(await command(owner, storeIds[1], "repair.rework", input), 403); expect(await command(other, storeIds[1], "repair.rework", input), 404);
  assert.deepEqual(await ledgerCounts(storeIds[0]), counts); assert.equal((await state(other)).intakes.length, 0); pass("anonymous, read-only and cross-store sources cannot create or leak a rework");
  for (const changed of [{ reason: " " }, { customerName: "Forged customer" }, { repairId: "NOT-LOCAL" }, { sourceId: input.repairId }, { sourceRevision: -1 }, { custody: "unknown" }]) expect(await command(owner, storeIds[0], "repair.rework", { ...input, ...changed }), 400);
  expect(await command(owner, storeIds[0], "repair.rework", { ...input, sourceId: ids() }), 404); assert.deepEqual(await ledgerCounts(storeIds[0]), counts); pass("strict input rejects forged client facts, missing reason and invalid identifiers");
  expect(await command(owner, storeIds[0], "repair.rework", input), 409); expect(await stage(owner, original.id, "outsourced"), 200);
  expect(await command(owner, storeIds[0], "repair.rework", await sourceInput(owner, original.id)), 409); pass("signature, customer custody and outsourced repair never establish returned-repair eligibility");
  let current = await state(owner), saved = current.intakes.find(row => row.id === original.id);
  expect(await command(owner, storeIds[0], "intake.save", { data: { ...saved, issue: "Synthetic revised original issue" }, revision: saved.revision, photos: [photo], signatureCount: 1 }), 200);
  expect(await stage(owner, original.id, "completed"), 200); input = await sourceInput(owner, original.id); counts = await ledgerCounts(storeIds[0]);
  expect(await command(owner, storeIds[0], "repair.rework", { ...input, sourceRevision: input.sourceRevision - 1 }), 409);
  expect(await command(owner, storeIds[0], "repair.rework", { ...input, workflowRevision: input.workflowRevision - 1 }), 409); assert.deepEqual(await ledgerCounts(storeIds[0]), counts); pass("both frozen source and workflow revisions reject stale rework drafts");
  await sql`update chinatech_v2.store_memberships set permissions=${["repairs.view"]},revision=revision+1 where store_id=${storeIds[0]} and user_id=${editor.id}`;
  expect(await command(editor, storeIds[0], "repair.rework", input), 403); assert.deepEqual(await ledgerCounts(storeIds[0]), counts); pass("permission revocation is checked again at the real write boundary");
  current = await state(owner); expect(await command(owner, storeIds[0], "settings.save", { settings: { ...current.settings, repairWarrantyMonths: 4 }, revision: current.settings.revision }), 200);
  const [sourceBefore] = await sql`select customer_id,device_id,data,signatures,workflow from chinatech_v2_private.repair_intakes where store_id=${storeIds[0]} and id=${original.id}`;
  const beforeCreate = await ledgerCounts(storeIds[0]), operationId = randomUUID();
  const created = expect(await command(owner, storeIds[0], "repair.rework", input, operationId), 200), rework = created.intakes.find(row => row.id === input.repairId);
  assert.deepEqual(rework.repairOrigin, { repairId: original.id, reason: input.reason }); assert.equal(rework.issue, input.reason); assert.equal(rework.policy.months, 4); assert.equal(rework.custody, "store");
  for (const field of ["customerName", "phone", "email", "category", "brand", "model", "color", "serial"]) assert.equal(rework[field], sourceBefore.data[field]);
  assert.deepEqual(rework.services, emptyServices); assert.deepEqual(rework.accessories, []); assert.equal(rework.priority, "普通"); assert.equal(rework.photoCount, 0);
  for (const field of ["retailOrigin", "itemQuotes", "itemQuoteHistory", "photos", "faults", "issueNote"]) assert.equal(Object.hasOwn(rework, field), false);
  assert.equal(created.signatures.filter(row => row.orderId === rework.id).length, 0); assert.equal(created.workflows[rework.id], undefined); assert.equal(created.procurement.filter(row => row.repairId === rework.id).length, 0);
  const [newRelation] = await sql`select customer_id,device_id from chinatech_v2_private.repair_intakes where store_id=${storeIds[0]} and id=${rework.id}`;
  assert.equal(newRelation.customer_id, sourceBefore.customer_id); assert.equal(newRelation.device_id, sourceBefore.device_id);
  assert.deepEqual((await sql`select customer_id,device_id,data,signatures,workflow from chinatech_v2_private.repair_intakes where store_id=${storeIds[0]} and id=${original.id}`)[0], sourceBefore);
  const afterCreate = await ledgerCounts(storeIds[0]); assert.equal(afterCreate.devices, beforeCreate.devices); assert.equal(afterCreate.customers, beforeCreate.customers); assert.equal(afterCreate.repairs, beforeCreate.repairs + 1); pass("rework creates one independent order with the original physical relationship and current policy; original facts stay intact");
  const replay = expect(await command(owner, storeIds[0], "repair.rework", input, operationId), 200); assert.equal(replay.operation.replayed, true); assert.deepEqual(await ledgerCounts(storeIds[0]), afterCreate);
  expect(await command(owner, storeIds[0], "repair.rework", { ...input, reason: "Changed" }, operationId), 409); expect(await command(owner, storeIds[0], "repair.rework", input), 409);
  const [commits] = await sql`select (select count(*)::int from chinatech_v2_private.command_receipts where store_id=${storeIds[0]} and request_id=${operationId}) receipts,(select count(*)::int from chinatech_v2_private.audit_events where store_id=${storeIds[0]} and request_id=${operationId}) audits`; assert.deepEqual(commits, { receipts: 1, audits: 1 }); pass("same operation replays once and changed payload or colliding new number cannot overwrite it");
  const concurrentInput = await sourceInput(owner, original.id), concurrentId = randomUUID();
  const concurrent = await Promise.all([command(owner, storeIds[0], "repair.rework", concurrentInput, concurrentId), command(owner, storeIds[0], "repair.rework", concurrentInput, concurrentId)]);
  for (const response of concurrent) expect(response, 200); assert.deepEqual(concurrent.map(row => row.data.operation.replayed).sort(), [false, true]);
  assert.equal((await state(owner)).intakes.filter(row => row.id === concurrentInput.repairId).length, 1); pass("concurrent duplicate requests create one new repair and one original receipt");
  expect(await command(owner, storeIds[0], "intake.save", { data: { ...receipt(), repairOrigin: rework.repairOrigin }, revision: 0, signatureCount: 0 }), 400);
  for (const repairOrigin of [{ ...rework.repairOrigin, reason: "Changed" }, { ...rework.repairOrigin, repairId: ids() }]) expect(await command(owner, storeIds[0], "intake.save", { data: { ...rework, repairOrigin }, revision: 1, signatureCount: 0 }), 400);
  const oldClient = { ...rework, issue: "Synthetic later intake correction" }; delete oldClient.repairOrigin;
  const compatible = expect(await command(owner, storeIds[0], "intake.save", { data: oldClient, revision: 1, signatureCount: 0 }), 200).intakes.find(row => row.id === rework.id); assert.deepEqual(compatible.repairOrigin, rework.repairOrigin); assert.equal(compatible.revision, 2); pass("ordinary intake saves cannot forge or change the source; omitted source survives an older client");
  const faultId = randomUUID(), faultInput = await sourceInput(owner, original.id), faultName = "rework_fault_" + suffix, beforeFault = await ledgerCounts(storeIds[0]);
  await sql.unsafe(`create function chinatech_v2_private.${faultName}() returns trigger language plpgsql as $$ begin if new.store_id='${storeIds[0]}'::uuid and new.request_id='${faultId}'::uuid then raise exception 'synthetic transaction failure'; end if; return new; end $$; create trigger ${faultName} before insert on chinatech_v2_private.audit_events for each row execute function chinatech_v2_private.${faultName}()`);
  try {
    expect(await command(owner, storeIds[0], "repair.rework", faultInput, faultId), 503); assert.deepEqual(await ledgerCounts(storeIds[0]), beforeFault);
    const [faultRows] = await sql`select (select count(*)::int from chinatech_v2_private.repair_intakes where store_id=${storeIds[0]} and id=${faultInput.repairId}) repairs,(select count(*)::int from chinatech_v2_private.command_receipts where store_id=${storeIds[0]} and request_id=${faultId}) receipts,(select count(*)::int from chinatech_v2_private.audit_events where store_id=${storeIds[0]} and request_id=${faultId}) audits`; assert.deepEqual(faultRows, { repairs: 0, receipts: 0, audits: 0 });
    assert.deepEqual((await sql`select customer_id,device_id,data,signatures,workflow from chinatech_v2_private.repair_intakes where store_id=${storeIds[0]} and id=${original.id}`)[0], sourceBefore); pass("injected failure after the repair and receipt writes rolls back all rows, audit and store revision");
  } finally { await sql.unsafe(`drop trigger ${faultName} on chinatech_v2_private.audit_events; drop function chinatech_v2_private.${faultName}()`); }
  expect(await command(owner, storeIds[0], "repair.rework", faultInput, faultId), 200); pass("the original failed request remains retryable after transaction recovery");

  // Exercise the shared status/purchase boundary with optional parts, so a valid ready state exists.
  const active = receipt(); expect(await command(owner, storeIds[0], "intake.save", { data: active, revision: 0, signatureCount: 0 }), 200);
  const requirement = { id: "synthetic-check", title: "Synthetic check", request: "", revision: 1, mode: "none", confirmed: true, deviceFingerprint: JSON.stringify([active.category, active.brand, active.model]) };
  expect(await command(owner, storeIds[0], "repair.workflow", { id: active.id, command: { type: "requirement", item: requirement, note: "Synthetic no-part check" }, revision: 0 }), 200);
  const cart = { id: "PO-rework-cart-" + suffix, repairId: active.id, item: "Synthetic optional part", supplierId: "test-supplier", supplier: "Synthetic supplier", quantity: 2, unitCostCents: null, expectedAt: "", reference: "", events: [], required: false };
  expect(await command(owner, storeIds[0], "procurement", { type: "create-cart", record: cart, intakeRevision: 1, workflowRevision: 1 }), 200);
  const ordered = { ...cart, id: "PO-rework-ordered-" + suffix }; expect(await command(owner, storeIds[0], "procurement", { type: "create-cart", record: ordered, intakeRevision: 1, workflowRevision: 1 }), 200);
  expect(await command(owner, storeIds[0], "procurement", { type: "append", id: ordered.id, revision: 1, event: { type: "ordered", id: randomUUID(), time: "", note: "Synthetic order", quantity: 0 } }), 200);
  for (const status of ["ready", "completed", "cancelled"]) {
    expect(await stage(owner, active.id, status), 200); current = await state(owner); const before = await ledgerCounts(storeIds[0]), orderRevision = current.intakes.find(row => row.id === active.id).revision, workflowRevision = current.workflows[active.id].revision;
    const attempts = [
      ["procurement", { type: "create", record: { ...cart, id: "PO-new-" + randomBytes(4).toString("hex") } }],
      ["procurement", { type: "create-cart", record: { ...cart, id: "PO-new-" + randomBytes(4).toString("hex") }, intakeRevision: orderRevision, workflowRevision }],
      ["procurement", { type: "edit", record: cart, revision: 1 }],
      ["procurement", { type: "append", id: cart.id, revision: 1, event: { type: "cart_added", id: randomUUID(), time: "", note: "Synthetic", quantity: 0 } }],
      ["procurement", { type: "append", id: cart.id, revision: 1, event: { type: "ordered", id: randomUUID(), time: "", note: "Synthetic", quantity: 0 } }],
      ["procurement.batch", { action: "ordered", supplierId: "test-supplier", items: [{ id: cart.id, revision: 1 }] }],
      ["procurement", { type: "save-item", record: { ...cart, id: "PO-item-" + randomBytes(4).toString("hex"), item: requirement.title, requirementId: requirement.id, requirementRevision: 1 }, revision: 0, intakeRevision: orderRevision, workflowRevision, quoteCents: null }],
      ["procurement", { type: "save-item", record: { ...cart, id: "PO-none-" + randomBytes(4).toString("hex"), item: "Synthetic closed no-purchase project", supplier: "", supplierId: "" }, revision: 0, intakeRevision: orderRevision, workflowRevision, quoteCents: null, noProcurement: true }],
      ["procurement", { type: "save-items", repairId: active.id, intakeRevision: orderRevision, workflowRevision, items: [{ requirementId: requirement.id, requirementRevision: 1, quoteCents: null, purchase: { id: "PO-items-" + randomBytes(4).toString("hex"), revision: 0, supplierId: "test-supplier", unitCostCents: null } }] }],
    ];
    for (const [kind, payload] of attempts) {
      const rejected = expect(await command(owner, storeIds[0], kind, payload), 409);
      if (payload.noProcurement) assert.match(rejected.message, /先明确恢复维修/);
    }
    const rejectedProject = expect(await command(owner, storeIds[0], "repair.workflow", { id: active.id, revision: workflowRevision, command: { type: "requirement", item: { ...requirement, id: "closed-project-" + status, mode: "pending", confirmed: false }, note: "Synthetic closed repair project" } }), 400);
    assert.match(rejectedProject.message, /先明确恢复维修，再新增或更改维修项目/);
    assert.deepEqual(await ledgerCounts(storeIds[0]), before); pass(`${status}: all nine purchase or project paths reject while original drafts and receipts remain unchanged`);
    expect(await command(owner, storeIds[0], "procurement", { type: "save-items", repairId: active.id, intakeRevision: orderRevision, workflowRevision, items: [{ requirementId: requirement.id, requirementRevision: 1, quoteCents: 1200 }] }), 200);
    const quoteSource = (await state(owner)).intakes.find(row => row.id === active.id); expect(await command(owner, storeIds[0], "repair.quote", { id: active.id, item: requirement.title, quoteCents: 1400, intakeRevision: quoteSource.revision }), 200);
  }
  pass("new manual repair projects reject on ready, completed and cancelled repairs without reopening the order");
  pass("quote-only saves remain available on ready and historical repairs without reopening procurement");
  expect(await command(owner, storeIds[0], "procurement.batch", { action: "arrival", supplierId: "test-supplier", items: [{ id: ordered.id, revision: 2, quantity: 1 }] }), 200); pass("actual arrivals on historical repairs can still be recorded without erasing the existing order");
  expect(await stage(owner, active.id, "repairing"), 200);
  expect(await command(owner, storeIds[0], "procurement.batch", { action: "ordered", supplierId: "test-supplier", items: [{ id: cart.id, revision: 1 }] }), 200); pass("explicit recovery restores new purchase eligibility without replacing old history");

  const returned = receipt(); expect(await command(owner, storeIds[0], "intake.save", { data: returned, revision: 0, signatureCount: 0 }), 200); expect(await stage(owner, returned.id, "ready"), 200); current = await state(owner);
  expect(await command(owner, storeIds[0], "repair.workflow", { id: returned.id, revision: current.workflows[returned.id].revision, command: { type: "followup", flag: "collectedUnpaid", value: true, delivered: true, unpaid: true, note: "Synthetic actual handover" } }), 200);
  const handedInput = await sourceInput(owner, returned.id); expect(await command(owner, storeIds[0], "repair.rework", handedInput), 200);
  expect(await stage(owner, returned.id, "ready_notified", ""), 400); current = await state(owner);
  assert.equal(workflowDomain.hasCurrentRepairHandover(current.workflows[returned.id]), true); assert.equal(workflowDomain.workflowGroup(intakeDomain.intakeDirectoryEntry(current.intakes.find(row => row.id === returned.id)), current.procurement, current.workflows[returned.id]), "complete");
  expect(await stage(owner, returned.id, "repairing"), 200); expect(await command(owner, storeIds[0], "repair.rework", await sourceInput(owner, returned.id)), 409); pass("explicit handover creates eligibility, legacy notification cannot resurrect it, and active recovery removes it");

  // A sales-origin repair is a valid source, but the independent new repair must not become another sale case.
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", dateStyle: "short" }).format(new Date()), unitId = randomUUID(), saleId = randomUUID(), caseId = randomUUID();
  const unit = { ...retailDomain.emptyRetailUnit(), id: unitId, brand: "Apple", model: "Synthetic sold phone", serial: "SYNTHETIC-SALE-" + suffix, storeOwned: true, intakeDate: day, costCents: 12000, refurbCents: 0, priceCents: 22000 };
  expect(await command(owner, storeIds[0], "retail", { type: "create", unit }), 200);
  async function retailOperation(commandValue) { const latest = (await state(owner)).retail.find(row => row.id === unitId); return expect(await command(owner, storeIds[0], "retail", { type: "command", id: unitId, version: latest.version, command: commandValue }), 200); }
  await retailOperation({ type: "inspect", checks: { functional: true, ownership: true, data: true } }); await retailOperation({ type: "approve" }); current = await state(owner);
  const warranty = { months: 12, termsVersion: "retail-2026-10-v1", shopName: current.settings.shopName, address: current.settings.address, phone: current.settings.phone };
  await retailOperation({ type: "sell", saleId, customerPhone: "+393330000888", customerName: "Synthetic buyer", priceCents: 22000, warranty, paymentUnreceived: true });
  await retailOperation({ type: "payment", saleId, entryId: randomUUID(), amountCents: 1000, date: day, method: "cash", note: "Synthetic ledger entry" }); await retailOperation({ type: "deliver", saleId, deliveryDate: day, debt: { reason: "Synthetic unpaid delivery", owner: "Synthetic owner", followUp: day } });
  await retailOperation({ type: "after_sale", saleId, caseId, date: day, issue: "Synthetic after-sale repair", custody: "left" }); current = await state(owner); const saleRepairId = ids();
  expect(await command(owner, storeIds[0], "retail.aftersale_repair", { unitId, saleId, caseId, repairId: saleRepairId, version: current.retail.find(row => row.id === unitId).version }), 200); expect(await stage(owner, saleRepairId, "completed"), 200);
  current = await state(owner); const saleBefore = current.retail.find(row => row.id === unitId), saleRepairBefore = current.intakes.find(row => row.id === saleRepairId), saleWorkflowBefore = current.workflows[saleRepairId];
  const saleReworkInput = await sourceInput(owner, saleRepairId), saleReworkState = expect(await command(owner, storeIds[0], "repair.rework", saleReworkInput), 200);
  assert.equal(Object.hasOwn(saleReworkState.intakes.find(row => row.id === saleReworkInput.repairId), "retailOrigin"), false); assert.deepEqual(saleReworkState.retail.find(row => row.id === unitId), saleBefore); assert.deepEqual(saleReworkState.intakes.find(row => row.id === saleRepairId), saleRepairBefore); assert.deepEqual(saleReworkState.workflows[saleRepairId], saleWorkflowBefore); pass("a sales-origin source keeps original sale, payment, delivery and after-sale linkage unchanged; the new repair does not copy that origin");
  const proof = { status: "PASS", timestamp: new Date().toISOString(), count: checks.length, checks, target: "isolated local API and database", productionWrites: 0 };
  mkdirSync(".local", { recursive: true }); writeFileSync(".local/repair-rework-api-verification.json", JSON.stringify(proof, null, 2)); console.log(`PASS ${checks.length} isolated API checks`);
} finally {
  for (const who of sessions) await request(who, "/api/auth/logout", undefined, "POST").catch(() => {});
  // Only synthetic histories remain; credentials and customer records are never written to proof files.
  await sql.end();
}
