import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

// Exercise the actual standalone domain module, not a duplicate implementation.
const source = readFileSync(new URL("../lib/retail.ts", import.meta.url), "utf8");
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const customerModule = `data:text/javascript;base64,${Buffer.from(compile(readFileSync(new URL("../lib/customers.ts", import.meta.url), "utf8"))).toString("base64")}`;
const compiled = compile(source).replace('"./customers"', JSON.stringify(customerModule));
const { emptyRetailUnit, copyRetailModel, changeRetailDraftCategory, nextRetailCode, validateRetailUnit, createRetailUnit, applyRetailCommand, lookupRetailCode, retailSpec, retailMoney, parseRetailMoney, parseStoredRetailUnits, retailFieldLabels, canEditRetailField, validateRetailFieldEdit, retailWarrantyTermsVersion, retailWarrantyLabel, retailWarrantyExpiry, validateRetailWarrantyMonths, currentRetailSale, retailPaidCents, retailRefundedCents, retailDueCents, isRetailReturnSettled, retailSaleState, retailGrossProfit, retailSaleGrossProfit, saleProductUnit, validateRetailPhotos } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP90AAAAASUVORK5CYII=";
const unit = (extra = {}) => ({ ...emptyRetailUnit(), priceCents: ["available", "reserved"].includes(extra.status) ? 26000 : null, id: "unit-1", code: "CT-TEST-1", brand: "Apple", model: "虚构测试手机", storeOwned: true, ...extra });
const event = (id, detail = "虚构测试说明") => ({ id, title: "测试操作", detail, time: "2026-09-30 10:00" });
const command = (record, action, id = "event-1") => applyRetailCommand(record, action, event(id), record.version);
const completeChecks = { functional: true, ownership: true, data: true };
const edit = (record, field, value, id = "field-edit", others = []) => applyRetailCommand(record, { type: "edit", change: { field, value } }, event(id, "虚构资料核对更正"), record.version, others);

test("每项编辑只更新目标资料，永久身份与既有事实不变，历史追加", () => {
  const original = unit({ imei1: "000000000000101", serial: "DEMO-ORIGINAL", events: [event("created")], photos: [photo], inspection: completeChecks });
  const changed = edit(original, "imei1", "000 000000000102");
  assert.equal(changed.imei1, "000000000000102");
  assert.equal(changed.id, original.id);
  assert.equal(changed.code, original.code);
  assert.equal(changed.serial, original.serial);
  assert.equal(changed.model, original.model);
  assert.equal(changed.photos, original.photos);
  assert.equal(changed.sales, original.sales);
  assert.equal(changed.reservation, original.reservation);
  assert.equal(changed.inspection, original.inspection);
  assert.equal(changed.version, 2);
  assert.deepEqual(changed.events, [...original.events, event("field-edit", "虚构资料核对更正")]);
  assert.equal(original.imei1, "000000000000101");
  assert.equal(original.version, 1);
  assert.equal(original.events.length, 1);
});

test("编辑契约拒绝任意 patch、受保护字段、错误值类型和无效枚举", () => {
  for (const field of ["id", "version", "events", "sales", "reservation", "storeOwned", "photos", "inspection", "status", "__proto__"])
    assert.throws(() => validateRetailFieldEdit(unit(), { field, value: "tamper" }), /不可直接编辑/);
  for (const change of [{ field: "model" }, { field: "model", value: "new", status: "sold" }, null]) assert.throws(() => validateRetailFieldEdit(unit(), change));
  for (const [field, value] of [["brand", null], ["model", 123], ["ramGb", "8"], ["batteryPercent", "90"], ["costCents", "12000"], ["source", {}], ["serial", undefined], ["category", "watch"], ["condition", "良好"], ["grade", "AA"]])
    assert.throws(() => validateRetailFieldEdit(unit(), { field, value }));
  assert.throws(() => validateRetailFieldEdit(unit(), { field: "model", value: " " }), /填写/);
  assert.throws(() => validateRetailFieldEdit(unit(), { field: "code", value: "new" }), /自动生成/);
  assert.throws(() => validateRetailFieldEdit(unit(), { field: "knownIssues", value: "x".repeat(5001) }), /5000/);
  assert.equal(Object.keys(retailFieldLabels).length, 29);
});

test("独立清空保持未知 null，零成本和零手柄仍是明确数值", () => {
  for (const field of ["ramGb", "batteryPercent", "costCents", "refurbCents", "priceCents"])
    assert.equal(edit(unit({ [field]: 10 }), field, null)[field], null);
  assert.equal(edit(unit({ bodyStorage: { capacity: 128, unit: "GB" } }), "bodyStorage", null).bodyStorage, null);
  const unknownStorage = edit(unit(), "bodyStorage", { capacity: null, unit: "TB" });
  assert.deepEqual(unknownStorage.bodyStorage, { capacity: null, unit: "TB" });
  assert.equal(edit(unit({ costCents: 10 }), "costCents", 0).costCents, 0);
  assert.equal(edit(unit({ category: "console", controllers: 2 }), "controllers", 0).controllers, 0);
  assert.equal(edit(unit({ category: "console", controllers: 2 }), "controllers", null).controllers, null);
  assert.equal(edit(unit({ intakeDate: "2026-10-01" }), "intakeDate", "").intakeDate, "");
});

