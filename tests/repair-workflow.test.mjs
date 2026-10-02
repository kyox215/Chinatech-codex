import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const cache = new Map();
function moduleUrl(name) { if (cache.has(name)) return cache.get(name); let compiled = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText; compiled = compiled.replace(/from "\.\/([^"]+)"/g, (_, dep) => `from "${moduleUrl(dep)}"`); const url = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`; cache.set(name, url); return url; }
const { initialRepairWorkflow, applyWorkflowCommand, arrivalNotice, overlayRepair, workflowGroup, workflowGroups } = await import(moduleUrl('repair-workflow'));
const { parseProcurementState } = await import(moduleUrl('procurement-storage'));
const { defaultStoreSettings, parseStoreSettings, validateFinanceEntry, financeTotals } = await import(moduleUrl('store-settings'));
const order = { id: 'LOCAL-0000000000000001', status: 'diagnosis', statusLabel: '待检测', tone: 'warning', updatedAt: '2026-10-01 09:00:00' };
const part = { id: 'P1', repairId: order.id, item: 'DEMO 配件', supplier: 'DEMO 供应商', quantity: 1, unitCostCents: null, expectedAt: '', reference: '', events: [{ id: 'ordered', type: 'ordered', quantity: 0, note: '', time: '2026-10-01 09:00:00' }, { id: 'arrival', type: 'arrival', quantity: 1, note: '', time: '2026-10-01 09:10:00' }] };
const activity = { id: 'A1', time: '2026-10-01 10:00:00' };
const apply = (flow, command, records = [part], id = 'A1') => applyWorkflowCommand(flow, command, { ...activity, id }, records, order.id, flow.revision);
test('维修阶段覆盖共享目录，保留独立采购事实与原始工单', () => { const flow = apply(initialRepairWorkflow(order), { type: 'stage', status: 'repairing', note: '' }); const updated = overlayRepair(order, flow); assert.equal(updated.status, 'repairing'); assert.equal(updated.updatedAt, activity.time); assert.equal(order.status, 'diagnosis'); assert.equal(flow.events.length, 1); assert.equal(part.events.length, 2); });
test('作废和恢复必须原因，原历史不抹除', () => { const base = initialRepairWorkflow(order); assert.throws(() => apply(base, { type: 'stage', status: 'cancelled', note: '' })); const cancelled = apply(base, { type: 'stage', status: 'cancelled', note: 'DEMO重复登记' }); assert.throws(() => apply(cancelled, { type: 'stage', status: 'diagnosis', note: '' }, [part], 'A2')); const restored = apply(cancelled, { type: 'stage', status: 'diagnosis', note: 'DEMO复核恢复' }, [part], 'A2'); assert.equal(restored.events.length, 2); });
test('版本冲突、重复操作、倒退时间失败不改变历史', () => { const base = initialRepairWorkflow(order); assert.throws(() => applyWorkflowCommand(base, { type: 'stage', status: 'ready', note: '' }, activity, [], order.id, 1)); const next = apply(base, { type: 'stage', status: 'ready', note: '' }); assert.throws(() => apply(next, { type: 'stage', status: 'testing', note: '' })); assert.throws(() => applyWorkflowCommand(next, { type: 'stage', status: 'testing', note: '' }, { id: 'later', time: order.updatedAt }, [], order.id, 1)); assert.equal(next.events.length, 1); });
test('已留下无需到货通知；未知保管不能免除核对', () => { const base = initialRepairWorkflow(order); assert.equal(arrivalNotice(base, [part], order.id), '先核对设备保管'); const left = apply(base, { type: 'custody', custody: 'store' }); assert.equal(arrivalNotice(left, [part], order.id), '无需到货通知'); assert.throws(() => apply(left, { type: 'arrival_notice', outcome: 'notified', note: '' }, [part], 'A2')); });
test('未留设备且到齐才通知，未接通仍是未通知，新需求不沿用旧通知', () => { let flow = apply(initialRepairWorkflow(order), { type: 'custody', custody: 'customer' }); assert.throws(() => apply(flow, { type: 'arrival_notice', outcome: 'notified', note: '' }, [], 'A2')); flow = apply(flow, { type: 'arrival_notice', outcome: 'unreachable', note: '' }, [part], 'A2'); assert.equal(arrivalNotice(flow, [part], order.id), '未通知送机'); flow = apply(flow, { type: 'arrival_notice', outcome: 'notified', note: '' }, [part], 'A3'); assert.equal(arrivalNotice(flow, [part], order.id), '已通知送机'); assert.equal(arrivalNotice(flow, [part, { ...part, id: 'P2', events: [] }], order.id), '配件未到齐'); const after = apply(flow, { type: 'custody', custody: 'store' }, [part], 'A4'); assert.equal(arrivalNotice(after, [part], order.id), '无需到货通知'); assert.equal(after.events.length, 4); });
test('SeaTable状态分组遵循既有事实，维修中和结束优先于采购', () => {
  assert.deepEqual(Object.values(workflowGroups), ['久等 未答复','欠款 已拿走','寄修','IN CORSO','下单','到货','到货已通知','修好','修好已通知','FATTO','作废']);
  assert.equal(workflowGroup(order, []), 'processing');
  assert.equal(workflowGroup(order, [part]), 'arrival');
  assert.equal(workflowGroup({ ...order, status: 'awaiting_parts' }, []), 'processing');
  assert.equal(workflowGroup(order, [{...part,events:part.events.slice(0,1)}]), 'purchase');
  assert.equal(workflowGroup({...order,status:'repairing'}, [part]), 'processing');
  assert.equal(workflowGroup({...order,status:'ready'}, [part]), 'ready');
  assert.equal(workflowGroup({...order,status:'completed'}, [part]), 'complete');
  assert.equal(workflowGroup({...order,status:'cancelled'}, [part]), 'cancelled');
});
test('到货通知组随已保存沟通与采购签名联动，未接通和新增需求不能沿用', () => {
  const customer = {...initialRepairWorkflow(order),custody:'customer'};
  const notified = apply(customer,{type:'arrival_notice',outcome:'notified',note:'DEMO沟通'});
  assert.equal(workflowGroup(order,[part],notified),'arrival_notified');
  assert.equal(workflowGroup(order,[part],{...notified,notice:{...notified.notice,outcome:'unreachable'}}),'arrival');
  assert.equal(workflowGroup(order,[part,{...part,id:'P2',events:[]}],notified),'purchase');
  assert.equal(workflowGroup(order,[part],{...notified,custody:'store'}),'arrival');
});
test('新人工阶段有共享标签并保留版本、通知和欠款保管校验', () => {
  for (const status of ['awaiting_reply','outsourced']) {
    const flow=apply(initialRepairWorkflow(order),{type:'stage',status,note:''});
    assert.equal(workflowGroup(order,[],flow),status);
    assert.equal(overlayRepair(order,flow).status,status);
  }
  assert.throws(()=>apply(initialRepairWorkflow(order),{type:'stage',status:'ready_notified',note:''}),/待取机/);
  const ready={...initialRepairWorkflow(order),status:'ready'};
  const notified=apply(ready,{type:'stage',status:'ready_notified',note:''});
  assert.equal(workflowGroup(order,[],notified),'ready_notified');
  assert.throws(()=>apply(ready,{type:'stage',status:'collected_unpaid',note:'DEMO确认'}),/保管/);
  assert.throws(()=>apply({...ready,custody:'customer'},{type:'stage',status:'collected_unpaid',note:''}),/原因/);
  const unpaid=apply({...ready,custody:'customer'},{type:'stage',status:'collected_unpaid',note:'DEMO确认欠款取走'});
  assert.equal(workflowGroup(order,[],unpaid),'collected_unpaid');
  assert.throws(()=>apply(unpaid,{type:'stage',status:'diagnosis',note:''},[],'A2'),/原因/);
  assert.equal(part.events.length,2);
});
test('持久配件重放数量事实，拒绝损坏/超量/重复编号', () => { const state = { version: 1, records: [part], repairUpdates: {} }; assert.equal(parseProcurementState(JSON.stringify(state)).records[0].events.length, 2); assert.throws(() => parseProcurementState(JSON.stringify({ ...state, records: [{ ...part, events: [...part.events, { id: 'overflow', type: 'arrival', quantity: 1, note: '', time: activity.time }] }] }))); assert.throws(() => parseProcurementState(JSON.stringify({ ...state, records: [part, part] }))); });
test('经营收支只计已登记且未作废的整数分，销售与采购不会自动成为收支', () => { const base = { id: 'E1', kind: 'income', amountCents: 1250, purpose: 'DEMO收款', relatedId: '', note: '', time: activity.time }; validateFinanceEntry(base); assert.throws(() => validateFinanceEntry({ ...base, amountCents: 0 })); assert.throws(() => validateFinanceEntry({ ...base, amountCents: 1.5 })); assert.deepEqual(financeTotals([base, { ...base, id: 'E2', kind: 'expense', amountCents: 250 }, { ...base, id: 'E3', voidReason: '误记' }]), { income: 1250, expense: 250, balance: 1000 }); assert.equal(defaultStoreSettings.finance.length, 0); });
test('设置验证拒绝重复供应商、不安全网站和坏账本，不覆盖原资料', () => { const raw = settings => JSON.stringify({ version: 1, settings }); assert.equal(parseStoreSettings(raw(defaultStoreSettings)).paper, 'a4'); assert.throws(() => parseStoreSettings(raw({ ...defaultStoreSettings, suppliers: [...defaultStoreSettings.suppliers, defaultStoreSettings.suppliers[0]] }))); assert.throws(() => parseStoreSettings(raw({ ...defaultStoreSettings, suppliers: [{ ...defaultStoreSettings.suppliers[0], website: 'javascript:alert(1)' }] }))); });

test("售后接机已核对的保管事实用于初始工作流，普通旧LOCAL仍待核对", () => { assert.equal(initialRepairWorkflow({...order,custody:"store"}).custody,"store"); assert.equal(initialRepairWorkflow({...order,custody:"customer"}).custody,"customer"); assert.equal(initialRepairWorkflow(order).custody,"unknown"); });
