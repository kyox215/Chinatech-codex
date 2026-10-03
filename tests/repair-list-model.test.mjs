import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const cache = new Map();
function moduleUrl(name) {
  if (cache.has(name)) return cache.get(name);
  let compiled = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  compiled = compiled.replace(/from "\.\/([^"]+)"/g, (_, dependency) => `from "${moduleUrl(dependency)}"`);
  const url = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  cache.set(name, url);
  return url;
}
const { buildRepairPartsIndex, buildRepairListRows, selectRepairListGroups, filterRepairContactGroups } = await import(moduleUrl("repair-list-model"));
const { repairPartsSummary } = await import(moduleUrl("procurement"));
const { repairOrders, repairStatusOptions } = await import(moduleUrl("repair-fixtures"));
const { workflowGroup, initialRepairWorkflow, partsSignature } = await import(moduleUrl("repair-workflow"));
const { compareRepairUpdates } = await import(moduleUrl("repair-list-order"));
const { defaultRepairGroups, visibleRepairGroups } = await import(moduleUrl("repair-groups"));

const order = (id, changes = {}) => ({ ...structuredClone(repairOrders[0]), id, status: "diagnosis", ...changes });
const event = (id, type, quantity = 0) => ({ id, type, quantity, note: "合成验证", time: "2026-10-02 09:00:00" });
const part = (repairId, changes = {}) => ({ id: `P-${repairId}`, repairId, item: "合成配件", supplier: "供应商A", quantity: 1, unitCostCents: null, expectedAt: "", reference: "", events: [], ...changes });
const options = changes => ({ query: "", status: "all", partsFilter: "all", groupBy: "workflow", sort: "updated", ...changes });
const model = (orders, parts = [], workflows = {}, updates = {}) => buildRepairListRows(orders, buildRepairPartsIndex(parts), workflows, updates);

test("配件索引保留供应商及备选展示，同源汇总只计算必需数量且不改原记录", () => {
  const parts = [
    part("A", { id: "P1", quantity: 2, events: [event("O1", "ordered"), event("A1", "arrival", 2)] }),
    part("B", { id: "P2", events: [event("C1", "cart_added")] }),
    part("A", { id: "P3", required: false, supplier: "供应商B", quantity: 5, item: "备选" }),
    part("A", { id: "P4", supplier: "供应商A", events: [event("C2", "cart_added")] }),
    part("C", { id: "P5", required: false }),
  ];
  const before = structuredClone(parts);
  const index = buildRepairPartsIndex(parts);
  for (const id of ["A", "B", "C"]) assert.deepEqual(index.get(id).summary, repairPartsSummary(parts, id));
  assert.deepEqual(index.get("A").records.map(row => row.id), ["P1", "P3", "P4"]);
  assert.equal(index.get("A").suppliers, "供应商A、供应商B");
  assert.equal(index.get("A").title, "供应商A · 合成配件\n供应商B · 备选\n供应商A · 合成配件");
  assert.equal(index.get("C").summary.group, "unrecorded");
  assert.deepEqual(parts, before);
  const rows = buildRepairListRows([order("D")], index, {}, {}).rows;
  assert.deepEqual(rows[0].parts.summary, repairPartsSummary(parts, "D"));
});

test("索引工作流遵循共享规则，人工阶段、保管及通知签名与整份采购结果相同", () => {
  const parts = [part("A", { events: [event("O", "ordered"), event("A", "arrival", 1)] }), part("unrelated")];
  for (const { value: status } of repairStatusOptions) {
    for (const custody of ["store", "customer", "unknown"]) {
      for (const outcome of ["notified", "unreachable"]) {
        const repair = order("A", { status });
        const flow = { ...initialRepairWorkflow(repair), custody, notice: { signature: partsSignature(parts, "A"), outcome } };
        const rows = model([repair], parts, { A: flow }).rows;
        assert.equal(rows[0].workflowGroup, workflowGroup(repair, parts, flow), `${status}/${custody}/${outcome}`);
      }
    }
  }
});

test("七个空组、作废筛选、改名排序和同一次分桶保留计数与工单身份", () => {
  const settings = defaultRepairGroups();
  settings.workflow.reverse();
  settings.workflow.find(group => group.key === "processing").label = "自定义处理中";
  const list = model([order("A"), order("B", { status: "cancelled" }), order("C", { status: "ready" })]);
  const selected = selectRepairListGroups(list.rows, settings, options());
  assert.equal(selected.groups.length, 7);
  assert.deepEqual(selected.groups.map(group => group.key), visibleRepairGroups(settings, "workflow").map(group => group.key));
  assert.equal(selected.groups.find(group => group.key === "processing").label, "自定义处理中");
  assert.equal(selected.groups.reduce((sum, group) => sum + group.rows.length, 0), 2);
  assert.deepEqual(selected.groups.flatMap(group => group.rows.map(row => row.id)).toSorted(), ["A", "C"]);
  const empty = selectRepairListGroups(list.rows, settings, options({ query: "找不到的合成文本" }));
  assert.equal(empty.groups.length, 7);
  assert.ok(empty.groups.every(group => group.rows.length === 0));
  const included = selectRepairListGroups(list.rows, settings, options({ status: "including_cancelled" }));
  assert.equal(included.groups.length, 7);
  assert.equal(included.filteredRows.length, 3);
  const cancelled = selectRepairListGroups(list.rows, settings, options({ status: "cancelled" }));
  assert.deepEqual(cancelled.groups.find(group => group.key === "cancelled").rows.map(row => row.id), ["B"]);
});

