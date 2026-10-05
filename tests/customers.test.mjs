import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/customers.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { normalizeCustomerPhone, customerId, customerSaleHref, buildCustomerDirectory, customerCandidates, updateCustomerProfile, parseCustomerProfiles } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const repair = (id, phone, extra = {}) => ({ id, customer: { name: "", phone }, device: { brand: "演示", model: "手机", serial: `SN-${id}` }, createdAt: "2026-10-01 10:00", updatedAt: "2026-10-01 10:00", ...extra });
const retail = (id, phone, extra = {}) => ({ id, code: `UNIT-${id}`, brand: "演示", model: "同型号", sales: [{ id: `SALE-${id}`, customerPhone: phone, customerName: "", priceCents: 10000, paidCents: null, delivered: false, note: "测试事实", time: "2026-10-01 11:00", ...extra }] });

test("意大利本地/+39/0039及格式一致，外国区号和意大利市话前导零保留", () => {
  const variants = ["320 000 1029", "+39 (320) 000-1029", "0039 320 000 1029", "＋３９ ３２００００１０２９"];
  assert.deepEqual(variants.map(normalizeCustomerPhone), Array(4).fill("+393200001029"));
  assert.equal(normalizeCustomerPhone("06 1234 5678"), "+390612345678");
  assert.notEqual(normalizeCustomerPhone("+44 3200001029"), normalizeCustomerPhone("3200001029"));
  assert.equal(customerId(variants[0]), customerId(variants[2]));
  for (const value of ["", "123", "abc3200001029", "39+3200001029", "+0000000000", "+1234567890123456", "00"]) assert.throws(() => normalizeCustomerPhone(value));
});
test("同号维修与销售归档，客户记录不合并设备实物身份，按时间排序", () => {
  const repairs = [repair("R-1", "3200001029"), repair("R-2", "0039 3200001029", { createdAt: "2026-10-02 10:00" }), repair("R-3", "+44 3200001029")];
  const units = [retail("U-1", "+39 3200001029"), retail("U-2", "3200001029", { time: "2026-10-03 12:00" })];
  const customers = buildCustomerDirectory(repairs, units);
  assert.equal(customers.length, 2);
  const customer = customers.find(item => item.phone === "+393200001029");
  assert.deepEqual(customer.repairs.map(item => item.id), ["R-2", "R-1"]);
  assert.deepEqual(customer.sales.map(item => item.unitId), ["U-2", "U-1"]);
  assert.equal(customer.name, "");
  assert.equal(customer.lastActivity, "2026-10-03 12:00");
  assert.notEqual(customer.repairs[0].device.serial, customer.repairs[1].device.serial);
  assert.equal(units.length, 2);
  assert.equal(repairs.length, 3);
});
test("匿名资料不制造实名，资料覆盖可清空称呼且不重写历史", () => {
  const original = repair("R-1", "3200001029", { customer: { phone: "3200001029", name: "未填写姓名" } });
  const records = buildCustomerDirectory([original], []);
  assert.equal(records[0].name, "");
  const profiles = updateCustomerProfile([], { phone: "3200001029", name: "", email: "", note: "", updatedAt: "2026-10-02 11:00" }, 0);
  const customer = buildCustomerDirectory([original], [], profiles, [{ phone: "3200001029", name: "虚构称呼" }])[0];
  assert.equal(customer.name, "");
  assert.equal(original.customer.name, "未填写姓名");
  assert.equal(customer.version, 1);
});
test("客户候选统一查本地工单/销售/基础资料，显式外国区号限制匹配", () => {
  const directory = buildCustomerDirectory([repair("R-1", "3200001029"), repair("R-2", "+44 3200001029")], [retail("U-1", "3200001030")]);
  assert.equal(customerCandidates("10", directory).length, 0);
  assert.equal(customerCandidates("320 000", directory).length, 3);
  assert.equal(customerCandidates("0039 320", directory).length, 2);
  assert.equal(customerCandidates("+44 320", directory).length, 1);
});
test("新客户与基础资料可持久化，版本冲突/非法邮件失败不改变资料", () => {
  const draft = { phone: "3200001029", name: "虚构称呼", email: "demo@example.com", note: "演示", updatedAt: "2026-10-01 12:00" };
  const first = updateCustomerProfile([], draft, 0);
  const restored = parseCustomerProfiles(JSON.stringify({ version: 1, profiles: first }));
  assert.deepEqual(restored, first);
  assert.equal(buildCustomerDirectory([], [], restored)[0].repairs.length, 0);
  assert.throws(() => updateCustomerProfile(first, { ...draft, name: "另一个称呼" }, 0), /已更新/);
  assert.throws(() => updateCustomerProfile(first, { ...draft, email: "invalid" }, 1), /邮件/);
  assert.equal(first[0].name, "虚构称呼");
  const next = updateCustomerProfile(first, { ...draft, name: "" }, 1);
  assert.equal(next[0].name, "");
  assert.equal(next[0].version, 2);
  assert.throws(() => parseCustomerProfiles(JSON.stringify({ version: 1, profiles: [first[0], first[0]] })), /重复/);
  assert.throws(() => parseCustomerProfiles("bad"));
});