test("字段数值、容量、磁盘、日期及 IMEI 做严格运行时校验", () => {
  for (const [field, values] of [
    ["ramGb", [0, -1, 1.5, 8193, NaN, Infinity]], ["batteryPercent", [-1, 101, 10.5]],
    ["costCents", [-1, 1.2, 100000001]], ["refurbCents", [-1, Infinity]], ["priceCents", [1.5, -1]],
  ]) for (const value of values) assert.throws(() => validateRetailFieldEdit(unit(), { field, value }));
  for (const value of [-1, 1.5, 101, "1"]) assert.throws(() => validateRetailFieldEdit(unit({ category: "console" }), { field: "controllers", value }));
  for (const value of [{ capacity: 0, unit: "GB" }, { capacity: "128", unit: "GB" }, { capacity: 1, unit: "MB" }, { capacity: null }, { capacity: 2, unit: "TB", type: "SSD" }, { capacity: Infinity, unit: "GB" }, { capacity: 1025, unit: "TB" }])
    assert.throws(() => validateRetailFieldEdit(unit(), { field: "bodyStorage", value }));
  for (const value of [{}, [null], [{ capacity: 512, unit: "GB", type: "USB" }], Array.from({ length: 17 }, () => ({ capacity: 1, unit: "TB", type: "SSD" }))])
    assert.throws(() => validateRetailFieldEdit(unit({ category: "desktop" }), { field: "disks", value }));
  for (const value of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-10-00", "0000-01-01", "2026-1-1", "not-a-date"])
    assert.throws(() => validateRetailFieldEdit(unit(), { field: "intakeDate", value }));
  assert.equal(validateRetailFieldEdit(unit(), { field: "intakeDate", value: "2024-02-29" }).intakeDate, "2024-02-29");
  assert.throws(() => validateRetailFieldEdit(unit(), { field: "imei1", value: "12345" }), /15 位/);
  assert.throws(() => validateRetailFieldEdit(unit({ imei1: "000000000000101" }), { field: "imei2", value: "000000000000101" }), /不能重复/);
});

test("可适用字段按商品类别开放；已有不适用事实只能明确清理", () => {
  const cases = [
    ["phone", "cpu", "CPU"], ["phone", "controllers", 2], ["desktop", "bodyStorage", { capacity: 128, unit: "GB" }],
    ["desktop", "batteryPercent", 90], ["desktop", "keyboard", "IT"], ["console", "imei1", "000000000000101"],
    ["console", "ramGb", 16], ["other", "disks", [{ capacity: 512, unit: "GB", type: "SSD" }]],
  ];
  for (const [category, field, value] of cases) {
    const record = unit({ category });
    assert.equal(canEditRetailField(record, field), false);
    assert.throws(() => validateRetailFieldEdit(record, { field, value }), /不适用/);
    const existing = unit({ category, [field]: value });
    assert.equal(canEditRetailField(existing, field), true);
    const empty = typeof value === "string" ? "" : Array.isArray(value) ? [] : null;
    assert.deepEqual(edit(existing, field, empty)[field], empty);
  }
  assert.equal(canEditRetailField(unit({ category: "laptop" }), "keyboard"), true);
  assert.equal(canEditRetailField(unit({ category: "console" }), "edition"), true);
});

test("更正类别先清理不适用规格，拒绝静默清零或隐藏旧事实", () => {
  const original = unit({ bodyStorage: { capacity: 128, unit: "GB" }, imei1: "000000000000101", batteryPercent: 90 });
  assert.throws(() => edit(original, "category", "desktop"), /先独立清理/);
  assert.equal(original.category, "phone");
  assert.equal(original.imei1, "000000000000101");
  assert.equal(original.bodyStorage.capacity, 128);
  let cleared = edit(original, "imei1", "", "clear-imei");
  cleared = edit(cleared, "bodyStorage", null, "clear-storage");
  cleared = edit(cleared, "batteryPercent", null, "clear-battery");
  const computer = edit(cleared, "category", "desktop", "change-category");
  assert.equal(computer.category, "desktop");
  assert.equal(computer.id, original.id);
  assert.equal(computer.events.length, 4);
});

test("手机网络版本按品类规格可独立更正，已可售手机需要重新核验", () => {
  const original = unit({ status: "available", inspection: completeChecks, priceCents: 20000 });
  assert.equal(canEditRetailField(original, "edition"), true);
  const changed = edit(original, "edition", "双 SIM / 欧版");
  assert.equal(changed.edition, "双 SIM / 欧版");
  assert.equal(changed.status, "inspecting");
  assert.deepEqual(changed.inspection, { functional: false, ownership: false, data: false });
  assert.equal(changed.id, original.id);
  assert.equal(changed.version, 2);
  assert.equal(changed.events.length, 1);
  assert.equal(original.edition, "");
  assert.equal(original.status, "available");
});

test("编号、品牌内 SN 和任一 IMEI 跨单机查重，包装码允许重复", () => {
  const original = unit({ serial: "SN-NEW" });
  const other = unit({ id: "other", code: "CT-OTHER", serial: "SN-OTHER", imei2: "000000000000101", status: "sold" });
  assert.throws(() => edit(original, "code", " ct-other ", "code", [other]), /自动生成/);
  assert.throws(() => edit(original, "serial", "sn-other", "serial", [other]), /重复/);
  assert.throws(() => edit(original, "imei1", "000000000000101", "imei", [other]), /重复/);
  assert.throws(() => edit(unit({ brand: "Lenovo", serial: "SN-OTHER" }), "brand", "Apple", "brand", [other]), /重复/);
  assert.throws(() => edit(original, "brand", ""), /品牌/);
  assert.equal(canEditRetailField(original, "code"), false);
  assert.equal(original.code, "CT-TEST-1");
  assert.equal(edit(original, "productCode", "DEMO-BOX", "product", [{ ...other, productCode: "DEMO-BOX" }]).productCode, "DEMO-BOX");
});

test("编辑拒绝旧版本、重复事件、空原因，失败不改变原始资料", () => {
  const original = unit({ events: [event("used")], color: "蓝色" });
  const action = { type: "edit", change: { field: "color", value: "黑色" } };
  assert.throws(() => applyRetailCommand(original, action, event("edit"), 0), /更新/);
  assert.throws(() => applyRetailCommand(original, action, event("used"), 1), /重复/);
  assert.throws(() => applyRetailCommand(original, action, event("edit", " "), 1), /原因/);
  assert.equal(original.color, "蓝色");
  assert.equal(original.version, 1);
  assert.equal(original.events.length, 1);
});

test("无变化编辑不追加历史或版本，结构化存储键顺序不造成伪变更", () => {
  const original = unit({ bodyStorage: { unit: "GB", capacity: 128 }, events: [event("created")] });
  assert.equal(edit(original, "model", original.model), original);
  assert.equal(edit(original, "bodyStorage", { capacity: 128, unit: "GB" }), original);
  const computer = unit({ category: "desktop", disks: [{ unit: "TB", type: "HDD", capacity: 1 }] });
  assert.equal(edit(computer, "disks", [{ type: "HDD", capacity: 1, unit: "TB" }]), computer);
  assert.equal(original.events.length, 1);
  assert.equal(original.version, 1);
});

test("预留与已售单机锁定全部逐字段编辑", () => {
  for (const status of ["reserved", "sold"]) {
    const record = unit({ status });
    for (const field of Object.keys(retailFieldLabels)) assert.equal(canEditRetailField(record, field), false);
    for (const [field, value] of [["model", "更正型号"], ["priceCents", 20000], ["location", "A-01"]]) assert.throws(() => edit(record, field, value), /禁止普通资料编辑/);
  }
});

test("可售核验事实更正回待检测并清空三检查；预确认候选不修改原档案", () => {
  const available = unit({ status: "available", inspection: completeChecks, priceCents: 20000 });
  for (const [field, value] of [["category", "tablet"], ["brand", "Samsung"], ["model", "新型号"], ["serial", "DEMO-SN"], ["imei1", "000000000000101"], ["productCode", "BOX"], ["color", "黑色"], ["ramGb", 8], ["bodyStorage", { capacity: 128, unit: "GB" }], ["condition", "新机"], ["grade", "B"], ["batteryPercent", 90], ["knownIssues", "触控待核实"]]) {
    const preview = validateRetailFieldEdit(available, { field, value });
    assert.equal(preview.status, "inspecting");
    assert.deepEqual(preview.inspection, { functional: false, ownership: false, data: false });
    assert.equal(preview.version, 1);
    assert.deepEqual(preview.events, []);
    const changed = edit(available, field, value);
    assert.equal(changed.status, "inspecting");
    assert.deepEqual(changed.inspection, { functional: false, ownership: false, data: false });
    assert.equal(changed.version, 2);
  }
  for (const [category, field, value] of [["laptop", "cpu", "新 CPU"], ["laptop", "gpu", "新 GPU"], ["laptop", "keyboard", "IT"], ["desktop", "disks", [{ capacity: 512, unit: "GB", type: "SSD" }]], ["console", "edition", "数字版"], ["console", "controllers", 2]]) {
    const changed = edit({ ...available, category }, field, value);
    assert.equal(changed.status, "inspecting");
    assert.deepEqual(changed.inspection, { functional: false, ownership: false, data: false });
  }
  assert.equal(available.status, "available");
  assert.deepEqual(available.inspection, completeChecks);
  assert.equal(edit(available, "model", available.model), available);
});

test("可售行政与金额更正保留可售，不产生销售、收款或交付副作用", () => {
  const original = unit({ status: "available", inspection: completeChecks, priceCents: 20000 });
  for (const [field, value] of [["source", "虚构入库"], ["location", "A-02"], ["intakeDate", "2026-10-01"], ["accessories", "充电线"], ["costCents", null], ["refurbCents", 0], ["priceCents", 21000]]) {
    const changed = edit(original, field, value);
    assert.equal(changed.status, "available");
    assert.equal(changed.inspection, original.inspection);
    assert.equal(changed.sales, original.sales);
    assert.equal(changed.reservation, original.reservation);
  }
  for (const value of [null, 0]) assert.throws(() => edit(original, "priceCents", value), /有效正售价/);
});

test("结构化编辑保存独立容量对象；金额更正保留销售原快照且可刷新恢复", () => {
  const historicalSale = { id: "sale-old", time: "2026-09-01 10:00", priceCents: 20000, paidCents: null, delivered: false, note: "虚构快照", costCents: 10000, refurbCents: 2000 };
  const original = unit({ status: "hold", category: "desktop", costCents: 10000, sales: [historicalSale] });
  const disks = [{ capacity: null, unit: "GB", type: "SSD" }, { capacity: 1, unit: "TB", type: "HDD" }];
  let changed = edit(original, "disks", disks, "disks");
  disks[1].capacity = 2;
  assert.equal(changed.disks[1].capacity, 1);
  changed = edit(changed, "costCents", 12000, "cost");
  changed = edit(changed, "refurbCents", null, "refurb");
  assert.equal(changed.sales, original.sales);
  assert.equal(changed.sales[0].costCents, 10000);
  assert.equal(changed.sales[0].refurbCents, 2000);
  assert.equal(changed.sales[0].paidCents, null);
  assert.equal(changed.sales[0].delivered, false);
  const restored = parseStoredRetailUnits(JSON.stringify({ version: 1, units: [changed] }), []);
  assert.deepEqual(restored[0], changed);
  assert.equal(restored[0].disks[0].capacity, null);
  assert.equal(restored[0].refurbCents, null);
  assert.equal(restored[0].sales[0].costCents, 10000);
});

test("同型号逐台建档，独立身份、价格和检测资料", () => {
  const first = createRetailUnit(unit({ serial: "DEMO-001", priceCents: 26000 }), [], event("created-1"));
  const second = createRetailUnit(unit({ id: "unit-2", code: "CT-TEST-2", serial: "DEMO-002", priceCents: 22000 }), [first], event("created-2"));
  assert.equal(first.model, second.model);
  assert.notEqual(first.id, second.id);
  assert.equal(first.priceCents, 26000);
  assert.equal(second.priceCents, 22000);
  assert.notEqual(first.inspection, second.inspection);
});
test("SN 按品牌归一化查重，已售记录仍占用身份", () => {
  const sold = unit({ serial: "DEMO-SN", status: "sold" });
  assert.throws(() => validateRetailUnit(unit({ id: "unit-2", code: "CT-TEST-2", brand: " apple ", serial: " demo-sn " }), [sold]), /重复/);
  assert.doesNotThrow(() => validateRetailUnit(unit({ id: "unit-2", code: "CT-TEST-2", brand: "Lenovo", serial: "DEMO-SN" }), [sold]));
  assert.throws(() => validateRetailUnit(unit({ brand: "", serial: "DEMO-SN" })), /品牌/);
});
test("IMEI 1 与 2 共用查重范围，包括已售记录", () => {
  const sold = unit({ imei2: "000000000000101", status: "sold" });
  assert.throws(() => validateRetailUnit(unit({ id: "unit-2", code: "CT-TEST-2", imei1: "000-000000000101" }), [sold]), /重复/);
  assert.throws(() => validateRetailUnit(unit({ imei1: "000000000000101", imei2: "000000000000101" })), /不能重复/);
  assert.throws(() => validateRetailUnit(unit({ imei1: "12345" })), /15 位/);
});
test("包装码可重复，识码仅返回候选，不改状态或自动新建", () => {
  const units = [unit({ productCode: "DEMO-BOX" }), unit({ id: "unit-2", code: "CT-TEST-2", productCode: "DEMO-BOX" })];
  assert.doesNotThrow(() => validateRetailUnit(units[1], [units[0]]));
  assert.equal(lookupRetailCode(units, " demo-box ", "product").length, 2);
  assert.deepEqual(lookupRetailCode(units, "https://example.invalid/device", "serial"), []);
  assert.equal(units.length, 2);
  assert.equal(units[0].status, "inspecting");
});
test("同 SN 跨品牌仍可返回多个候选，不猜测制造商", () => {
  const units = [unit({ serial: "DEMO-SN" }), unit({ id: "unit-2", code: "CT-TEST-2", serial: "DEMO-SN", brand: "Lenovo" })];
  assert.equal(lookupRetailCode(units, "DEMO-SN", "serial").length, 2);
  assert.deepEqual(lookupRetailCode(units, "", "serial"), []);
});
test("复制型号清空身份、实测、金额、占用和历史，不共享存储对象", () => {
  const original = unit({ serial: "DEMO-SN", imei1: "000000000000101", category: "laptop", ramGb: 16, disks: [{ type: "SSD", capacity: 512, unit: "GB" }], bodyStorage: { capacity: 128, unit: "GB" }, batteryPercent: 89, controllers: 2, grade: "A", photos: ["fixture-only"], costCents: 10000, priceCents: 20000, inspection: completeChecks, status: "reserved", reservation: { name: "虚构预留", until: "2026-10-01" }, events: [event("original")] });
  const copied = copyRetailModel(original);
  assert.equal(copied.model, original.model);
  assert.equal(copied.ramGb, 16);
  for (const key of ["id", "code", "serial", "imei1", "imei2", "location", "source"]) assert.equal(copied[key], "");
  for (const key of ["batteryPercent", "controllers", "costCents", "refurbCents", "priceCents", "reservation"]) assert.equal(copied[key], null);
  assert.equal(copied.grade, "待评估");
  assert.equal(copied.storeOwned, false);
  assert.equal(copied.status, "inspecting");
  assert.deepEqual(copied.inspection, { functional: false, ownership: false, data: false });
  assert.deepEqual(copied.photos, []);
  assert.deepEqual(copied.events, []);
  assert.deepEqual(copied.sales, []);
  copied.disks[0].capacity = 256;
  assert.equal(copied.bodyStorage, null);
  const phone = unit({ bodyStorage: { capacity: 128, unit: "GB" } });
  copyRetailModel(phone).bodyStorage.capacity = 64;
  assert.equal(phone.bodyStorage.capacity, 128);
  assert.equal(original.disks[0].capacity, 512);
  assert.equal(original.bodyStorage.capacity, 128);
});
test("未知规格和金额保留 null，零手柄与零成本不是未知", () => {
  const unknown = unit();
  assert.equal(validateRetailUnit(unknown).ramGb, null);
  assert.equal(unknown.costCents, null);
  assert.equal(retailSpec(unknown), "规格待确认");
  assert.equal(retailMoney(null), "待确认");
  assert.equal(retailMoney(0), "€0.00");
  assert.doesNotThrow(() => validateRetailUnit(unit({ category: "console", controllers: 0, costCents: 0 })));
  assert.throws(() => validateRetailUnit(unit({ ramGb: 0 })), /RAM/);
  assert.throws(() => validateRetailUnit(unit({ bodyStorage: { capacity: 0, unit: "GB" } })), /容量/);
});
test("电脑多块磁盘与 RAM 分开保存和展示", () => {
  const computer = unit({ category: "desktop", ramGb: 16, disks: [{ type: "SSD", capacity: 512, unit: "GB" }, { type: "HDD", capacity: 1, unit: "TB" }] });
  assert.equal(validateRetailUnit(computer).disks.length, 2);
  assert.equal(retailSpec(computer), "16 GB RAM · 512 GB SSD + 1 TB HDD");
});
test("登记必须明确为门店自有，且新档案总是待检测", () => {
  assert.throws(() => createRetailUnit(unit({ storeOwned: false }), [], event("create")), /门店自有/);
  const created = createRetailUnit(unit({ status: "available", inspection: completeChecks, version: 9 }), [], event("create"));
  assert.equal(created.status, "inspecting");
  assert.equal(created.version, 1);
  assert.deepEqual(created.inspection, { functional: false, ownership: false, data: false });
  assert.throws(() => createRetailUnit(unit(), [created], event("duplicate")), /编号/);
});
test("三项检查、有效售价和明确批准缺一不可，记录检查不会自动可售", () => {
  let record = unit({ priceCents: 23000 });
  assert.throws(() => command(record, { type: "approve" }), /全部完成/);
  record = command(record, { type: "inspect", checks: completeChecks });
  assert.equal(record.status, "inspecting");
  const approved = command(record, { type: "approve" }, "approve");
  assert.equal(approved.status, "available");
  assert.equal(record.status, "inspecting");
  for (const priceCents of [null, 0]) assert.throws(() => command(unit({ inspection: completeChecks, priceCents }), { type: "approve" }), /有效售价/);
});
test("暂停后重新检测清空检查，保留身份与追加式历史", () => {
  const available = unit({ status: "available", inspection: completeChecks, serial: "DEMO-SN", events: [event("created")] });
  const paused = command(available, { type: "pause" }, "pause");
  const reopened = command(paused, { type: "reinspect" }, "reinspect");
  assert.equal(reopened.status, "inspecting");
  assert.deepEqual(reopened.inspection, { functional: false, ownership: false, data: false });
  assert.equal(reopened.serial, "DEMO-SN");
  assert.equal(reopened.events.length, 3);
  assert.equal(available.events.length, 1);
  assert.equal(reopened.version, 3);
});
test("预留与已售单机禁止普通编辑和直接恢复可售", () => {
  for (const status of ["reserved", "sold"]) {
    const record = unit({ status, inspection: completeChecks, priceCents: 20000 });
    for (const action of [{ type: "pause" }, { type: "reinspect" }, { type: "approve" }, { type: "inspect", checks: completeChecks }, { type: "price", priceCents: 25000 }]) assert.throws(() => command(record, action));
  }
  assert.throws(() => command(unit({ status: "available" }), { type: "price", priceCents: 25000 }));
});
test("重复事件、过期版本和空原因不改变原档案", () => {
  const record = unit({ events: [event("event-1")] });
  assert.throws(() => command(record, { type: "price", priceCents: 10000 }), /重复/);
  assert.throws(() => applyRetailCommand(record, { type: "price", priceCents: 10000 }, event("event-2"), 0), /更新/);
  assert.throws(() => applyRetailCommand(record, { type: "price", priceCents: 10000 }, event("event-2", " "), 1), /原因/);
  assert.equal(record.priceCents, null);
  assert.equal(record.events.length, 1);
});
test("待检测与暂停允许带原因更正标价，错误金额被拒绝", () => {
  for (const status of ["inspecting", "hold"]) {
    const record = command(unit({ status }), { type: "price", priceCents: 25000 });
    assert.equal(record.priceCents, 25000);
    assert.equal(record.status, status);
  }
  for (const priceCents of [-1, 1.5, Infinity, 100000001]) assert.throws(() => command(unit(), { type: "price", priceCents }));
});
test("本地金额解析保留未知值和分精度，不接受负数或三位小数", () => {
  assert.equal(parseRetailMoney(" "), null);
  assert.equal(parseRetailMoney("0"), 0);
  assert.equal(parseRetailMoney("260.10"), 26010);
  for (const value of ["-1", "1.001", "abc", "1e3", "1000000.01"]) assert.throws(() => parseRetailMoney(value));
});

const policy = (extra = {}) => ({ months: 12, termsVersion: retailWarrantyTermsVersion, shopName: "DEMO 店", address: "DEMO 地址", phone: "", ...extra });
const sale = (extra = {}) => ({ warranty: policy(), type: "sell", saleId: "LOCAL-SALE-TEST", customerPhone: "320 000 1029", customerName: "", priceCents: 26000, ...extra });
test("可售单机登记售出，保留实物身份、成本快照与未知收款/交付", () => {
  const original = unit({ status: "available", inspection: completeChecks, serial: "DEMO-SALE-SN", costCents: 10000, refurbCents: null, events: [event("created")] });
  const sold = command(original, sale(), "sale-event");
  assert.equal(sold.status, "sold");
  assert.equal(sold.serial, original.serial);
  assert.equal(sold.id, original.id);
  assert.equal(sold.sales.length, 1);
  assert.equal(sold.sales[0].customerPhone, "+393200001029");
  assert.equal(sold.sales[0].customerName, "");
  assert.equal(sold.sales[0].priceCents, 26000);
  assert.equal(sold.sales[0].paidCents, null);
  assert.equal(sold.sales[0].delivered, false);
  assert.equal(sold.sales[0].costCents, 10000);
  assert.equal(sold.sales[0].refurbCents, null);
  assert.equal(sold.version, 2);
  assert.equal(sold.events.length, 2);
  assert.equal(original.status, "available");
  assert.equal(original.sales.length, 0);
});
test("待检测、暂停、预留与已售不能出售，非法手机号/价格/版本无副作用", () => {
  for (const status of ["inspecting", "hold", "reserved", "sold"]) assert.throws(() => command(unit({ status, inspection: completeChecks }), sale()), /可售|预留买家/);
  const original = unit({ status: "available", inspection: completeChecks });
  for (const customerPhone of ["", "abc", "12+3456789", "+00001234"]) assert.throws(() => command(original, sale({ customerPhone })));
  for (const priceCents of [null, 0, -1, 1.1, Infinity, 100000001]) assert.throws(() => command(original, sale({ priceCents })), /成交价/);
  assert.throws(() => applyRetailCommand(original, sale(), event("sale"), 0), /更新/);
  assert.throws(() => command(unit({ status: "available", inspection: { ...completeChecks, ownership: false } }), sale()), /核验/);
  assert.equal(original.version, 1);
  assert.deepEqual(original.sales, []);
  assert.deepEqual(original.events, []);
});
test("售出重复点击幂等，同操作标识不同内容拒绝，不能再次销售", () => {
  const available = unit({ status: "available", inspection: completeChecks });
  const sold = command(available, sale(), "sale-event");
  assert.equal(applyRetailCommand(sold, sale({ customerPhone: "0039 320 000 1029" }), event("sale-event"), 1), sold);
  assert.equal(sold.sales.length, 1);
  assert.equal(sold.events.length, 1);
  assert.throws(() => command(sold, sale({ priceCents: 28000 }), "another-event"), /不同资料/);
  assert.throws(() => command(sold, sale({ saleId: "another-sale" }), "another-event"), /可售/);
});
test("销售事实与单机状态可刷新恢复，损坏/重复身份存储被拒绝", () => {
  const sold = command(unit({ status: "available", inspection: completeChecks }), sale(), "sale-event");
  const encoded = JSON.stringify({ version: 1, units: [sold] });
  const restored = parseStoredRetailUnits(encoded, []);
  assert.deepEqual(restored[0], sold);
  assert.equal(restored[0].status, "sold");
  assert.equal(restored[0].sales[0].customerPhone, "+393200001029");
  assert.throws(() => parseStoredRetailUnits("broken", []));
  assert.throws(() => parseStoredRetailUnits(JSON.stringify({ version: 2, units: [sold] }), []));
  assert.throws(() => parseStoredRetailUnits(JSON.stringify({ version: 1, units: [sold, sold] }), []));
  assert.throws(() => parseStoredRetailUnits(JSON.stringify({ version: 1, units: [{ ...sold, sales: [{ ...sold.sales[0], paidCents: -1 }] }] }), []));
  assert.deepEqual(parseStoredRetailUnits(null, [sold]), [sold]);
});

test("旧分类兼容两类，不丢单机历史，不给旧销售补造保修与交付", () => {
  for (const [legacy, expected] of [["全新", "新机"], ["二手", "翻新机"], ["整备", "翻新机"]]) {
    const record = unit({ condition: legacy, warrantyMonths: undefined, version: 3, events: [event("created")], sales: [{ id: "old-sale", time: "2026-09-28 10:00", priceCents: 20000, paidCents: null, delivered: false, note: "旧销售" }] });
    const raw = JSON.stringify({ version: 1, units: [record] });
    const restored = parseStoredRetailUnits(raw, [])[0];
    assert.equal(restored.condition, expected);
    assert.equal(restored.warrantyMonths, 12);
    assert.equal(restored.version, 3);
    assert.deepEqual(restored.events, record.events);
    assert.deepEqual(restored.sales, record.sales);
    assert.equal(restored.sales[0].warranty, undefined);
    assert.equal(restored.sales[0].deliveryDate, undefined);
    assert.equal(record.condition, legacy);
  }
  assert.throws(() => parseStoredRetailUnits(JSON.stringify({ version: 1, units: [unit({ condition: "未定义" })] }), []));
  assert.throws(() => validateRetailUnit(unit({ condition: "二手" })), /新机或翻新机/);
});

test("商家保修默认一年，自定义只接受整数月，无额外保修须明确 null", () => {
  assert.equal(emptyRetailUnit().warrantyMonths, 12);
  assert.equal(copyRetailModel(unit({ warrantyMonths: 36 })).warrantyMonths, 12);
  for (const value of [1, 6, 12, 18, 24, 120, null]) assert.equal(validateRetailWarrantyMonths(value), value);
  for (const value of [undefined, "12", "", 0, -1, 1.5, NaN, Infinity, 121]) {
    assert.throws(() => validateRetailWarrantyMonths(value), /1–120/);
    assert.throws(() => validateRetailUnit(unit({ warrantyMonths: value })), /1–120/);
    assert.throws(() => edit(unit(), "warrantyMonths", value), /1–120/);
  }
  assert.equal(retailWarrantyLabel(12), "1 年");
  assert.equal(retailWarrantyLabel(18), "18 个月");
  assert.equal(retailWarrantyLabel(null), "无额外商家保修");
  const original = unit({ status: "available", inspection: completeChecks, priceCents: 20000 });
  const changed = edit(original, "warrantyMonths", 18);
  assert.equal(changed.status, "available");
  assert.equal(changed.inspection, original.inspection);
  assert.equal(changed.warrantyMonths, 18);
  assert.equal(original.warrantyMonths, 12);
  for (const status of ["reserved", "sold"]) assert.throws(() => edit(unit({ status }), "warrantyMonths", 18), /禁止普通资料编辑/);
});

test("销售冻结保修与门店，幂等包含承诺，不接受非法条款或过时配置", () => {
  const original = unit({ status: "available", inspection: completeChecks, warrantyMonths: 18 });
  const request = sale({ warranty: policy({ months: 18 }) });
  const sold = command(original, request, "sale-warranty");
  assert.deepEqual(sold.sales[0].warranty, request.warranty);
  request.warranty.address = "其他地址";
  assert.equal(sold.sales[0].warranty.address, "DEMO 地址");
  assert.equal(sold.sales[0].deliveryDate, undefined);
  assert.equal(sold.sales[0].delivered, false);
  assert.throws(() => command(original, sale(), "outdated-warranty"), /期限已变化/);
  for (const warranty of [undefined, null, policy({ months: 0 }), policy({ termsVersion: "unsupported" }), policy({ shopName: " " }), policy({ address: "" }), { ...policy({ months: 18 }), illegal: true }]) assert.throws(() => command(original, sale({ warranty }), "invalid-warranty"));
  for (const warranty of [policy({ months: 12 }), policy({ months: 18, address: "其他地址" })]) assert.throws(() => command(sold, sale({ warranty }), "reused-id"), /不同资料/);
  const reordered = { phone: "", address: "DEMO 地址", shopName: "DEMO 店", termsVersion: retailWarrantyTermsVersion, months: 18 };
  assert.equal(applyRetailCommand(sold, sale({ warranty: reordered }), event("sale-warranty"), 1), sold);
  const noExtra = command(unit({ status: "available", inspection: completeChecks, warrantyMonths: null }), sale({ warranty: policy({ months: null }) }));
  assert.equal(noExtra.sales[0].warranty.months, null);
  for (const warranty of [policy({ months: "12" }), policy({ months: 0 }), policy({ termsVersion: "unknown" })]) assert.throws(() => parseStoredRetailUnits(JSON.stringify({ version: 1, units: [{ ...sold, sales: [{ ...sold.sales[0], warranty }] }] }), []));
});

test("交付单独确认，先核对结清，保修按日历起算，重复交付不追加", () => {
  const initial = command(unit({ status: "available", inspection: completeChecks }), sale(), "sale");
  assert.throws(() => command(initial, { type: "deliver", saleId: initial.sales[0].id, deliveryDate: "2026-09-30" }, "unknown"), /付款尚未核对/);
  const sold = command(initial, { type: "payment_reconcile", saleId: initial.sales[0].id, paidCents: 26000, reason: "虚构结清核对" }, "paid");
  const delivered = applyRetailCommand(sold, { type: "deliver", saleId: sold.sales[0].id, deliveryDate: "2026-10-01" }, { ...event("handover"), time: "2026-10-01 18:00" }, sold.version);
  assert.equal(delivered.sales[0].delivered, true);
  assert.equal(delivered.sales[0].deliveryDate, "2026-10-01");
  assert.equal(delivered.sales[0].paidCents, 26000);
  assert.equal(delivered.sales[0].warranty, sold.sales[0].warranty);
  assert.equal(retailWarrantyExpiry("2026-10-01", 12), "2027-10-01");
  assert.equal(retailWarrantyExpiry("2024-02-29", 12), "2025-02-28");
  assert.equal(retailWarrantyExpiry("2026-01-31", 1), "2026-02-28");
  assert.equal(retailWarrantyExpiry("2026-12-31", 2), "2027-02-28");
  assert.equal(retailWarrantyExpiry("2026-10-01", null), null);
  assert.throws(() => retailWarrantyExpiry("2026-02-29", 12));
  assert.equal(applyRetailCommand(delivered, { type: "deliver", saleId: sold.sales[0].id, deliveryDate: "2026-10-01" }, event("replay"), 1), delivered);
  assert.equal(delivered.events.length, 3);
  assert.equal(sold.sales[0].delivered, false);
  assert.deepEqual(parseStoredRetailUnits(JSON.stringify({ version: 1, units: [delivered] }), [])[0], delivered);
});

test("交付拒绝旧版本、未来/售前/无效日期和覆盖已确认事实", () => {
  const sold = command(unit({ status: "available", inspection: completeChecks }), sale(), "sale");
  for (const deliveryDate of ["", "2026-02-29", "2026-09-29", "2026-10-02"]) assert.throws(() => applyRetailCommand(sold, { type: "deliver", saleId: sold.sales[0].id, deliveryDate }, { ...event("deliver"), time: "2026-10-01 12:00" }, sold.version), /真实日期/);
  assert.throws(() => applyRetailCommand(sold, { type: "deliver", saleId: sold.sales[0].id, deliveryDate: "2026-10-01" }, event("deliver"), 1), /更新/);
  assert.throws(() => command(sold, { type: "deliver", saleId: "other", deliveryDate: "2026-09-30" }), /销售记录/);
  const reconciled = command(sold, { type: "payment_reconcile", saleId: sold.sales[0].id, paidCents: 26000, reason: "虚构结清核对" }, "paid");
  const delivered = command(reconciled, { type: "deliver", saleId: sold.sales[0].id, deliveryDate: "2026-09-30" }, "delivery");
  assert.throws(() => command(delivered, { type: "deliver", saleId: sold.sales[0].id, deliveryDate: "2026-10-01" }, "overwrite"), /不能覆盖/);
  assert.throws(() => parseStoredRetailUnits(JSON.stringify({ version: 1, units: [{ ...sold, sales: [{ ...sold.sales[0], deliveryDate: "2026-09-30" }] }] }), []));
  assert.equal(sold.version, 2);
  assert.equal(sold.sales[0].delivered, false);
});

const soldKnown = (extra = {}, options = {}) => command(unit({ status: "available", inspection: completeChecks, ...extra }), sale({ paymentUnreceived: true, ...options }), "sale-start");
const requestMoney = (type, id, amountCents, extra = {}) => ({ type, saleId: "LOCAL-SALE-TEST", entryId: id, amountCents, date: "2026-09-30", method: "cash", note: "虚构款项", ...extra });
const pay = (record, id = "pay-1", cents = 26000) => command(record, requestMoney("payment", id, cents), id);
const refund = (record, id = "refund-1", cents = 26000) => command(record, requestMoney("refund", id, cents), id);
const returnUnit = (record, id = "return-1") => command(record, { type: "return", saleId: "LOCAL-SALE-TEST", date: "2026-09-30", reason: "虚构退回核对", received: true }, id);
const persisted = record => parseStoredRetailUnits(JSON.stringify({ version: 1, units: [record] }), [])[0];
const caseRequest = (extra = {}) => ({ type: "after_sale", saleId: "LOCAL-SALE-TEST", caseId: "case-1", date: "2026-09-30", issue: "虚构电池故障", custody: "left", ...extra });

test("买家资料和实物快照冻结，后续当前档案与客户更名不会改历史", () => {
  const original = unit({ status: "available", inspection: completeChecks, category: "laptop", serial: "DEMO-SNAPSHOT", disks: [{ type: "SSD", capacity: 512, unit: "GB" }], photos: [photo] });
  const sold = command(original, sale({ customerEmail: " test@example.invalid ", customerAddress: "虚构地址", customerNote: "虚构买家备注" }), "frozen");
  original.disks[0].capacity = 128; original.photos.length = 0;
  assert.equal(sold.sales[0].product.disks[0].capacity, 512);
  assert.equal(sold.sales[0].product.photos.length, 1);
  assert.equal(sold.sales[0].customerEmail, "test@example.invalid");
  const historical = saleProductUnit({ ...sold, model: "更正后当前型号" }, sold.sales[0]);
  assert.equal(historical.model, "虚构测试手机");
  historical.disks[0].capacity = 64;
  assert.equal(sold.sales[0].product.disks[0].capacity, 512);
  assert.equal(saleProductUnit(sold, { ...sold.sales[0], product: undefined }), null);
  assert.deepEqual(persisted(sold), sold);
  for (const extra of [{ customerEmail: "invalid@" }, { customerEmail: "a@b c.com" }, { customerAddress: "x".repeat(501) }, { customerNote: "x".repeat(5001) }]) assert.throws(() => command(unit({ status: "available", inspection: completeChecks }), sale(extra)));
  assert.throws(() => command(sold, sale({ customerEmail: "other@example.invalid" }), "retry"), /不同资料/);
});

test("明确本次未收款才开启零账本，未勾选保持未知，重复售出须相同确认", () => {
  const sold = soldKnown(); const unknown = command(unit({ status: "available", inspection: completeChecks }), sale(), "unknown-sale");
  assert.equal(retailPaidCents(sold.sales[0]), 0);
  assert.equal(retailPaidCents(unknown.sales[0]), null);
  assert.equal(sold.sales[0].paidCents, 0);
  assert.equal(retailDueCents(sold.sales[0]), 26000);
  assert.throws(() => command(unknown, requestMoney("payment", "p", 100)), /付款未知/);
  assert.throws(() => command(sold, sale(), "retry"), /不同资料/);
  for (const paymentUnreceived of [null, 0, "true", {}]) assert.throws(() => command(unit({ status: "available", inspection: completeChecks }), sale({ paymentUnreceived })));
  assert.equal(applyRetailCommand(sold, sale({ paymentUnreceived: true }), event("retry"), 1), sold);
});

test("分次收款整数分、累计限额和幂等，完成须结清并交付", () => {
  const initial = soldKnown(); const first = pay(initial, "first", 10000); const paid = pay(first, "second", 16000);
  assert.equal(retailPaidCents(first.sales[0]), 10000);
  assert.equal(retailDueCents(first.sales[0]), 16000);
  assert.equal(retailPaidCents(paid.sales[0]), 26000);
  assert.equal(retailSaleState(paid.sales[0]), "awaiting_delivery");
  assert.equal(applyRetailCommand(paid, requestMoney("payment", "first", 10000), event("retry"), 1), paid);
  assert.throws(() => command(paid, requestMoney("payment", "first", 10001), "reused"), /不同资料/);
  assert.throws(() => pay(paid, "third", 1), /超过成交价/);
  const delivered = command(paid, { type: "deliver", saleId: "LOCAL-SALE-TEST", deliveryDate: "2026-09-30" }, "delivered");
  assert.equal(retailSaleState(delivered.sales[0]), "complete");
  assert.equal(initial.sales[0].payments.length, 0);
  assert.equal(delivered.sales[0].payments.length, 2);
  assert.deepEqual(persisted(delivered), delivered);
});

test("款项拒绝零负数小数、无效日期、售前与未来日期、错误方式和旧版本", () => {
  const record = soldKnown();
  for (const amountCents of [0, -1, 0.5, NaN, Infinity, 100000001, "100"]) assert.throws(() => command(record, requestMoney("payment", "p", amountCents)));
  for (const date of ["2026-02-29", "2026-09-29", "2026-10-01", "2026-9-30", ""]) assert.throws(() => command(record, requestMoney("payment", "p", 100, { date })), /真实日期/);
  assert.throws(() => command(record, requestMoney("payment", "p", 100, { method: "crypto" })), /方式/);
  assert.throws(() => applyRetailCommand(record, requestMoney("payment", "p", 100), event("p"), 1), /更新/);
  assert.throws(() => command(record, requestMoney("payment", "", 100)));
  assert.equal(record.sales[0].paidCents, 0);
  assert.equal(record.sales[0].payments.length, 0);
});

test("旧累计实收保留起始事实，未知核对须原因，已知不能重写", () => {
  const unknown = command(unit({ status: "available", inspection: completeChecks }), sale(), "sale");
  assert.throws(() => command(unknown, { type: "payment_reconcile", saleId: "LOCAL-SALE-TEST", paidCents: 0, reason: " " }), /核对原因/);
  const zero = command(unknown, { type: "payment_reconcile", saleId: "LOCAL-SALE-TEST", paidCents: 0, reason: "虚构旧实收核对" }, "reconcile");
  assert.equal(retailPaidCents(zero.sales[0]), 0);
  assert.equal(zero.sales[0].payments.length, 0);
  assert.equal(command(zero, { type: "payment_reconcile", saleId: "LOCAL-SALE-TEST", paidCents: 0, reason: "虚构旧实收核对" }, "retry"), zero);
  assert.throws(() => command(zero, { type: "payment_reconcile", saleId: "LOCAL-SALE-TEST", paidCents: 100, reason: "更改" }, "overwrite"), /不同资料/);
  const legacySale = { id: "LOCAL-SALE-TEST", time: "2026-09-30 10:00", priceCents: 26000, paidCents: 5000, delivered: false, note: "旧累计事实" };
  const legacy = unit({ status: "sold", sales: [legacySale] });
  const added = pay(legacy, "new-pay", 2000);
  assert.equal(added.sales[0].paymentOpeningCents, 5000);
  assert.equal(added.sales[0].paidCents, 7000);
  assert.equal(added.sales[0].payments.length, 1);
  assert.throws(() => command(legacy, { type: "payment_reconcile", saleId: "LOCAL-SALE-TEST", paidCents: 0, reason: "覆盖" }), /不能覆盖/);
  assert.equal(persisted(legacy).sales[0].warranty, undefined);
  assert.deepEqual(persisted(added), added);
});

test("收款作废保留金额和原因，重复冲销不追加，退款后禁止冲销不足的实收", () => {
  const paid = pay(soldKnown());
  const corrected = command(paid, { type: "payment_void", saleId: "LOCAL-SALE-TEST", entryId: "pay-1", reason: "虚构重复收款" }, "void-pay");
  assert.equal(corrected.sales[0].payments[0].amountCents, 26000);
  assert.equal(corrected.sales[0].payments[0].void.reason, "虚构重复收款");
  assert.equal(retailPaidCents(corrected.sales[0]), 0);
  assert.equal(command(corrected, { type: "payment_void", saleId: "LOCAL-SALE-TEST", entryId: "pay-1", reason: "虚构重复收款" }, "retry"), corrected);
  assert.throws(() => command(corrected, { type: "payment_void", saleId: "LOCAL-SALE-TEST", entryId: "pay-1", reason: "不同原因" }, "different"), /不同资料/);
  const refunded = refund(paid, "small-refund", 1000);
  assert.throws(() => command(refunded, { type: "payment_void", saleId: "LOCAL-SALE-TEST", entryId: "pay-1", reason: "虚构更正" }, "void"), /不能低于已退款/);
  assert.throws(() => command(paid, { type: "payment_void", saleId: "LOCAL-SALE-TEST", entryId: "pay-1", reason: " " }, "void"));
  assert.deepEqual(persisted(corrected), corrected);
});

test("默认未结清不能交付，欠款交付须完整例外事实，补款不改实际交付日", () => {
  const partial = pay(soldKnown(), "deposit", 5000);
  const request = { type: "deliver", saleId: "LOCAL-SALE-TEST", deliveryDate: "2026-09-30" };
  assert.throws(() => command(partial, request, "no-debt"), /尚未结清/);
  for (const debt of [{ reason: "", owner: "员工", followUp: "2026-10-03" }, { reason: "允许", owner: "", followUp: "2026-10-03" }, { reason: "允许", owner: "员工", followUp: "2026-02-29" }, { reason: "允许", owner: "员工", followUp: "2026-09-29" }]) assert.throws(() => command(partial, { ...request, debt }, "invalid"));
  const debt = { reason: "虚构分期约定", owner: "DEMO 员工", followUp: "2026-10-03" };
  const delivered = command(partial, { ...request, debt }, "debt-delivery");
  assert.equal(delivered.sales[0].delivered, true);
  assert.deepEqual(delivered.sales[0].debtDelivery, debt);
  assert.equal(retailDueCents(delivered.sales[0]), 21000);
  assert.equal(retailSaleState(delivered.sales[0]), "awaiting_payment");
  const settled = pay(delivered, "balance", 21000);
  assert.equal(retailSaleState(settled.sales[0]), "complete");
  assert.equal(settled.sales[0].deliveryDate, "2026-09-30");
  assert.equal(retailWarrantyExpiry(settled.sales[0].deliveryDate, 12), "2027-09-30");
  assert.deepEqual(persisted(settled), settled);
});

test("预留有独立联系方式、截止日和明确解除，不自动订金或到期释放", () => {
  const original = unit({ status: "available", inspection: completeChecks });
  const action = { type: "reserve", name: "虚构预留", phone: "320 000 1029", until: "2026-10-01", note: "虚构到店核对" };
  const reserved = command(original, action, "reserve");
  assert.equal(reserved.status, "reserved"); assert.equal(reserved.sales.length, 0);
  assert.equal(reserved.reservation.phone, "+393200001029");
  assert.equal(command(reserved, action, "reserve"), reserved);
  assert.equal(persisted(reserved).status, "reserved");
  assert.throws(() => command(reserved, sale({ customerPhone: "320 000 1028" }), "wrong-buyer"), /预留买家/);
  const sold = command(reserved, sale({ paymentUnreceived: true, customerName: "本次成交称呼" }), "reserved-sell");
  assert.equal(sold.sales[0].customerName, "本次成交称呼"); assert.equal(sold.reservation, null);
  const released = command(reserved, { type: "release_reservation" }, "release");
  assert.equal(released.status, "available"); assert.equal(released.reservation, null);
  assert.throws(() => command(original, { ...action, until: "2026-09-29" }));
  assert.throws(() => command(sold, action));
});

test("部分退款不转回库存，退款不超实收，零与未知不能猜成交价退款", () => {
  const partial = refund(pay(soldKnown()), "refund-part", 1000);
  assert.equal(partial.status, "sold");
  assert.equal(partial.sales[0].returned, undefined);
  assert.equal(retailRefundedCents(partial.sales[0]), 1000);
  assert.equal(retailSaleState(partial.sales[0]), "partial_refund");
  assert.throws(() => refund(partial, "over-refund", 25001), /超过有效实收/);
  assert.throws(() => refund(soldKnown(), "no-receipt", 1), /超过有效实收/);
  const unknown = command(unit({ status: "available", inspection: completeChecks }), sale(), "unknown");
  assert.throws(() => refund(unknown, "unknown-refund", 1), /付款未知/);
  assert.equal(command(partial, requestMoney("refund", "refund-part", 1000), "retry"), partial);
  assert.throws(() => command(partial, requestMoney("refund", "refund-part", 1001), "retry"), /不同资料/);
  assert.deepEqual(persisted(partial), partial);
});

test("退回须明确收到原销售实物，暂停并清核验，未结清禁止所有重售入口", () => {
  const paid = pay(soldKnown());
  assert.throws(() => command(paid, { type: "return", saleId: "LOCAL-SALE-TEST", date: "2026-09-30", reason: "原因", received: false }), /实物已收到/);
  const returned = returnUnit(paid);
  assert.equal(returned.status, "hold"); assert.deepEqual(returned.inspection, { functional: false, ownership: false, data: false });
  assert.equal(returned.sales[0].returned.received, true); assert.equal(returned.sales[0].product.id, returned.id);
  assert.equal(isRetailReturnSettled(returned.sales[0]), false);
  assert.equal(retailSaleState(returned.sales[0]), "return_pending_refund");
  for (const action of [{ type: "reinspect" }, { type: "approve" }, sale({ saleId: "bypass-new", paymentUnreceived: true })]) assert.throws(() => command(returned, action, "bypass"), /退款尚未结清/);
  for (const status of ["available", "inspecting"]) assert.throws(() => command({ ...returned, status, inspection: completeChecks }, status === "available" ? sale({ saleId: "new-sale" }) : { type: "approve" }, "bypass"), /退款尚未结清/);
  assert.equal(returnUnit(returned), returned);
  assert.deepEqual(persisted(returned), returned);
  assert.throws(() => pay(returned, "post-return", 1), /不能追加收款/);
});

test("全额退款仍保持已售直至实物退回，退回零实收可明确结清后复检", () => {
  const refunded = refund(pay(soldKnown()));
  assert.equal(refunded.status, "sold"); assert.equal(isRetailReturnSettled(refunded.sales[0]), false);
  const returned = returnUnit(refunded);
  assert.equal(isRetailReturnSettled(returned.sales[0]), true);
  assert.equal(retailSaleState(returned.sales[0]), "returned");
  assert.equal(command(returned, { type: "reinspect" }, "reinspect").status, "inspecting");
  const unpaidReturn = returnUnit(soldKnown());
  assert.equal(isRetailReturnSettled(unpaidReturn.sales[0]), true);
  assert.equal(command(unpaidReturn, { type: "reinspect" }, "zero-reinspect").status, "inspecting");
});

test("退款冲销保留原事实，已开始复检、上架或复售不能破坏退回结清", () => {
  const returned = refund(returnUnit(pay(soldKnown())));
  const undo = { type: "refund_void", saleId: "LOCAL-SALE-TEST", entryId: "refund-1", reason: "虚构退款未发生更正" };
  const corrected = command(returned, undo, "refund-void");
  assert.equal(corrected.sales[0].refunds[0].amountCents, 26000);
  assert.equal(retailRefundedCents(corrected.sales[0]), 0);
  assert.equal(isRetailReturnSettled(corrected.sales[0]), false);
  assert.throws(() => command(corrected, { type: "reinspect" }, "blocked"), /退款尚未结清/);
  const inspecting = command(returned, { type: "reinspect" }, "reinspect");
  assert.throws(() => command(inspecting, undo, "undo-after-inspect"), /重新检测、上架或复售/);
  const checked = command(inspecting, { type: "inspect", checks: completeChecks }, "checks");
  const available = command(checked, { type: "approve" }, "approve");
  assert.throws(() => command(available, undo, "undo-after-approve"), /重新检测、上架或复售/);
  const resold = command(available, sale({ saleId: "sale-2", paymentUnreceived: true }), "resold");
  assert.throws(() => command(resold, undo, "undo-after-resale"), /重新检测、上架或复售/);
  assert.equal(resold.sales.length, 2);
  assert.equal(currentRetailSale(resold).id, "sale-2");
  assert.deepEqual(persisted(resold), resold);
});

test("同机复售保留旧售后历史，旧sale不能接收新买家的实物售后", () => {
  const pending = command(pay(soldKnown()), caseRequest({ custody: "not_left" }), "old-case");
  assert.throws(() => returnUnit(pending), /未关闭售后/);
  const cancelled = command(pending, { type: "after_sale_cancel", saleId: "LOCAL-SALE-TEST", caseId: "case-1", reason: "虚构客户取消未送机申请" }, "old-cancel");
  const returned = refund(returnUnit(cancelled));
  const inspecting = command(returned, { type: "reinspect" }, "again");
  const checked = command(inspecting, { type: "inspect", checks: completeChecks }, "again-checks");
  const available = command(checked, { type: "approve" }, "again-approve");
  const resold = command(available, sale({ saleId: "new-sale", customerPhone: "320 000 1028", paymentUnreceived: true }), "new-sale-event");
  assert.throws(() => command(resold, caseRequest({ caseId: "new-old-case" }), "old-buyer-after-sale"), /当前未退回/);
  assert.equal(resold.status, "sold"); assert.equal(resold.currentSaleId, "new-sale");
  assert.equal(resold.sales[0].afterSales.length, 1); assert.equal(resold.sales[1].afterSales.length, 0);
  assert.equal(resold.sales[0].afterSales[0].cancelled.reason, "虚构客户取消未送机申请");
  assert.equal(resold.sales[1].customerPhone, "+393200001028"); assert.equal(resold.sales[1].paidCents, 0);
  assert.throws(() => command(resold, { type: "deliver", saleId: "LOCAL-SALE-TEST", deliveryDate: "2026-09-30" }, "old-deliver"), /当前已售/);
  assert.throws(() => command(resold, { type: "return", saleId: "LOCAL-SALE-TEST", date: "2026-09-30", received: true, reason: "不同退回" }, "old-return"), /不同资料/);
  assert.deepEqual(persisted(resold), resold);
});

test("售后申请、人工覆盖判断、稳定关联和明确交还关闭，不改变原销售身份", () => {
  const initial = soldKnown(); const opened = command(initial, caseRequest(), "case-open");
  assert.equal(opened.sales[0].afterSales[0].coverage, "pending"); assert.equal(opened.status, "sold");
  assert.equal(command(opened, caseRequest(), "case-retry"), opened);
  assert.throws(() => command(opened, caseRequest({ issue: "不同故障" }), "different"), /不同资料/);
  assert.throws(() => command(opened, { type: "after_sale_assess", saleId: "LOCAL-SALE-TEST", caseId: "case-1", coverage: "commercial", reason: " " }, "blank"));
  const assessed = command(opened, { type: "after_sale_assess", saleId: "LOCAL-SALE-TEST", caseId: "case-1", coverage: "statutory", reason: "虚构人工法定保障核对" }, "assess");
  assert.equal(assessed.sales[0].afterSales[0].coverage, "statutory");
  const close = { type: "after_sale_close", saleId: "LOCAL-SALE-TEST", caseId: "case-1", date: "2026-09-30", resolution: "虚构完成维修", returned: true };
  assert.throws(() => command(assessed, close, "unlinked-close"), /关联已完成维修/);
  const link = { type: "after_sale_link", saleId: "LOCAL-SALE-TEST", caseId: "case-1", repairId: "LOCAL-DEMO-REPAIR-1" };
  const linked = command(assessed, link, "link");
  assert.equal(command(linked, link, "link-retry"), linked);
  assert.throws(() => command(linked, { ...link, repairId: "different" }, "relink"), /不同资料/);
  assert.throws(() => command(linked, { ...close, returned: false }, "not-returned"), /明确交还/);
  const closed = command(linked, close, "closed");
  assert.equal(closed.sales[0].afterSales[0].closed.returned, true); assert.equal(closed.status, "sold");
  assert.equal(command(closed, close, "close-retry"), closed);
  assert.throws(() => command(closed, { type: "after_sale_assess", saleId: "LOCAL-SALE-TEST", caseId: "case-1", coverage: "paid", reason: "不能改" }, "closed-edit"), /已经|已明确关闭/);
  assert.deepEqual(persisted(closed), closed);
});

test("售后接收和关闭拒绝错误保管、无效日期、缺案、旧版本与未知覆盖", () => {
  const initial = soldKnown();
  for (const extra of [{ custody: "unknown" }, { date: "2026-02-29" }, { date: "2026-09-29" }, { date: "2026-10-01" }, { issue: " " }, { caseId: "" }]) assert.throws(() => command(initial, caseRequest(extra)));
  assert.throws(() => applyRetailCommand(initial, caseRequest(), event("case"), 1), /更新/);
  assert.throws(() => command(initial, { type: "after_sale_link", saleId: "LOCAL-SALE-TEST", caseId: "missing", repairId: "repair" }), /原售后记录/);
  const opened = command(initial, caseRequest(), "case");
  assert.throws(() => command(opened, { type: "after_sale_assess", saleId: "LOCAL-SALE-TEST", caseId: "case-1", coverage: "accident", reason: "事故不能自动拒保" }, "unsupported"));
});

test("毛利使用实际冻结成本和退款后成交收入，未知不计算，零和负数保持", () => {
  assert.equal(retailGrossProfit(26000, null, 0), null);
  assert.equal(retailGrossProfit(26000, 10000, undefined), null);
  assert.equal(retailGrossProfit(0, 0, 0), 0);
  assert.equal(retailGrossProfit(10000, 12000, 500), -2500);
  const sold = soldKnown({ costCents: 10000, refurbCents: 0 });
  assert.equal(retailSaleGrossProfit(sold.sales[0]), 16000);
  const changedCurrent = { ...sold, costCents: 100, refurbCents: 100 };
  assert.equal(retailSaleGrossProfit(changedCurrent.sales[0]), 16000);
  assert.equal(retailSaleGrossProfit(refund(pay(sold), "adjustment", 20000).sales[0]), -4000);
  assert.equal(retailSaleGrossProfit(soldKnown({ costCents: 0, refurbCents: null }).sales[0]), null);
});

test("实物照片只接受限量限体积的本地可验证图，已售锁定，不允许任意URI", () => {
  const original = unit(); const changed = command(original, { type: "photos", photos: [photo] }, "photos");
  assert.deepEqual(changed.photos, [photo]); assert.deepEqual(original.photos, []);
  assert.deepEqual(persisted(changed), changed);
  for (const value of [["https://example.invalid/x.png"], ["javascript:alert(1)"], ["data:image/svg+xml;base64,PHN2Zy8+"], ["data:image/png;base64,aGVsbG8="], ["data:image/png;base64,%%%="], Array(7).fill(photo), "invalid"]) assert.throws(() => validateRetailPhotos(value));
  const overLimit = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([255, 216, 255]), Buffer.alloc(250 * 1024)]).toString("base64");
  assert.throws(() => validateRetailPhotos([overLimit]), /大小|250 KiB/);
  assert.throws(() => command(soldKnown(), { type: "photos", photos: [photo] }, "sold-photos"), /锁定/);
});

