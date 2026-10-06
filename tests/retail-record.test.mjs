import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const cache = new Map();
function mod(name) {
  if (cache.has(name)) return cache.get(name);
  let code = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const m of [...code.matchAll(/from "\.\/([^";]+)"/g)]) code = code.replace(m[0], `from ${JSON.stringify(mod(m[1]))}`);
  const url = "data:text/javascript;base64," + Buffer.from(code).toString("base64"); cache.set(name, url); return url;
}
const { historyDisplayUnit, initialRecordPreparation, prepareRetailRecord, parsePreviewRetailHistory } = await import(mod("retail-record"));
const { parseStoredRetailUnits, createRetailUnit, applyRetailCommand } = await import(mod("retail"));
const { buildRetailListIndex } = await import(mod("retail-list-model"));
const record = { id: "00000000-0000-5000-8000-000000000051", source: "seatable", sourceSnapshot: "a".repeat(64), sourceRow: 52, sourceStatus: "在售", condition: "翻新机", customerName: "Synthetic original", customerPhone: "+393200000001", category: "手机", brand: "Apple", model: "Synthetic source phone", color: "NERO", memory: "8+128GB", paymentMethod: null, askingPriceCents: 22000, salePriceCents: null, depositCents: null, costCents: 0, notes: "Synthetic original internal cost note", batteryPercent: 0, identifier: "1234567890123456", intakeAt: "2026-09-02T09:00:00Z", pickupDate: null, sourceUpdatedAt: "2026-09-03T10:00:00Z", importedAt: "2026-10-02T10:00:00Z", reviewReasons: ["Synthetic identity needs checking"] };
const event = { id: "synthetic-prepare", title: "商品资料已核对", detail: "Synthetic evidence", time: "2026-10-06 12:00:00" };
const draft = extra => ({ ...initialRecordPreparation(record), storeOwned: true, ...extra });

