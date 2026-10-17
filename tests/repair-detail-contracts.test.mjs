import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url)), nativeRequire = createRequire(import.meta.url);
const storeId = "00000000-0000-4000-8000-000000000001", userId = "00000000-0000-4000-8000-000000000002";
const repairId = "LOCAL-0000000000000001", time = "2026-10-01 10:00:00";
const member = { id: "member", role: "technician", revision: 1, accountStatus: "active", membershipStatus: "active", permissions: ["repairs.view", "repairs.edit"] };
const intake = () => ({ id: repairId, revision: 1, createdAt: time, updatedAt: time, previewAt: time, customerName: "Synthetic", phone: "+393200001111", email: "", category: "手机", brand: "Apple", model: "Synthetic", color: "", serial: "", issue: "Synthetic issue", accessories: [], services: { screen: { quality: "", technology: "" }, battery: { quality: "", appleService: "" }, port: { quality: "" } }, priority: "普通", photoCount: 0, photos: [] });

function harness() {
  class BackendError extends Error { constructor(message, status = 400, code) { super(message); this.status = status; this.code = code; } }
  const h = { member: structuredClone(member), state: { storeId, revision: 1, intakes: [intake()], signatures: [], workflows: {}, procurement: [], customers: [], settings: {}, staff: { currentId: member.id, members: [member] }, retail: [] }, photos: new Map(), objects: new Map(), receipts: new Map(), results: new Map(), effects: new Map(), audits: new Map(), failPhotoWrite: false, failPhotoPreparation: false, preparing: 0, decoded: 0, locked: false };
  const modules = new Map(), sandbox = createContext({ Buffer, console, Intl, Date, structuredClone, URL, performance, process: { env: {} } });
  const tx = (strings, ...values) => {
    if(!strings.raw)return strings;
    const query = strings.join("?").replace(/\s+/g, " ").trim();
    if (query.startsWith("select revision,jsonb_build_object")) return [{ revision: h.state.revision, defaults: h.state.settings, suppliers: values[0] ? h.state.settings.suppliers : null, full_settings: values[1] ? h.state.settings : null, audit: values[2] ? h.state.staff.audit : null }];
    if(query.startsWith("select pg_advisory")){h.locked=true;return [];}
    if (query.startsWith("select revision")) return [];
    if (query.startsWith("select data,repair_id")) return h.state.procurement.filter(row => values[1].includes(row.id)).map(data => ({ data, repair_id: data.repairId }));
    if (query.startsWith("select data,workflow,case")) return h.state.intakes.filter(row => values[2].includes(row.id)).map(data => ({ data, workflow: h.state.workflows[data.id], signatures: values[0].includes(data.id) ? h.state.signatures.filter(row => row.orderId === data.id) : null }));
    if (query.startsWith("select data from chinatech_v2_private.procurement_records")) return h.state.procurement.filter(row => values[1].includes(row.repairId) || values[2].includes(row.id)).map(data => ({ data }));
    if (query.startsWith("select id,coalesce")) return h.state.intakes.filter(row => values[1].includes(row.id)).map(data => ({ id: data.id, version: data.revision ?? 1, workflow_revision: h.state.workflows[data.id]?.revision ?? 0, signature_count: h.state.signatures.filter(row => row.orderId === data.id).length, updated_at: data.updatedAt }));
    if (query.startsWith("select id,jsonb_array_length")) return h.state.procurement.filter(row => values[1].includes(row.id)).map(data => ({ id: data.id, version: data.events.length }));
    if (query.startsWith("select digest")) return h.receipts.has(values[2]) ? [{ digest: h.receipts.get(values[2]), result: h.results.get(values[2]) ?? null }] : [];
    if (query.startsWith("select a.entity_id")) return h.audits.has(values[2]) ? [h.audits.get(values[2])] : [];
    if (query.startsWith("insert into chinatech_v2_private.intake_photo_objects")) {
      if (h.failPhotoWrite) throw new BackendError("Synthetic photo write failure", 503);
      const key = values[1] + ":" + values[2];
      if (h.photos.has(key)) return [];
      h.photos.set(key, { repairId: values[1], id: values[2], slot: values[3], mime: values[4], bytes: Buffer.from(h.objects.get(values[2]).bytes) }); return [{ id: values[2] }];
    }
    if (query.startsWith("select u.bytes,u.content_hash")) {const row=h.objects.get(values[1]);return row?[{bytes:row.bytes.length,content_hash:row.hash}]:[];}
    if (query.startsWith("select slot,mime from")) {const row=h.photos.get(values[1]+":"+values[2]);return row?[row]:[];}
    if (query.startsWith("select slot,mime,bytes")) { const photo = h.photos.get(values[1] + ":" + values[2]); return photo ? [photo] : []; }
    if (query.startsWith("select count(*)::int as count")) { const photos = [...h.photos.values()].filter(photo => photo.repairId === values[1]); return [{ count: photos.length, bytes: photos.reduce((sum, photo) => sum + photo.bytes.length, 0) }]; }
    if (query.startsWith("insert into chinatech_v2_private.procurement_records")) { for(const row of values[1]){const index=h.state.procurement.findIndex(record=>record.id===row.id);if(index<0)h.state.procurement.push(row.data);else h.state.procurement[index]=row.data;}return []; }
    if (query.startsWith("update chinatech_v2_private.repair_intakes set data=jsonb_set")) { h.state.intakes=h.state.intakes.map(row=>values[2].includes(row.id)?{...row,updatedAt:values[0]}:row);return []; }
    if (query.startsWith("select customer_id,device_id")) return [{ customer_id: "customer", device_id: "device" }];
    if (query.startsWith("insert into chinatech_v2_private.repair_intakes")) { const index = h.state.intakes.findIndex(row => row.id === values[1]); h.state.intakes[index] = values[4]; if (values[6]) h.state.signatures = values[5]; return []; }
    if (query.startsWith("update chinatech_v2_private.repair_intakes set workflow=")) { h.state.workflows[values[2]] = values[0]; return []; }
    if (query.startsWith("insert into chinatech_v2_private.command_receipts")) { h.receipts.set(values[2], values[3]); h.results.set(values[2], values[4]); h.effects.set(values[2], values[5]); return []; }
    if (query.startsWith("insert into chinatech_v2_private.audit_events")) { h.audits.set(values[2], { kind: values[3], entity_id: values[4], created_at: "2026-10-15T12:00:00.000Z" }); return [{ created_at: "2026-10-15T12:00:00.000Z" }]; }
    if (query.startsWith("update chinatech_v2_private.store_state set revision=")) { h.state.revision++; return [{ revision: h.state.revision }]; }
    throw new Error("Unexpected synthetic SQL: " + query);
  };
  tx.json = value => JSON.parse(JSON.stringify(value));
  function load(name, from = root) {
    if(name === "server-only")return {};
    if (!name.startsWith(".") && !name.startsWith("@/")) return nativeRequire(name);
    const file = (name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(from, name)).replace(/\.ts$/, "") + ".ts";
    if (file.endsWith("/backend/database.ts")) {
      const runDatabase=async (_identity, scope, run)=>{
        if (scope !== storeId) throw new BackendError("Synthetic foreign store", 403);
        const before = structuredClone({ state: h.state, photos: h.photos, receipts: h.receipts, results: h.results, effects: h.effects, audits: h.audits });
        try { return await run(tx); } catch (error) { Object.assign(h, before); throw error; }finally{h.locked=false;}
      };
      return {BackendError,withDatabase:runDatabase,withReadDatabase:runDatabase};
    }
    if(file.endsWith("/server/attachment-storage.ts")) return {prepareStoredPhotos:async (_identity,scope,photos)=>{
      assert.equal(h.locked,false,"immutable object preparation must precede the business write lock");h.preparing++;if(h.failPhotoPreparation)throw new BackendError("Synthetic unavailable object storage",503);
      if(scope!==storeId || !h.member.permissions.includes("repairs.view") || !h.member.permissions.includes("repairs.edit"))throw new BackendError("Synthetic permission denied",403);
      for(const photo of photos){const bytes=Buffer.from(photo.base64,"base64"),old=h.objects.get(photo.id);if(old&&!old.bytes.equals(bytes))throw new BackendError("Synthetic immutable object",409);h.objects.set(photo.id,{bytes});}h.afterPhotoPreparation?.();
    },storeRetailPhotos:async (_identity,_store,_request,photos)=>photos};
    if (file.endsWith("/backend/context.ts")) return { memberInTransaction: async () => h.member, memberForRead: async()=>h.member };
    if (file.endsWith("/backend/state.ts")) return { loadState: async () => h.state, projectState: state => structuredClone(state) };
    if (modules.has(file)) return modules.get(file).exports;
    const loadedModule = { exports: {} }; modules.set(file, loadedModule);
    const compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, esModuleInterop: true } }).outputText;
    const fn = runInContext(`(function(require,module,exports){${compiled}\n})`, sandbox, { filename: file });
    fn(dep => load(dep, dirname(file)), loadedModule, loadedModule.exports);
    if(file.endsWith("/backend/intake-photos.ts")){const parse=loadedModule.exports.parseIntakePhotoAttachments;loadedModule.exports.parseIntakePhotoAttachments=(...args)=>{assert.equal(h.locked,false,"image decode must precede the write lock");h.decoded++;return parse(...args);};}
    return loadedModule.exports;
  }
  h.load = name => load("./lib/" + name);
  h.commands = h.load("backend/commands");
  h.command = (kind, payload, requestId = randomUUID(), overrides = {}) => ({ kind, payload, requestId, memberId: member.id, storeId, ...overrides });
  h.execute = command => h.commands.executeCommand({ userId }, command);
  h.seedReceipt = command => { h.receipts.set(command.requestId, createHash("sha256").update(JSON.stringify({ kind: command.kind, payload: command.payload })).digest("hex")); h.audits.set(command.requestId, { entity_id: repairId, kind: command.kind, created_at: "2026-10-01T10:00:00Z" }); };
  return h;
}
const jpeg = await sharp({ create: { width: 8, height: 6, channels: 3, background: "#6255cc" } }).jpeg().toBuffer();
const photo = (slot = "other", id = randomUUID()) => ({ id, slot, mime: "image/jpeg", base64: jpeg.toString("base64") });
const refs = attachments => attachments.map(({ id, slot }) => ({ id, slot }));

