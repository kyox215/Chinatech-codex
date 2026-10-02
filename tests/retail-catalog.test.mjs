import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/retail-catalog.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { retailCatalogOptions, retailRamPresets, retailStoragePresets, catalogSources, retailCatalogCounts } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const values = (field, category, brand, units) => retailCatalogOptions(field, category, brand, units).map(option => option.value);
const categories = ["phone", "tablet", "laptop", "desktop", "console", "other"];
const fields = ["brand", "model", "cpu", "gpu", "keyboard", "edition"];
const record = (category, extra = {}) => ({ category, brand: "", model: "", cpu: "", gpu: "", keyboard: "", edition: "", ...extra });
const normalize = value => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

test("目录是无运行时业务依赖的候选模块，来源保留可核验地址与日期", () => {
  assert.doesNotMatch(compiled, /from\s+["']\.\/retail["']/);
  assert.equal(new Set(catalogSources.map(source => source.id)).size, catalogSources.length);
  for (const source of catalogSources) {
    assert.ok(source.title.trim());
    assert.match(source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
    assert.ok(["intel.com", "amd.com", "nvidia.com", "apple.com", "playstation.com", "xbox.com", "nintendo.com", "steamdeck.com", "asus.com", "lenovo.com"].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)), source.url);
  }
  assert.equal(retailCatalogCounts.sources, catalogSources.length);
});

test("每类每字段候选唯一，移动和桌面并集计数准确，输出不含实測参数", () => {
  for (const category of categories) for (const field of fields) {
    const options = retailCatalogOptions(field, category);
    assert.equal(new Set(options.map(option => normalize(option.value))).size, options.length, `${category}/${field}`);
    for (const option of options) {
      assert.equal(option.value, option.label);
      assert.deepEqual(Object.keys(option).filter(key => !["value", "label", "detail"].includes(key)), []);
    }
  }
  for (const field of ["cpu", "gpu"]) {
    assert.equal(new Set([...values(field, "laptop"), ...values(field, "desktop")]).size, retailCatalogCounts[field]);
  }
  assert.equal(values("model", "console").length, retailCatalogCounts.consoleModels);
});

test("电脑处理器按移动桌面区分，不根据整机品牌排除其它制造商", () => {
  const mobile = values("cpu", "laptop", "Dell");
  const desktop = values("cpu", "desktop", "Dell");
  for (const value of ["Intel Core i5-8250U", "Intel Core i7-12700H", "Intel Core Ultra 7 155H", "Intel Celeron N4020", "Intel Pentium Gold 7505", "AMD Ryzen 5 3500U", "AMD Ryzen 7 7840U", "AMD Ryzen AI 9 HX 370", "Apple M1", "Apple M5 Pro"]) assert.ok(mobile.includes(value), value);
  for (const value of ["Intel Core i5-2400", "Intel Core i5-12400F", "Intel Core Ultra 9 285K", "Intel Pentium G4560", "AMD Athlon 3000G", "AMD Ryzen 5 5600G", "AMD Ryzen 7 7800X3D", "Apple M2", "Apple M3 Ultra"]) assert.ok(desktop.includes(value), value);
  assert.ok(!desktop.includes("Intel Core i5-8250U"));
  assert.ok(!mobile.includes("Intel Core i5-12400F"));
  assert.deepEqual(retailCatalogOptions("cpu", "laptop", "Dell"), retailCatalogOptions("cpu", "laptop", "Apple"));
});

test("显卡保留旧代、集成和独显，桌面型号与移动型号不同名", () => {
  const mobile = values("gpu", "laptop");
  const desktop = values("gpu", "desktop");
  for (const value of ["NVIDIA GeForce MX150", "NVIDIA GeForce GTX 1050（移动版）", "NVIDIA GeForce RTX 3060 Laptop GPU", "NVIDIA GeForce RTX 5070 Laptop GPU", "AMD Radeon RX 5700M", "Intel Iris Xe Graphics", "Intel Arc A370M", "Apple M1 GPU"]) assert.ok(mobile.includes(value), value);
  for (const value of ["NVIDIA GeForce GTX 750 Ti", "NVIDIA GeForce GTX 1060", "NVIDIA GeForce RTX 3060", "NVIDIA GeForce RTX 5070", "AMD Radeon RX 580", "AMD Radeon RX 7800 XT", "Intel UHD Graphics 630", "Intel Arc B580"]) assert.ok(desktop.includes(value), value);
  assert.ok(!desktop.includes("NVIDIA GeForce RTX 3060 Laptop GPU"));
  assert.ok(!mobile.includes("NVIDIA GeForce RTX 3060"));
});

test("游戏机型号按制造商品牌筛选，保留各代主机与掌机", () => {
  const expected = {
    Sony: ["PlayStation 2", "PlayStation 5 Pro", "PSP-3000", "PS Vita PCH-2000"],
    Microsoft: ["Xbox", "Xbox 360", "Xbox One X", "Xbox Series S"],
    Nintendo: ["Nintendo Switch 2", "Nintendo Switch OLED", "Nintendo 3DS", "Wii U"],
    Valve: ["Steam Deck LCD", "Steam Deck OLED"], ASUS: ["ROG Ally (2023)", "ROG Ally X (2024)"], Lenovo: ["Legion Go"],
  };
  for (const [brand, models] of Object.entries(expected)) {
    const options = retailCatalogOptions("model", "console", brand);
    for (const model of models) assert.ok(options.some(option => option.value === model), `${brand}/${model}`);
    assert.ok(options.every(option => option.detail.startsWith(`${brand} ·`)));
    assert.deepEqual(options, retailCatalogOptions("model", "console", ` ${brand.toLowerCase()} `));
  }
  assert.deepEqual(values("model", "console", "未知品牌"), []);
  assert.ok(!values("model", "console", "Sony").includes("PlayStation Portal"));
});

test("已登记的手动型号与硬件值加入本类别候选，未知值不被替换或修改", () => {
  const units = [record("console", { brand: "虚构测试品牌", model: "虚构自定义掌机" }), record("laptop", { brand: "虚构测试品牌", cpu: "虚构自定义处理器", gpu: "虚构自定义显卡", keyboard: "虚构键盘" })];
  const original = structuredClone(units);
  assert.ok(values("brand", "console", "", units).includes("虚构测试品牌"));
  assert.ok(values("model", "console", "虚构测试品牌", units).includes("虚构自定义掌机"));
  assert.ok(values("cpu", "laptop", "", units).includes("虚构自定义处理器"));
  assert.ok(values("gpu", "laptop", "", units).includes("虚构自定义显卡"));
  assert.ok(values("keyboard", "laptop", "", units).includes("虚构键盘"));
  assert.deepEqual(units, original);
  assert.ok(!values("model", "console", "Nintendo", units).includes("虚构自定义掌机"));
});

test("已有候选对大小写、全半角及多余空格去重，过滤空或非法文本", () => {
  const units = [record("console", { brand: " Nintendo ", model: " Nintendo   Switch " }), record("console", { brand: "ＮＩＮＴＥＮＤＯ", model: "Ｎｉｎｔｅｎｄｏ Ｓｗｉｔｃｈ" }), record("console", { brand: "Nintendo", model: "虚构型号" }), record("console", { brand: "Nintendo", model: "虚构型号" }), record("console", { brand: "Nintendo", model: " " }), record("console", { brand: "Nintendo", model: "x".repeat(5001) }), record("console", { brand: "Nintendo", model: "虚构\u0000型号" })];
  const options = retailCatalogOptions("model", "console", "Nintendo", units);
  assert.equal(options.filter(option => normalize(option.value) === normalize("Nintendo Switch")).length, 1);
  assert.equal(options.filter(option => option.value === "虚构型号").length, 1);
  assert.ok(options.every(option => option.value.trim() && option.value.length <= 5000 && !option.value.includes("\u0000")));
});

test("类别候选独立：手机规格不混入电脑CPU、其他类别不混键盘与主机版本", () => {
  const units = [record("laptop", { brand: "虚构电脑品牌", model: "虚构笔记本", cpu: "虚构 CPU", edition: "虚构电脑版本" }), record("phone", { brand: "虚构手机品牌", model: "虚构手机" })];
  for (const category of ["phone", "tablet", "console", "other"]) for (const field of ["cpu", "gpu"]) assert.deepEqual(retailCatalogOptions(field, category, "", units), []);
  for (const category of ["phone", "tablet", "desktop", "console", "other"]) assert.deepEqual(retailCatalogOptions("keyboard", category, "", units), []);
  for (const category of ["laptop", "desktop", "other"]) assert.deepEqual(retailCatalogOptions("edition", category, "", units), []);
  assert.ok(!values("brand", "phone", "", units).includes("虚构电脑品牌"));
  assert.ok(values("model", "phone", "虚构手机品牌", units).includes("虚构手机"));
});

test("常见RAM和机身容量分开，容量返回独立GB/TB对象且未知值不填零", () => {
  for (const value of [2, 3, 4, 6, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128, 192]) assert.ok(retailRamPresets.includes(value));
  assert.ok(retailRamPresets.every(value => Number.isSafeInteger(value) && value > 0));
  assert.equal(new Set(retailRamPresets).size, retailRamPresets.length);
  for (const category of ["phone", "tablet"]) {
    const options = retailStoragePresets(category);
    for (const capacity of [16, 32, 64, 128, 256, 512]) assert.ok(options.some(option => option.capacity === capacity && option.unit === "GB"));
    for (const capacity of [1, 2]) assert.ok(options.some(option => option.capacity === capacity && option.unit === "TB"));
    assert.ok(options.every(option => option.capacity > 0 && !["ramGb", "type"].some(key => Object.hasOwn(option, key))));
  }
  for (const capacity of [8, 32, 64, 128, 256, 512, 825]) assert.ok(retailStoragePresets("console").some(option => option.capacity === capacity && option.unit === "GB"));
  for (const category of ["laptop", "desktop", "other"]) assert.deepEqual(retailStoragePresets(category), []);
  const changed = retailStoragePresets("phone"); changed[0].capacity = 999;
  assert.equal(retailStoragePresets("phone")[0].capacity, 16);
});

test("候选检索文字保留无连字符别名，调用方修改返回选项不污染目录", () => {
  const option = retailCatalogOptions("cpu", "laptop").find(option => option.value === "Intel Core i5-8250U");
  assert.ok(`${option.label} ${option.detail}`.toLowerCase().includes("i5 8250u"));
  const ps5 = retailCatalogOptions("model", "console", "Sony").find(option => option.value === "PlayStation 5");
  assert.ok(`${ps5.label} ${ps5.detail}`.toLowerCase().includes("ps5"));
  const xboxBrand = retailCatalogOptions("brand", "console").find(option => option.value === "Microsoft");
  assert.ok(`${xboxBrand.label} ${xboxBrand.detail}`.toLowerCase().includes("xbox"));
  option.label = "虚构改动";
  assert.equal(retailCatalogOptions("cpu", "laptop").find(option => option.value === "Intel Core i5-8250U").label, "Intel Core i5-8250U");
  const keyboard = retailCatalogOptions("keyboard", "laptop"); keyboard[0].value = "虚构改动";
  assert.equal(retailCatalogOptions("keyboard", "laptop")[0].value, "IT");
});
