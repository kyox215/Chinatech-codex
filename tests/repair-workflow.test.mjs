import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const cache = new Map();
function moduleUrl(name) { if (cache.has(name)) return cache.get(name); let compiled = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText; compiled = compiled.replace(/from "\.\/([^"]+)"/g, (_, dep) => `from "${moduleUrl(dep)}"`); const url = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`; cache.set(name, url); return url; }
const { initialRepairWorkflow, applyWorkflowCommand, arrivalNotice, overlayRepair, workflowGroup, repairStageGroups, repairPartsFollowup, hasCurrentRepairHandover, repairProgress, isRepairHistory, assertRepairProcurementOpen } = await import(moduleUrl('repair-workflow'));
const { parseProcurementState } = await import(moduleUrl('procurement-storage'));
const { defaultStoreSettings, parseStoreSettings, validateFinanceEntry, financeTotals } = await import(moduleUrl('store-settings'));
const order = { id: 'LOCAL-0000000000000001', status: 'diagnosis', statusLabel: '待检测', tone: 'warning', updatedAt: '2026-10-01 09:00:00' };
const part = { id: 'P1', repairId: order.id, item: 'DEMO 配件', supplier: 'DEMO 供应商', quantity: 1, unitCostCents: null, expectedAt: '', reference: '', events: [{ id: 'ordered', type: 'ordered', quantity: 0, note: '', time: '2026-10-01 09:00:00' }, { id: 'arrival', type: 'arrival', quantity: 1, note: '', time: '2026-10-01 09:10:00' }] };
const activity = { id: 'A1', time: '2026-10-01 10:00:00' };
const apply = (flow, command, records = [part], id = 'A1') => applyWorkflowCommand(flow, command, { ...activity, id }, records, order.id, flow.revision);
test('维修阶段覆盖共享目录，保留独立采购事实与原始工单', () => { const flow = apply(initialRepairWorkflow(order), { type: 'stage', status: 'repairing', note: '' }); const updated = overlayRepair(order, flow); assert.equal(updated.status, 'repairing'); assert.equal(updated.updatedAt, activity.time); assert.equal(order.status, 'diagnosis'); assert.equal(flow.events.length, 1); assert.equal(part.events.length, 2); });
test('接单报价沟通独立记录，不冒充客户授权、到货通知或改变阶段', () => {
  const base=initialRepairWorkflow(order), before=structuredClone(base);
  const waiting=apply(base,{type:'quote_contact',outcome:'awaiting_reply',note:'DEMO 客户考虑屏幕报价'},[]);
  assert.deepEqual(base,before);assert.equal(waiting.status,base.status);assert.equal(waiting.notice,null);assert.equal(waiting.pickupNotice,undefined);assert.equal(waiting.followUp,undefined);assert.equal(workflowGroup(order,[],waiting),'processing');
  assert.deepEqual(waiting.quoteContact,{outcome:'awaiting_reply',time:activity.time,note:'DEMO 客户考虑屏幕报价'});assert.equal(waiting.events[0].type,'quote_contact');
  const contacted=apply(waiting,{type:'quote_contact',outcome:'contacted',note:'DEMO 再次沟通报价'},[],'A2');
  assert.equal(contacted.events.length,2);assert.equal(contacted.quoteContact.outcome,'contacted');assert.equal(contacted.status,'diagnosis');assert.equal(contacted.events[0].note,waiting.events[0].note);
});
test('报价沟通拒绝无说明、坏结果、越过结案和版本冲突，保留原事实', () => {
  const base=initialRepairWorkflow(order);
  for(const command of [{type:'quote_contact',outcome:'contacted',note:''},{type:'quote_contact',outcome:'accepted',note:'DEMO'},{type:'quote_contact',outcome:'unreachable',note:'x'.repeat(1201)}])assert.throws(()=>apply(base,command,[]));
  for(const status of ['completed','cancelled'])assert.throws(()=>apply({...base,status},{type:'quote_contact',outcome:'contacted',note:'DEMO'},[]),/只能查看/);
  assert.throws(()=>applyWorkflowCommand(base,{type:'quote_contact',outcome:'contacted',note:'DEMO'},activity,[],order.id,1),/已变化/);assert.equal(base.events.length,0);
});
test('新报价沟通扩展兼容旧工作流，拒绝损坏持久资料', async()=>{
  const {validateWorkflowExtensions}=await import(moduleUrl('repair-workflow'));const base=initialRepairWorkflow(order);validateWorkflowExtensions(base);
  const good={outcome:'unreachable',time:activity.time,note:'DEMO 未接通',actorId:'DEMO-OWNER'};validateWorkflowExtensions({...base,quoteContact:good});
  for(const bad of [null,{...good,outcome:'accepted'},{...good,note:''},{...good,time:0},{...good,actorId:0}])assert.throws(()=>validateWorkflowExtensions({...base,quoteContact:bad}));
});
test('作废和恢复必须原因，原历史不抹除', () => { const base = initialRepairWorkflow(order); assert.throws(() => apply(base, { type: 'stage', status: 'cancelled', note: '' })); const cancelled = apply(base, { type: 'stage', status: 'cancelled', note: 'DEMO重复登记' }); assert.throws(() => apply(cancelled, { type: 'stage', status: 'diagnosis', note: '' }, [part], 'A2')); const restored = apply(cancelled, { type: 'stage', status: 'diagnosis', note: 'DEMO复核恢复' }, [part], 'A2'); assert.equal(restored.events.length, 2); });
test('版本冲突、重复操作、倒退时间失败不改变历史', () => { const base = initialRepairWorkflow(order); assert.throws(() => applyWorkflowCommand(base, { type: 'stage', status: 'ready', note: '' }, activity, [], order.id, 1)); const next = apply(base, { type: 'stage', status: 'ready', note: '' }); assert.throws(() => apply(next, { type: 'stage', status: 'testing', note: '' })); assert.throws(() => applyWorkflowCommand(next, { type: 'stage', status: 'testing', note: '' }, { id: 'later', time: order.updatedAt }, [], order.id, 1)); assert.equal(next.events.length, 1); });
test('已留下无需到货通知；未知保管不能免除核对', () => { const base = initialRepairWorkflow(order); assert.equal(arrivalNotice(base, [part], order.id), '先核对设备保管'); const left = apply(base, { type: 'custody', custody: 'store' }); assert.equal(arrivalNotice(left, [part], order.id), '无需到货通知'); assert.throws(() => apply(left, { type: 'arrival_notice', outcome: 'notified', note: '' }, [part], 'A2')); });
test('未留设备且到齐才通知，未接通仍是未通知，新需求不沿用旧通知', () => { let flow = apply(initialRepairWorkflow(order), { type: 'custody', custody: 'customer' }); assert.throws(() => apply(flow, { type: 'arrival_notice', outcome: 'notified', note: '' }, [], 'A2')); flow = apply(flow, { type: 'arrival_notice', outcome: 'unreachable', note: '' }, [part], 'A2'); assert.equal(arrivalNotice(flow, [part], order.id), '未通知送机'); flow = apply(flow, { type: 'arrival_notice', outcome: 'notified', note: '' }, [part], 'A3'); assert.equal(arrivalNotice(flow, [part], order.id), '已通知送机'); assert.equal(arrivalNotice(flow, [part, { ...part, id: 'P2', events: [] }], order.id), '配件未到齐'); const after = apply(flow, { type: 'custody', custody: 'store' }, [part], 'A4'); assert.equal(arrivalNotice(after, [part], order.id), '无需到货通知'); assert.equal(after.events.length, 4); });
test('四个日常分组按采购与返修事实映射，阶段细节保留且读取不改事实', async () => {
  const { visibleRepairGroups, defaultRepairGroups } = await import(moduleUrl('repair-groups'));
  assert.deepEqual(visibleRepairGroups(defaultRepairGroups(), 'workflow').map(row => row.label), ['返修','处理中','等配件','等取机']);
  for (const status of Object.keys(repairStageGroups)) {
    for (const records of [[], [{...part,events:[]}], [{...part,events:part.events.slice(0,1)}], [part]]) {
      const flow = { ...initialRepairWorkflow(order), status }, before = structuredClone({flow,records});
      const expected = status === 'cancelled' ? 'cancelled' : status === 'completed' ? 'complete' : status === 'ready' ? 'ready' : records.some(row => row.events.length === 1) ? 'purchase' : 'processing';
      assert.equal(workflowGroup(order, records, flow), expected);
      assert.deepEqual({flow,records},before);
    }
  }
});
test('到货通知仍依实际采购和沟通签名判断，与维修分组分开', () => {
  const customer = {...initialRepairWorkflow(order),custody:'customer'};
  const notified = apply(customer,{type:'arrival_notice',outcome:'notified',note:'DEMO沟通'});
  assert.equal(workflowGroup(order,[part],notified),'processing');
  assert.equal(repairPartsFollowup(order,[part],notified),'arrival');
  assert.equal(arrivalNotice(notified,[part],order.id),'已通知送机');
  assert.equal(arrivalNotice({...notified,notice:{...notified.notice,outcome:'unreachable'}},[part],order.id),'未通知送机');
  assert.equal(repairPartsFollowup(order,[part,{...part,id:'P2',events:[]}],notified),null);
  assert.equal(repairPartsFollowup(order,[part],{...notified,status:'testing'}),'arrival');
});
test('旧等待/欠款不推断修好，旧通知兼容，交还通过明确跟进事实记录', () => {
  for(const status of ['awaiting_reply','collected_unpaid'])assert.equal(workflowGroup({...order,status},[]),'processing');
  assert.equal(workflowGroup({...order,status:'outsourced'},[]),'processing');
  assert.throws(()=>apply(initialRepairWorkflow(order),{type:'stage',status:'ready_notified',note:''}),/修好/);
  const ready=apply(initialRepairWorkflow(order),{type:'stage',status:'ready',note:''});
  const notified=apply(ready,{type:'stage',status:'ready_notified',note:''},[],'A2');
  assert.equal(workflowGroup(order,[],notified),'ready');
  assert.throws(()=>apply(ready,{type:'stage',status:'collected_unpaid',note:'DEMO确认'},[],'A2'),/交还/);
  assert.throws(()=>apply(ready,{type:'followup',flag:'collectedUnpaid',value:true,note:'DEMO'},[],'A2'),/交还/);
  const unpaid=apply(ready,{type:'followup',flag:'collectedUnpaid',value:true,note:'DEMO交还欠款',delivered:true,unpaid:true},[],'A2');
  assert.equal(unpaid.custody,'customer');assert.equal(unpaid.followUp.collectedUnpaid,true);assert.equal(workflowGroup(order,[],unpaid),'complete');assert.equal(part.events.length,2);
});
test('持久配件重放数量事实，拒绝损坏/超量/重复编号', () => { const state = { version: 1, records: [part], repairUpdates: {} }; assert.equal(parseProcurementState(JSON.stringify(state)).records[0].events.length, 2); assert.throws(() => parseProcurementState(JSON.stringify({ ...state, records: [{ ...part, events: [...part.events, { id: 'overflow', type: 'arrival', quantity: 1, note: '', time: activity.time }] }] }))); assert.throws(() => parseProcurementState(JSON.stringify({ ...state, records: [part, part] }))); });
test('经营收支只计已登记且未作废的整数分，销售与采购不会自动成为收支', () => { const base = { id: 'E1', kind: 'income', amountCents: 1250, purpose: 'DEMO收款', relatedId: '', note: '', time: activity.time }; validateFinanceEntry(base); assert.throws(() => validateFinanceEntry({ ...base, amountCents: 0 })); assert.throws(() => validateFinanceEntry({ ...base, amountCents: 1.5 })); assert.deepEqual(financeTotals([base, { ...base, id: 'E2', kind: 'expense', amountCents: 250 }, { ...base, id: 'E3', voidReason: '误记' }]), { income: 1250, expense: 250, balance: 1000 }); assert.equal(defaultStoreSettings.finance.length, 0); });
test('设置验证拒绝重复供应商、不安全网站和坏账本，不覆盖原资料', () => { const raw = settings => JSON.stringify({ version: 1, settings }); assert.equal(parseStoreSettings(raw(defaultStoreSettings)).paper, 'a4'); assert.throws(() => parseStoreSettings(raw({ ...defaultStoreSettings, suppliers: [...defaultStoreSettings.suppliers, defaultStoreSettings.suppliers[0]] }))); assert.throws(() => parseStoreSettings(raw({ ...defaultStoreSettings, suppliers: [{ ...defaultStoreSettings.suppliers[0], website: 'javascript:alert(1)' }] }))); });

