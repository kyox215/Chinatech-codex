import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
const compiled=ts.transpileModule(readFileSync(new URL("../lib/retail-input.ts",import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {retailDraftNumber,retailNumberError}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
test("实测输入的未知不转零、整数不取整，无效原文不能成为合法值",()=>{
  assert.equal(retailDraftNumber(""),null); assert.equal(retailDraftNumber("  ",true),null); assert.equal(retailDraftNumber("0",true),0);
  for(const raw of ["-1","1.5","1,5","1e2","NaN","Infinity","12%","1 000"]) assert.ok(Number.isNaN(retailDraftNumber(raw,true)),raw);
  assert.equal(retailDraftNumber("1,5"),1.5); assert.equal(retailDraftNumber("1.5"),1.5);
  for(const raw of ["1,000.5","1.000,5","5.",".5","-1"]) assert.ok(Number.isNaN(retailDraftNumber(raw)),raw);
});
test("电池、数量、RAM的上下界反馈与写入限制一致",()=>{
  for(const raw of ["0","78","100",""]) assert.equal(retailNumberError(raw,0,100,true),"");
  for(const raw of ["101","-1","3.5","abc"]) assert.ok(retailNumberError(raw,0,100,true));
  assert.ok(retailNumberError("0",1,8192,true)); assert.ok(retailNumberError("8193",1,8192,true)); assert.equal(retailNumberError("8192",1,8192,true),"");
});
