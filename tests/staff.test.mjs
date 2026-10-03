import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

// Load the actual TypeScript modules and stores, with only React rendering stubbed.
const modules = new Map();
const dataUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = path => ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.React } }).outputText;
function library(name) {
  if (modules.has(name)) return modules.get(name);
  const code = compile(`lib/${name}.ts`).replace(/from "\.\/([^"]+)"/g, (_, dep) => `from "${library([...name.split("/").slice(0,-1),dep].join("/"))}"`);
  const url = dataUrl(code); modules.set(name, url); return url;
}
let instance = 0;
async function store(path, ssr = false) {
  let code = compile(path).replace(/import \{[^}]+\} from "react";/g, `let captured; const React = {createElement(type, props) {captured = props; return null;}}; const createContext = () => ({Provider: "provider"}); const useContext = () => null; const useMemo = fn => fn(); const useSyncExternalStore = (subscribe, read, server) => ${ssr ? "server()" : "read()"}; const useReducer = (reducer, initial) => [initial, action => Object.assign(initial, reducer(initial, action))];`);
  code = code.replace(/import \{ useStaff \} from "@\/components\/staff\/use-staff";/g, `import { readStaffSnapshot, staffServerSnapshot } from "@/lib/staff-client";const useStaff=()=>${ssr?"staffServerSnapshot":"readStaffSnapshot()"};`);
  code = code.replace(/import \{[^}]+\} from "@\/lib\/backend\/react";/g, "const useBackendState=()=>null;const useBackendMode=()=>false;");
 code = code.replace(/import \{ (RetailContext|ProcurementContext) \} from "@\/components\/backend-domain-context";/g,(_,name)=>`const ${name}={Provider:"provider"};`);
  code = code.replace(/from "@\/lib\/([^"]+)"/g, (_, dep) => `from "${library(dep)}"`);
  code = code.replace('from "./repair-workflow-store"', `from "${dataUrl("export function useRepairWorkflows() { return {workflows:{}}; }")}"`);
  const tail = path.includes("retail-provider") ? "export function contextUnderTest() { RetailProvider({children:null}); return captured.value; }" : "";
  return import(dataUrl(`${code}\n${tail}\n// instance ${instance++}`));
}
const staff = await import(library("staff"));
const client = await import(library("staff-client"));
const access = await import(library("retail-access"));
const retail = await import(library("retail"));
const time = "2026-10-01 12:00:00";
const defaults = () => structuredClone(staff.defaultStaffData);
const member = role => defaults().members.find(value => value.role === role);
const staffRaw = data => JSON.stringify({ version: 1, data });
const retailRaw = units => JSON.stringify({ version: 1, units });
const event = (id, extra = {}) => ({ id, title: "DEMO 测试", detail: "虚构规则核对", time, ...extra });
function soldUnit() {
  const unit = { ...retail.emptyRetailUnit(), id: "DEMO-UNIT", code: "DEMO-CODE", brand: "Apple", model: "DEMO 手机", storeOwned: true, status: "available", costCents: 13579, refurbCents: 1234, priceCents: 26000, inspection: { functional: true, ownership: true, data: true } };
  return retail.applyRetailCommand(unit, { type: "sell", saleId: "DEMO-SALE", customerPhone: "320 000 1019", customerName: "DEMO", customerEmail: "demo@example.test", priceCents: 26000, paymentUnreceived: true, warranty: { months: unit.warrantyMonths, termsVersion: retail.retailWarrantyTermsVersion, shopName: "DEMO", address: "DEMO", phone: "DEMO" } }, event("sale"), 1);
}
function afterSaleUnit(custody = "left") {
  const sold = soldUnit();
  return retail.applyRetailCommand(sold, { type: "after_sale", saleId: "DEMO-SALE", caseId: "case-with-no-hex", date: "2026-10-01", custody, issue: "DEMO 本次故障" }, event("case"), sold.version);
}
function browser(entries = {}) {
  const window = new EventTarget(); const saved = new Map(Object.entries(entries));
  window.failWriteKey = null; window.failReadKey = null; window.onRead = null;
  window.localStorage = { getItem(key) { if (window.failReadKey === key) throw new Error("read denied"); window.onRead?.(key); return saved.get(key) ?? null; }, setItem(key, raw) { if (window.failWriteKey === key) throw new Error("quota"); saved.set(key, raw); } };
  window.saved = key => saved.get(key) ?? null;
  return window;
}
async function withBrowser(value, run) {
  const previous = globalThis.window; globalThis.window = value; client.resetStaffModuleForTests();
  try { await run(); } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; client.resetStaffModuleForTests(); }
}