test("账本存储拒绝伪造累计、无历史、重复ID、错误快照、坏金额和旧退回状态绕过", () => {
  const paid = pay(soldKnown());
  const mutate = fn => { const copy = structuredClone(paid); fn(copy); assert.throws(() => persisted(copy)); };
  mutate(record => { record.sales[0].paidCents = 0; });
  mutate(record => { record.sales[0].payments[0].eventId = "missing"; });
  mutate(record => { record.sales[0].payments.push({ ...record.sales[0].payments[0] }); });
  mutate(record => { record.sales[0].payments[0].amountCents = 1.5; });
  mutate(record => { record.sales[0].product.id = "other-device"; });
  mutate(record => { record.sales[0].product.secret = 1; });
  mutate(record => { record.sales[0].paymentOpeningCents = null; record.sales[0].paidCents = null; });
  mutate(record => { record.sales[0].paymentUnreceived = "true"; });
  mutate(record => { record.sales[0].payments[0].method = "unknown"; });
  mutate(record => { record.currentSaleId = "missing"; });
  const returned = returnUnit(paid);
  assert.throws(() => persisted({ ...returned, status: "available" }));
  assert.throws(() => persisted({ ...returned, photos: ["arbitrary-uri"] }));
});

test("事件保留操作者与财务分类，非法历史字段、超限和未知命令被拒绝", () => {
  const initial = soldKnown();
  const request = requestMoney("payment", "actor-payment", 100);
  const operated = applyRetailCommand(initial, request, { ...event("actor-payment"), actorId: "demo-owner", actorName: "DEMO 老板", sensitive: "financial" }, initial.version);
  assert.equal(operated.sales[0].payments[0].actorId, "demo-owner");
  assert.equal(operated.events.at(-1).sensitive, "financial");
  assert.deepEqual(persisted(operated), operated);
  for (const extra of [{ actorId: "" }, { actorName: 1 }, { sensitive: "unknown" }, { time: "2026-02-29 10:00" }]) assert.throws(() => applyRetailCommand(initial, request, { ...event("bad"), ...extra }, initial.version));
  assert.throws(() => command(unit({ status: "hold" }), { type: "arbitrary" }), /未知/);
  const many = unit({ events: Array.from({ length: 1000 }, (_, index) => event(`event-${index}`)) });
  assert.throws(() => command(many, { type: "price", priceCents: 10000 }, "limit"), /上限/);
  assert.throws(() => persisted({ ...many, events: [...many.events, event("extra")] }));
  assert.throws(() => command(unit({ status: "inspecting" }), { type: "inspect", checks: { functional: true, ownership: true, data: true, injected: true } }));
});

