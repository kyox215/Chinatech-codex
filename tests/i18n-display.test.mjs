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
const { repairIssueText, repairCustomerName } = await load("lib/i18n/repair-display.ts");
const { intakeDirectoryEntry } = await load("lib/repair-intake-record.ts");



test("structured repair choices display in three languages while explicit customer notes and source stay original",()=>{
  const source={issue:"屏幕、电池；屏幕 · 客户原文",faults:["屏幕","电池"],issueNote:"屏幕 · 客户原文"};const before=structuredClone(source);
  assert.equal(repairIssueText(source,"it"),"Display, Batteria; 屏幕 · 客户原文");
  assert.equal(repairIssueText(source,"en"),"Screen, Battery; 屏幕 · 客户原文");
  assert.equal(repairIssueText({...source,faults:[],issueNote:"屏幕"},"en"),"屏幕");
  assert.deepEqual(source,before);
});
test("missing-name display uses source metadata and preserves real names that match dictionary words",()=>{
  assert.equal(repairCustomerName({customer:{name:"未填写姓名"},customerNameMissing:true},"en"),"Name not entered");
  assert.equal(repairCustomerName({customer:{name:"未填写姓名"},customerNameMissing:false},"en"),"未填写姓名");
  assert.equal(repairCustomerName({customer:{name:"普通"}},"it"),"普通");
});
test("repair directory keeps original structured facts and only adds view metadata",()=>{
  const raw={id:"LOCAL-0000000000000011",customerName:"",phone:"+393330000011",category:"手机",brand:"Apple",model:"iPhone",color:"黑色",serial:"DEMO",priority:"普通",issue:"屏幕；原文",faults:["屏幕"],issueNote:"原文",accessories:[],services:{screen:{quality:"",technology:""},battery:{quality:"",appleService:""},port:{quality:""}},createdAt:"2026-10-06 10:00:00",updatedAt:"2026-10-06 10:00:00"};
  const before=structuredClone(raw);const view=intakeDirectoryEntry(raw);
  assert.equal(view.customerNameMissing,true);assert.deepEqual(view.faults,["屏幕"]);assert.equal(view.issueNote,"原文");assert.equal(view.issue,raw.issue);assert.deepEqual(raw,before);
  assert.equal(repairIssueText(view,"en"),"Screen; 原文");
});

const { retailEventTitle, retailEventDetail } = await load("lib/i18n/retail-display.ts");
test("formal retail event codes display locally while unknown history and frozen raw facts stay unchanged",()=>{
  const event={title:"单机操作：payment",detail:"已核对并保存。"};const before=structuredClone(event);
  assert.equal(retailEventTitle(event.title,"en"),"Device operation: Record payments");
  assert.equal(retailEventTitle("单机操作：unknown-custom-code","it"),"单机操作：unknown-custom-code");
  assert.equal(retailEventDetail("普通 · 客户手写原文","en"),"普通 · 客户手写原文");
  assert.match(retailEventDetail(event.detail,"en"),/saved/i);assert.deepEqual(event,before);
});
