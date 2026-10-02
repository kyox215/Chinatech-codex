import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const dependencies = new Map();
function library(name) {
  if (dependencies.has(name)) return dependencies.get(name);
  let code = compile(`lib/${name}.ts`);
  code = code.replace(/from "\.\/([^"]+)"/g, (_, dep) => `from "${library(dep)}"`);
  const url = dataUrl(code); dependencies.set(name, url); return url;
}
function compile(path) { return ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.React } }).outputText; }
function dataUrl(code) { return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`; }
let instance = 0;
async function store(path, extra = '', tail = '') {
  let code = compile(path).replace(/import \{[^}]+\} from "react";/g, 'let captured; const React = {createElement(type, props) {captured = props; return null;}}; const createContext = () => ({Provider: "provider"}); const useCallback = fn => fn; const useContext = () => null; const useSyncExternalStore = (subscribe, read) => read(); const useReducer = (reducer, initial) => [initial, action => Object.assign(initial, reducer(initial, action))];');
  code = code.replace(/from "@\/lib\/([^"]+)"/g, (_, dep) => `from "${library(dep)}"`);
  return import(dataUrl(`${code}\nexport {read as readSnapshot${extra}};\n${tail}\n// instance ${instance++}`));
}
function browser(raw = null) {
  const value = new EventTarget(); let saved = raw; let staffSaved = null;
  value.denyRead = false; value.denyWrite = false; value.reads = 0; value.afterWriteDenyRead = false;
  value.localStorage = { getItem(key) { value.reads++; if (value.denyRead) throw new Error('temporary read failure'); return key === 'chinatech.m1.staff.v1' ? staffSaved : saved; }, setItem(key, next) { if (value.denyWrite) throw new Error('quota'); if(key === 'chinatech.m1.staff.v1') staffSaved = next; else saved = next; if (value.afterWriteDenyRead) value.denyRead = true; } };
  value.saved = () => saved;
  return value;
}
async function withBrowser(value, action) { const before = globalThis.window; globalThis.window = value; try { await action(); } finally { if (before === undefined) delete globalThis.window; else globalThis.window = before; } }
test('整机坏存储的错误快照保持引用稳定，修复内容后可恢复', async () => {
  await withBrowser(browser('invalid-retail-json'), async () => {
    const storeModule = await store('components/retail/retail-provider.tsx');
    const failed = storeModule.readSnapshot();
    assert.ok(failed.error);
    assert.equal(storeModule.readSnapshot(), failed);
    assert.equal(storeModule.readSnapshot(), failed);
    window.localStorage.setItem('', JSON.stringify({ version: 1, units: [] }));
    const recovered = storeModule.readSnapshot();
    assert.equal(recovered.error, '');
    assert.equal(recovered.units.length, 0);
    assert.equal(storeModule.readSnapshot(), recovered);
  });
});
const part = { id: 'DEMO-P1', repairId: 'DEMO-R1', item: 'DEMO 配件', supplier: 'DEMO 供应商', quantity: 1, unitCostCents: null, expectedAt: '', reference: '', events: [] };
const procurementRaw = records => JSON.stringify({ version: 1, records, repairUpdates: {} });
test('采购、设置和维修状态的暂时读失败恢复，同内容不会锁死操作', async () => {
  for (const [path, errorKey] of [['components/procurement/procurement-provider.tsx', 'storageError'], ['components/settings/settings-store.ts', 'error'], ['components/repairs/repair-workflow-store.ts', 'error']]) {
    await withBrowser(browser(), async () => { const storeModule = await store(path); assert.ok(!storeModule.readSnapshot()[errorKey]); window.denyRead = true; assert.ok(storeModule.readSnapshot()[errorKey]); window.denyRead = false; assert.ok(!storeModule.readSnapshot()[errorKey]); });
  }
});
test('采购先完整验证再写入，1001条记录/事件不会破坏已有账本', async () => {
  const histories = Array.from({ length: 1000 }, (_, index) => ({ id: `E${index}`, type: index % 2 ? 'cart_removed' : 'cart_added', quantity: 0, time: '2026-09-30 10:00:00', note: '' }));
  for (const [records, action] of [
    [Array.from({ length: 1000 }, (_, index) => ({ ...part, id: `P${index}` })), { type: 'create', record: part }],
    [[{ ...part, events: histories }], { type: 'append', id: part.id, revision: 1000, event: { id: 'E1001', type: 'cart_added', quantity: 0, time: '2026-10-01 10:00:00', note: '' } }],
  ]) {
    const original = procurementRaw(records);
    await withBrowser(browser(original), async () => { const storeModule = await store('components/procurement/procurement-provider.tsx', ', dispatchAction as dispatchTest'); storeModule.dispatchTest(action); assert.equal(storeModule.readSnapshot().feedback.error, true); assert.equal(window.saved(), original); assert.equal(storeModule.readSnapshot().records.length, records.length); });
  }
});
test('采购写入成功直接发布；随后读失败不会误报原操作失败', async () => {
  await withBrowser(browser(procurementRaw([])), async () => { const storeModule = await store('components/procurement/procurement-provider.tsx', ', dispatchAction as dispatchTest'); storeModule.readSnapshot(); window.afterWriteDenyRead = true; storeModule.dispatchTest({ type: 'create', record: part }); assert.equal(JSON.parse(window.saved()).records[0].id, part.id); assert.equal(storeModule.readSnapshot().feedback.error, false); window.denyRead = false; assert.equal(storeModule.readSnapshot().records[0].id, part.id); });
});
test('配件编辑保留历史并取消旧加车，写入失败或损坏存储不覆盖', async () => {
  const inCart = { ...part, events: [{ id: 'E1', type: 'cart_added', quantity: 0, time: '2026-09-30 10:00:00', note: '' }] };
  await withBrowser(browser(procurementRaw([inCart])), async () => { const storeModule = await store('components/procurement/procurement-provider.tsx', ', dispatchAction as dispatchTest'); storeModule.dispatchTest({ type: 'edit', record: { ...inCart, supplier: 'DEMO 新供应商', quantity: 2 }, revision: 1 }); const row = storeModule.readSnapshot().records[0]; assert.deepEqual(row.events.map(event => event.type), ['cart_added', 'cart_removed', 'details_changed']); assert.equal(row.quantity, 2); const saved = window.saved(); window.denyWrite = true; storeModule.dispatchTest({ type: 'create', record: { ...part, id: 'DEMO-P2' } }); assert.equal(storeModule.readSnapshot().feedback.error, true); assert.equal(window.saved(), saved); });
  await withBrowser(browser('{damaged'), async () => { const storeModule = await store('components/procurement/procurement-provider.tsx', ', dispatchAction as dispatchTest'); storeModule.dispatchTest({ type: 'create', record: part }); assert.equal(storeModule.readSnapshot().feedback.error, true); assert.equal(window.saved(), '{damaged'); });
});
test('设置与维修状态先保存再发布，旧版本/容量失败不改事实', async () => {
  await withBrowser(browser(), async () => { const settingsStore = await store('components/settings/settings-store.ts'); settingsStore.saveStoreSettings(0, current => ({ ...current, paper: 'a5' })); const saved = window.saved(); assert.equal(settingsStore.readSnapshot().settings.paper, 'a5'); assert.throws(() => settingsStore.saveStoreSettings(0, current => ({ ...current, paper: 'half' }))); assert.equal(window.saved(), saved); window.denyWrite = true; assert.throws(() => settingsStore.saveStoreSettings(1, current => ({ ...current, paper: 'half' }))); assert.equal(window.saved(), saved); });
  await withBrowser(browser(), async () => { const workflowStore = await store('components/repairs/repair-workflow-store.ts'); const order = { id: 'LOCAL-DEMO01', status: 'diagnosis', updatedAt: '2026-09-30 10:00:00' }; workflowStore.updateRepairWorkflow(order, { type: 'stage', status: 'repairing', note: 'DEMO' }, [], 0); const saved = window.saved(); assert.equal(workflowStore.readSnapshot().workflows[order.id].status, 'repairing'); assert.throws(() => workflowStore.updateRepairWorkflow(order, { type: 'stage', status: 'testing', note: '' }, [], 0)); window.denyWrite = true; assert.throws(() => workflowStore.updateRepairWorkflow(order, { type: 'stage', status: 'testing', note: '' }, [], 1)); assert.equal(window.saved(), saved); assert.equal(workflowStore.readSnapshot().workflows[order.id].status, 'repairing'); });
});