test("old cart ledger replays exactly while every new retired cart command is rejected after receipt recovery", async () => {
  const h = harness(), { appendProcurementEvent, procurementStatus, repairPartsSummary, procurementStatuses } = h.load("procurement");
  let row = { id: "PO-old", repairId, item: "Synthetic", supplier: "Synthetic", quantity: 1, unitCostCents: null, expectedAt: "", reference: "", events: [] };
  for (const [index, type] of ["cart_added", "cart_removed", "cart_added"].entries()) row = appendProcurementEvent(row, { id: "old" + index, time, type, quantity: 0, note: "Old original note" });
  h.state.procurement = [row]; const before = JSON.stringify(row);
  const parsed = h.load("procurement-storage").parseProcurementState(JSON.stringify({ version: 1, records: [row], repairUpdates: {} }));
  assert.equal(JSON.stringify(parsed.records[0]), before); assert.equal(procurementStatus(row), "cart"); assert.equal(repairPartsSummary([row], repairId).group, "draft"); assert.equal(procurementStatuses.cart.label, procurementStatuses.draft.label);
  for (const command of [h.command("procurement", { type: "create-cart", record: row }), ...["cart_added", "cart_removed"].map(type => h.command("procurement", { type: "append", id: row.id, revision: 3, event: { type, id: randomUUID(), time, note: "", quantity: 0 } })), h.command("procurement.batch", { action: "ordered", supplierId: "supplier", items: [{ id: row.id, revision: 3 }] })]) {
    await assert.rejects(h.execute(command), /已停用/); assert.equal(h.receipts.has(command.requestId), false); assert.equal(h.state.revision, 1);
    h.seedReceipt(command); const replay = await h.execute(command); assert.equal(replay.operation.replayed, true); assert.equal(JSON.stringify(replay.procurement[0]), before);
    const recovered = await h.commands.queryOperation({ userId }, storeId, member.id, command.requestId); assert.equal(recovered.status, "committed");
    await assert.rejects(h.execute({ ...command, payload: { ...command.payload, note: "changed" } }), error => error.status === 409);
  }
});

