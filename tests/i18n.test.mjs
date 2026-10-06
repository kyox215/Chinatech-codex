import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modules = new Map();
async function moduleUrl(file) {
  if (modules.has(file)) return modules.get(file);
  if (file.endsWith(".json")) return `data:text/javascript;base64,${Buffer.from(`export default ${readFileSync(file, "utf8")}`).toString("base64")}`;
  const result = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }, reportDiagnostics: true });
  assert.deepEqual(result.diagnostics, []);
  let output = result.outputText;
  for (const match of output.matchAll(/from ["'](\.\.?\/[^"']+)["']/g)) {
    const dependency = resolve(dirname(file), match[1] + (/\.json$/.test(match[1]) ? "" : ".ts"));
    output = output.replace(match[0], `from "${await moduleUrl(dependency)}"`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
  modules.set(file, url);
  return url;
}
const load = async name => import(await moduleUrl(resolve(root, name)));
const { translate, translateSystemMessage } = await load("lib/i18n/translate.ts");
const { interfaceMessages } = await load("lib/i18n/interface.ts");
const { errorMessages } = await load("lib/i18n/errors.ts");
const { publicMessages } = await load("lib/i18n/public.ts");
const structured = JSON.parse(readFileSync(resolve(root, "lib/i18n/structured.json"), "utf8"));
const { retailDisplaySpec } = await load("lib/i18n/retail-display.ts");
const { getTutorials } = await load("lib/tutorials.ts");
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test("display dictionaries provide Italian and English without losing message variables", () => {
  for (const [source, entries] of Object.entries({ ...structured, ...errorMessages, ...interfaceMessages, ...publicMessages })) {
    assert.equal(entries.length, 2, source);
    for (const entry of entries) {
      assert.ok(entry.trim(), source);
      assert.deepEqual(placeholders(entry), placeholders(source), source);
    }
  }
});

test("display translation preserves unknown text and explicit original facts", () => {
  assert.equal(translate("登录", "it"), "Accedi");
  assert.equal(translate("客户张三 · 原始备注", "en"), "客户张三 · 原始备注");
  for (const text of ["__proto__", "constructor", "toString"]) assert.equal(translate(text, "en"), text);
  assert.equal(translate("{constructor}", "zh-CN", {}), "{constructor}");
  assert.equal(translate("报价客户中文自由补充", "en"), "报价客户中文自由补充");
  assert.equal(translate("第 {number} 集 {title}", "en", { number: "02", title: "客户中文原文" }), "Episode 02 客户中文原文");
  assert.equal(translate("{count} 条", "it", { count: 0 }), "0 record");
  assert.equal(translate("第 {number} 集", "zh-CN", { number: "02" }), "第 02 集");
});

test("translated errors retain numeric limits and explicit failed-operation boundaries", () => {
  for (const [source, entries] of Object.entries(errorMessages)) {
    const numbers = text => text.match(/\d+/g) ?? [];
    for (const entry of entries) assert.deepEqual(numbers(entry), numbers(source), source);
  }
  assert.equal(translate("工单已变化，请核对最新状态后重试。", "en"), "The repair order has changed. Check its latest status before retrying.");
  assert.match(translate("员工预览资料格式异常，现有资料未被覆盖。", "it"), /non sono stati sovrascritti/);
  assert.equal(translate("请先明确恢复维修，再新增或更改维修项目。 ", "en"), "Explicitly resume the repair before adding or changing repair items. ");
});

test("reviewed system sentences localize fields and preserve original names and limits", () => {
  assert.equal(translateSystemMessage("电池健康须为整数，未知请留空。", "en"), "Battery health must be an integer; leave blank if unknown.");
  assert.equal(translateSystemMessage("请输入 0–100 的整数。", "it"), "Inserisci un numero intero compreso tra 0 e 100.");
  assert.equal(translateSystemMessage("客户邮箱须为有效文字，最多 160 字。", "en"), "Customer email must be valid text, up to 160 characters.");
  assert.equal(translateSystemMessage("有效", "en"), "Active");
  const original = "客户  自选屏幕";
  const message = `${original}已有采购记录，清空供应商不能取消采购。`;
  assert.equal(translateSystemMessage(message, "en"), `${original} already has a purchase record. Clearing the supplier does not cancel the purchase.`);
  assert.equal(translate(message, "en"), message);
  assert.equal(translateSystemMessage(message, "zh-CN"), message);
  assert.equal(translateSystemMessage("{name}：填写进价前请选择供应商。", "en", {name: original}), `${original}: choose a supplier before entering the purchase cost.`);
});

test("system translation rejects unknown slots and broad partial-message matches", () => {
  for (const text of ["客户中文原文须为整数，未知请留空。", "Unregistered field须为整数，未知请留空。", "报价客户中文自由补充", "报价Custom note", "请输入 猜测–100 的整数。", "未知供应商 登录暂不可用，请稍后重试。"])
    assert.equal(translateSystemMessage(text, "en"), text);
  assert.equal(translateSystemMessage("采购条目 {id} 已变化，请重新核对整批。", "en", {}), "Purchase item {id} has changed. Review the entire batch again.");
  assert.equal(translate("客户邮箱须为有效文字，最多 160 字。", "en"), "客户邮箱须为有效文字，最多 160 字。");
});

test("professional labels distinguish product condition, cosmetic grade and commercial warranty", () => {
  assert.equal(translate("商品分类", "en"), "Product condition");
  assert.equal(translate("外观等级", "it"), "Grado estetico");
  assert.equal(translate("无额外商家保修", "en"), "No additional store warranty");
  assert.equal(translate("待取机", "en"), "Awaiting collection");
  for (const key of ["无法传输数据", "镜片破损", "需检查腐蚀", "软件异常", "变形", "声音小", "通话异常"])
    for (const locale of ["it", "en"]) assert.doesNotMatch(translate(key, locale), /[\u3400-\u9fff]/u, key);
});

test("localized specification display keeps unknown capacity, zero and free edition separate", () => {
  const unit = { category: "phone", ramGb: 0, bodyStorage: { capacity: null, unit: "GB" }, disks: [], edition: "自填版本原文" };
  const display = retailDisplaySpec(unit, "en");
  assert.match(display, /0 GB RAM/);
  assert.match(display, /To be confirmed GB Internal storage/);
  assert.match(display, /自填版本原文/);
  assert.equal(unit.bodyStorage.capacity, null);
  assert.equal(retailDisplaySpec({ ...unit, category: "desktop", bodyStorage: null, disks: [{ capacity: 0, unit: "TB", type: "SSD" }] }, "it"), "0 GB RAM · 0 TB SSD · 自填版本原文");
});

test("all three tutorial languages have complete independent media and ordered chapter cues", () => {
  const ids = ["start", "intake", "follow-up", "procurement", "retail"];
  for (const locale of ["zh-CN", "it", "en"]) {
    const tutorials = getTutorials(locale);
    assert.deepEqual(tutorials.map(item => item.id), ids);
    for (const tutorial of tutorials) {
      assert.equal(tutorial.steps.length, 6);
      assert.equal(tutorial.steps[0].at, 0);
      for (let index = 1; index < 6; index++) assert.ok(tutorial.steps[index].at > tutorial.steps[index - 1].at);
      for (const asset of [tutorial.src, tutorial.poster, tutorial.captions]) assert.ok(readFileSync(resolve(root, "public" + asset)).length > 0, asset);
      const captions = readFileSync(resolve(root, "public" + tutorial.captions), "utf8");
      assert.match(captions, /^WEBVTT/);
      assert.ok((captions.match(/ --> /g) ?? []).length >= 6);
      if (locale !== "zh-CN") {
        assert.ok(tutorial.src.startsWith(`/tutorials/${locale}/`));
        assert.doesNotMatch(tutorial.title + tutorial.description + captions, /[\u3400-\u9fff]/u);
      }
    }
  }
});
