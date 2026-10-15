import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";

const source=readFileSync(new URL("../lib/toolbox/mimover-original-release.ts",import.meta.url),"utf8");
const exports={};
new Function("exports",ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports);
const {mimoverOriginalRelease:release,isMimoverOriginalReady:ready}=exports;
test("Original Mi Mover download gate rejects incomplete or changed-engine releases",()=>{
  assert.equal(ready(release),false);
  assert.equal(ready({...release,available:true}),true);
  for(const change of [{status:"building"},{available:false},{mode:"independent-engine"},{bytes:0},{bytes:NaN},{bytes:1.5},{sha256:""},{sha256:"z".repeat(64)},{signerSha256:"a".repeat(63)}])assert.equal(ready({...release,...change}),false);
});

test("Retired vendor package and metadata are absent from public deployment",()=>{
  assert.equal(release.available,false);
  for(const path of [release.apkPath,release.instructionsPath,release.proofPath,release.checksumsPath])assert.equal(existsSync(new URL(`../public${path}`,import.meta.url)),false,path);
  const page=readFileSync(new URL('../components/toolbox/mimover-original-download.tsx',import.meta.url),'utf8');
  assert.ok(page.includes('ToolIntegrationPending'));assert.equal(page.includes('DownloadLink'),false);
});

test("Rejected lab2 cannot be reached from the toolbox or its old public URL",()=>{
  assert.equal(existsSync(new URL("../public/toolbox/mimover-universal/MiMover-4.5.7.5-universal-coexist-lab2.apk",import.meta.url)),false);
  const page=readFileSync(new URL("../components/toolbox/android-transfer-page.tsx",import.meta.url),"utf8");
  assert.ok(page.includes("<MimoverOriginalDownload />"));assert.equal(page.includes("<MimoverDownload />"),false);
});
