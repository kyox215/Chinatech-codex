import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Execute the actual editor's event handlers with an in-memory hook adapter.
// This tests synchronous races and JSX lock boundaries, not browser/React DOM behavior.
const compiled = ts.transpileModule(readFileSync(new URL("../components/retail/retail-field-editor.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function find(tree, predicate) { const match = nodes(tree).find(predicate); assert.ok(match, "expected editor control"); return match; }
function button(tree, label) { return find(tree, node => node.type === "button" && nodes(node.props.children).length === 0 && node.props.children === label || node.type === "button" && JSON.stringify(node.props.children).includes(label)); }

function harness(field = "serial") {
  const state = [], refs = [], calls = { closes: 0, recover: 0, discard: 0, clears: 0, dispatch: [] };
  const unit = { id: "synthetic-unit", code: "SYNTHETIC", version: 1, status: "draft", category: "phone", serial: "before", source: "before", brand: "before", costCents: 0 };
  let units = [unit], stateIndex = 0, refIndex = 0, draft, restore, tracked, waiting = false, requestId = null, active = true;
  let saveResult = deferred(), clearResult = null;
  const receipt = {
    get waiting() { return waiting; }, get requestId() { return requestId; },
    isWaiting: () => waiting, isActive: () => active,
    watch(id, confirmed, settled) { waiting = true; requestId = id; tracked = { id, confirmed, settled }; return true; },
  };
  const react = {
    createContext: value => ({ value }), useContext: context => context.value,
    useEffect: () => {},
    useRef(value) { const index = refIndex++; refs[index] ??= { current: value }; return refs[index]; },
    useState(initial) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
  };
  const modules = {
    react,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "@/components/use-operation-receipt": { useOperationReceipt: () => receipt, OperationRecoveryControls: "OperationRecoveryControls" },
    "@/components/language-provider": { useLanguage: () => ({ t: value => value, systemText: value => value }) },
    "@/components/use-device-draft": {
      DeviceDraftNotice: "DeviceDraftNotice",
      useDeviceDraft: (key, data, callback) => {
        draft = data; restore = callback;
        return { enabled: true, status: "", candidates: [], recover: () => { calls.recover++; }, discard: async () => { calls.discard++; }, clear: () => { calls.clears++; return clearResult?.promise ?? Promise.resolve(); } };
      },
    },
    "./retail-provider": { useRetail: () => ({ units, ready: true, feedback: null, dispatch: async (command, options) => { calls.dispatch.push(structuredClone({ command, options })); return saveResult.promise; } }) },
    "@/lib/retail": {
      retailFieldLabels: new Proxy({}, { get: (_, key) => String(key) }), retailCategories: {},
      canEditRetailField: () => true, retailMoney: value => String(value), retailWarrantyLabel: value => String(value),
      parseRetailMoney: text => Math.round(Number(text) * 100), validateRetailFieldEdit: (original, change) => ({ ...original, [change.field]: change.value }),
    },
    "@/lib/repair-intake-record": { intakeRecordTime: () => "2026-10-16 10:00" },
  };
  const sandbox = createContext({ exports: {}, structuredClone, crypto: { randomUUID }, document: {}, require: name => modules[name] ?? (name.endsWith(".css") ? { default: new Proxy({}, { get: (_, key) => String(key) }) } : new Proxy({}, { get: (_, key) => String(key) })) });
  runInContext(compiled, sandbox);
  const render = () => { stateIndex = 0; refIndex = 0; return sandbox.exports.RetailFieldEditor({ unit, field, onClose: () => { calls.closes++; } }); };
  return {
    render, calls, receipt,
    snapshot: () => structuredClone(state.slice(0, 5)), draft: () => structuredClone(draft), restore: value => restore(value),
    newer() { units = [{ ...unit, version: 2 }]; },
    resolveSave(value) { saveResult.resolve(value); },
    cancel() { waiting = false; requestId = null; tracked?.settled?.(); },
    delayClear() { clearResult = deferred(); }, resolveClear() { clearResult.resolve(); },
    async confirm() { requestId = null; await tracked.confirmed(() => active); waiting = false; },
    deactivate() { active = false; },
  };
}

for (const field of ["serial", "brand", "source", "costCents"]) test(`actual ${field} handlers freeze retained draft before rerender and throughout unknown outcome`, async () => {
  const h = harness(field);
  const editing = h.render();
  const input = find(editing, node => ["IdentifierField", "RetailCatalogControl", "TextareaControl", "RetailMoneyControl"].includes(node.type) && node.props.value !== "");
  const note = find(editing, node => node.type === "TextareaControl" && node.props["aria-label"] === "更正备注");
  input.props.onChange(field === "source" ? { target: { value: "candidate" } } : field === "costCents" ? "12.50" : "candidate");
  note.props.onChange({ target: { value: "frozen note" } });
  button(editing, "继续确认").props.onClick();
  const candidate = h.render(), notice = find(candidate, node => node.type === "DeviceDraftNotice");
  const frozen = h.snapshot(), frozenDraft = h.draft();
  const saving = button(candidate, "确认保存").props.onClick();
  // Invoke pre-render and delayed child callbacks directly; disabled attributes alone cannot stop these.
  input.props.onChange(field === "source" ? { target: { value: "late" } } : "late");
  note.props.onChange({ target: { value: "late note" } });
  h.restore({ ...frozenDraft, value: "restored", raw: "99", note: "restored", version: 7, before: "other" });
  notice.props.draft.recover("other-draft"); await notice.props.draft.discard("other-draft");
  button(editing, "继续确认").props.onClick(); button(candidate, "返回修改").props.onClick(); button(candidate, "取消").props.onClick();
  h.newer(); const executing = h.render(); button(executing, "保留输入并核对最新版本").props.onClick();
  assert.deepEqual(h.snapshot(), frozen); assert.deepEqual(h.draft(), frozenDraft);
  assert.equal(find(executing, node => node.type === "fieldset").props.disabled, true);
  assert.equal(button(executing, "正在保存").props["aria-busy"], true);
  assert.equal(h.calls.recover, 0); assert.equal(h.calls.discard, 0); assert.equal(h.calls.closes, 0);
  assert.equal(h.calls.dispatch.length, 1); assert.equal(h.calls.dispatch[0].command.version, 1);
  const originalId = h.calls.dispatch[0].options.requestId;
  h.resolveSave(false); await saving;
  const unknown = h.render(), save = button(unknown, "待核对");
  assert.equal(save.props["aria-busy"], false); assert.equal(save.props.disabled, true);
  const recovery = find(unknown, node => node.type === "OperationRecoveryControls");
  assert.equal(recovery.props.requestId, originalId);
  const fieldset = find(unknown, node => node.type === "fieldset");
  assert.ok(!nodes(fieldset).includes(recovery), "original recovery must remain outside the draft fieldset");
  button(unknown, "保留输入并核对最新版本").props.onClick(); button(unknown, "返回修改").props.onClick();
  assert.deepEqual(h.snapshot(), frozen); assert.deepEqual(h.draft(), frozenDraft); assert.equal(h.calls.dispatch.length, 1);
  h.cancel(); const settled = h.render(); button(settled, "保留输入并核对最新版本").props.onClick();
  assert.equal(h.snapshot()[0].version, 2); assert.equal(h.snapshot()[4], null);
  assert.deepEqual(h.snapshot().slice(1, 4), frozen.slice(1, 4)); assert.equal(h.calls.closes, 0);
});

test("matching receipt cleanup keeps draft locked with null requestId; stale instance cannot close a new editor", async () => {
  const h = harness(); const editing = h.render();
  find(editing, node => node.type === "IdentifierField").props.onChange("candidate");
  button(editing, "继续确认").props.onClick();
  const saving = button(h.render(), "确认保存").props.onClick(); h.resolveSave(false); await saving;
  h.delayClear(); const completion = h.confirm(), during = h.render(), frozen = h.snapshot();
  assert.equal(find(during, node => node.type === "OperationRecoveryControls").props.requestId, null);
  assert.equal(find(during, node => node.type === "fieldset").props.disabled, true);
  button(during, "返回修改").props.onClick(); button(during, "取消").props.onClick();
  h.restore({ value: "late", raw: "", note: "", version: 4, before: "late" });
  assert.deepEqual(h.snapshot(), frozen);
  h.deactivate(); h.resolveClear(); await completion;
  assert.equal(h.calls.clears, 1); assert.equal(h.calls.closes, 0); assert.equal(h.calls.dispatch.length, 1);
});

test("unresolved-free version conflict still permits explicit rebase, preserving input and note", () => {
  const h = harness("brand"), editing = h.render();
  find(editing, node => node.type === "RetailCatalogControl").props.onChange("retained value");
  find(editing, node => node.type === "TextareaControl").props.onChange({ target: { value: "retained note" } });
  h.newer(); const conflict = h.render();
  assert.equal(button(conflict, "保留输入并核对最新版本").props.disabled, false);
  button(conflict, "保留输入并核对最新版本").props.onClick(); const next = h.render();
  assert.equal(h.snapshot()[0].version, 2); assert.equal(h.draft().value, "retained value"); assert.equal(h.draft().note, "retained note");
  button(next, "继续确认").props.onClick(); assert.equal(h.snapshot()[4].brand, "retained value");
  assert.equal(h.calls.dispatch.length, 0);
});