test('单机暂时读失败保留成功资料，写失败或恢复均不会回退到演示默认值', async () => {
  const { retailUnits } = await import(library('retail-fixtures'));
  const unit = { ...retailUnits.find(unit => unit.id === 'demo-unit-2'), version: 2, location: 'DEMO 已保存位置' };
  const raw = JSON.stringify({ version: 1, units: [unit] });
  await withBrowser(browser(raw), async () => {
    const mod = await store('components/retail/retail-provider.tsx', '', 'export function contextUnderTest() {RetailProvider({children: null}); return captured.value;}');
    assert.equal(mod.readSnapshot().units[0].location, unit.location);
    window.denyRead = true;
    assert.equal(mod.readSnapshot().units[0].location, unit.location);
    assert.ok(mod.readSnapshot().error);
    window.denyRead = false;
    assert.equal(mod.readSnapshot().error, '');
    const ctx = mod.contextUnderTest();
    const action = { type: 'command', id: unit.id, version: 2, command: {type: 'edit', change: {field: 'location', value: 'DEMO 修正位置'}}, event: {id: 'DEMO-E2', title: '更正位置', detail: 'DEMO 测试', time: '2026-10-01 12:00:00'} };
    window.denyWrite = true;
    assert.equal(ctx.dispatch(action), false);
    assert.equal(window.saved(), raw);
    assert.equal(mod.readSnapshot().units[0].location, unit.location);
    window.denyWrite = false;
    window.afterWriteDenyRead = true;
    assert.equal(ctx.dispatch(action), true);
    assert.equal(JSON.parse(window.saved()).units[0].version, 3);
    assert.equal(mod.readSnapshot().units[0].location, 'DEMO 修正位置');
    assert.equal(mod.readSnapshot().units[0].events.length, unit.events.length + 1);
    window.denyRead = false;
    assert.equal(mod.readSnapshot().error, '');
    const beforeConflict = window.saved();
    assert.equal(ctx.dispatch({...action, event: {...action.event, id: 'DEMO-E3'}}), false);
    assert.equal(window.saved(), beforeConflict);
    assert.equal(mod.readSnapshot().units[0].version, 3);
  });
});