test("individual actual ordering freezes a registered supplier and keeps old cart history; inactive or unmatched suppliers reject", async()=>{
  const h=harness(),row={id:"PO-old",repairId,item:"Synthetic",supplier:"Synthetic A",quantity:1,unitCostCents:null,expectedAt:"",reference:"",events:[{id:"old-cart",type:"cart_added",time,note:"Original cart fact",quantity:0}]};
  h.state.procurement=[row];h.state.settings.suppliers=[{id:"supplier-a",name:"Synthetic A",active:true}];
  const command=h.command("procurement",{type:"append",id:row.id,revision:1,event:{id:randomUUID(),time:"",type:"ordered",note:"",quantity:0}}),saved=await h.execute(command),record=saved.procurement[0];
  assert.deepEqual(record.events[0],row.events[0]);assert.equal(record.events.length,2);assert.equal(record.events[1].type,"ordered");assert.equal(record.events[1].actorId,member.id);assert.equal(record.supplierId,"supplier-a");
  for(const supplier of [{id:"supplier-a",name:"Synthetic A",active:false},{id:"other",name:"Different supplier",active:true}]){const next=harness();next.state.procurement=[row];next.state.settings.suppliers=[supplier];await assert.rejects(next.execute(command),error=>error.status===409);assert.equal(next.state.procurement[0].events.length,1);assert.equal(next.receipts.size,0);}
});