test("账号与门店成员双有效且身份已知才允许读写；角色模板不授予额外敏感能力", () => {
  const owner = member("owner");
  for (const denied of [null, undefined, { ...owner, role: "unknown" }, { ...owner, permissions: undefined }, ...["pending", "disabled"].flatMap(status => [{ ...owner, accountStatus: status }, { ...owner, membershipStatus: status }])]) {
    for (const permission of staff.allPermissions) assert.equal(staff.can(denied, permission), false);
    assert.deepEqual(access.projectRetailForStaff([soldUnit()], denied), []);
  }
  for (const role of ["manager", "sales", "technician", "viewer"]) {
    assert.equal(staff.can(member(role), "financial.read"), false);
    assert.equal(staff.can(member(role), "sale.refund"), false);
    assert.equal(staff.can(member(role), "staff.manage"), false);
  }
  assert.equal(staff.can(owner, "financial.read"), true);
  assert.equal(staff.can(owner, "not.a.permission"), false);
});

test("普通员工投影移除当前和每次销售成本、财务历史；未知利润不计算，原数据未改", () => {
  const raw = soldUnit();
  raw.events.push(event("legacy-cost", { title: "更正入库成本", detail: "从 €135.79 到 €145.79" }), event("financial", { title: "核对", detail: "秘密 24680", sensitive: "financial" }));
  const original = structuredClone(raw);
  const projected = access.projectRetailForStaff([raw], member("sales"))[0];
  assert.equal(projected.costCents, null); assert.equal(projected.refurbCents, null);
  assert.equal(Object.hasOwn(projected.sales[0], "costCents"), false); assert.equal(Object.hasOwn(projected.sales[0], "refurbCents"), false);
  assert.equal(retail.retailSaleGrossProfit(projected.sales[0]), null);
  assert.doesNotMatch(JSON.stringify(projected), /13579|145\.79|1234|24680/);
  assert.equal(projected.priceCents, 26000); assert.equal(projected.sales[0].priceCents, 26000);
  assert.deepEqual(raw, original);
  assert.equal(access.projectRetailForStaff([raw], member("owner"))[0], raw);
});

test("员工表单不能自提权、修改老板或分配自己没有的能力；有效老板不可全部停用", () => {
  const data = defaults(); const manager = data.members.find(value => value.role === "manager");
  manager.permissions.push("staff.manage"); data.currentId = manager.id;
  const owner = data.members.find(value => value.role === "owner"); const viewer = data.members.find(value => value.role === "viewer");
  const save = draft => staff.updateStaffMember(data, draft, data.revision, manager.id, "audit", time);
  assert.throws(() => save({ ...manager, role: "owner", permissions: staff.allPermissions }), /老板/);
  assert.throws(() => save({ ...manager, permissions: [...manager.permissions, "sale.refund"] }), /自己/);
  assert.throws(() => save({ ...owner, membershipStatus: "disabled" }), /有限员工管理员/);
  assert.throws(() => save({ ...viewer, permissions: [...viewer.permissions, "financial.read"] }), /无权分配/);
  const own = defaults(); const onlyOwner = own.members.find(value => value.role === "owner");
  assert.throws(() => staff.updateStaffMember(own, { ...onlyOwner, accountStatus: "disabled" }, 0, onlyOwner.id, "disable", time));
  assert.throws(() => staff.parseStaffData(staffRaw({ ...own, members: own.members.map(value => value.role === "owner" ? { ...value, membershipStatus: "disabled" } : value) })), /有效老板/);
});

