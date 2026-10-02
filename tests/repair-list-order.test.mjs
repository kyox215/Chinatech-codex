import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/repair-list-order.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { compareRepairUpdates, repairUpdatedAt, recordRepairUpdate } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const orders = [
  { id: "A", createdAt: "2026-09-29 09:00", updatedAt: "2026-09-30 08:00:00" },
  { id: "B", createdAt: "2026-09-27 09:00", updatedAt: "2026-09-30 09:00:00" },
  { id: "C", createdAt: "2026-09-28 09:00", updatedAt: "2026-09-30 07:00:00" },
];
const sorted = (rows, updates = {}) => rows.toSorted((a, b) => compareRepairUpdates(a, b, updates)).map((row) => row.id);

test("最后更新升序，最新在底部；不是按建单新旧倒序", () => {
  assert.deepEqual(sorted(orders), ["C", "A", "B"]);
  assert.equal(repairUpdatedAt(orders[0], {}), orders[0].updatedAt);
});
test("关联采购的本次修改移至底部，保留其他工单和原建单时间", () => {
  const before = { B: "2026-09-30 09:02:00" };
  const after = recordRepairUpdate(before, "C", "2026-09-30 10:00:00");
  assert.deepEqual(sorted(orders, after), ["A", "B", "C"]);
  assert.deepEqual(before, { B: "2026-09-30 09:02:00" });
  assert.equal(after.B, before.B);
  assert.equal(orders[2].createdAt, "2026-09-28 09:00");
});
test("同更新时间先按建单时间，再按编号确定稳定次序", () => {
  const rows = orders.map((row) => ({ ...row, updatedAt: "2026-09-30 10:00:00" }));
  assert.deepEqual(sorted(rows), ["B", "C", "A"]);
  assert.deepEqual(sorted([{ ...rows[0], id: "Z" }, { ...rows[0], id: "D" }]), ["D", "Z"]);
});

test("较早采购更新时间不能覆盖之后的维修阶段更新时间", () => { assert.equal(repairUpdatedAt({ id: "A", updatedAt: "2026-10-01 10:00:00" }, { A: "2026-10-01 09:00:00" }), "2026-10-01 10:00:00"); });