test("售后人工判断更正追加原原因与操作者历史，同事件幂等且不同内容拒绝", () => {
  const opened = command(soldKnown(), caseRequest(), "case-open");
  const firstRequest = { type: "after_sale_assess", saleId: "LOCAL-SALE-TEST", caseId: "case-1", coverage: "pending", reason: "虚构需继续核对" };
  const first = command(opened, firstRequest, "assessment-1");
  const second = command(first, { ...firstRequest, coverage: "commercial", reason: "虚构核对后覆盖" }, "assessment-2");
  assert.equal(second.sales[0].afterSales[0].assessmentReason, "虚构核对后覆盖");
  assert.equal(second.sales[0].afterSales[0].assessments[0].reason, "虚构需继续核对");
  assert.equal(second.sales[0].afterSales[0].assessments.length, 2);
  assert.equal(applyRetailCommand(second, firstRequest, event("assessment-1"), 1), second);
  assert.throws(() => command(second, { ...firstRequest, reason: "不同原因" }, "assessment-1"), /不同资料/);
  assert.deepEqual(persisted(second), second);
  const malformed = structuredClone(second);
  malformed.sales[0].afterSales[0].coverage = "statutory";
  assert.throws(() => persisted(malformed));
});

test("新交付事实须对应事件，存储未来日期、坏冲销和坏售后关联不能恢复", () => {
  const paid = pay(soldKnown());
  const delivered = command(paid, { type: "deliver", saleId: "LOCAL-SALE-TEST", deliveryDate: "2026-09-30" }, "deliver");
  const future = structuredClone(delivered); future.sales[0].deliveryDate = "2026-10-01";
  assert.throws(() => persisted(future));
  const missing = structuredClone(delivered); missing.sales[0].deliveryEventId = "missing";
  assert.throws(() => persisted(missing));
  const voided = command(paid, { type: "payment_void", saleId: "LOCAL-SALE-TEST", entryId: "pay-1", reason: "虚构更正" }, "void");
  const badVoid = structuredClone(voided); badVoid.sales[0].payments[0].void.reason = "";
  assert.throws(() => persisted(badVoid));
  const opened = command(paid, caseRequest(), "open");
  const badCase = structuredClone(opened); badCase.sales[0].afterSales[0].repairId = "not-verified";
  assert.throws(() => persisted(badCase));
  assert.throws(() => parseStoredRetailUnits("", [paid]));
});