test("员工变更绑定当前身份和双版本，新增账号保持显式状态并追加完整审计", () => {
  const data = defaults(); const owner = data.members.find(value => value.role === "owner"); const viewer = data.members.find(value => value.role === "viewer");
  const changed = staff.updateStaffMember(data, { ...viewer, membershipStatus: "pending" }, 0, owner.id, "audit", time);
  assert.equal(changed.revision, 1); assert.equal(changed.members.find(value => value.id === viewer.id).revision, 2);
  assert.equal(changed.audit[0].before.membershipStatus, "active"); assert.equal(changed.audit[0].after.membershipStatus, "pending"); assert.equal(changed.audit[0].actorId, owner.id);
  assert.deepEqual(staff.parseStaffData(staffRaw(changed)), changed);
  assert.throws(() => staff.updateStaffMember(changed, viewer, 0, owner.id, "stale", time), /变化/);
  assert.throws(() => staff.updateStaffMember(changed, viewer, 1, owner.id, "member-stale", time), /已更新/);
  assert.throws(() => staff.updateStaffMember({ ...data, currentId: viewer.id }, viewer, 0, owner.id, "actor-stale", time), /没有管理员工/);
  const newMember = { ...viewer, id: "DEMO-NEW", email: "new@demo.local", accountStatus: "pending", membershipStatus: "pending", revision: 0 };
  const added = staff.updateStaffMember(data, newMember, 0, owner.id, "new", time);
  assert.equal(added.audit[0].before, null); assert.equal(staff.can(added.members.at(-1), "retail.view"), false);
});

test("坏员工存储、重复账号、坏权限历史和无效日期不能转成默认老板资料", () => {
  for (const raw of ["", "broken", "{}", staffRaw({ ...defaults(), members: [...defaults().members, member("sales")] })]) assert.throws(() => staff.parseStaffData(raw));
  const data = defaults(); data.members[1].email = data.members[0].email.toUpperCase(); assert.throws(() => staff.parseStaffData(staffRaw(data)), /重复/);
  const valid = staff.updateStaffMember(defaults(), { ...member("sales"), name: "DEMO changed" }, 0, "DEMO-OWNER", "audit", time);
  for (const edit of [value => { value.audit[0].after.role = "owner"; }, value => { value.audit[0].before.accountStatus = "invented"; }, value => { value.audit[0].time = "2026-02-30 12:00:00"; }, value => { value.audit.push(structuredClone(value.audit[0])); }]) {
    const bad = structuredClone(valid); edit(bad); assert.throws(() => staff.parseStaffData(staffRaw(bad)));
  }
  const first = staff.parseStaffData(null); first.members[0].permissions.length = 0;
  assert.equal(staff.parseStaffData(null).members[0].permissions.length, staff.allPermissions.length);
});

test("动作能力分开核对收款、核对冲销、退款、欠款放行和财务修改", () => {
  for (const [command, expected] of [[{ type: "payment" }, "sale.payment"], [{ type: "payment_reconcile" }, "sale.reconcile"], [{ type: "payment_void" }, "sale.reconcile"], [{ type: "refund_void" }, "sale.refund"], [{ type: "return" }, "sale.refund"], [{ type: "after_sale_cancel" }, "sale.aftersales"], [{ type: "edit", change: { field: "costCents" } }, "financial.edit"], [{ type: "edit", change: { field: "priceCents" } }, "retail.price"]]) assert.equal(access.retailCommandPermission(command), expected);
  assert.equal(access.retailFieldPermission("refurbCents"), "financial.edit");
});