test("售后接机已核对的保管事实用于初始工作流，普通旧LOCAL仍待核对", () => { assert.equal(initialRepairWorkflow({...order,custody:"store"}).custody,"store"); assert.equal(initialRepairWorkflow({...order,custody:"customer"}).custody,"customer"); assert.equal(initialRepairWorkflow(order).custody,"unknown"); });

test('维修分组改名与排序保留业务标识，旧设置兼容，非法配置拒绝', async () => {
  const { defaultRepairGroups, parseRepairGroups, moveRepairGroup } = await import(moduleUrl('repair-groups'));
  const groups = defaultRepairGroups();
  const reordered = moveRepairGroup(groups.workflow, 'processing', 'rework');
  assert.equal(reordered[0].key, 'processing');
  const next = {...groups, workflow:reordered.map(row=>row.key==='processing'?{...row,label:'  处理中  '}:row)};
  const parsed = parseRepairGroups(next);
  assert.equal(parsed.workflow[0].label,'处理中');
  assert.equal(groups.workflow[0].key,'rework');
  const legacy = parseStoreSettings(JSON.stringify({version:1,settings:defaultStoreSettings}));
  assert.deepEqual(legacy.repairGroups,groups);
  const custom = parseStoreSettings(JSON.stringify({version:1,settings:{...defaultStoreSettings,repairGroups:next}}));
  assert.deepEqual(custom.repairGroups,parsed);
  for (const edit of [v=>v.workflow.pop(),v=>v.workflow.push(v.workflow[0]),v=>v.workflow[0].key='invented',v=>v.workflow[0].key=v.workflow[1].key,v=>v.workflow[0].label=' ',v=>v.workflow[0].label='x'.repeat(41),v=>v.workflow[0].label='a\nb',v=>v.workflow[0].label=v.workflow[1].label,v=>v.workflow[0].role='owner']) {
    const bad=structuredClone(groups);edit(bad);assert.throws(()=>parseRepairGroups(bad));
  }
  for (const bad of [null, [], {}, {...groups,extra:[]}]) assert.throws(()=>parseRepairGroups(bad));
});

