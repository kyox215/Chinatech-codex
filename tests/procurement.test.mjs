import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

// Test the actual standalone TS domain module without adding a runtime dependency.
const source = readFileSync(new URL("../lib/procurement.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { appendProcurementEvent: append, arrivedQuantity, arrivalBalance, procurementStatus, validateProcurementDraft, formatCost, repairPartsSummary } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const draft = () => ({ id: "PO-TEST", repairId: "CT-TEST", item: "演示配件", supplier: "演示供应商", quantity: 3, unitCostCents: null, expectedAt: "", reference: "", events: [] });
const event = (id, type, quantity, extra = {}) => ({ id, type, quantity, time: "2026-09-30 10:00", note: "演示记录", ...extra });
const ordered = () => append(draft(), event("order", "ordered", 0));

test("草稿未知金额保持空值", () => { assert.equal(validateProcurementDraft(draft()).unitCostCents, null); assert.equal(formatCost(null), "待确认"); assert.equal(formatCost(0), "€0.00"); });
test("下单 → 分次到货 → 到齐", () => { let record = ordered(); assert.equal(procurementStatus(record), "ordered"); record = append(record, event("batch1", "arrival", 1)); assert.equal(procurementStatus(record), "partial"); record = append(record, event("batch2", "arrival", 2)); assert.equal(procurementStatus(record), "complete"); assert.equal(arrivedQuantity(record), 3); });
test("更正追加且不改写原到货", () => { const original = append(ordered(), event("batch1", "arrival", 2)); const corrected = append(original, event("fix1", "correction", -1, { arrivalId: "batch1" })); assert.equal(original.events.length, 2); assert.equal(original.events[1].quantity, 2); assert.equal(corrected.events.length, 3); assert.equal(arrivedQuantity(corrected), 1); assert.equal(arrivalBalance(corrected, "batch1"), 1); });
test("拒绝未下单到货与重复下单", () => { assert.throws(() => append(draft(), event("batch1", "arrival", 1))); assert.throws(() => append(ordered(), event("order2", "ordered", 0))); });
test("拒绝零数、负数、小数、超量到货", () => { for (const quantity of [0, -1, 1.5, 4, NaN, Infinity]) assert.throws(() => append(ordered(), event("bad", "arrival", quantity))); });
test("更正必须关联本采购的到货批次并填写原因", () => { const record = append(ordered(), event("batch1", "arrival", 1)); assert.throws(() => append(record, event("fix", "correction", -1, { arrivalId: "other" }))); assert.throws(() => append(record, event("fix", "correction", -1, { arrivalId: "batch1", note: " " }))); assert.throws(() => append(record, event("fix", "correction", 0, { arrivalId: "batch1" }))); });
test("累计更正不能使单批次为负或总量超限", () => { let record = append(ordered(), event("batch1", "arrival", 1)); record = append(record, event("batch2", "arrival", 2)); assert.throws(() => append(record, event("fix", "correction", -2, { arrivalId: "batch1" }))); assert.throws(() => append(record, event("fix", "correction", 1, { arrivalId: "batch1" }))); record = append(record, event("fix1", "correction", -1, { arrivalId: "batch1" })); assert.throws(() => append(record, event("fix2", "correction", -1, { arrivalId: "batch1" }))); assert.equal(procurementStatus(record), "partial"); });
test("重复事件与过期版本不追加", () => { const record = ordered(); assert.throws(() => append(record, event("order", "arrival", 1))); assert.throws(() => append(record, event("batch1", "arrival", 1), 0)); assert.equal(record.events.length, 1); });
test("草稿数量与金额边界", () => { for (const quantity of [0, -1, 1.5, 10001]) assert.throws(() => validateProcurementDraft({ ...draft(), quantity })); for (const unitCostCents of [-1, 1.5, Infinity]) assert.throws(() => validateProcurementDraft({ ...draft(), unitCostCents })); assert.throws(() => validateProcurementDraft({ ...draft(), supplier: " " })); });
test("全部误记撤销后回到等待到货，可再补到货", () => { let record = append(ordered(), event("batch1", "arrival", 3)); record = append(record, event("fix", "correction", -3, { arrivalId: "batch1" })); assert.equal(procurementStatus(record), "ordered"); record = append(record, event("batch2", "arrival", 3)); assert.equal(procurementStatus(record), "complete"); });


test("加车不是下单，不能登记到货，移出保留历史", () => {
  const original = draft();
  let record = append(original, event("cart", "cart_added", 0));
  assert.equal(procurementStatus(record), "cart");
  assert.equal(arrivedQuantity(record), 0);
  assert.equal(original.events.length, 0);
  assert.throws(() => append(record, event("arrival", "arrival", 1)));
  assert.throws(() => append(record, event("again", "cart_added", 0)));
  record = append(record, event("remove", "cart_removed", 0, { note: " " }));
  assert.equal(procurementStatus(record), "draft");
  assert.equal(record.events.length, 2);
  record = append(record, event("cart2", "cart_added", 0));
  record = append(record, event("order", "ordered", 0, { reference: " DEMO-NEW-ORDER " }));
  assert.equal(procurementStatus(record), "ordered");
  assert.equal(record.reference, "DEMO-NEW-ORDER");
  assert.equal(record.events.at(-1).reference, "DEMO-NEW-ORDER");
  assert.throws(() => append(record, event("remove2", "cart_removed", 0)));
});
test("购物车不改变到货数量；下单标记无需订单号", () => {
  assert.throws(() => append(draft(), event("cart", "cart_added", 1)));
  assert.throws(() => append(draft(), event("remove", "cart_removed", 0)));
  const marked = append(draft(), event("order", "ordered", 0));
  assert.equal(procurementStatus(marked), "ordered");
  assert.equal(marked.reference, "");
  assert.equal(arrivedQuantity(marked), 0);
  assert.equal(procurementStatus(append(draft(), event("order", "ordered", 0, { reference: " " }))), "ordered");
  assert.throws(() => append(draft(), event("order", "ordered", 1)));
  assert.throws(() => append(draft(), event("order", "ordered", 0, { reference: "x".repeat(101) })));
  assert.throws(() => append(draft(), event("unknown", "unknown", 0)));
});
test("工单分组按必需配件聚合，部分下单不冒充全部下单", () => {
  let first = draft();
  let second = { ...draft(), id: "PO-SECOND" };
  const other = { ...ordered(), id: "PO-OTHER", repairId: "CT-OTHER" };
  const optional = { ...draft(), id: "PO-OPTIONAL", required: false };
  assert.equal(repairPartsSummary([optional, other], "CT-TEST").group, "unrecorded");
  first = append(first, event("cart1", "cart_added", 0));
  assert.equal(repairPartsSummary([first, second], "CT-TEST").group, "draft");
  second = append(second, event("cart2", "cart_added", 0));
  assert.equal(repairPartsSummary([first, second], "CT-TEST").group, "cart");
  first = append(first, event("order1", "ordered", 0));
  let summary = repairPartsSummary([first, second, other, optional], "CT-TEST");
  assert.equal(summary.group, "mixed"); assert.equal(summary.ordered, 3); assert.equal(summary.total, 6);
  second = append(second, event("order2", "ordered", 0));
  summary = repairPartsSummary([first, second, optional], "CT-TEST");
  assert.equal(summary.group, "ordered"); assert.equal(summary.ordered, 6);
  first = append(first, event("arrive1", "arrival", 3));
  assert.equal(repairPartsSummary([first, second], "CT-TEST").group, "ordered");
  second = append(second, event("arrive2", "arrival", 3));
  assert.equal(repairPartsSummary([first, second, optional], "CT-TEST").group, "complete");
  second = append(second, event("fix", "correction", -1, { arrivalId: "arrive2" }));
  assert.equal(repairPartsSummary([first, second], "CT-TEST").group, "ordered");
});