test("SSR和身份未载入不给整机fixture，未知/停用/坏员工存储不给DOM上下文", async () => {
  const ssr = await store("components/retail/retail-provider.tsx", true); const context = ssr.contextUnderTest();
  assert.deepEqual(context.units, []); assert.equal(context.ready, false); assert.equal(client.staffServerSnapshot.member, null);
  for (const data of [{ ...defaults(), currentId: "unknown" }, { ...defaults(), currentId: "DEMO-SALES", members: defaults().members.map(value => value.role === "sales" ? { ...value, accountStatus: "disabled" } : value) }]) {
    await withBrowser(browser({ [client.staffStorageKey]: staffRaw(data) }), async () => assert.deepEqual((await store("components/retail/retail-provider.tsx")).contextUnderTest().units, []));
  }
  await withBrowser(browser({ [client.staffStorageKey]: "bad" }), async () => { const context = (await store("components/retail/retail-provider.tsx")).contextUnderTest(); assert.deepEqual(context.units, []); assert.ok(context.error); });
});

test("已打开整机确认后撤权/停用，保存重新鉴权拒绝且保留原存储", async () => {
  const sold = soldUnit(); const original = retailRaw([sold]); const data = defaults(); data.currentId = "DEMO-SALES";
  await withBrowser(browser({ [client.staffStorageKey]: staffRaw(data), "chinatech.m1.retail.v1": original }), async () => {
    const context = (await store("components/retail/retail-provider.tsx")).contextUnderTest();
    const action = { type: "command", id: sold.id, version: sold.version, command: { type: "payment", saleId: "DEMO-SALE", entryId: "DEMO-PAY", amountCents: 100, date: "2026-10-01", method: "cash", note: "DEMO" }, event: event("pay") };
    const revoked = structuredClone(data); revoked.members.find(value => value.id === "DEMO-SALES").permissions = ["retail.view"]; window.localStorage.setItem(client.staffStorageKey, staffRaw(revoked));
    assert.equal(context.dispatch(action), false); assert.equal(window.saved("chinatech.m1.retail.v1"), original);
    const disabled = structuredClone(data); disabled.members.find(value => value.id === "DEMO-SALES").membershipStatus = "disabled"; window.localStorage.setItem(client.staffStorageKey, staffRaw(disabled));
    assert.equal(context.dispatch(action), false); assert.equal(window.saved("chinatech.m1.retail.v1"), original);
  });
});

test("有限收款能力不能冲销/核对旧累计，也不能用debt参数越权交付", async () => {
  const sold = soldUnit(); const original = retailRaw([sold]); const data = defaults(); data.currentId = "DEMO-SALES";
  await withBrowser(browser({ [client.staffStorageKey]: staffRaw(data), "chinatech.m1.retail.v1": original }), async () => {
    const context = (await store("components/retail/retail-provider.tsx")).contextUnderTest();
    for (const command of [{ type: "payment_reconcile", saleId: "DEMO-SALE", paidCents: 0, reason: "DEMO" }, { type: "payment_void", saleId: "DEMO-SALE", entryId: "payment", reason: "DEMO" }, { type: "refund", saleId: "DEMO-SALE", entryId: "refund", amountCents: 100, date: "2026-10-01", method: "cash", note: "DEMO" }, { type: "deliver", saleId: "DEMO-SALE", deliveryDate: "2026-10-01", debt: { reason: "DEMO", owner: "DEMO", followUp: "2026-10-02" } }]) assert.equal(context.dispatch({ type: "command", id: sold.id, version: sold.version, command, event: event("denied") }), false);
    assert.equal(window.saved("chinatech.m1.retail.v1"), original);
  });
});

