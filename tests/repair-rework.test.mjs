import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const urls = new Map();
const overrides = {
  "lib/backend/client": 'export const isBackendClient=()=>false,backendSnapshot=()=>null,subscribeBackend=()=>()=>{};export function backendCommand(){throw new Error("Unexpected backend call");}',
  "lib/staff-client": 'export function requirePreviewPermission(){return globalThis.__repairReworkActor();}',
};
function moduleUrl(name) {
  if (urls.has(name)) return urls.get(name);
  let code = overrides[name] ?? ts.transpileModule(readFileSync(new URL(`../${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  code = code.replace(/import \{[^}]+\} from "react";/g, 'const useSyncExternalStore=(_subscribe,getSnapshot)=>getSnapshot();');
  code = code.replace(/from "(@\/lib\/[^\"]+|\.\.?\/[^\"]+)"/g, (_match, dependency) => {
    const key = dependency.startsWith("@/") ? dependency.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(name), dependency));
    return `from "${moduleUrl(key)}"`;
  });
  const url = "data:text/javascript;base64," + Buffer.from(code + `\n//# sourceURL=${name}.js`).toString("base64");
  urls.set(name, url); return url;
}
const record = await import(moduleUrl("lib/repair-intake-record"));
const { buildRepairRework, canCreateRepairRework, repairOriginForSave, validateRepairReworkInput } = await import(moduleUrl("lib/repair-rework"));
const { initialRepairWorkflow, applyWorkflowCommand } = await import(moduleUrl("lib/repair-workflow"));
const { emptyIntakeServices } = await import(moduleUrl("lib/intake-services"));
const store = await import(moduleUrl("components/repairs/local-intake-store"));
const { repairOrders } = await import(moduleUrl("lib/repair-fixtures"));
const policy = { months: 6, shopName: "Current local store", address: "Current address", phone: "0000000" };
const time = "2026-10-05 14:00:00";
const source = {
  id: "LOCAL-AAAAAAAAAAAAAAAA", revision: 3, createdAt: "2026-10-01 10:00:00", updatedAt: "2026-10-04 12:00:00", previewAt: "2026-10-01 10:00:00",
  customerName: "Synthetic customer", phone: "+393330000101", email: "", category: "手机", brand: "Apple", model: "Synthetic phone", color: "蓝色", serial: "DEMO-REWORK-DEVICE",
  issue: "屏幕：碎裂", accessories: ["SIM 卡托"], services: { screen: { quality: "assembled", technology: "oled" }, battery: { quality: "", appleService: "" }, port: { quality: "" } }, priority: "紧急", photoCount: 1,
  itemQuotes: [{ item: "屏幕", amountCents: 10000 }], itemQuoteHistory: [], policy: { ...policy, months: 12, shopName: "Original policy" },
};
const input = { sourceId: source.id, sourceRevision: 3, workflowRevision: 0, repairId: "LOCAL-BBBBBBBBBBBBBBBB", reason: "  维修后再次出现触摸失灵  ", custody: "store" };
const completed = { ...initialRepairWorkflow(record.intakeDirectoryEntry(source)), status: "completed" };
function browserSetup(workflow = completed, records = [source], signatures = []) {
  const values = new Map([
    ["chinatech.m1.local-intakes.v1", JSON.stringify({ version: 1, records, signatures })],
    ["chinatech.m1.repair-workflow.v1", JSON.stringify({ version: 1, workflows: { [source.id]: workflow } })],
    ["chinatech.m1.store-settings.v1", JSON.stringify({ version: 1, settings: { ...policy, revision: 0, repairWarrantyMonths: policy.months, retailWarrantyMonths: 12, suppliers: [], finance: [], paper: "a4" } })],
  ]);
  const browser = new EventTarget(); let denyWrite = false, changes = 0;
  browser.localStorage = { getItem: key => values.get(key) ?? null, setItem(key, value) { if (denyWrite) throw new Error("quota"); values.set(key, value); } };
  browser.addEventListener("chinatech-local-intake-change", () => changes++);
  globalThis.window = browser;
  globalThis.__repairReworkActor = () => ({ id: "synthetic-owner" });
  return { values, denyWrite(value) { denyWrite = value; }, changes: () => changes, raw: () => values.get("chinatech.m1.local-intakes.v1"), records: () => record.parseLocalIntakes(values.get("chinatech.m1.local-intakes.v1")) };
}

test("返修关联严格校验并进入共享目录，不把销售来源当返修", () => {
  const data = { ...source, repairOrigin: { repairId: "ORIGINAL-1", reason: "再次送回" } };
  assert.equal(record.validLocalIntake(data), true);
  assert.deepEqual(record.intakeDirectoryEntry(data).repairOrigin, data.repairOrigin);
  for (const repairOrigin of [{ repairId: source.id, reason: "再次送回" }, { repairId: "old", reason: " " }, { repairId: "old", reason: "x".repeat(2001) }, { repairId: "old", reason: "again", trusted: true }]) assert.equal(record.validLocalIntake({ ...source, repairOrigin }), false);
  assert.equal(record.validLocalIntake({ ...data, retailOrigin: { unitId: "unit", saleId: "sale", caseId: "case" } }), false);
});

test("独立返修只复制原客和设备，本次约定清空并冻结当前默认政策", () => {
  const before = structuredClone(source);
  const data = buildRepairRework(input, { ...source, retailOrigin: { unitId: "sold", saleId: "sale", caseId: "case" } }, completed, policy, time);
  for (const key of ["customerName", "phone", "email", "category", "brand", "model", "color", "serial"]) assert.equal(data[key], source[key]);
  assert.deepEqual(data.repairOrigin, { repairId: source.id, reason: input.reason.trim() });
  assert.equal(data.issue, input.reason.trim()); assert.equal(data.id, input.repairId); assert.equal(data.revision, 1);
  assert.equal(data.createdAt, time); assert.equal(data.updatedAt, time); assert.deepEqual(data.policy, policy);
  assert.deepEqual(data.services, emptyIntakeServices); assert.deepEqual(data.accessories, []); assert.equal(data.priority, "普通"); assert.equal(data.photoCount, 0);
  for (const key of ["retailOrigin", "itemQuotes", "itemQuoteHistory", "photos", "faults", "issueNote"]) assert.equal(Object.hasOwn(data, key), false);
  assert.deepEqual(source, before);
  data.policy.shopName = "Changed"; assert.equal(policy.shopName, "Current local store");
});

test("来源资格只接受结束或本轮明确交还，保管/签名/寄修不代替", () => {
  assert.equal(canCreateRepairRework(completed), true);
  for (const status of ["diagnosis", "outsourced", "ready", "ready_notified", "cancelled", "collected_unpaid"]) assert.equal(canCreateRepairRework({ ...completed, status, custody: "customer" }), false);
  const handed = { ...completed, status: "ready", handedOver: { time, unpaid: true }, events: [{ id: "handover", type: "followup", time, label: "欠款已拿走：已记录", note: "Synthetic" }], revision: 1 };
  assert.equal(canCreateRepairRework(handed), true);
  assert.equal(canCreateRepairRework({ ...handed, events: [...handed.events, { id: "recover", type: "stage", time, label: "维修阶段：维修中", note: "Explicit recovery" }], status: "repairing", revision: 2 }), false);
});

test("返修输入保护两个打开时版本，拒绝伪造事实和不存在来源", () => {
  for (const changed of [{ sourceRevision: 2 }, { workflowRevision: 1 }]) assert.throws(() => buildRepairRework({ ...input, ...changed }, source, completed, policy, time), error => error.status === 409);
  assert.throws(() => buildRepairRework(input, undefined, completed, policy, time), error => error.status === 404);
  assert.throws(() => buildRepairRework(input, source, { ...completed, status: "ready", custody: "customer" }, policy, time), error => error.status === 409);
  for (const changed of [{ customerName: "Forged" }, { sourceId: input.repairId }, { repairId: "BAD" }, { reason: " " }, { sourceRevision: -1 }, { workflowRevision: 0.5 }, { custody: "unknown" }]) assert.throws(() => validateRepairReworkInput({ ...input, ...changed }));
});

test("普通保存不可新增/改写返修来源，旧客户端省略仍保留", () => {
  const previous = buildRepairRework(input, source, completed, policy, time);
  const draft = structuredClone(previous); delete draft.repairOrigin;
  assert.deepEqual(repairOriginForSave(draft, previous), previous.repairOrigin);
  assert.deepEqual(repairOriginForSave(previous, previous), previous.repairOrigin);
  assert.throws(() => repairOriginForSave(previous));
  assert.throws(() => repairOriginForSave({ ...previous, repairOrigin: { ...previous.repairOrigin, reason: "changed" } }, previous));
  assert.throws(() => repairOriginForSave({ ...previous, repairOrigin: { repairId: "other", reason: previous.repairOrigin.reason } }, previous));
});

test("预览返修一次写入并幂等恢复，同编号换内容拒绝，原单不变", async () => {
  const env = browserSetup(), before = env.records()[0];
  assert.equal(await store.createRepairRework(input), input.repairId);
  assert.equal(env.records().length, 2); assert.deepEqual(env.records()[0], before); assert.equal(env.changes(), 1);
  const saved = env.raw(); assert.equal(await store.createRepairRework(input), input.repairId); assert.equal(env.raw(), saved); assert.equal(env.changes(), 1);
  for (const changed of [{ reason: "different" }, { sourceRevision: 2 }, { custody: "customer" }, { sourceId: "other" }]) await assert.rejects(store.createRepairRework({ ...input, ...changed }));
  assert.equal(env.raw(), saved);
});

test("预览资格/两版本/身份变化/坏存储及容量失败均不发布成功", async () => {
  for (const [workflow, changed] of [[{ ...completed, status: "diagnosis", custody: "customer" }, {}], [completed, { sourceRevision: 2 }], [completed, { workflowRevision: 1 }], [completed, { sourceId: "missing" }]]) {
    const env = browserSetup(workflow), before = env.raw();
    await assert.rejects(store.createRepairRework({ ...input, ...changed })); assert.equal(env.raw(), before); assert.equal(env.changes(), 0);
  }
  const env = browserSetup(), before = env.raw(); env.denyWrite(true);
  await assert.rejects(store.createRepairRework(input), /本地保存失败/); assert.equal(env.raw(), before); assert.equal(env.changes(), 0); env.denyWrite(false);
  let calls = 0; globalThis.__repairReworkActor = () => ({ id: ++calls === 1 ? "synthetic-owner" : "other-actor" });
  await assert.rejects(store.createRepairRework(input), /身份已变化/); assert.equal(env.raw(), before); assert.equal(env.changes(), 0);
  globalThis.__repairReworkActor = () => { throw new Error("无操作权限"); };
  await assert.rejects(store.createRepairRework(input), /无操作权限/); assert.equal(env.raw(), before);
  const corrupted = browserSetup(); corrupted.values.set("chinatech.m1.local-intakes.v1", "{broken");
  await assert.rejects(store.createRepairRework(input)); assert.equal(corrupted.raw(), "{broken"); assert.equal(corrupted.changes(), 0);
  const full = browserSetup(completed, Array.from({ length: 100 }, (_, index) => ({ ...source, id: index ? `LOCAL-${index.toString(16).padStart(16, "0").toUpperCase()}` : source.id }))), fullBefore = full.raw();
  await assert.rejects(store.createRepairRework(input)); assert.equal(full.raw(), fullBefore); assert.equal(full.changes(), 0);
});

test("预览旧客户端更正不擦来源或提交回执，重试仍能恢复原新单", async () => {
  const env = browserSetup(); await store.createRepairRework(input);
  const current = env.records().find(row => row.id === input.repairId), draft = { ...current, issue: "本次追加说明" }; delete draft.repairOrigin;
  const saved = store.saveLocalIntake(draft, 1);
  assert.deepEqual(saved.repairOrigin, current.repairOrigin); assert.equal(env.records()[1].issue, "本次追加说明");
  assert.equal(await store.createRepairRework(input), input.repairId); assert.equal(env.records().length, 2);
  assert.throws(() => store.saveLocalIntake({ ...saved, repairOrigin: { ...saved.repairOrigin, reason: "Forged" } }, 2));
  assert.throws(() => store.saveLocalIntake({ ...source, id: "LOCAL-CCCCCCCCCCCCCCCC", repairOrigin: current.repairOrigin }, 0));
});

test("预览fixture来源使用已保存工作流，结束来源和版本与目录一致", async () => {
  const fixture = repairOrders[0]; assert.ok(fixture);
  const env = browserSetup(completed, []);
  const workflow = applyWorkflowCommand(initialRepairWorkflow(fixture), { type: "stage", status: "completed", note: "Synthetic completion" }, { id: "fixture-completed", time }, [], fixture.id, 0, fixture);
  env.values.set("chinatech.m1.repair-workflow.v1", JSON.stringify({ version: 1, workflows: { [fixture.id]: workflow } }));
  const fixtureInput = { ...input, sourceId: fixture.id, sourceRevision: 1, workflowRevision: 1 };
  assert.equal(await store.createRepairRework(fixtureInput), fixtureInput.repairId);
  assert.equal(env.records()[0].repairOrigin.repairId, fixture.id);
});