test("搜索、配件过滤及三种稳定排序与原有时间和优先级规则相同", () => {
  const repairs = [
    order("B", { createdAt: "2026-10-01 09:00:00", updatedAt: "2026-10-02 08:00:00", priority: "紧急" }),
    order("A", { createdAt: "2026-10-01 09:00:00", updatedAt: "2026-10-02 08:00:00", priority: "紧急" }),
    order("C", { createdAt: "2026-09-30 09:00:00", updatedAt: "2026-10-02 07:00:00", priority: "普通", customer: { name: "合成张三", phone: "+39 000 1234" } }),
  ];
  const updates = { C: "2026-10-02 10:00:00", A: "2026-10-02 06:00:00" };
  const parts = [part("C", { events: [event("C", "cart_added")] })];
  const rows = model(repairs, parts, {}, updates).rows;
  for (const sort of ["updated", "created", "priority"]) {
    const scores = { 紧急: 0, 优先: 1, 普通: 2 };
    const expected = repairs.toSorted((left, right) => sort === "created" ? left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
      : (sort === "priority" ? scores[left.priority] - scores[right.priority] : 0) || compareRepairUpdates(left, right, updates));
    const selected = selectRepairListGroups(rows, defaultRepairGroups(), options({ sort, groupBy: "none" }));
    assert.deepEqual(selected.groups[0].rows.map(row => row.id), expected.map(row => row.id));
  }
  const found = selectRepairListGroups(rows, defaultRepairGroups(), options({ query: "   合成张三  ", partsFilter: "cart" }));
  assert.deepEqual(found.filteredRows.map(row => row.id), ["C"]);
  assert.equal(selectRepairListGroups(rows, defaultRepairGroups(), options({ query: "  IPHONE 15 PRO  " })).filteredRows.length, 3);
  assert.deepEqual(repairs.map(row => row.id), ["B", "A", "C"]);
});

test("下单、到货与更正后重建移组；已通知事实不跨需求变化复用", () => {
  const repair = order("A", { custody: "customer" });
  const draft = part("A");
  const ordered = { ...draft, events: [event("O", "ordered")] };
  const arrived = { ...ordered, events: [...ordered.events, event("A", "arrival", 1)] };
  assert.equal(model([repair], [draft]).byId.get("A").workflowGroup, "processing");
  assert.equal(model([repair], [ordered]).byId.get("A").workflowGroup, "purchase");
  const flow = { ...initialRepairWorkflow(repair), notice: { signature: partsSignature([arrived], "A"), outcome: "notified" } };
  assert.equal(model([repair], [arrived], { A: flow }).byId.get("A").workflowGroup, "arrival");
  const corrected = { ...arrived, events: [...arrived.events, { ...event("C", "correction", -1), arrivalId: "A" }] };
  assert.equal(model([repair], [corrected], { A: flow }).byId.get("A").workflowGroup, "purchase");
  assert.equal(model([repair], [arrived, part("A", { id: "optional", required: false })], { A: flow }).byId.get("A").workflowGroup, "arrival");
  assert.equal(model([repair], [arrived, part("A", { id: "new-required" })], { A: flow }).byId.get("A").workflowGroup, "purchase");
});

test("100/1000/5000合成工单只在索引及各工单本身读取配件关联，不随工单数扫描整份采购", () => {
  for (const count of [100, 1000, 5000]) {
    let associationReads = 0;
    const repairs = Array.from({ length: count }, (_, index) => order(`S-${index.toString().padStart(5, "0")}`));
    const parts = repairs.map(repair => {
      const row = part(repair.id, { events: [event(`O-${repair.id}`, "ordered"), event(`A-${repair.id}`, "arrival", 1)] });
      Object.defineProperty(row, "repairId", { get: () => { associationReads++; return repair.id; } });
      return row;
    });
    const rows = model(repairs, parts).rows;
    const selected = selectRepairListGroups(rows, defaultRepairGroups(), options());
    assert.equal(selected.filteredRows.length, count);
    assert.equal(selected.groups.find(group => group.key === "arrival").rows.length, count);
    assert.ok(associationReads <= parts.length * 12, `${count} rows read associations ${associationReads} times`);
  }
});

test("逐单需求范围进入索引摘要，未选项目不被零采购条目隐藏", () => {
  const screen={id:"screen",title:"屏幕",request:"",mode:"parts",confirmed:true,revision:1};
  const battery={id:"battery",title:"电池",request:"",mode:"pending",confirmed:false,revision:1};
  const repair=order("pending",{requirements:[screen,battery]});
  const rows=model([repair],[part(repair.id,{requirementId:screen.id,requirementRevision:1,events:[event("O","ordered"),event("A","arrival",1)]})]).rows;
  assert.equal(rows[0].parts.summary.unresolvedRequirements,1);
  assert.equal(rows[0].parts.summary.allRequiredReady,false);
  assert.equal(rows[0].workflowGroup,"purchase");
  assert.equal(model([order("empty",{requirements:[battery]})]).rows[0].parts.summary.unresolvedRequirements,1);
});

test("联系筛选先作用于全部获权分桶，分页后的第二页待联系不会漏掉", () => {
  const orders=Array.from({length:61},(_,i)=>order(`READY-${i}`,{status:"ready"}));
  const flows=Object.fromEntries(orders.map((repair,i)=>[repair.id,{...initialRepairWorkflow(repair),readyCycle:"cycle",...(i<60?{pickupNotice:{cycle:"cycle",outcome:"notified"}}:{})}]));
  const groups=selectRepairListGroups(model(orders,[],flows).rows,defaultRepairGroups(),options()).groups;
  const filtered=filterRepairContactGroups(groups,flows,{ready:"unnotified"});
  assert.deepEqual(filtered.find(group=>group.key==="ready").rows.map(row=>row.id),["READY-60"]);
  assert.equal(filtered.length,7);
  assert.equal(filtered.find(group=>group.key==="cancelled").rows.length,0);
});