test("写入前员工身份再次核对，存储错误不覆写、不发布假成功", async () => {
  const sold = soldUnit(); const original = retailRaw([sold]); const data = defaults(); data.currentId = "DEMO-SALES";
  await withBrowser(browser({ [client.staffStorageKey]: staffRaw(data), "chinatech.m1.retail.v1": original }), async () => {
    const context = (await store("components/retail/retail-provider.tsx")).contextUnderTest();
    const action = { type: "command", id: sold.id, version: sold.version, command: { type: "payment", saleId: "DEMO-SALE", entryId: "payment", amountCents: 100, date: "2026-10-01", method: "cash", note: "DEMO" }, event: event("payment") };
    window.onRead = key => { if (key === "chinatech.m1.retail.v1") { const revoked = structuredClone(data); revoked.members.find(value => value.id === data.currentId).permissions = ["retail.view"]; window.localStorage.setItem(client.staffStorageKey, staffRaw(revoked)); } };
    assert.equal(context.dispatch(action), false); assert.equal(window.saved("chinatech.m1.retail.v1"), original); window.onRead = null;
    window.localStorage.setItem(client.staffStorageKey, staffRaw(data)); window.failWriteKey = "chinatech.m1.retail.v1";
    assert.equal(context.dispatch(action), false); assert.equal(window.saved("chinatech.m1.retail.v1"), original); window.failWriteKey = null;
    window.localStorage.setItem("chinatech.m1.retail.v1", "bad"); assert.equal(context.dispatch(action), false); assert.equal(window.saved("chinatech.m1.retail.v1"), "bad");
  });
});

test("售后建单使用来源三元组，非hex申请ID可用；关联保存半失败可继续且不重复", async () => {
  const unit = afterSaleUnit();
  await withBrowser(browser({ "chinatech.m1.retail.v1": retailRaw([unit]) }), async () => {
    const intakes = await store("components/repairs/local-intake-store.ts");
    const first = intakes.createRetailAfterSaleRepair(unit.id, "DEMO-SALE", "case-with-no-hex"); assert.match(first, /^LOCAL-[A-F0-9]{16}$/);
    const intakeRaw = window.saved("chinatech.m1.local-intakes.v1"); const records = JSON.parse(intakeRaw).records;
    assert.deepEqual(records[0].retailOrigin, { unitId: unit.id, saleId: "DEMO-SALE", caseId: "case-with-no-hex" });
    assert.equal(records[0].custody, "store");
    const provider = await store("components/retail/retail-provider.tsx"); const context = provider.contextUnderTest();
    const action = { type: "command", id: unit.id, version: unit.version, command: { type: "after_sale_link", saleId: "DEMO-SALE", caseId: "case-with-no-hex", repairId: first }, event: event("link") };
    window.failWriteKey = "chinatech.m1.retail.v1"; assert.equal(context.dispatch(action), false);
    assert.equal(intakes.createRetailAfterSaleRepair(unit.id, "DEMO-SALE", "case-with-no-hex"), first); assert.equal(window.saved("chinatech.m1.local-intakes.v1"), intakeRaw);
    window.failWriteKey = null; assert.equal(context.dispatch(action), true); assert.equal(context.dispatch(action), true);
    assert.equal(JSON.parse(window.saved("chinatech.m1.retail.v1")).units[0].sales[0].afterSales[0].repairId, first);
    assert.equal(JSON.parse(window.saved("chinatech.m1.local-intakes.v1")).records.length, 1);
  });
});

test("售后坏工单存储/建单写失败保留原字节，无原商品快照不能倒填当前实物", async () => {
  const unit = afterSaleUnit();
  await withBrowser(browser({ "chinatech.m1.retail.v1": retailRaw([unit]), "chinatech.m1.local-intakes.v1": "bad" }), async () => { const intakes = await store("components/repairs/local-intake-store.ts"); assert.throws(() => intakes.createRetailAfterSaleRepair(unit.id, "DEMO-SALE", "case-with-no-hex")); assert.equal(window.saved("chinatech.m1.local-intakes.v1"), "bad"); });
  await withBrowser(browser({ "chinatech.m1.retail.v1": retailRaw([unit]) }), async () => { const intakes = await store("components/repairs/local-intake-store.ts"); window.failWriteKey = "chinatech.m1.local-intakes.v1"; assert.throws(() => intakes.createRetailAfterSaleRepair(unit.id, "DEMO-SALE", "case-with-no-hex")); assert.equal(window.saved("chinatech.m1.local-intakes.v1"), null); });
  const legacy = structuredClone(unit); delete legacy.sales[0].product;
  await withBrowser(browser({ "chinatech.m1.retail.v1": retailRaw([legacy]) }), async () => { const intakes = await store("components/repairs/local-intake-store.ts"); assert.throws(() => intakes.createRetailAfterSaleRepair(unit.id, "DEMO-SALE", "case-with-no-hex"), /快照不完整/); assert.equal(window.saved("chinatech.m1.local-intakes.v1"), null); });
});

