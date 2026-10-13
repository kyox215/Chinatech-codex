import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import ts from "typescript";

const source=readFileSync(new URL("../lib/toolbox/mimover-original-release.ts",import.meta.url),"utf8");
const exports={};
new Function("exports",ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports);
const {mimoverOriginalRelease:release,isMimoverOriginalReady:ready}=exports;
const hash=data=>createHash("sha256").update(data).digest("hex");
function archive(data) {
  let end=data.length-22;
  while(end>=Math.max(0,data.length-65557)&&data.readUInt32LE(end)!==0x06054b50)end--;
  assert.ok(end>=0);let pos=data.readUInt32LE(end+16);const count=data.readUInt16LE(end+10);const entries=new Map();
  for(let i=0;i<count;i++) {
    assert.equal(data.readUInt32LE(pos),0x02014b50);
    const method=data.readUInt16LE(pos+10),packed=data.readUInt32LE(pos+20),nameLength=data.readUInt16LE(pos+28),extra=data.readUInt16LE(pos+30),comment=data.readUInt16LE(pos+32),local=data.readUInt32LE(pos+42);
    const name=data.subarray(pos+46,pos+46+nameLength).toString("utf8");assert.equal(entries.has(name),false);
    assert.equal(data.readUInt32LE(local),0x04034b50);const start=local+30+data.readUInt16LE(local+26)+data.readUInt16LE(local+28);const bytes=data.subarray(start,start+packed);
    assert.ok(method===0||method===8);entries.set(name,method===8?inflateRawSync(bytes):bytes);pos+=46+nameLength+extra+comment;
  }
  return entries;
}

test("Original Mi Mover download gate rejects incomplete or changed-engine releases",()=>{
  assert.equal(ready(release),true);
  for(const change of [{status:"building"},{available:false},{mode:"independent-engine"},{bytes:0},{bytes:NaN},{bytes:1.5},{sha256:""},{sha256:"z".repeat(64)},{signerSha256:"a".repeat(63)}])assert.equal(ready({...release,...change}),false);
});

test("Published original APK contains only original DEX and the inspected entry patch",()=>{
  const bytes=readFileSync(new URL(`../public${release.apkPath}`,import.meta.url));assert.equal(bytes.length,release.bytes);assert.equal(hash(bytes),release.sha256);
  const proof=JSON.parse(readFileSync(new URL(`../public${release.proofPath}`,import.meta.url),"utf8"));const entries=archive(bytes);
  assert.deepEqual([...entries.keys()].filter(n=>/^classes.*\.dex$/.test(n)).sort(),["classes.dex","classes2.dex"]);
  assert.equal(hash(entries.get("classes.dex")),proof.originalClasses1Sha256);
  assert.equal(hash(entries.get("resources.arsc")),proof.originalResourceTableSha256);
  assert.equal(hash(entries.get("classes2.dex")),"e92485a7c9edaf9de81ccbeb5089cc0a9e27d95bd3137709e71fe7a444fc1e0a");
  assert.deepEqual([...entries.get("classes2.dex").subarray(1996484,1996488)],[0x13,0x02,0x01,0x00]);
  assert.deepEqual(proof.addedFiles,[]);assert.equal(proof.addedDex,false);
  assert.equal(proof.originalMainApplication,true);assert.equal(proof.originalGlobalMiuiStatusUnchanged,true);
  assert.deepEqual(proof.dexBodyChangedOffsets,[1996484,1996486,1996487]);
  assert.deepEqual([...proof.changedEntries].sort(),["AndroidManifest.xml","classes2.dex"]);
  const instructions=readFileSync(new URL(`../public${release.instructionsPath}`,import.meta.url),"utf8");
  for(const text of ["中文","Italiano","English",release.sha256,"classes3"])assert.ok(instructions.includes(text));
});

test("Rejected lab2 cannot be reached from the toolbox or its old public URL",()=>{
  assert.equal(existsSync(new URL("../public/toolbox/mimover-universal/MiMover-4.5.7.5-universal-coexist-lab2.apk",import.meta.url)),false);
  const page=readFileSync(new URL("../components/toolbox/android-transfer-page.tsx",import.meta.url),"utf8");
  assert.ok(page.includes("<MimoverOriginalDownload />"));assert.equal(page.includes("<MimoverDownload />"),false);
});