test("未送机未关联的售后可明确撤销，保留判断与原因并解除退回占用", () => {
  const opened = command(soldKnown(), caseRequest({ custody: "not_left" }), "request");
  assert.throws(() => returnUnit(opened), /未关闭售后/);
  const assessed = command(opened, { type: "after_sale_assess", saleId: "LOCAL-SALE-TEST", caseId: "case-1", coverage: "statutory", reason: "虚构已人工核对法定保障" }, "assess");
  const cancel = { type: "after_sale_cancel", saleId: "LOCAL-SALE-TEST", caseId: "case-1", reason: "虚构客户取消未送机申请" };
  const cancelled = command(assessed, cancel, "cancel");
  const request = cancelled.sales[0].afterSales[0];
  assert.equal(request.coverage, "statutory"); assert.equal(request.assessments.length, 1);
  assert.equal(request.cancelled.reason, cancel.reason); assert.equal(request.closed, undefined); assert.equal(request.repairId, undefined);
  assert.equal(command(cancelled, cancel, "retry"), cancelled);
  assert.throws(() => command(cancelled, { ...cancel, reason: "不同原因" }, "other"), /不同资料/);
  for (const commandAfterCancel of [{ type: "after_sale_assess", saleId: cancel.saleId, caseId: cancel.caseId, coverage: "paid", reason: "虚构" }, { type: "after_sale_link", saleId: cancel.saleId, caseId: cancel.caseId, repairId: "LOCAL-REPAIR" }, { type: "after_sale_close", saleId: cancel.saleId, caseId: cancel.caseId, date: "2026-09-30", resolution: "虚构", returned: true }]) assert.throws(() => command(cancelled, commandAfterCancel, "cancelled-edit"), /已撤销/);
  const returned = returnUnit(cancelled); assert.equal(returned.status, "hold");
  assert.equal(command(returned, { type: "reinspect" }, "reinspect").status, "inspecting");
  assert.deepEqual(persisted(cancelled), cancelled);
});

