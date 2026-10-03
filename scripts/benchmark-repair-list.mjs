import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import ts from "typescript";

const modules=new Map();
function library(name){
  if(modules.has(name))return modules.get(name);
  const code=ts.transpileModule(readFileSync("lib/"+name+".ts","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from "\.\/([^"]+)"/g,(_,dep)=>`from "${library([...name.split("/").slice(0,-1),dep].join("/"))}"`);
  const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");modules.set(name,url);return url;
}
const {repairOrders}=await import(library("repair-fixtures"));
const {repairPartsSummary}=await import(library("procurement"));
const {workflowGroup}=await import(library("repair-workflow"));
const {compareRepairUpdates}=await import(library("repair-list-order"));
const {defaultRepairGroups}=await import(library("repair-groups"));
const {buildRepairPartsIndex,buildRepairListRows,selectRepairListGroups}=await import(library("repair-list-model"));
const settings=defaultRepairGroups();const results=[];
function measure(fn){
  for(let i=0;i<3;i++)fn();
  const values=[];for(let i=0;i<30;i++){const started=performance.now();fn();values.push(performance.now()-started);}
  const sorted=values.toSorted((a,b)=>a-b);return {n:values.length,p50ms:sorted[14],p95ms:sorted[28],values};
}
for(const size of [100,1000,5000]){
  const repairs=Array.from({length:size},(_,i)=>({...structuredClone(repairOrders[0]),id:"PERF-"+String(i).padStart(5,"0"),status:"diagnosis",custody:"customer"}));
  const parts=repairs.map(row=>({id:"P-"+row.id,repairId:row.id,item:"Synthetic part",supplier:"Synthetic supplier",quantity:1,unitCostCents:null,expectedAt:"",reference:"",events:[{id:"O-"+row.id,type:"ordered",time:"2026-10-02 10:00:00",note:"Synthetic"},{id:"A-"+row.id,type:"arrival",quantity:1,time:"2026-10-02 10:00:00",note:"Synthetic"}]}));
  // Reproduce the pre-P1 list's map/full-ledger summary, group filters and row scans.
  function before(query=""){
    const summaries=Object.fromEntries(repairs.map(row=>[row.id,repairPartsSummary(parts,row.id)]));
    const filtered=repairs.filter(row=>row.status!=="cancelled"&&[row.id,row.customer.name,row.customer.phone,row.device.brand,row.device.model,row.device.serial,row.issue].join(" ").toLocaleLowerCase().includes(query)).sort((a,b)=>compareRepairUpdates(a,b,{}));
    const groups=settings.workflow.filter(group=>group.key!=="cancelled").map(group=>({key:group.key,rows:filtered.filter(row=>workflowGroup(row,parts)===group.key)}));
    for(const group of groups)for(const row of group.rows){parts.filter(part=>part.repairId===row.id);assert.ok(summaries[row.id]);}
    return groups;
  }
  const model=buildRepairListRows(repairs,buildRepairPartsIndex(parts),{},{});
  const select=(rows,query="")=>selectRepairListGroups(rows,settings,{query,status:"all",partsFilter:"all",groupBy:"workflow",sort:"updated"}).groups;
  const digest=groups=>groups.map(group=>[group.key,group.rows.map(row=>row.id)]);
  assert.deepEqual(digest(before()),digest(select(model.rows)));
  assert.deepEqual(digest(before("perf-000")),digest(select(model.rows,"perf-000")));
  const coldBefore=measure(()=>before());
  const coldAfter=measure(()=>select(buildRepairListRows(repairs,buildRepairPartsIndex(parts),{},{}).rows));
  const searchBefore=measure(()=>before("perf-000"));
  const searchAfter=measure(()=>select(model.rows,"perf-000"));
  results.push({size,coldBefore,coldAfter,searchBefore,searchAfter});
  console.log(`${size}: old/new model P50 ${coldBefore.p50ms.toFixed(2)}/${coldAfter.p50ms.toFixed(2)}ms; old/new cached search ${searchBefore.p50ms.toFixed(2)}/${searchAfter.p50ms.toFixed(2)}ms`);
}
mkdirSync(".local/performance-p1",{recursive:true});
writeFileSync(".local/performance-p1/list-model-results.json",JSON.stringify({timestamp:new Date().toISOString(),method:"Node24 CPU model comparison, three warmups and 30 samples; old list algorithm reproduced, equal ordered group identities verified; excludes React/DOM/network, not user-device INP",results},null,2));
