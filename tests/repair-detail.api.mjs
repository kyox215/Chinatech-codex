import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import sharp from "sharp";

const config = JSON.parse(readFileSync(process.env.CT_LOCAL_CONFIG ?? new URL("../.local/backend/connection.private.json", import.meta.url), "utf8"));
const api = process.env.REPAIR_DETAIL_API_URL ?? "http://127.0.0.1:3117", origin = process.env.REPAIR_DETAIL_ORIGIN ?? "http://localhost:3117";
for (const [value, port] of [[config.API_URL, "55421"], [config.DB_URL, "55422"]]) { const target = new URL(value); assert.ok(["127.0.0.1", "localhost"].includes(target.hostname) && target.port === port, "Only the verified isolated rebuild stack is accepted."); }
for (const value of [api, origin]) assert.ok(["127.0.0.1", "localhost"].includes(new URL(value).hostname), "The candidate must be served on loopback.");
const sql = postgres(config.DB_URL, { max: 1, prepare: false }), admin = createClient(config.API_URL, config.SECRET_KEY || config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = randomBytes(6).toString("hex"), password = "Ct" + randomBytes(20).toString("hex"), stores = [randomUUID(), randomUUID()], sessions = [], created = [], checks = [];
const settings = { revision: 0, shopName: "Synthetic repair detail", address: "Synthetic", phone: "", paper: "a4", repairWarrantyMonths: 6, retailWarrantyMonths: 12, suppliers: [{ id: "supplier-a", name: "Synthetic A", phone: "", website: "", active: true }], finance: [] };
const services = { screen: { quality: "", technology: "" }, battery: { quality: "", appleService: "" }, port: { quality: "" } };
function pass(name) { checks.push(name); console.log("PASS " + name); }
async function request(who, path, body, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(api + path, { method, redirect: "manual", headers: { Origin: origin, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(who ? { Cookie: [...who.cookies].map(([key, value]) => key + "=" + value).join("; ") } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (who) for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0], at = pair.indexOf("="); who.cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; } return { status: response.status, data };
}
async function user(label, storeId, permissions) {
  const email = `ct-detail-${label}-${suffix}@example.test`, { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Synthetic " + label } }); assert.ifError(error); created.push(data.user.id);
  const [member] = await sql`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${storeId},${data.user.id},'technician','active',${permissions}) returning id`;
  const who = { id: data.user.id, memberId: member.id, storeId, cookies: new Map() }; const login=await request(who, "/api/auth/login", { email, password });assert.equal(login.status, 200, JSON.stringify(login.data)); sessions.push(who); return who;
}
const ok = result => { assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data; };
async function state(who) { return ok(await request(who, "/api/backend/state")); }
async function command(who, kind, payload, requestId = randomUUID(), storeId = who.storeId) { return request(who, "/api/backend/command", { kind, payload, requestId, storeId, memberId: who.memberId }); }
async function createIntake(who, label) {
  const id = "LOCAL-" + randomBytes(8).toString("hex").toUpperCase(), time = "2026-10-01 10:00:00";
  const data = { id, createdAt: time, updatedAt: time, previewAt: time, customerName: "Synthetic " + label, phone: "+393200001111", email: "", category: "手机", brand: "Apple", model: "Synthetic phone", serial: label + suffix, color: "", issue: "Synthetic issue", accessories: [], services, priority: "普通", photoCount: 0, photos: [] };
  ok(await command(who, "intake.save", { data, revision: 0, signatureCount: 0, photos: [] })); return id;
}
async function current(who, id) { return (await state(who)).intakes.find(row => row.id === id); }
async function photoResponse(who, id, photoId) { return fetch(api + `/api/backend/intake-photo?order=${id}&photo=${photoId}`, { headers: who ? { Cookie: [...who.cookies].map(([key, value]) => key + "=" + value).join("; ") } : {} }); }
const jpeg = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#6255cc" } }).jpeg().toBuffer();
const photo = (slot = "other") => ({ id: randomUUID(), slot, mime: "image/jpeg", base64: jpeg.toString("base64") });

try {
  for (const id of stores) { await sql`insert into chinatech_v2.stores(id,name) values(${id},'Synthetic repair detail')`; await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${id},${sql.json(settings)})`; }
  const editor = await user("editor", stores[0], ["repairs.view", "repairs.edit"]), viewer = await user("viewer", stores[0], ["repairs.view"]), blind = await user("blind", stores[0], ["repairs.edit"]), other = await user("other", stores[1], ["repairs.view", "repairs.edit"]);
  const id = await createIntake(editor, "main"), foreign = await createIntake(other, "foreign"), front = photo("front"), back = photo("back");
  const signedData=await current(editor,id),signature={id:randomUUID(),signedAt:"1999-01-01 00:00:00",language:"it",termsVersion:"repair-intake-2026-10-v1",strokes:[[{x:.1,y:.2},{x:.5,y:.6}]],snapshot:{...Object.fromEntries(["customerName","phone","email","category","brand","model","color","serial","issue","accessories","services","priority"].map(key=>[key,signedData[key]])),policy:signedData.policy}};
  const signed=ok(await command(editor,"intake.signature",{id,revision:1,policy:signedData.policy,signature,count:0})).signatures;
  const payload = { id, revision: 1, photos: [front, back] }, requestId = randomUUID();
  assert.equal((await request(null, "/api/backend/command", { kind: "intake.photos", payload, requestId, memberId: editor.memberId, storeId: stores[0] })).status, 401);
  for (const who of [viewer, blind]) assert.equal((await command(who, "intake.photos", payload)).status, 403);
  assert.equal((await command(editor, "intake.photos", payload, randomUUID(), stores[1])).status, 403); assert.equal((await command(other, "intake.photos", payload)).status, 404); assert.equal((await command(editor, "intake.photos", { ...payload, id: foreign })).status, 404);
  pass("new photo command rejects anonymous, view-only, edit-without-view and foreign scope requests");
  let saved = ok(await command(editor, "intake.photos", payload, requestId)); assert.equal(saved.intakes.find(row => row.id === id).photoCount, 2); assert.equal(JSON.stringify(saved).includes('"base64"'), false); assert.equal(saved.operation.kind, "intake.photos"); assert.deepEqual(saved.signatures,signed);
  saved = ok(await command(editor, "intake.photos", payload, requestId)); assert.equal(saved.operation.replayed, true); assert.equal(saved.intakes.find(row => row.id === id).revision, 2);
  const receipt = ok(await request(editor, "/api/backend/operation?" + new URLSearchParams({ storeId: stores[0], memberId: editor.memberId, requestId }))); assert.equal(receipt.status, "committed"); assert.equal(receipt.operation.requestId, requestId);
  assert.equal((await command(editor, "intake.photos", { ...payload, photos: [front] }, requestId)).status, 409);
  const [audit] = await sql`select (select count(*)::int from chinatech_v2_private.command_receipts where store_id=${stores[0]} and request_id=${requestId}) receipts,(select count(*)::int from chinatech_v2_private.audit_events where store_id=${stores[0]} and request_id=${requestId} and actor_id=${editor.id}) audit`; assert.deepEqual(audit, { receipts: 1, audit: 1 });
  const active = await photoResponse(editor, id, front.id); assert.equal(active.status, 200); assert.deepEqual(Buffer.from(await active.arrayBuffer()), jpeg); assert.match(active.headers.get("cache-control"), /no-store/);
  assert.equal((await photoResponse(null, id, front.id)).status, 401); assert.equal((await photoResponse(other, id, front.id)).status, 404);
  pass("photo bytes stay private, exact request recovers one committed operation and one real actor audit");
  const old = await current(editor, id), otherPhoto = photo(), newFront = photo("front");
  saved = ok(await command(editor, "intake.photos", { id, revision: old.revision, photos: [otherPhoto, newFront] })); const updated = saved.intakes.find(row => row.id === id); assert.deepEqual(saved.signatures,signed);
  assert.equal(updated.photoCount, 3); assert.equal(updated.revision, 3); assert.deepEqual(updated.photos.map(row => row.id).sort(), [back.id, otherPhoto.id, newFront.id].sort());
  assert.equal((await photoResponse(editor, id, front.id)).status, 404); assert.equal((await photoResponse(editor, id, newFront.id)).status, 200);
  const [original] = await sql`select bytes from chinatech_v2_private.intake_photos where store_id=${stores[0]} and repair_id=${id} and id=${front.id}`; assert.deepEqual(Buffer.from(original.bytes), jpeg);
  const changedBytes = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#ff0000" } }).jpeg().toBuffer();
  const before = await state(editor), bad = await command(editor, "intake.photos", { id, revision: 3, photos: [{ ...newFront, base64: changedBytes.toString("base64") }] }); assert.equal(bad.status, 409); assert.deepEqual(await state(editor), before);
  assert.equal((await command(editor, "intake.photos", { id, revision: 2, photos: [photo()] })).status, 409);
  for (const photos of [[], [photo("front"), photo("front")], Array.from({ length: 4 }, () => photo()), [{ ...photo(), mime: "image/png" }], [{ ...photo(), base64: "/9j/AP/Z" }]]) { assert.equal((await command(editor, "intake.photos", { id, revision: 3, photos })).status, 400); assert.deepEqual(await state(editor), before); }
  pass("front replacement keeps immutable original bytes; stale versions, changed IDs, invalid JPEG and overflowing other slots leave state unchanged");
  const capped = await createIntake(editor, "cap"); await sql`insert into chinatech_v2_private.intake_photos(store_id,repair_id,id,slot,mime,bytes) select ${stores[0]},${capped},gen_random_uuid(),'other','image/jpeg',${jpeg} from generate_series(1,30)`;
  assert.equal((await command(editor, "intake.photos", { id: capped, revision: 1, photos: [photo()] })).status, 400); assert.equal((await current(editor, capped)).revision, 1);
  const [history] = await sql`select count(*)::int count from chinatech_v2_private.intake_photos where store_id=${stores[0]} and repair_id=${capped}`; assert.equal(history.count, 30);
  pass("immutable 30-photo history cap rolls back the attempted extra bytes and current intake together");
  for (const outcome of ["contacted", "unreachable", "awaiting_reply"]) { const snapshot = await state(editor), revision = snapshot.workflows[id]?.revision ?? 0; ok(await command(editor, "repair.workflow", { id, revision, command: { type: "quote_contact", outcome, note: "" } })); const stored = (await state(editor)).workflows[id]; assert.equal(stored.quoteContact.note, ""); assert.equal(stored.quoteContact.outcome, outcome); assert.equal(stored.status, "diagnosis"); assert.equal(stored.quoteContact.actorId, editor.memberId); }
  let flow = (await state(editor)).workflows[id]; ok(await command(editor, "repair.workflow", { id, revision: flow.revision, command: { type: "stage", status: "ready", note: "" } }));
  for (const value of [true, false]) { flow = (await state(editor)).workflows[id]; ok(await command(editor, "repair.workflow", { id, revision: flow.revision, command: { type: "followup", flag: "awaitingReply", value, note: "" } })); }
  flow = (await state(editor)).workflows[id]; assert.equal((await command(editor, "repair.workflow", { id, revision: flow.revision, command: { type: "followup", flag: "collectedUnpaid", value: true, note: "" } })).status, 400);
  pass("empty contact and followup notes persist across fresh API reads while actual handover still needs explicit facts");
  const legacy = { id: "PO-legacy-" + suffix, repairId: capped, item: "Synthetic historical cart", supplier: "Synthetic A", supplierId: "supplier-a", quantity: 1, unitCostCents: null, expectedAt: "", reference: "", events: [{ id: "old-cart", time: "2026-10-01 10:00:00", type: "cart_added", quantity: 0, note: "Original legacy note" }] };
  await sql`insert into chinatech_v2_private.procurement_records(store_id,id,repair_id,data) values(${stores[0]},${legacy.id},${capped},${sql.json(legacy)})`; await sql`update chinatech_v2_private.store_state set revision=revision+1 where store_id=${stores[0]}`;
  for (const [kind, retired] of [["procurement", { type: "create-cart", record: { ...legacy, events: [] }, intakeRevision: 1, workflowRevision: 0 }], ...["cart_added", "cart_removed"].map(type => ["procurement", { type: "append", id: legacy.id, revision: 1, event: { id: randomUUID(), time: "", type, note: "", quantity: 0 } }]), ["procurement.batch", { action: "ordered", supplierId: "supplier-a", items: [{ id: legacy.id, revision: 1 }] }]]) {
    const oldId = randomUUID(), baseline = await state(editor); assert.equal((await command(editor, kind, retired, oldId)).status, 400); assert.deepEqual(await state(editor), baseline);
    const digest = createHash("sha256").update(JSON.stringify({ kind, payload: retired })).digest("hex"); await sql`insert into chinatech_v2_private.command_receipts(store_id,actor_id,request_id,digest) values(${stores[0]},${editor.id},${oldId},${digest})`; await sql`insert into chinatech_v2_private.audit_events(store_id,actor_id,request_id,kind,entity_id) values(${stores[0]},${editor.id},${oldId},${kind},${legacy.id})`;
    const replay = ok(await command(editor, kind, retired, oldId)); assert.equal(replay.operation.replayed, true); assert.deepEqual(replay.procurement.find(row => row.id === legacy.id), legacy);
  }
  pass("new retired cart commands reject, old completed request IDs still recover the untouched legacy ledger");
  await sql`update chinatech_v2.store_memberships set permissions=${["repairs.edit"]},revision=revision+1 where store_id=${stores[0]} and id=${editor.memberId}`;
  assert.equal((await photoResponse(editor, id, newFront.id)).status, 403); assert.equal((await command(editor, "intake.photos", { id, revision: 3, photos: [photo()] })).status, 403);
  pass("permission revocation applies to both photo reads and new photo commands immediately");
  console.log(JSON.stringify({ status: "PASS", count: checks.length, checks, timestamp: new Date().toISOString() }));
} catch (reason) { console.error("PRIMARY TEST FAILURE", reason); throw reason; } finally {
  for (const who of sessions) await request(who, "/api/auth/logout", undefined, "POST").catch(() => {});
  // These UUIDs and synthetic identities were created only by this isolated run.
  if(created.length) await sql`delete from chinatech_v2_private.session_audit where actor_id in ${sql(created)} or target_user_id in ${sql(created)}`;
  for (const storeId of stores) await sql.begin(async tx=>{for(const table of ["session_audit","store_login_sessions","audit_events","command_receipts","intake_photos","procurement_records","repair_intakes","customer_devices","customers","store_state"]){await tx.unsafe(`delete from chinatech_v2_private.${table} where store_id=$1`,[storeId]);}await tx`delete from chinatech_v2.store_memberships where store_id=${storeId}`;await tx`delete from chinatech_v2.stores where id=${storeId} and name='Synthetic repair detail'`;});
  for (const userId of created) { const result=await admin.auth.admin.deleteUser(userId); assert.ifError(result.error); }
  await sql.end();
  console.log("CLEANUP synthetic stores and users removed");
}