test('旧11分组配置统一名称、补齐阶段且保留已有相对顺序，不改输入字节', async () => {
  const { parseRepairGroups, visibleRepairGroups, defaultRepairGroups } = await import(moduleUrl('repair-groups'));
  const added = ['rework','diagnosis','awaiting_quote','awaiting_parts','testing'];
  const legacy = defaultRepairGroups();
  legacy.workflow = legacy.workflow.filter(row => !added.includes(row.key)).toReversed().map(row => ({...row,label:row.key==='processing'?'维修':row.key==='complete'?'完成':row.label}));
  const before = JSON.stringify(legacy);
  const parsed = parseRepairGroups(legacy);
  assert.equal(JSON.stringify(legacy),before);
  assert.deepEqual(parsed.workflow.filter(row=>!added.includes(row.key)&&!['processing','purchase','ready'].includes(row.key)).map(row=>row.key),legacy.workflow.filter(row=>!['processing','purchase','ready'].includes(row.key)).map(row=>row.key));
  assert.equal(visibleRepairGroups(legacy,'workflow').length,4);
  assert.equal(parsed.workflow.find(row=>row.key==='processing').label,'处理中');
  assert.equal(parsed.workflow.find(row=>row.key==='complete').label,'维修结束');
  assert.deepEqual(parseRepairGroups(parsed),parsed);
  for(const bad of [legacy.workflow.slice(1),[...legacy.workflow,{key:'diagnosis',label:'待检测'}]]) assert.throws(()=>parseRepairGroups({...legacy,workflow:bad}));
});