test("已收机或已关联维修不能撤销假装交还，取消需原因和新版本，坏取消存储拒绝", () => {
  const cancel = { type: "after_sale_cancel", saleId: "LOCAL-SALE-TEST", caseId: "case-1", reason: "虚构取消" };
  const left = command(soldKnown(), caseRequest(), "left");
  assert.throws(() => command(left, cancel, "cancel-left"), /已收机/);
  const notLeft = command(soldKnown(), caseRequest({ custody: "not_left" }), "not-left");
  assert.throws(() => command(notLeft, { ...cancel, reason: " " }, "blank"), /原因/);
  assert.throws(() => applyRetailCommand(notLeft, cancel, event("stale"), notLeft.version - 1), /更新/);
  const linked = command(notLeft, { type: "after_sale_link", saleId: cancel.saleId, caseId: cancel.caseId, repairId: "LOCAL-REPAIR" }, "linked");
  assert.throws(() => command(linked, cancel, "cancel-linked"), /未关联维修/);
  const cancelled = command(notLeft, cancel, "cancel");
  for (const change of [value => { value.sales[0].afterSales[0].custody = "left"; }, value => { value.sales[0].afterSales[0].repairId = "LOCAL-REPAIR"; }, value => { value.sales[0].afterSales[0].cancelled.reason = ""; }, value => { value.sales[0].afterSales[0].cancelled.eventId = "missing"; }, value => { value.sales[0].afterSales[0].cancelled.time = "2026-09-29 10:00"; }]) {
    const bad = structuredClone(cancelled); change(bad); assert.throws(() => persisted(bad));
  }
});