test("empty contact and ordinary followup notes survive command save and persisted workflow parsing without authorizing repair", async () => {
  const h = harness(), { validateWorkflowExtensions } = h.load("repair-workflow");
  for (const outcome of ["contacted", "unreachable", "awaiting_reply"]) {
    const revision = h.state.workflows[repairId]?.revision ?? 0;
    const result = await h.execute(h.command("repair.workflow", { id: repairId, revision, command: { type: "quote_contact", outcome, note: "" } }));
    const stored = JSON.parse(JSON.stringify(result.workflows[repairId])); validateWorkflowExtensions(stored); assert.equal(stored.quoteContact.note, ""); assert.equal(stored.status, "diagnosis"); assert.equal(stored.notice, null); assert.equal(stored.quoteContact.actorId, member.id);
  }
  h.state.workflows[repairId].status = "ready";
  for (const command of [{ type: "followup", flag: "awaitingReply", value: true, note: "" }, { type: "followup", flag: "awaitingReply", value: false, note: "" }]) await h.execute(h.command("repair.workflow", { id: repairId, revision: h.state.workflows[repairId].revision, command }));
  for (const facts of [{}, { delivered: true }, { unpaid: true }]) await assert.rejects(h.execute(h.command("repair.workflow", { id: repairId, revision: h.state.workflows[repairId].revision, command: { type: "followup", flag: "collectedUnpaid", value: true, note: "", ...facts } })), /实际交还/);
  await h.execute(h.command("repair.workflow", { id: repairId, revision: h.state.workflows[repairId].revision, command: { type: "followup", flag: "collectedUnpaid", value: true, note: "", delivered: true, unpaid: true } }));
  await assert.rejects(h.execute(h.command("repair.workflow", { id: repairId, revision: h.state.workflows[repairId].revision, command: { type: "stage", status: "repairing", note: "" } })), /原因/);
});

test("photo reference merge replaces explicit front/back, appends other, preserves old references and signature facts", () => {
  const h = harness(), { mergeRepairPhotoReferences, prepareIntakePhotoUpdate } = h.load("repair-photo-update"), { intakeSignatureSnapshot } = h.load("repair-intake-record");
  const initial = [photo("front"), photo("back"), photo()], nextFront = photo("front"), nextOther = photo();
  const current = { ...intake(), photos: refs(initial), photoCount: 3 }, before = JSON.stringify(current), policy = { months: 6, shopName: "Synthetic", address: "", phone: "" };
  const next = prepareIntakePhotoUpdate(current, 1, refs([nextFront, nextOther]), "2026-10-01 11:00:00");
  assert.deepEqual(JSON.parse(JSON.stringify(next.photos)), refs([initial[1], initial[2], nextFront, nextOther])); assert.equal(next.revision, 2); assert.equal(next.photoCount, 4); assert.equal(JSON.stringify(current), before);
  assert.deepEqual(intakeSignatureSnapshot(current, policy), intakeSignatureSnapshot(next, policy));
  assert.deepEqual(JSON.parse(JSON.stringify(mergeRepairPhotoReferences(current, refs([initial[0]])))), current.photos);
  for (const incoming of [[], refs(Array.from({ length: 5 }, () => photo())), refs([photo("front"), photo("front")]), [{ id: initial[0].id, slot: "other" }]]) assert.throws(() => mergeRepairPhotoReferences(current, incoming));
  assert.throws(() => mergeRepairPhotoReferences({ photoCount: 1 }, refs([photo()])), error => error.status === 409);
  assert.throws(() => prepareIntakePhotoUpdate(current, 2, refs([photo()]), time), error => error.status === 409);
});