test("售后关闭须工单真实匹配三元组及完成事件，不能伪造status或提前交还", () => {
  const unit = afterSaleUnit(); const request = unit.sales[0].afterSales[0]; request.repairId = "LOCAL-0011223344556677";
  const record = { id: request.repairId, createdAt: "2026-10-01 10:00:00", retailOrigin: { unitId: unit.id, saleId: "DEMO-SALE", caseId: request.id } };
  const command = { type: "after_sale_close", saleId: "DEMO-SALE", caseId: request.id, date: "2026-10-02", resolution: "DEMO", returned: true };
  const completed = { revision: 1, status: "completed", custody: "store", notice: null, updatedAt: "2026-10-02 11:00:00", events: [{ id: "completed", time: "2026-10-02 11:00:00", type: "stage", label: "维修阶段：维修结束", note: "DEMO" }] };
  const raw = workflow => JSON.stringify({ version: 1, workflows: { [record.id]: workflow } });
  assert.doesNotThrow(() => access.requireRetailAfterSaleRepair(unit, command, [record], raw(completed)));
  assert.throws(() => access.requireRetailAfterSaleRepair(unit, command, [], raw(completed)), /不存在/);
  for (const field of ["unitId", "saleId", "caseId"]) assert.throws(() => access.requireRetailAfterSaleRepair(unit, command, [{ ...record, retailOrigin: { ...record.retailOrigin, [field]: "different" } }], raw(completed)), /来源不一致/);
  assert.throws(() => access.requireRetailAfterSaleRepair(unit, command, [record, record], raw(completed)), /来源不一致/);
  for (const bad of [null, "broken", raw({ status: "completed" }), raw({ ...completed, events: [], revision: 0 }), raw({ ...completed, revision: 2 }), raw({ ...completed, events: [{ ...completed.events[0], label: "维修阶段：检测中" }] })]) assert.throws(() => access.requireRetailAfterSaleRepair(unit, command, [record], bad));
  assert.throws(() => access.requireRetailAfterSaleRepair(unit, { ...command, date: "2026-10-01" }, [record], raw(completed)), /不能早于/);
});

test("员工存储保存失败和坏存储不产生假权限变更，可恢复后拒绝旧版本", async () => {
  const original = staffRaw(defaults());
  await withBrowser(browser({ [client.staffStorageKey]: original }), async () => {
    client.readStaffSnapshot(); window.failWriteKey = client.staffStorageKey;
    assert.throws(() => client.savePreviewMember({ ...member("sales"), permissions: [...member("sales").permissions, "financial.read"] }, 0)); assert.equal(window.saved(client.staffStorageKey), original);
    assert.equal(client.readStaffSnapshot().data.revision, 0); window.failWriteKey = null;
    client.savePreviewMember({ ...member("sales"), permissions: [...member("sales").permissions, "financial.read"] }, 0); assert.equal(client.readStaffSnapshot().data.revision, 1);
    assert.throws(() => client.savePreviewMember(member("sales"), 0), /变化/);
    window.localStorage.setItem(client.staffStorageKey, "bad"); assert.throws(() => client.savePreviewMember(member("sales"), 1)); assert.equal(window.saved(client.staffStorageKey), "bad"); assert.equal(client.readStaffSnapshot().member, null);
    window.localStorage.setItem(client.staffStorageKey, original); assert.equal(client.readStaffSnapshot().error, ""); assert.equal(client.readStaffSnapshot().member.id, "DEMO-OWNER");
  });
});
