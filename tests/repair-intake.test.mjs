import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
const compiled = ts.transpileModule(readFileSync(new URL("../lib/repair-intake.ts", import.meta.url),"utf8"),{ compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022} }).outputText;
const { customerPhoneMatches, intakeCustomers, validIntakePhone, modelsFor, intakeDeviceHistory, intakeIssueText, intakePhotoError } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
test("客户实时电话候选支持格式化/国际拨号前缀，短值不返回整份目录",()=>{
 assert.deepEqual(customerPhoneMatches("32",intakeCustomers),[]);
 for(const q of ["3200001029","+39 320 000 1029","00393200001029"]){ assert.equal(customerPhoneMatches(q,intakeCustomers)[0].id,"DEMO-C01"); }
 assert.equal(customerPhoneMatches("99999999",intakeCustomers).length,0);
 assert.equal(validIntakePhone("+39 320 000 1029"),true);
 for(const q of ["123","hello@example.com","+393200001029x","1".repeat(16)]) assert.equal(validIntakePhone(q),false);
});
test("品牌型号关联只给候选，不把未知手填值当成已知型号",()=>{
 assert.ok(modelsFor("手机","apple").includes("iPhone 15 Pro"));
 assert.deepEqual(modelsFor("电脑","Samsung"),[]);
 assert.deepEqual(modelsFor("手机","手动品牌"),[]);
});
test("设备标识跨客户保留全部历史，同型号另作参考，SN保留品牌范围",()=>{
 const orders=[{id:"old-a",customer:{id:"a"},createdAt:"2025-01-01",device:{brand:"Apple",model:"iPhone 15",serial:"DEMO-SHARED"}}, {id:"old-b",customer:{id:"b"},createdAt:"2026-01-01",device:{brand:"Apple",model:"iPhone 15",serial:"DEMO-SHARED"}}, {id:"other-unit",createdAt:"2026-02-01",device:{brand:"Apple",model:"iPhone 15",serial:"DEMO-OTHER"}}, {id:"other-brand",createdAt:"2026-02-01",device:{brand:"Samsung",model:"Other",serial:"DEMO-SHARED"}}];
 const result=intakeDeviceHistory("demo-shared","Apple","iPhone 15",orders);
 assert.deepEqual(result.exact.map(x=>x.id),["old-b","old-a"]);
 assert.deepEqual(result.related.map(x=>x.id),["other-unit"]);
 assert.equal(intakeDeviceHistory("","Apple","iPhone 15",orders).exact.length,0);
 const imei=[...orders,{id:"imei",createdAt:"2025-01-01",device:{brand:"Apple",model:"iPhone 15",serial:"123456789012345"}}];
 assert.equal(intakeDeviceHistory("123456789012345","Samsung","Galaxy",imei).exact[0].id,"imei");
});
test("故障标签和补充并存；照片拒绝非图像和过大文件",()=>{
 assert.equal(intakeIssueText(["屏幕：碎裂"],"  触摸正常  "),"屏幕：碎裂；触摸正常");
 assert.equal(intakeIssueText([],"  "),"");
 assert.equal(intakePhotoError({type:"image/jpeg",size:100}),"");
 assert.ok(intakePhotoError({type:"text/plain",size:100}));
 assert.ok(intakePhotoError({type:"image/png",size:0}));
 assert.ok(intakePhotoError({type:"image/jpeg",size:13*1024*1024}));
});
const servicesModule = ts.transpileModule(readFileSync(new URL("../lib/intake-services.ts", import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const { emptyIntakeServices, normalizeIntakeServices, intakeServiceLabels } = await import("data:text/javascript;base64," + Buffer.from(servicesModule).toString("base64"));

const dependencyUrls = new Map();
function dependencyUrl(name) {
 if(dependencyUrls.has(name)) return dependencyUrls.get(name);
 let code=ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 code=code.replace(/from "\.\/([^"]+)"/g,(_,dep)=>`from "${dependencyUrl([...name.split("/").slice(0,-1),dep].join("/"))}"`);
 const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");dependencyUrls.set(name,url);return url;
}
const recordUrl = dependencyUrl("repair-intake-record");
const { parseLocalIntakes, validLocalIntake, intakeDirectoryEntry, intakeRecordTime } = await import(recordUrl);
const receipt = {id:"LOCAL-0123456789ABCDEF",createdAt:"2026-09-30 12:00:00",updatedAt:"2026-09-30 12:00:00",previewAt:"2026-09-30 12:00",customerName:"",phone:"+39 320 000 1099",email:"",category:"手机",brand:"Apple",model:"iPhone 16",color:"蓝色",serial:"DEMO-INTAKE-099",issue:"屏幕：碎裂",accessories:["SIM 卡托"],services:emptyIntakeServices,priority:"普通",photoCount:0};
test("配件类型不混入故障；切换品牌、原装或取消故障清理不适用选择",()=>{
 const preferences={screen:{quality:"assembled",technology:"oled"},battery:{quality:"original",appleService:"both"},port:{quality:"assembled"}};
 assert.deepEqual(intakeServiceLabels(preferences),["屏幕 · 组装 · OLED","电池 · 原装","苹果电池 · 扩容跑诊断","尾插 · 组装"]);
 const selected=["屏幕：碎裂","电池","尾插：接口松动"];
 assert.equal(normalizeIntakeServices(preferences,selected," 苹果 ").battery.appleService,"both");
 assert.equal(normalizeIntakeServices(preferences,selected,"Samsung").battery.appleService,"");
 assert.equal(normalizeIntakeServices({...preferences,screen:{quality:"original",technology:"oled"}},selected,"Apple").screen.technology,"");
 assert.deepEqual(normalizeIntakeServices(preferences,[],"Apple"),emptyIntakeServices);
 assert.equal(normalizeIntakeServices(preferences,["电池：不充电"],"Apple").battery.appleService,"both");
 assert.equal(normalizeIntakeServices(preferences,["电池：不充电"],"Apple").screen.quality,"");
});
test("本地接机格式校验、可选姓名、150位标识和未知金额",()=>{
 const encoded=JSON.stringify({version:1,records:[receipt]});
 assert.deepEqual(parseLocalIntakes(encoded),[receipt]);
 assert.equal(validLocalIntake({...receipt,serial:"A".repeat(150)}),true);
 assert.equal(validLocalIntake({...receipt,serial:"A".repeat(151)}),false);
 for(const services of [
  {...emptyIntakeServices,screen:{quality:[],technology:""}},
  {...emptyIntakeServices,battery:{quality:"original",appleService:[]}},
  {...emptyIntakeServices,screen:{quality:"original",technology:"oled"}},
 ]) assert.equal(validLocalIntake({...receipt,services}),false);
 for(const raw of ["{",JSON.stringify({version:2,records:[receipt]}),JSON.stringify({version:1,records:[receipt,receipt]})]) assert.throws(()=>parseLocalIntakes(raw));
 const row=intakeDirectoryEntry(receipt); assert.equal(row.status,"diagnosis"); assert.equal(row.customer.name,"未填写姓名"); assert.equal("quote" in row,false);
 assert.equal(intakeRecordTime(new Date("2026-09-30T10:00:00Z")),"2026-09-30 12:00:00");
});
test("本地保存幂等、损坏与容量失败不覆盖；暂时读失败可以恢复",async()=>{
 let raw=null,denyRead=false,denyWrite=false;
 const browser=new EventTarget();
 browser.localStorage={getItem(key){if(denyRead)throw new Error("denied");return key==="chinatech.m1.staff.v1"?null:raw;},setItem(key,value){if(denyWrite)throw new Error("quota");raw=value;}};
 const previous=globalThis.window;globalThis.window=browser;
 try{
  let storeModule=ts.transpileModule(readFileSync(new URL("../components/repairs/local-intake-store.ts", import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  storeModule=storeModule.replace(/import \{[^}]+\} from "react";/,'const useSyncExternalStore = () => {}; const useMemo=fn=>fn();').replace(/import \{ repairOrders \} from "@\/lib\/repair-fixtures";/,'const repairOrders = [];').replace('"@/lib/repair-intake-record"',JSON.stringify(recordUrl)).replace('"@/lib/repair-workflow"',JSON.stringify(dependencyUrl("repair-workflow"))).replace(/import \{ useRepairWorkflows \} from "\.\/repair-workflow-store";/,'const useRepairWorkflows = () => ({workflows: {}});');
  storeModule=storeModule.replace(/from "@\/lib\/([^"]+)"/g,(_,dep)=>`from "${dependencyUrl(dep)}"`);
  storeModule+='\nexport {read as readSnapshot};';
  const {saveLocalIntake,readSnapshot}=await import("data:text/javascript;base64,"+Buffer.from(storeModule).toString("base64"));
  assert.equal(readSnapshot().records.length,0);
  saveLocalIntake(receipt);saveLocalIntake({...receipt,issue:"更新故障"},1);
  assert.equal(parseLocalIntakes(raw).length,1);assert.equal(readSnapshot().records[0].issue,"更新故障");
  denyRead=true;assert.ok(readSnapshot().error);denyRead=false;assert.equal(readSnapshot().error,"");assert.equal(readSnapshot().records.length,1);
  const saved=raw;denyWrite=true;assert.throws(()=>saveLocalIntake({...receipt,issue:"失败修改"},2));assert.equal(raw,saved);denyWrite=false;
  raw="{invalid";assert.throws(()=>saveLocalIntake(receipt));assert.equal(raw,"{invalid");
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
