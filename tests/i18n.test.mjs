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
const { translate } = await load("lib/i18n/translate.ts");
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