test("photo command keeps immutable originals, refresh references and original receipt; stale or changed bytes roll back", async () => {
  const h = harness(), front = photo("front"), first = h.command("intake.photos", { id: repairId, revision: 1, photos: [front] });
  let saved = await h.execute(first); assert.equal(saved.intakes[0].photoCount, 1); assert.equal(saved.intakes[0].revision, 2); assert.equal(h.photos.size, 1); assert.equal(saved.operation.kind, "intake.photos");
  const preparationCount=h.preparing,decodeCount=h.decoded;h.failPhotoPreparation=true;
  const replay = await h.execute(first); assert.equal(replay.operation.replayed, true);assert.equal(h.preparing,preparationCount);assert.equal(h.decoded,decodeCount);h.failPhotoPreparation=false; assert.equal(h.photos.size, 1); assert.equal(replay.intakes[0].revision, 2);
  const replacement = photo("front"), other = photo(); saved = await h.execute(h.command("intake.photos", { id: repairId, revision: 2, photos: [replacement, other] }));
  assert.equal(h.photos.size, 3); assert.deepEqual(JSON.parse(JSON.stringify(saved.intakes[0].photos)), refs([replacement, other])); assert.deepEqual(Buffer.from(h.photos.get(repairId + ":" + front.id).bytes), jpeg);
  const changedJpeg = await sharp({ create: { width: 8, height: 6, channels: 3, background: "#ff0000" } }).jpeg().toBuffer();
  const before = JSON.stringify(h.state);
  await assert.rejects(h.execute(h.command("intake.photos", { id: repairId, revision: 3, photos: [{ ...replacement, base64: changedJpeg.toString("base64") }] })), error => error.status === 409);
  await assert.rejects(h.execute(h.command("intake.photos", { id: repairId, revision: 2, photos: [photo()] })), error => error.status === 409);
  assert.equal(JSON.stringify(h.state), before); assert.equal(h.photos.size, 3);
  h.failPhotoWrite = true; await assert.rejects(h.execute(h.command("intake.photos", { id: repairId, revision: 3, photos: [photo()] })), error => error.status === 503); assert.equal(JSON.stringify(h.state), before);
});

test("photo commands reject revoked permissions, foreign scope, unknown records, count overflow and corrupt JPEG before publishing", async () => {
  for (const permissions of [[], ["repairs.view"], ["repairs.edit"]]) { const h = harness(); h.member.permissions = permissions; await assert.rejects(h.execute(h.command("intake.photos", { id: repairId, revision: 1, photos: [photo()] })), error => error.status === 403); assert.equal(h.photos.size, 0); }
  const h = harness(), payload = { id: repairId, revision: 1, photos: [photo()] };
  await assert.rejects(h.execute(h.command("intake.photos", payload, randomUUID(), { storeId: randomUUID() })), error => error.status === 403);
  await assert.rejects(h.execute(h.command("intake.photos", { ...payload, id: "LOCAL-0000000000000002" })), error => error.status === 404);
  for (const photos of [[], Array.from({ length: 5 }, () => photo()), [photo("front"), photo("front")], [{ ...photo(), base64: "/9j/AP/Z" }], [{ ...photo(), mime: "image/png" }]]) await assert.rejects(h.execute(h.command("intake.photos", { ...payload, photos })), error => error.status === 400);
  const others = Array.from({ length: 4 }, () => photo()); h.state.intakes[0] = { ...intake(), photos: refs(others), photoCount: 4 };
  await assert.rejects(h.execute(h.command("intake.photos", payload)), error => error.status === 400); assert.equal(h.state.intakes[0].revision, 1); assert.equal(h.photos.size, 0); assert.equal(h.receipts.size, 0);
});

 test("photo preparation cannot bypass a permission change before the write transaction",async()=>{
  const h=harness();h.afterPhotoPreparation=()=>{h.member.permissions=[];};const command=h.command("intake.photos",{id:repairId,revision:1,photos:[photo()]});
  await assert.rejects(h.execute(command),error=>error.status===403);assert.equal(h.receipts.size,0);assert.equal(h.photos.size,0);assert.equal(h.state.intakes[0].revision,1);assert.equal(h.objects.size,1,"prepared immutable object remains private; no canonical reference is published");
 });
