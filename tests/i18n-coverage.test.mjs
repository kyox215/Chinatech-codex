import assert from "node:assert/strict";
import test from "node:test";
import { auditI18n, parseDictionary, scanSource, validateDictionaries } from "../scripts/check-i18n.mjs";

const dictionary = pairs => new Map(pairs.map(key => [key, ["Traduzione", "Translation"]]));
const scan = (source, keys = [], options) => scanSource("components/example.tsx", source, dictionary(keys), options);
const kinds = report => report.issues.map(issue => issue.kind);

test("dictionary audit sees conflicting entries before object spread can hide them", () => {
  const first = parseDictionary("lib/i18n/interface.ts", 'export const interfaceMessages = { "客户": ["Cliente", "Customer"], "客户": ["Clienti", "Customers"] };');
  const second = parseDictionary("lib/i18n/structured.json", '{"客户":["Cliente","Customer"]}');
  assert.equal(first.entries.length, 2);
  assert.equal(second.entries.length, 1);
  assert.ok(kinds(validateDictionaries([...first.entries, ...second.entries])).includes("conflicting-key"));
  assert.ok(kinds(parseDictionary("lib/i18n/errors.ts", 'export const errorMessages = { "失败": ["Failed"] };')).includes("dictionary-shape"));
  const normalized = parseDictionary("lib/i18n/interface.ts", 'export const interfaceMessages = { " 已退款 ": ["Rimborsato", "Refunded"], "已退款": ["In attesa", "Pending"] };');
  assert.ok(kinds(validateDictionaries(normalized.entries)).includes("conflicting-normalized-key"));
});

test("all language tuples preserve placeholders, numbers and a real foreign translation", () => {
  const parsed = parseDictionary("lib/i18n/interface.ts", 'export const interfaceMessages = { "最多 6 张 {name}": ["最多 7 张 {other}", ""] };');
  const issues = kinds(validateDictionaries(parsed.entries));
  for (const expected of ["untranslated-language", "empty-translation", "message-variables", "message-numbers"]) assert.ok(issues.includes(expected), expected);
  const range = parseDictionary("lib/i18n/errors.ts", 'export const errorMessages = { "从 1 到 100": ["Da 100 a 1", "From 1 to 100"] };');
  assert.ok(kinds(validateDictionaries(range.entries)).includes("message-numbers"));
});

test("new direct translations, visible JSX, attributes and English prose are gated", () => {
  assert.ok(kinds(scan('const view = <p>{t("新功能")}</p>;')).includes("missing-message"));
  assert.deepEqual(kinds(scan('const view = <p>{t("新功能")}</p>;', ["新功能"])), []);
  const visible = scan('const view = <button aria-label="打开记录">打开记录</button>;', ["打开记录"]);
  assert.equal(visible.issues.filter(issue => issue.kind === "unwrapped-visible").length, 2);
  assert.ok(kinds(scan('const view = <button>Save changes</button>;')).includes("unwrapped-visible"));
  assert.deepEqual(kinds(scan('const view = <span>CPU</span>;')), []);
  assert.ok(kinds(scan('const view = <span>CPU ready</span>;')).includes("unwrapped-visible"));
});

test("configuration, system errors and event templates need complete dictionary sources", () => {
  const report = scan('const options = [{value:"pending", label:"等待确认"}]; function save(){throw new Error("保存失败，输入已保留。")} const event = `数量更正 ${count} 件`;');
  assert.equal(report.issues.filter(issue => issue.kind === "missing-message").length, 2);
  assert.ok(report.issues.some(issue => issue.kind === "missing-template" && issue.text === "数量更正 {v0} 件"));
  assert.deepEqual(kinds(scan('const event = `数量更正 ${count} 件`;', ["数量更正 {count} 件"])), []);
  assert.deepEqual(kinds(scan('const view = <p>{systemText("保存失败。")}</p>;', ["保存失败。"])), []);
  assert.ok(kinds(scan('throw new Error("Unexpected visible failure.");')).includes("missing-message"));
  assert.ok(kinds(scan('const options = [{value:"save", label:"Save changes"}];')).includes("missing-message"));
});

test("finite config output is checked separately from the canonical map input", () => {
  const source = 'const states = [{value:"new", label:"新机"},{value:"refurbished",label:"翻新机"}]; const view = <>{states.map(state => <span>{state.label}</span>)}</>;';
  assert.equal(scan(source, ["新机", "翻新机"]).issues.filter(issue => issue.kind === "unwrapped-enumerable").length, 2);
  assert.deepEqual(kinds(scan(source.replace("{state.label}", "{t(state.label)}"), ["新机", "翻新机"])), []);
  assert.deepEqual(kinds(scan('const view = <>{["all", "新机", "翻新机"].map(value => <button onClick={() => update("condition", value)}>{value === "all" ? t("全部") : t(value)}</button>)}</>;', ["新机", "翻新机", "全部"])), []);
  assert.ok(kinds(scan('const view = <>{["新机"].map(value => value)}</>;', ["新机"])).includes("unwrapped-enumerable"));
});

test("canonical comparisons and translated custom component props are not mutated", () => {
  assert.deepEqual(kinds(scan('const selected = form.accessories.includes("其他"); const allowed = ["新机", "翻新机"].includes(value); const view = <>{value === "其他" ? null : <span>{t("全部")}</span>}</>;', ["全部"])), []);
  assert.deepEqual(kinds(scan('const view = <MultiChoice label="随件" options={["充电器", "数据线"]} />;', ["随件", "充电器", "数据线"])), []);
});

test("original facts have exact scoped exceptions, not a blanket Chinese exclusion", () => {
  const exceptions = [{ file: "components/example.tsx", owner: "fixtures", text: "客户原文", reason: "Test fixture customer fact." }];
  assert.deepEqual(kinds(scan('const fixtures = [{name:"客户原文"}]; const view = <>{fixtures.map(item => <span>{item.name}</span>)}</>;', [], { exceptions })), []);
  assert.ok(kinds(scan('const other = "客户原文";', [], { exceptions })).includes("missing-message"));
  assert.ok(kinds(scan('const fixtures = "新按钮";', [], { exceptions })).includes("missing-message"));
});

test("unknown runtime messages remain an explicit review boundary", () => {
  const report = scan('const view = <p>{t(result.message)}</p>;');
  assert.equal(report.dynamicBoundaries.length, 1);
  assert.equal(report.dynamicBoundaries[0].text, "result.message");
  assert.deepEqual(report.issues, []);
});

test("current production sources meet the static gate with reviewable exceptions", () => {
  const report = auditI18n();
  assert.deepEqual(report.issues, [], JSON.stringify(report.issues, null, 2));
  assert.ok(report.counts.sources > 150);
  assert.ok(report.dynamicBoundaries.length > 0);
  assert.ok(report.sourceExceptions.every(item => item.file && item.reason));
  assert.ok(report.limitations.some(text => text.includes("runtime")));
});