test("财务编辑在领域追加敏感分类，款项和售后动作不能早于原事实", () => {
  const edited = edit(unit({ costCents: 10000 }), "costCents", 12000, "cost-change");
  assert.equal(edited.events.at(-1).sensitive, "financial");
  const sold = soldKnown();
  assert.throws(() => applyRetailCommand(sold, { type: "payment_reconcile", saleId: "LOCAL-SALE-TEST", paidCents: 0, reason: "虚构" }, { ...event("before-sale"), time: "2026-09-29 12:00" }, sold.version), /早于原销售/);
  const payment = { type: "payment", saleId: "LOCAL-SALE-TEST", entryId: "later-pay", amountCents: 10000, date: "2026-10-01", method: "cash", note: "虚构" };
  const paid = applyRetailCommand(sold, payment, { ...event("later-pay"), time: "2026-10-01 12:00" }, sold.version);
  assert.throws(() => command(paid, { type: "payment_void", saleId: payment.saleId, entryId: payment.entryId, reason: "虚构" }, "early-void"), /早于原款项/);
  const requested = applyRetailCommand(sold, caseRequest({ date: "2026-10-01" }), { ...event("later-case"), time: "2026-10-01 12:00" }, sold.version);
  assert.throws(() => command(requested, { type: "after_sale_assess", saleId: "LOCAL-SALE-TEST", caseId: "case-1", coverage: "pending", reason: "虚构" }, "early-assess"), /早于售后接收日/);
});