test('旧通知与跟进只投影确定阶段，未核对维修结果保持待确认且不改原状态', async () => {
  const {repairStageStatus}=await import(moduleUrl('repair-workflow'));
  for(const status of ['awaiting_reply','collected_unpaid','ready_notified']) {
    const flow={...initialRepairWorkflow(order),status};const before=JSON.stringify(flow);
    const stage=status==='ready_notified'?'ready':'awaiting_quote';
    assert.equal(repairStageStatus(flow),stage);
    assert.equal(overlayRepair(order,flow).statusLabel,status==='ready_notified'?'待取机':'待确认');
    assert.equal(overlayRepair(order,flow).status,status);
    assert.equal(JSON.stringify(flow),before);
    assert.equal(repairStageStatus({...flow,readyCycle:'known-ready'}),'ready');
    assert.equal(workflowGroup(order,[],{...flow,readyCycle:'known-ready'}),'ready');
  }
});

test('返修保留来源标记，选供应商或加车不移组，下单/部分到货/全到货依真实事实', () => {
  const rework={...order,repairOrigin:{repairId:'LOCAL-0000000000000002',reason:'DEMO再次送回'}};
  const draft={...part,quantity:2,events:[]};
  const cart={...draft,events:[{id:'c',type:'cart_added',quantity:0,time:activity.time,note:''}]};
  const ordered={...cart,events:[...cart.events,{id:'o',type:'ordered',quantity:0,time:activity.time,note:''}]};
  const partial={...ordered,events:[...ordered.events,{id:'p',type:'arrival',quantity:1,time:activity.time,note:''}]};
  const complete={...partial,events:[...partial.events,{id:'a',type:'arrival',quantity:1,time:activity.time,note:''}]};
  for(const source of [order,rework]) {
    const group=source.repairOrigin?'rework':'processing';
    for(const rows of [[],[draft],[cart],[complete]])assert.equal(workflowGroup(source,rows),group);
    for(const rows of [[ordered],[partial]])assert.equal(workflowGroup(source,rows),'purchase');
    assert.equal(repairProgress(source,[cart]).label,'已加车');assert.equal(repairProgress(source,[partial]).label,'部分到货');
    assert.equal(workflowGroup(source,[complete],{...initialRepairWorkflow(source),status:'ready'}),'ready');
  }
});
test('需求待核对或必需配件未齐拒绝修好，纯人工明确无需采购后可进入等取机', () => {
  const item={id:'project:1',title:'DEMO人工处理',request:'',revision:1,mode:'pending',confirmed:false};
  const source={requirements:[item]};
  assert.throws(()=>applyWorkflowCommand(initialRepairWorkflow(order),{type:'stage',status:'ready',note:''},activity,[],order.id,0,source),/待核对/);
  const verified=applyWorkflowCommand(initialRepairWorkflow(order),{type:'requirement',item:{...item,mode:'none',confirmed:true},note:'DEMO仅人工清洁'},activity,[],order.id,0,source);
  assert.equal(applyWorkflowCommand(verified,{type:'stage',status:'ready',note:''},{...activity,id:'A2'},[],order.id,1,source).status,'ready');
  assert.throws(()=>apply(initialRepairWorkflow(order),{type:'stage',status:'ready',note:''},[{...part,events:part.events.slice(0,1)}]),/未到齐/);
});
test('已取机始终进历史，旧通知事件不能复活；恢复需说明且通知周期重置', () => {
  const ready=apply(initialRepairWorkflow(order),{type:'stage',status:'ready',note:''},[]);
  const handed=apply(ready,{type:'followup',flag:'collectedUnpaid',value:true,note:'DEMO已交还未结清',delivered:true,unpaid:true},[],'A2');
  const before=structuredClone(handed);
  for(const status of ['ready_notified','awaiting_reply']) {
    const legacy={...handed,events:[...handed.events,{id:'old-'+status,type:'stage',label:'维修阶段：'+(status==='ready_notified'?'修好已通知':'久等 未答复'),note:'DEMO旧数据',time:activity.time}]};
    assert.equal(hasCurrentRepairHandover(legacy),true);assert.equal(isRepairHistory(order,legacy),true);assert.equal(workflowGroup(order,[],legacy),'complete');
    assert.throws(()=>apply(handed,{type:'stage',status,note:'DEMO'},[],'A3'),/已取走/);
  }
  assert.throws(()=>apply(handed,{type:'pickup_notice',outcome:'notified',note:''},[],'A3'),/历史工单/);
  assert.throws(()=>assertRepairProcurementOpen(order,handed),/恢复/);
  assert.throws(()=>apply(handed,{type:'stage',status:'repairing',note:''},[],'A3'),/原因/);
  const closed=apply(handed,{type:'followup',flag:'collectedUnpaid',value:false,note:'DEMO已核对收尾'},[],'A3');
  assert.equal(workflowGroup(order,[],closed),'complete');
  const restored=apply(closed,{type:'stage',status:'repairing',note:'DEMO明确恢复'},[],'A4');
  assert.equal(hasCurrentRepairHandover(restored),false);assert.equal(workflowGroup(order,[],restored),'processing');
  const again=apply(restored,{type:'stage',status:'ready',note:''},[],'A5');assert.equal(repairProgress(order,[],again).label,'未通知');assert.deepEqual(handed,before);assert.equal(again.handedOver.time,handed.handedOver.time);
});
test('旧15分组自动加入返修且保存原顺序，完整16分组读取稳定', async()=>{
 const {defaultRepairGroups,parseRepairGroups}=await import(moduleUrl('repair-groups')); const current=defaultRepairGroups();
 const old={...current,workflow:current.workflow.filter(row=>row.key!=='rework').toReversed()};const before=structuredClone(old);
 const next=parseRepairGroups(old);assert.equal(next.workflow[0].key,'rework');assert.deepEqual(next.workflow.slice(0,4).map(row=>row.key),['rework','processing','purchase','ready']);assert.deepEqual(next.workflow.slice(4).map(row=>row.key),old.workflow.filter(row=>!['processing','purchase','ready'].includes(row.key)).map(row=>row.key));assert.deepEqual(old,before);assert.deepEqual(parseRepairGroups(next),next);
});

test('等取机与历史写端拒绝新增或更改项目，不把界面隐藏当校验',()=>{
 const item={id:'project:blocked',title:'DEMO新项目',request:'',revision:1,mode:'pending',confirmed:false};
 for(const status of ['ready','ready_notified','completed','cancelled']){const flow={...initialRepairWorkflow(order),status};assert.throws(()=>apply(flow,{type:'requirement',item,note:'DEMO'}),/恢复维修/);assert.equal(flow.requirements,undefined);}
});