test("销售提供最新已知联系资料，买家备注仅属于原销售且旧快照不回写", () => {
  const first = retail("U-1", "3200001029", { customerName: "原买家称呼", customerEmail: "first@example.test", customerAddress: "原销售地址", customerNote: "仅此交易备注", delivered: true, deliveryDate: "2026-10-01", product: { code: "ORIGINAL-CODE", brand: "原品牌", model: "原型号" } });
  const second = retail("U-2", "0039 3200001029", { time: "2026-10-02 12:00", customerName: "较新称呼", customerEmail: "latest@example.test", customerAddress: "较新地址" });
  const third = retail("U-3", "+393200001029", { time: "2026-10-03 12:00" });
  const bytes = JSON.stringify([first, second, third]);
  const customer = buildCustomerDirectory([], [third, first, second])[0];
  assert.equal(customer.email, "latest@example.test");
  assert.equal(customer.address, "较新地址");
  assert.equal(customer.name, "较新称呼");
  assert.equal(customer.note, "");
  assert.equal(customer.sales[2].customerName, "原买家称呼");
  assert.equal(customer.sales[2].customerEmail, "first@example.test");
  assert.equal(customer.sales[2].customerAddress, "原销售地址");
  assert.equal(customer.sales[2].customerNote, "仅此交易备注");
  assert.equal(customer.sales[2].deliveryDate, "2026-10-01");
  assert.equal(customer.sales[2].unitCode, "ORIGINAL-CODE");
  assert.equal(customer.sales[2].deviceName, "原品牌 原型号");
  assert.equal(JSON.stringify([first, second, third]), bytes);
});

test("已编辑客户资料优先且可明确清空，历史买家联系资料保持原值", () => {
  const sold = retail("U-1", "3200001029", { customerName: "原称呼", customerEmail: "sale@example.test", customerAddress: "交易地址", customerNote: "交易备注" });
  const profile = { phone: "+393200001029", name: "当前客户称呼", email: "current@example.test", note: "当前长期备注", version: 2, updatedAt: "2026-10-04 12:00" };
  const customer = buildCustomerDirectory([], [sold], [profile])[0];
  assert.equal(customer.name, profile.name);
  assert.equal(customer.email, profile.email);
  assert.equal(customer.note, profile.note);
  assert.equal(customer.address, "交易地址");
  assert.equal(customer.sales[0].customerEmail, "sale@example.test");
  const cleared = buildCustomerDirectory([], [sold], [{ ...profile, name: "", email: "", note: "" }])[0];
  assert.equal(cleared.name, "");
  assert.equal(cleared.email, "");
  assert.equal(cleared.note, "");
  assert.equal(cleared.sales[0].customerName, "原称呼");
  assert.equal(cleared.sales[0].customerNote, "交易备注");
});

test("客户销售链接定位具体销售，复售与特殊标识不会丢失原单", () => {
  assert.equal(customerSaleHref({ unitId: "DEMO-UNIT", id: "DEMO-SALE" }), "/app/retail/units/DEMO-UNIT?sale=DEMO-SALE#sale-DEMO-SALE");
  const url = new URL(customerSaleHref({ unitId: "unit/1", id: "sale #旧/1" }), "https://example.test");
  assert.equal(url.pathname, "/app/retail/units/unit%2F1");
  assert.equal(url.searchParams.get("sale"), "sale #旧/1");
  assert.equal(decodeURIComponent(url.hash.slice(1)), "sale-sale #旧/1");
});
