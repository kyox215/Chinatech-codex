import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/repair-list-view-state.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function harness() {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; }, removeItem: () => { raw = null; } };
  const context = createContext({ exports: {} });
  runInContext(compiled, context);
  return { ...context.exports, storage, raw: () => raw, setRaw: value => { raw = value; } };
}
const member = { id: "MEMBER-A", name: "DEMO", email: "demo@example.test", role: "viewer", accountStatus: "active", membershipStatus: "active", permissions: ["repairs.view", "customers.view"], revision: 2 };
const view = { query: "DEMO 客户 123456789", status: "awaiting_parts", partsFilter: "ordered", groupBy: "parts", sort: "priority", filtersOpen: true, openGroups: { ordered: true, cart: false }, scrollY: 740, scrollLeft: 310 };
const snapshot = value => JSON.parse(JSON.stringify(value));

test("同scope恢复搜索、筛选、排序、分组和滚动；持久化只保存视图和ID", () => {
  const h = harness();
  const scope = h.repairListViewScope({ mode: "backend", storeId: "STORE-A", member, accountId: "ACCOUNT-A" });
  assert.equal(h.readRepairListView(scope, h.storage), null);
  assert.equal(h.writeRepairListView(scope, { ...view, customer: { phone: "SECRET" } }, h.storage), true);
  assert.deepEqual(snapshot(h.readRepairListView(scope, h.storage)), view);
  assert.equal(h.raw().includes("DEMO 客户"), false);
  assert.equal(h.raw().includes("123456789"), false);
  assert.equal(h.raw().includes("SECRET"), false);
  assert.equal(h.raw().includes('"query"'), false);
  const cold = harness(); cold.setRaw(h.raw());
  assert.deepEqual(snapshot(cold.readRepairListView(scope, cold.storage)), { ...view, query: "" });
});

test("按身份、成员revision、门店、权限及运行模式隔离；旧scope不复活", () => {
  const h = harness();
  const input = { mode: "backend", storeId: "STORE-A", member, accountId: "ACCOUNT-A" };
  const scope = h.repairListViewScope(input);
  const variants = [
    { ...input, accountId: "ACCOUNT-B" }, { ...input, storeId: "STORE-B" }, { ...input, mode: "preview" },
    { ...input, member: { ...member, id: "MEMBER-B" } }, { ...input, member: { ...member, revision: 3 } },
    { ...input, member: { ...member, permissions: ["repairs.view"] } },
  ];
  for (const variant of variants) {
    h.writeRepairListView(scope, view, h.storage);
    const next = h.repairListViewScope(variant);
    assert.notEqual(next, scope);
    assert.equal(h.readRepairListView(next, h.storage), null);
    assert.equal(h.readRepairListView(scope, h.storage), null);
    assert.equal(h.raw(), null);
  }
  assert.equal(h.repairListViewScope({ ...input, member: { ...member, permissions: [...member.permissions].reverse() } }), scope);
  for (const change of [{ accountStatus: "disabled" }, { membershipStatus: "pending" }, { permissions: [] }, { revision: 0 }]) {
    assert.equal(h.repairListViewScope({ ...input, member: { ...member, ...change } }), null);
  }
  h.writeRepairListView(scope, view, h.storage);
  assert.equal(h.readRepairListView(null, h.storage), null);
  assert.equal(h.readRepairListView(scope, h.storage), null);
});

test("坏缓存、未知过滤值和非法滚动位置不崩溃、不应用", () => {
  for (const raw of ["not json", "null", JSON.stringify({ version: 2, scope: "S", view }), JSON.stringify({ version: 1, scope: "OTHER", view }),
    ...[{ status: "guessed" }, { partsFilter: "invalid" }, { groupBy: "invalid" }, { sort: "invalid" }, { filtersOpen: "yes" },
      { openGroups: { __proto__: null, UNKNOWN: true } }, { openGroups: { cart: "yes" } }, { scrollY: -1 }, { scrollLeft: "10" }]
      .map(change => JSON.stringify({ version: 1, scope: "S", view: { ...view, ...change } }))]) {
    const h = harness(); h.setRaw(raw);
    assert.equal(h.readRepairListView("S", h.storage), null);
  }
});

test("存储拒绝和容量失败仍允许同标签内存恢复，身份改变清理旧搜索", () => {
  const h = harness();
  const forbidden = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("denied"); } };
  assert.equal(h.readRepairListView("S", forbidden), null);
  assert.equal(h.writeRepairListView("S", view, forbidden), false);
  assert.deepEqual(snapshot(h.readRepairListView("S", forbidden)), view);
  assert.equal(h.readRepairListView("OTHER", forbidden), null);
  assert.equal(h.readRepairListView("S", forbidden), null);
});

test("位置恢复等两帧与布局可达，当前scope改变或用户输入立即停止", () => {
  const frames = new Map(), listeners = new Map(); let next = 0, maxY = 0, current = true;
  const window = { scrollY: 0, scrollTo: ({ top }) => { window.scrollY = Math.min(top, maxY); },
    addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener: type => listeners.delete(type) };
  const context = createContext({ exports: {}, window, requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id) });
  runInContext(compiled, context);
  function frame() { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(); }
  const table = { scrollLeft: 0 };
  let finished = 0;
  const cleanup = context.exports.restoreRepairListPosition(view, table, () => current, () => { finished++; });
  frame(); assert.equal(window.scrollY, 0); assert.equal(table.scrollLeft, 0);
  frame(); assert.equal(table.scrollLeft, 310); assert.equal(window.scrollY, 0);
  maxY = 1000; frame(); assert.equal(window.scrollY, 740); assert.equal(frames.size, 0);
  assert.equal(listeners.size, 0);
  cleanup(); assert.equal(finished, 1);
  window.scrollY = 0; current = false;
  context.exports.restoreRepairListPosition(view, table, () => current, () => { finished++; }); frame(); frame(); assert.equal(window.scrollY, 0); assert.equal(finished, 2);
  current = true; context.exports.restoreRepairListPosition(view, table, () => current, () => { finished++; }); listeners.get("pointerdown")(); frame(); assert.equal(window.scrollY, 0); assert.equal(finished, 3);
  assert.equal(frames.size, 0); assert.equal(listeners.size, 0);
});

test("新增维修阶段分组的展开状态在刷新后保留", () => {
  const h = harness();const openGroups={diagnosis:true,awaiting_quote:true,awaiting_parts:false,testing:true};
  assert.equal(h.writeRepairListView('STAGE-SCOPE',{...view,groupBy:'workflow',openGroups},h.storage),true);
  const cold=harness();cold.setRaw(h.raw());
  assert.deepEqual(snapshot(cold.readRepairListView('STAGE-SCOPE',cold.storage).openGroups),openGroups);
});


test("日常/历史/全部及取机通知筛选持久恢复，非法范围拒绝",()=>{
 for(const scope of ['active','history','all']) {const h=harness();const value={...view,view:scope,noticeFilter:'notified',status:'handover',openGroups:{rework:true,history:false}};assert.equal(h.writeRepairListView('NEW',value,h.storage),true);const cold=harness();cold.setRaw(h.raw());assert.deepEqual(snapshot(cold.readRepairListView('NEW',cold.storage)),{...value,query:''});}
 for(const change of [{view:'invented'},{noticeFilter:'unreachable'}]){const h=harness();h.setRaw(JSON.stringify({version:1,scope:'S',view:{...view,...change}}));assert.equal(h.readRepairListView('S',h.storage),null);}
});