test("售出邮箱与新售后诉求保持接机桥接边界，超长输入不先写入不可建单事实", () => {
  const saleCommand = {type:"sell",saleId:"LOCAL-SALE-LENGTH",customerPhone:"3331234567",customerName:"DEMO",customerEmail:"a".repeat(150)+"@demo.local",priceCents:10000,warranty:{months:12,termsVersion:retailWarrantyTermsVersion,shopName:"DEMO",address:"DEMO",phone:"3331234567"}};
  assert.throws(() => command(unit({status:"available",priceCents:10000,inspection:{functional:true,ownership:true,data:true}}),saleCommand), /160/);
  assert.throws(() => command(soldKnown(),caseRequest({issue:"测".repeat(3001)}),"long-issue"), /3000/);
});


test("创建边界按创建日期分配顺序号，旧编号保留且不可更正", () => {
  const original = unit({ code: "CT-26-0002" });
  const old = unit({ id: "legacy", code: "CT-DEMO-OLD" });
  assert.equal(nextRetailCode([original, old], "2026-10-01"), "CT-20261001-0001");
  const first = createRetailUnit(unit({ id: "new-a", code: "arbitrary", intakeDate: "2020-01-01" }), [original, old], { ...event("new-a"), time: "2026-10-01 12:30" });
  const second = createRetailUnit(unit({ id: "new-b", code: "arbitrary" }), [original, old, first], { ...event("new-b"), time: "2026-10-01 12:31" });
  assert.equal(first.code, "CT-20261001-0001");
  assert.equal(second.code, "CT-20261001-0002");
  assert.equal(first.intakeDate, "2020-01-01");
  assert.equal(nextRetailCode([first, second], "2026-10-02"), "CT-20261002-0001");
  assert.equal(nextRetailCode([unit({code:" ct-20261001-0098 "})], "2026-10-01"), "CT-20261001-0099");
  assert.throws(() => nextRetailCode([], "2026-02-30"), /日期/);
  assert.throws(() => createRetailUnit(unit({id:"new-a"}), [first], event("retry")), /编号/);
  assert.equal(original.code, "CT-26-0002");
  assert.equal(old.code, "CT-DEMO-OLD");
  assert.equal(parseStoredRetailUnits(JSON.stringify({version:1,units:[first,second]}), []).length, 2);
});

test("未保存草稿切换品类清理过期身份和候选，已保存档案不静默清理", () => {
  const draft = { ...emptyRetailUnit(), brand:"Apple", model:"iPhone 13", color:"蓝色", serial:"demo-sn", productCode:"phone-box", imei1:"000000000000123", bodyStorage:{capacity:128,unit:"GB"}, batteryPercent:78, condition:"新机", priceCents:22000, source:"DEMO" };
  const changed = changeRetailDraftCategory(draft, "console");
  assert.equal(changed.category, "console");
  for (const key of ["brand","model","color","serial","productCode","imei1","imei2","cpu","gpu","edition"]) assert.equal(changed[key], "");
  assert.equal(changed.bodyStorage, null);
  assert.equal(changed.batteryPercent, null);
  assert.equal(changed.condition, "新机");
  assert.equal(changed.source, "DEMO");
  assert.equal(changed.priceCents, 22000);
  assert.equal(draft.model, "iPhone 13");
  assert.equal(changeRetailDraftCategory(draft, "phone"), draft);
  assert.throws(() => changeRetailDraftCategory(unit(), "console"), /已保存/);
});

test("掌机可登记实测电池健康，未知仍为null且更正会重新检测", () => {
  const handheld = unit({category:"console",brand:"Nintendo",model:"Switch",status:"available",inspection:completeChecks});
  assert.equal(canEditRetailField(handheld, "batteryPercent"), true);
  assert.equal(handheld.batteryPercent, null);
  const changed = edit(handheld, "batteryPercent", 90);
  assert.equal(changed.status,"inspecting");
  assert.equal(changed.batteryPercent,90);
  assert.throws(() => edit(handheld,"batteryPercent",101), /0–100/);
});

test("金额支持单独的小数点或逗号并按整数分解析，拒绝歧义千位及截断", () => {
  for (const [raw, cents] of [["0",0],["0,01",1],["12,3",1230],[" 123,45 ",12345],["260.10",26010],["999999,99",99999999],["1000000",100000000]]) assert.equal(parseRetailMoney(raw),cents);
  for (const raw of ["1,000", "1.000", "1,000.00", "1.000,00", "1 000", "1,", ".5", "-0.1", "1e3", "Infinity", "1000000,01"]) assert.throws(()=>parseRetailMoney(raw));
});

test("新建与逐项更正共用实测上限与真实日期，未知与零各自保留", () => {
  for(const extra of [{ramGb:8193},{controllers:101},{intakeDate:"2026-02-29"},{disks:Array.from({length:17},()=>({capacity:512,unit:"GB",type:"SSD"}))},{disks:[{capacity:512,unit:"GB",type:"USB"}]},{bodyStorage:{capacity:1025,unit:"TB"}}]) assert.throws(()=>createRetailUnit(unit(extra),[],event("create-invalid")));
  const unknown=createRetailUnit(unit({batteryPercent:null,controllers:null,intakeDate:""}),[],event("create-unknown"));
  assert.equal(unknown.batteryPercent,null); assert.equal(unknown.controllers,null);
  const measured=createRetailUnit(unit({batteryPercent:0,controllers:0,intakeDate:"2024-02-29"}),[],event("create-zero"));
  assert.equal(measured.batteryPercent,0); assert.equal(measured.controllers,0); assert.equal(measured.intakeDate,"2024-02-29");
});

test("正式照片引用仅用于浏览器核对，服务端和持久化仍要求图片原字节",()=>{
 const photo='/api/backend/retail-photo?unit=synthetic-unit&index=0&hash='+"a".repeat(64);
 const record=unit({photos:[photo]});
 assert.throws(()=>validateRetailFieldEdit(record,{field:"model",value:"updated"}),/照片/);
 assert.equal(validateRetailFieldEdit(record,{field:"model",value:"updated"},[],true).model,"updated");
 assert.equal(validateRetailFieldEdit(record,{field:"warrantyMonths",value:24},[],true).warrantyMonths,24);
 for(const invalid of ['https://example.invalid'+photo,photo+'&extra=1',photo.replace('index=0','index=6'),photo.replace('hash=','hash=bad')])assert.throws(()=>validateRetailPhotos([invalid],true));
});