test("展示原行不制造实物身份、存储、检测、销售或打印约定", () => {
  const before = JSON.stringify(record); const unit = historyDisplayUnit(record);
  assert.equal(unit.id, record.id); assert.equal(unit.code, "ST-0051"); assert.equal(unit.storeOwned, false);
  assert.equal(unit.imei1, ""); assert.equal(unit.serial, ""); assert.equal(unit.bodyStorage, null); assert.equal(unit.ramGb, null);
  assert.equal(unit.warrantyMonths, null); assert.equal(unit.batteryPercent, 0); assert.deepEqual(unit.events, []); assert.deepEqual(unit.sales, []);
  assert.deepEqual(unit.inspection, { functional: false, ownership: false, data: false }); assert.equal(JSON.stringify(record), before);
});
test("明确核对保留原ID编号成本日期，不覆盖原买家或制造销售", () => {
  const before = JSON.stringify(record); const unit = prepareRetailRecord(record, draft(), 12, event, []);
  assert.equal(unit.id, record.id); assert.equal(unit.code, "ST-0051"); assert.equal(unit.costCents, 0); assert.equal(unit.refurbCents, null);
  assert.equal(unit.priceCents, 22000); assert.equal(unit.intakeDate, "2026-09-02"); assert.equal(unit.status, "inspecting");
  assert.deepEqual(unit.historyOrigin, { recordId: record.id, sourceSnapshot: record.sourceSnapshot }); assert.deepEqual(unit.sales, []);
  assert.equal(JSON.stringify(record), before); assert.deepEqual(parseStoredRetailUnits(JSON.stringify({ version: 1, units: [unit] }), []), [unit]);
});
test("原在售和三项保存均不替代明确设为可售", () => {
  const partial = draft({ checks: { functional: true, ownership: false, data: true } });
  assert.equal(prepareRetailRecord(record, partial, 12, event, []).status, "inspecting");
  const complete = draft({ checks: { functional: true, ownership: true, data: true } });
  const unit = prepareRetailRecord(record, complete, 12, event, []); assert.equal(unit.status, "inspecting"); assert.equal(unit.version, 1); assert.equal(unit.events.length, 1);
  const approved = applyRetailCommand(unit, { type: "approve" }, { ...event, id: "explicit-approve" }, unit.version, []); assert.equal(approved.status, "available"); assert.equal(unit.status, "inspecting");
  for (const askingPriceCents of [null, 0]) assert.equal(prepareRetailRecord({ ...record, askingPriceCents }, complete, 12, event, []).status, "inspecting");
});
test("只按明确原关联替代列表一行，不按相同型号或识别码合并", () => {
  const another = { ...record, id: "00000000-0000-5000-8000-000000000052", sourceRow: 53 };
  const unit = prepareRetailRecord(record, draft(), 12, event, []);
  const index = buildRetailListIndex([unit], [record, another]); assert.equal(index.length, 2);
  assert.equal(index.filter(item => item.id === record.id).length, 1); assert.equal(index.find(item => item.id === record.id).identifier, record.identifier);
  assert.equal(index.find(item => item.id === record.id).specification, record.memory);
  assert.equal(index.find(item => item.id === record.id).reviewCount, record.reviewReasons.length);
  for (const value of [record.identifier, record.memory, record.customerPhone, record.customerName]) assert.ok(index.find(item => item.id === record.id).search.includes(value.toLowerCase()));
});
test("已售原行、重复准备、未确认在店自有实物均拒绝且无写入", () => {
  for (const sourceStatus of ["已售", "以售"]) assert.throws(() => prepareRetailRecord({ ...record, sourceStatus }, draft(), 12, event, []), /保留历史/);
  assert.throws(() => prepareRetailRecord(record, draft({ storeOwned: false }), 12, event, []), /当前在店/);
  const unit = prepareRetailRecord(record, draft(), 12, event, []); assert.throws(() => prepareRetailRecord(record, draft(), 12, event, [unit]), /已保存/);
});
test("金额和关联不能由草稿伪造，未知类别与错误识别码不静默补齐", () => {
  assert.throws(() => prepareRetailRecord(record, { ...draft(), costCents: 1 }, 12, event, []), /核对商品/);
  assert.throws(() => prepareRetailRecord(record, draft({ category: "" }), 12, event, []), /核对商品/);
  for (const category of [["phone"], {}, null, 1]) assert.throws(() => prepareRetailRecord(record, draft({ category }), 12, event, []), /核对商品/);
  assert.equal(initialRecordPreparation({ ...record, category: "电脑" }).category, "");
  assert.throws(() => prepareRetailRecord(record, draft({ identifier: "changed" }), 12, event, []), /保留原文/);
  assert.throws(() => prepareRetailRecord(record, draft({ identifierKind: "imei" }), 12, event, []), /15 位/);
  const unit = prepareRetailRecord(record, draft({ identifierKind: "imei", identifier: "000000000000051" }), 12, event, []); assert.equal(unit.imei1, "000000000000051");
  assert.throws(() => prepareRetailRecord(record, draft({ identifierKind: "imei", identifier: "000000000000051", category: "desktop" }), 12, event, []), /手机或平板/);
});
test("原关联不能劫持另一原行或经普通新建注入", () => {
  const unit = prepareRetailRecord(record, draft(), 12, event, []);
  for (const historyOrigin of [{ ...unit.historyOrigin, recordId: "00000000-0000-5000-8000-000000000052" }, { ...unit.historyOrigin, sourceSnapshot: "fake" }, { ...unit.historyOrigin, costCents: 0 }]) assert.throws(() => parseStoredRetailUnits(JSON.stringify({ version: 1, units: [{ ...unit, historyOrigin }] }), []), /关联无效/);
  assert.throws(() => createRetailUnit(unit, [], event), /原档案/);
});
test("合成原资料预览按同一验证边界读取，坏格式与重复ID拒绝", () => {
  assert.deepEqual(parsePreviewRetailHistory(null), []); assert.deepEqual(parsePreviewRetailHistory(JSON.stringify({ version: 1, records: [record] })), [record]);
  assert.throws(() => parsePreviewRetailHistory(JSON.stringify({ version: 1, records: [record, record] })), /编号重复/);
  assert.throws(() => parsePreviewRetailHistory(JSON.stringify({ version: 2, records: [record] })), /无法读取/);
});
