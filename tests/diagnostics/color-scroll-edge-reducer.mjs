import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {appendFileSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,readlinkSync,realpathSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {arch,cpus,platform,release} from 'node:os';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

export const BASE='d60ea050e50e4b4a8534f09f7519976c551f0fac';
export const REF='refs/heads/codex/site-ui-color-scroll-edge-20261016';
const TITLE='routed retail editor cancels without persisting and restores after reload at four widths';
const ORIGIN='http://127.0.0.1:3121';
const ALLOWED=['tests/diagnostics/color-scroll-edge-reducer.mjs','.github/workflows/color-scroll-edge-reducer.yml','.github/workflows/ci.yml'];
const HASHES={'playwright.config.ts':'5857c6153cebb2dfab72bbaac734e10e13f1db830145750390f83d470f939c90','.github/workflows/ci.yml':'3d263a2a71d35676d927e2690f4d5138ca244b3ccd7dff82b0ffe3ba900c0ed6','next.config.ts':'58f9f9a2834151017871b89e5161c7f2733533c819efe5d68a6c93641355e26a','app/api/preview-session/route.ts':'2505ffac4ad0d7fe83fe3b60372be34c3081f3d4399fdfd0e8436d1959bebc29','lib/preview-auth.ts':'77bdad8fed92fb9c45f89caf036c007c369abe8acb0f09f235358efe391c4c3a','components/color-picker.tsx':'0eb25f8047186d0267985e0ae203174977b7b8ffafb3f6797fd02ef63cd15312','tests/browser/site-ui-recheck.spec.ts':'f0f32ca8664b44c14a6cae97a80f6412c5f30fed397fe2b5bee95813d54f121f'};
const NEXT_ENV={input:'99c57261ad066f56cad7d36225f2625bdfb2443b0681a09c06324e605c4bb072',inputBytes:304,generated:'0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc',generatedBytes:296,oldNonDevPrediction:'1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b',devConfig:'98ccb79dcb5be21d233e452e24198d9f71d42b16e560b38119da7fa78cecd526',writer:'3973ebf0093b08136059a790442951ba498421627a52bfcf06e1584360e034c9'};
const SAMPLE_ENV={path:'.env.example',blob:'89f0294086fdf5074b5d9042572cdfc8ef99d3c5',bytes:1497,sha256:'d7f68561fa46fdfc127e11a9e83946fbb191366ab470125a57cf2f63eb820b7d'};
const cwd=realpathSync(process.cwd()),output=join(cwd,'.local/color-scroll-edge/artifacts');
const sha=data=>createHash('sha256').update(data).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:256*1024*1024});
const baseline=file=>execFileSync('git',['show',`${BASE}:${file}`],{cwd,maxBuffer:256*1024*1024});
const json=(file,data)=>{mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(data,null,2)+'\n');};
const safeChildEnv=()=>Object.fromEntries(['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL','TZ','SYSTEMROOT'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
const previewEnv=()=>({...safeChildEnv(),BACKEND_MODE:'preview',LOCAL_PREVIEW:'true',NEXT_TELEMETRY_DISABLED:'1',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',APP_DATABASE_URL:''});

export function safeArchivePath(path,mode){
  assert(path&&!isAbsolute(path)&&!/[\\\x00-\x1f]/.test(path),'invalid archive path');
  assert(path.split('/').every(part=>part&&part!=='.'&&part!=='..'),'archive traversal');
  assert(['100644','100755'].includes(mode),'symlink/submodule/special archive entry');
  const parts=path.split('/');assert(!parts.some(part=>['.git','.aws','.vercel','.supabase','.npmrc','.yarnrc','.yarnrc.yml'].includes(part)||(/^(\.env|id_rsa|credentials?$|secrets?$)/i.test(part)&&path!==SAMPLE_ENV.path)),'private configuration archive entry');
}

export function transformColor(ts,source){
  assert.equal(sha(source),HASHES['components/color-picker.tsx']);
  const sf=ts.createSourceFile('color-picker.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const functions=[];sf.forEachChild(node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==='ColorPicker')functions.push(node);});assert.equal(functions.length,1);
  const effects=[];function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(sf)==='useEffect')effects.push(node);ts.forEachChild(node,visit);}visit(functions[0]);assert.equal(effects.length,1);assert.equal(effects[0].arguments[1].getText(sf),'[open]');
  const places=[];function find(node){if(ts.isVariableDeclaration(node)&&node.name.getText(sf)==='place'&&node.initializer&&ts.isArrowFunction(node.initializer))places.push(node.initializer);ts.forEachChild(node,find);}find(effects[0]);assert.equal(places.length,1);const place=places[0];assert.equal(place.parameters.length,0);
  const setters=[];function setter(node){if(ts.isCallExpression(node)&&node.expression.getText(sf)==='setPosition')setters.push(node);ts.forEachChild(node,setter);}setter(place);assert.equal(setters.length,1);const call=setters[0];assert.equal(call.arguments.length,1);assert(ts.isObjectLiteralExpression(call.arguments[0]));assert(ts.isExpressionStatement(call.parent));
  assert(!/\b__edge(?:Next|State|Suppressed)\b/.test(source));
  const effectText=effects[0].getText(sf);for(const text of ['place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);','window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true);'])assert(effectText.includes(text));
  const originalHead=source.slice(place.getStart(sf),place.equalsGreaterThanToken.getStart(sf));const originalStatement=call.parent.getText(sf),object=call.arguments[0].getText(sf);
  const head='(event?: Event) ';
  const statement=`const __edgeNext = ${object};\n      const __edgeState = (window as unknown as { __colorScrollEdge: { gate: boolean; capture: (source: string, bounds: DOMRect, next: typeof __edgeNext, suppressed: boolean) => void } }).__colorScrollEdge;\n      const __edgeSuppressed = __edgeState.gate && event?.type === "scroll";\n      if (!__edgeSuppressed) setPosition(__edgeNext);\n      __edgeState.capture(event?.type ?? "initial", bounds, __edgeNext, __edgeSuppressed);`;
  const transformed=source.slice(0,call.parent.getStart(sf))+statement+source.slice(call.parent.end);
  const result=transformed.slice(0,place.getStart(sf))+head+transformed.slice(place.equalsGreaterThanToken.getStart(sf));
  assert.equal(result.replace(head,originalHead).replace(statement,originalStatement),source,'nonlocal runtime transform');
  const parsed=ts.createSourceFile('derived.tsx',result,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);assert.equal(parsed.parseDiagnostics.length,0);
  return{source:result,proof:{beforeSha256:sha(source),afterSha256:sha(result),originalPlaceSha256:sha(place.getText(sf)),objectSha256:sha(object),inverseByteExact:true,onlyChanges:['optional native Event parameter','evaluate original setPosition object once before source-gated forwarding'],handlerRegistrationAndCleanupTextUnchanged:true},originalPlace:place.getText(sf),derivedPlace:result.slice(place.getStart(sf),place.end+(head.length-originalHead.length)+(statement.length-originalStatement.length))};
}

export function extractCallback(ts,source){
  assert.equal(sha(source),HASHES['tests/browser/site-ui-recheck.spec.ts']);const sf=ts.createSourceFile('f0.ts',source,ts.ScriptTarget.Latest,true);const found=[];
  function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(sf)==='test'&&node.arguments[0]?.text===TITLE)found.push(node);ts.forEachChild(node,visit);}visit(sf);assert.equal(found.length,1);const call=found[0];assert(ts.isArrowFunction(call.arguments[1]));assert(call.arguments[1].modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.AsyncKeyword));
  const start=call.parent.getStart(sf),end=call.parent.end+2,block=source.slice(start,end);assert.equal(source.slice(call.parent.end,end),'\n\n');assert.equal(Buffer.byteLength(block),1636);assert.equal(sha(block),'3d2db907f0048a779790ca5d606b295593b00ee104b5359d43fbb8207121b806');
  const callback=call.arguments[1].getText(sf);const code=ts.transpileModule(`module.exports = (${callback});`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const body=call.arguments[1].body.getText(sf);assert.equal(Buffer.byteLength(callback),1535);assert.equal(sha(callback),'d1afe4ee4579dc8bcb93c7159a061427beafe3a467d87bce3c59b55b1571985a');assert.equal(Buffer.byteLength(body),1515);assert.equal(sha(body),'b593559a8e5eaab86528628c58126bddd9f37383e6d9fa8beddacd6f09a085bf');
  return{callback,code,proof:{fileSha256:sha(source),legacyDeclarationBytes:1636,legacyDeclarationSha256:sha(block),trailingTwoLFVerified:true,callbackBytes:1535,callbackSha256:sha(callback),callbackBodyBytes:1515,callbackBodySha256:sha(body),compiledSha256:sha(code),directOriginalArrow:true}};
}

function archiveInputs(){
  const entries=git('ls-tree','-r','-z',BASE).split('\0').filter(Boolean).map(line=>{const [meta,path]=line.split('\t'),[mode,type,blob]=meta.split(' ');assert.equal(type,'blob');safeArchivePath(path,mode);return{path,mode,blob};});
  const manifest=entries.map(entry=>{const data=entry.path==='.github/workflows/ci.yml'?baseline(entry.path):readFileSync(join(cwd,entry.path));assert.equal(createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex'),entry.blob,`checkout input drift:${entry.path}`);if(entry.path===SAMPLE_ENV.path){assert.equal(entry.blob,SAMPLE_ENV.blob);assert.equal(data.length,SAMPLE_ENV.bytes);assert.equal(sha(data),SAMPLE_ENV.sha256);}return{...entry,bytes:data.length,sha256:sha(data)};});
  for(const [file,expected]of Object.entries(HASHES))assert.equal(sha(baseline(file)),expected,`baseline binding:${file}`);
  assert.equal(sha(baseline('next-env.d.ts')),NEXT_ENV.input);
  const dirty=git('status','--porcelain','--untracked-files=all').split('\n').filter(Boolean).map(line=>line.slice(3));for(const file of dirty)assert(ALLOWED.includes(file),`unauthorized checkout change:${file}`);
  const changed=git('diff','--name-only',BASE,'HEAD').trim().split('\n').filter(Boolean);for(const file of changed)assert(ALLOWED.includes(file));
  const originalCI=baseline('.github/workflows/ci.yml').toString();assert.equal(readFileSync(join(cwd,'.github/workflows/ci.yml'),'utf8'),originalCI.replace('  check:\n',`  check:\n    if: github.ref != '${REF}'\n`),'original CI changed beyond exact job guard');
  return{manifest};
}
export function preflight(dependencies=cwd){
  const {manifest}=archiveInputs(),native=createRequire(join(realpathSync(dependencies),'package.json')),ts=native('typescript');assert.equal(native('typescript/package.json').version,'6.0.3');
  const transform=transformColor(ts,baseline('components/color-picker.tsx').toString()),callback=extractCallback(ts,baseline('tests/browser/site-ui-recheck.spec.ts').toString());
  const writer=join(dirname(native.resolve('next/package.json')),'dist/lib/typescript/writeAppTypeDeclarations.js');assert.equal(sha(readFileSync(writer)),NEXT_ENV.writer);
  assert.equal(native('next/package.json').version,'16.3.7');assert.equal(sha(readFileSync(join(dirname(native.resolve('next/package.json')),'dist/server/config.js'))),NEXT_ENV.devConfig);
  return{native,ts,manifest,transform,callback,proof:{baseline:BASE,tree:git('rev-parse',`${BASE}^{tree}`).trim(),checkout:git('rev-parse','HEAD').trim(),node:process.version,manifest,transform:transform.proof,callback:callback.proof,envSample:SAMPLE_ENV,nextEnv:NEXT_ENV,allowedChanges:ALLOWED,networkOrBrowserStarted:false}};
}

function requireCI(){assert.equal(platform(),'linux');assert.equal(arch(),'x64');assert.equal(process.versions.node.split('.')[0],'24');assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.CI,'true');assert.equal(process.env.GITHUB_REF,REF);assert.equal(git('rev-parse','HEAD').trim(),process.env.GITHUB_SHA);}
export function describeNextEnv(data){
  const text=data.toString('utf8'),allowed=new Set(['./.next-backend/types/routes.d.ts','./.next-backend/types/root-params.d.ts','./.next/types/routes.d.ts','./.next/types/root-params.d.ts','./.next/dev/types/routes.d.ts','./.next/dev/types/root-params.d.ts']);
  const found=[...text.matchAll(/^\s*import\s+["']([^"']+)["'];?\s*$/gm)].map(match=>match[1]);const fingerprint=sha(data);
  const classification=fingerprint===NEXT_ENV.input&&data.length===NEXT_ENV.inputBytes?'EXACT_ARCHIVE_INPUT':fingerprint===NEXT_ENV.generated&&data.length===NEXT_ENV.generatedBytes?'EXACT_LOCKED_DEV_OUTPUT':fingerprint===NEXT_ENV.oldNonDevPrediction&&data.length===288?'EXACT_SUPERSEDED_NON_DEV_PREDICTION':'UNEXPECTED_NOT_ALLOWED';
  return{file:'next-env.d.ts',bytes:data.length,sha256:fingerprint,classification,relativeTypeImports:found.filter(path=>allowed.has(path)),nonWhitelistedImportCount:found.filter(path=>!allowed.has(path)).length};
}
function nextEnvEvidence(runtime,generated){
  const path=join(runtime,'next-env.d.ts');let actual;
  try{const stat=lstatSync(path);actual=stat.isFile()&&!stat.isSymbolicLink()?describeNextEnv(readFileSync(path)):{file:'next-env.d.ts',bytes:stat.size,sha256:null,classification:'NON_REGULAR_REFUSED',relativeTypeImports:[]};}catch(error){actual={file:'next-env.d.ts',bytes:null,sha256:null,classification:'UNREADABLE_OR_MISSING',errorCode:error.code,relativeTypeImports:[]};}
  const expected={sha256:generated?NEXT_ENV.generated:NEXT_ENV.input,bytes:generated?NEXT_ENV.generatedBytes:NEXT_ENV.inputBytes};
  const receipt={stage:generated?'after-dev-startup':'archive-input',expected,actual,accepted:actual.sha256===expected.sha256&&actual.bytes===expected.bytes};
  json(join(output,`next-env-metadata-${generated?'generated':'archive'}.json`),receipt);if(!receipt.accepted)json(join(output,'unexpected-next-env-metadata.json'),receipt);return receipt;
}
function verifyRuntime(runtime,manifest,derived,generated=false){
  const nextEnv=nextEnvEvidence(runtime,generated);
  const files=[];function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){if(['node_modules','.next'].includes(item.name))continue;const path=join(dir,item.name);assert(!lstatSync(path).isSymbolicLink());if(item.isDirectory())walk(path);else files.push(relative(runtime,path).split(sep).join('/'));}}walk(runtime);assert.equal(files.length,manifest.length);
  for(const item of manifest){const actual=item.path==='next-env.d.ts'?nextEnv.actual.sha256:sha(readFileSync(join(runtime,item.path)));const expected=item.path==='components/color-picker.tsx'?derived:item.path==='next-env.d.ts'&&generated?NEXT_ENV.generated:item.sha256;assert.equal(actual,expected,`runtime input drift:${item.path}`);if(item.path==='next-env.d.ts')assert(nextEnv.accepted,'runtime input drift:next-env.d.ts');}return{files:files.length,soleDerivative:'components/color-picker.tsx',nextEnvGenerated:generated,nextEnvSha256:nextEnv.actual.sha256,nextEnvMetadata:nextEnv};
}

function prepare(){
  requireCI();const inputs=archiveInputs();mkdirSync(output,{recursive:true});const base=join(cwd,'.local/color-scroll-edge');mkdirSync(base,{recursive:true});const runtime=mkdtempSync(join(base,'runtime-'));
  const tar=execFileSync('git',['archive','--format=tar',BASE],{cwd,maxBuffer:512*1024*1024});const members=execFileSync('tar',['-tf','-'],{input:tar,encoding:'utf8',maxBuffer:4*1024*1024}).trim().split('\n');for(const member of members){const path=member.endsWith('/')?member.slice(0,-1):member;assert(!isAbsolute(path)&&path.split('/').every(part=>part&&part!=='.'&&part!=='..'));if(!member.endsWith('/'))assert(inputs.manifest.some(entry=>entry.path===member));}
  execFileSync('tar',['-xf','-','--directory',runtime,'--no-same-owner'],{input:tar});for(const item of inputs.manifest)assert.equal(sha(readFileSync(join(runtime,item.path))),item.sha256);
  const env=safeChildEnv(),npm=realpathSync(join(dirname(process.execPath),'npm'));execFileSync(process.execPath,[npm,'ci'],{cwd:runtime,env,stdio:'inherit'});
  const check=preflight(runtime);writeFileSync(join(runtime,'components/color-picker.tsx'),check.transform.source);verifyRuntime(runtime,check.manifest,check.transform.proof.afterSha256);
  const native=createRequire(join(runtime,'package.json')),pw=join(dirname(native.resolve('playwright/package.json')),'cli.js');assert.equal(native('@playwright/test/package.json').version,'1.63.0');execFileSync(process.execPath,[pw,'install','--with-deps','webkit'],{cwd:runtime,env,stdio:'inherit'});
  const browsers=JSON.parse(readFileSync(join(dirname(native.resolve('playwright-core/package.json')),'browsers.json')));assert.equal(browsers.browsers.find(item=>item.name==='webkit').revision,'2359');
  json(join(output,'preparation.json'),{...check.proof,runtime,scriptSha256:sha(readFileSync(fileURLToPath(import.meta.url))),outsideNamespace:readlinkSync('/proc/self/ns/net'),versions:{node:process.version,playwright:native('@playwright/test/package.json').version,webkitRevision:2359},dependencyPreparationOutsideNamespace:true,runtimeInputProof:verifyRuntime(runtime,check.manifest,check.transform.proof.afterSha256)});
}

export function browserEdgeInit({sampleId,gate}){
  if(window!==window.top)return;
  const documentId=`edge-${performance.timeOrigin}`;let count=0,sealed=false,sealPromise,transportErrors=0;const pending=new Set();const counts={initial:0,resize:0,scroll:0,other:0,reads:0,writes:0,suppressed:0,late:0,overflow:false,sendErrors:0};
  const emit=packet=>{const task=window.__colorScrollEdgeSink(packet).catch(()=>{transportErrors++;}).finally(()=>pending.delete(task));pending.add(task);return task;};
  const state={counts,capture(source,bounds,next,suppressed){if(sealed)return;const started=performance.now();counts[source in counts&&['initial','resize','scroll'].includes(source)?source:'other']++;counts.reads++;if(suppressed)counts.suppressed++;else counts.writes++;if(++count>8192){if(!counts.overflow)void emit({kind:'overflow',sampleId,documentId,gate,counts:{...counts,overflow:true}});counts.overflow=true;return;}
    const packet={kind:'place',sampleId,documentId,sequence:count,time:performance.now(),source,gate,suppressed,bounds:{x:bounds.x,y:bounds.y,left:bounds.left,top:bounds.top,right:bounds.right,bottom:bounds.bottom,width:bounds.width,height:bounds.height},next:{width:next.width,left:next.left,top:next.top,maxHeight:next.maxHeight},counts:{...counts}};
    packet.readAndRecordCostMs=performance.now()-started;void emit(packet);
  },seal(reason){if(sealPromise)return sealPromise;sealed=true;const lastSequence=count,frozen=Object.freeze({...counts,sendErrors:transportErrors}),sealedAt=performance.now();sealPromise=(async()=>{void emit({kind:'terminal',sampleId,documentId,gate,reason,time:sealedAt,lastSequence,counts:frozen});await Promise.allSettled([...pending]);if(reason==='pagehide')return Object.freeze({sampleId,documentId,gate,lastSequence,counts:frozen,unloadAcknowledgementNotObserved:true});const ack={kind:'drained',sampleId,documentId,gate,time:performance.now(),lastSequence,counts:frozen,pending:pending.size,transportErrors};await emit(ack);return Object.freeze({...ack,pending:pending.size,transportErrors});})();return sealPromise;}};
  Object.defineProperty(state,'gate',{value:gate,writable:false});Object.defineProperty(window,'__colorScrollEdge',{value:state,writable:false});
  void emit({kind:'document',sampleId,documentId,gate,timeOrigin:performance.timeOrigin});
  addEventListener('pagehide',()=>{void state.seal('pagehide');},{once:true});
}

export function classifyNativeTrace(lines,{timedOut,pendingAtDeadline,passed,settled}){
  let width=null,reloaded=false;const widths=[],calls=new Map();
  for(const event of lines){if(event.type==='before'&&event.method==='setViewportSize'){width=event.params.viewportSize.width;widths.push(width);}if(event.type==='after'&&event.method==='reload'&&!event.error)reloaded=true;
    if(event.type==='before'){calls.set(event.callId,{method:event.method,selector:event.params?.selector,width,startTime:event.startTime,logs:[],after:null});}
    const call=calls.get(event.callId);if(call&&event.type==='log')call.logs.push({time:event.time,message:event.message});if(call&&event.type==='after'){call.after=event;if(call.method==='reload'&&!event.error)reloaded=true;}
  }
  const targets=[...calls.values()].filter(call=>call.method==='click'&&call.selector?.includes('internal:role=radio[name="其他颜色"s]')&&call.selector.endsWith(' >> ..'));
  const first=targets.find(call=>call.width===1440),target=targets.find(call=>call.width===1024);
  const stable=target?.logs.filter(log=>log.message.includes('element is visible, enabled and stable')).length??0,notStable=target?.logs.filter(log=>log.message.includes('element is not stable')).length??0;let waiting=false,completeChecks=0;
  for(const log of target?.logs??[]){if(log.message.includes('waiting for element to be visible, enabled and stable'))waiting=true;else if(log.message.includes('element is not stable')){if(waiting)completeChecks++;waiting=false;}}
  const forbidden=target?.logs.filter(log=>/scrolling into view|done scrolling|performing click action|click action done/.test(log.message)).map(log=>log.message)??[];
  const shape=Boolean(settled&&timedOut&&pendingAtDeadline&&!passed&&first?.after&&!first.after.error&&reloaded&&widths.length===2&&widths[0]===1440&&widths[1]===1024&&target&&completeChecks>=2&&stable===0&&forbidden.length===0);
  return{shape,passed,widths,reloaded,first1440Succeeded:Boolean(first?.after&&!first.after.error),target:target?{selector:target.selector,startTime:target.startTime,notStable,stable,forbidden,completeStableChecksObserved:completeChecks}:null,timedOut,pendingAtDeadline,settled};
}

export const BUDGET={operation:30000,teardown:5000,total:105000};

export function runnerSources(callbackProof,sampleId,runtime){
  assert(['A0','B','A1'].includes(sampleId));
  const dir=join(runtime,'.next','color-scroll-edge-diagnostic',sampleId),artifacts=join(output,`runner-${sampleId}`),begin=join(artifacts,'begin.json'),life=join(artifacts,'lifecycle.json'),stream=join(artifacts,'edge.jsonl'),outcome=join(artifacts,'outcome.json');
  const spec=`const {test,expect}=require('@playwright/test');
const {readFileSync,writeFileSync,appendFileSync,mkdirSync}=require('node:fs');
const {performance}=require('node:perf_hooks');
const {dirname}=require('node:path');
const paths=${JSON.stringify({begin,life,stream})},sampleId=${JSON.stringify(sampleId)},gate=${sampleId==='B'};
const stamp=()=>({wall:Date.now(),monotonic:performance.now(),timeOrigin:performance.timeOrigin});
const save=()=>{mkdirSync(dirname(paths.life),{recursive:true});writeFileSync(paths.life,JSON.stringify(life,null,2)+'\\n');};
const life={sampleId,gate,streamErrors:[],callbackInvoked:false,callbackSettled:false,callbackFinally:false,passed:false};let nativePromise,callbackPromise,cutoffTimer;
const browserEdgeInit=${browserEdgeInit.toString()};
const nativeModule={exports:{}};((module,exports)=>{${callbackProof.code}
})(nativeModule,nativeModule.exports);const native=nativeModule.exports;
test.beforeEach(async({context,page},testInfo)=>{
  const begin=JSON.parse(readFileSync(paths.begin,'utf8'));if(begin.timeout!==30000||testInfo.timeout!==30000||!Number.isFinite(begin.startWall))throw new Error('PUBLIC_RUNNER_CLOCK_MISSING');
  life.clock={publicStartWall:begin.startWall,timeout:begin.timeout,deadlineWall:begin.startWall+30000,worker:stamp()};life.beforeEach=stamp();life.browserVersion=context.browser().version();life.operationTimeout=testInfo.timeout;save();
  cutoffTimer=setTimeout(()=>{life.cutoffObserved=stamp();life.pendingAtDeadline=!life.callbackSettled;save();},Math.max(0,life.clock.deadlineWall-Date.now()));
  let records=0;
  await context.exposeBinding('__colorScrollEdgeSink',(source,packet)=>{if(source.frame!==source.page.mainFrame()){life.streamErrors.push('non-main-frame');return;}if(packet.sampleId!==sampleId||packet.gate!==gate||JSON.stringify(packet).length>8192){life.streamErrors.push('packet-binding');return;}if(packet.kind==='place'&&++records>8192){life.streamErrors.push('capacity');return;}if(packet.kind==='overflow')life.streamErrors.push('capacity');appendFileSync(paths.stream,JSON.stringify(packet)+'\\n');});
  await context.addInitScript(browserEdgeInit,{sampleId,gate});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==${JSON.stringify(ORIGIN)}){life.streamErrors.push('non-owned-request-origin');return route.abort();}return route.continue();});
  await context.routeWebSocket('**/*',ws=>{if(new URL(ws.url()).origin!=='ws://127.0.0.1:3121'){life.streamErrors.push('non-owned-websocket-origin');ws.close();}else ws.connectToServer();});
  life.ready=stamp();save();
});
test.afterEach(async({page,context},testInfo)=>{
  life.afterEachStarted=stamp();life.statusAtAfterEach=testInfo.status;life.operationEndUpperBound=stamp();testInfo.setTimeout(5000);save();
  try{
    life.sealRequested=stamp();save();life.seal=await page.evaluate(()=>window.__colorScrollEdge.seal('operation-complete-or-timedout'));life.sealAcknowledged=stamp();save();
    if(life.seal.pending!==0||life.seal.transportErrors!==0)throw new Error('SEAL_NOT_DRAINED');
    life.pageCloseRequested=stamp();save();await page.close();life.pageCloseCompleted=stamp();life.pageClosed=page.isClosed();save();
    if(!nativePromise||!callbackPromise)throw new Error('ORIGINAL_CALLBACK_NOT_INVOKED');await nativePromise.then(()=>{},()=>{});await callbackPromise.then(()=>{},()=>{});life.callbackAwaitCompleted=stamp();save();
    if(!life.callbackSettled||!life.callbackFinally)throw new Error('ORIGINAL_CALLBACK_NOT_SETTLED');
    life.contextCloseRequested=stamp();save();await context.close();life.contextClosed=true;life.contextCloseCompleted=stamp();life.complete=true;
  }finally{clearTimeout(cutoffTimer);life.afterEachFinished=stamp();save();}
});
test(${JSON.stringify(TITLE)},async({page})=>{
  life.callbackInvoked=true;life.callbackStarted=stamp();save();
  nativePromise=native({page});callbackPromise=nativePromise.then(value=>{life.passed=true;return value;},error=>{life.callbackErrorName=error.name;throw error;}).finally(()=>{life.callbackSettled=true;life.callbackFinally=true;life.callbackSettledAt=stamp();save();});
  await callbackPromise;
});
`;
  const reporter=`const {writeFileSync,mkdirSync}=require('node:fs');const {dirname}=require('node:path');const {performance}=require('node:perf_hooks');
const paths=${JSON.stringify({begin,outcome})};const save=(file,value)=>{mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(value,null,2)+'\\n');};
module.exports=class{constructor(){this.results=[];this.errors=[];}onBegin(config,suite){this.registered=suite.allTests().length;}onTestBegin(test,result){save(paths.begin,{startWall:result.startTime.getTime(),timeout:test.timeout,retry:result.retry,observedWall:Date.now(),observedMonotonic:performance.now()});}onTestEnd(test,result){this.results.push({title:test.title,status:result.status,expectedStatus:test.expectedStatus,startWall:result.startTime.getTime(),duration:result.duration,retry:result.retry,attachments:result.attachments.filter(item=>item.path).map(item=>({name:item.name,path:item.path,contentType:item.contentType})),errorNames:result.errors.map(error=>error.name||'Error')});}onError(error){this.errors.push({name:error.name||'Error'});}onEnd(result){this.outcome={registered:this.registered,results:this.results,errors:this.errors,status:result.status,startWall:result.startTime.getTime(),duration:result.duration,endWall:Date.now()};save(paths.outcome,this.outcome);}async onExit(){this.outcome={...this.outcome,publicReporterExit:true,exitWall:Date.now()};save(paths.outcome,this.outcome);}};
`;
  const config=`const {defineConfig,devices}=require('@playwright/test');module.exports=defineConfig({testDir:__dirname,testMatch:'sample.spec.cjs',fullyParallel:false,forbidOnly:true,workers:1,retries:0,timeout:30000,expect:{timeout:5000},outputDir:${JSON.stringify(join(artifacts,'test-results'))},reporter:[[${JSON.stringify(join(dir,'reporter.cjs'))}],['json',{outputFile:${JSON.stringify(join(artifacts,'runner.json'))}}]],projects:[{name:'webkit-touch',use:{...devices['iPhone 13'],viewport:{width:375,height:812},baseURL:${JSON.stringify(ORIGIN)},trace:'on',screenshot:'off',launchOptions:{env:${JSON.stringify(safeChildEnv())}}}}]});
`;
  return{dir,artifacts,begin,life,stream,outcome,files:{'sample.spec.cjs':spec,'reporter.cjs':reporter,'config.cjs':config}};
}

export function validateTerminalCounters(sample){
  const docs=sample.documents.filter(packet=>packet.kind==='document'),terminals=sample.documents.filter(packet=>packet.kind==='terminal'),drained=sample.documents.filter(packet=>packet.kind==='drained');
  if(!docs.length||!sample.records.length||sample.documents.some(packet=>['after-terminal','overflow'].includes(packet.kind)))return false;
  const unique=new Set(docs.map(packet=>packet.documentId));if(unique.size!==docs.length||terminals.length!==docs.length)return false;let initial=0;
  for(const id of unique){const terminal=terminals.filter(packet=>packet.documentId===id),acks=drained.filter(packet=>packet.documentId===id);if(terminal.length!==1)return false;const counters=terminal[0].counts,records=sample.records.filter(packet=>packet.documentId===id),ack=acks[0],unloaded=terminal[0].reason==='pagehide';if(unloaded?acks.length!==0:acks.length!==1)return false;
    if(!counters||terminal[0].lastSequence!==records.length||(!unloaded&&(ack.lastSequence!==records.length||ack.pending!==0||ack.transportErrors!==0||JSON.stringify(ack.counts)!==JSON.stringify(counters)))||counters.reads!==records.length||counters.writes+counters.suppressed!==counters.reads||counters.initial+counters.resize+counters.scroll+counters.other!==counters.reads||counters.overflow||counters.sendErrors||counters.late||counters.other)return false;
    if(sample.gate?(counters.suppressed!==counters.scroll||counters.writes!==counters.initial+counters.resize):counters.suppressed!==0)return false;
    if(['initial','resize','scroll','other'].some(source=>records.filter(record=>record.source===source).length!==counters[source]))return false;
    if(records.some((record,index)=>record.sequence!==index+1||record.counts?.reads!==record.sequence||record.counts?.writes+record.counts?.suppressed!==record.counts?.reads||record.suppressed!==(sample.gate&&record.source==='scroll')))return false;initial+=counters.initial;
  }
  return initial>0&&sample.records.every(packet=>unique.has(packet.documentId));
}

export function classifyOperationRecords(sample,cutoffWall){
  const origins=new Map(sample.documents.filter(packet=>packet.kind==='document').map(packet=>[packet.documentId,packet.timeOrigin]));
  const clockAvailable=Number.isFinite(cutoffWall)&&sample.records.every(packet=>Number.isFinite(origins.get(packet.documentId))&&Number.isFinite(packet.time));
  const operation=clockAvailable?sample.records.filter(packet=>origins.get(packet.documentId)+packet.time<cutoffWall):[],tail=clockAvailable?sample.records.filter(packet=>origins.get(packet.documentId)+packet.time>=cutoffWall):[];
  const summarize=records=>({reads:records.length,writes:records.filter(record=>!record.suppressed).length,suppressed:records.filter(record=>record.suppressed).length});
  return{clockAvailable,operation:summarize(operation),readonlyTailBeforeSeal:summarize(tail),prefix:summarize(sample.records),passiveAfterSeal:{measured:false,meaning:'Diagnostic capture returns without changing the frozen prefix; future application callbacks are not counted or asserted absent.'},operationSuppressionValid:!sample.gate||operation.some(record=>record.suppressed&&record.source==='scroll')};
}

async function exclusivePort(){const server=createServer();await new Promise((done,fail)=>{server.once('error',fail);server.listen({host:'127.0.0.1',port:3121,exclusive:true},done);});await new Promise(done=>server.close(done));}
function ownedProcess(pid,runtime){assert.equal(realpathSync(`/proc/${pid}/cwd`),runtime);const command=readFileSync(`/proc/${pid}/cmdline`).toString().split('\0').filter(Boolean);assert(command.some(value=>value.endsWith('/next/dist/bin/next')));assert(command.includes('3121'));return{pid,pgid:pid,cwd:runtime,command};}
async function stopOwned(child,receipt){if(!child)return{notStarted:true};assert.equal(child.pid,receipt.pid);try{process.kill(-child.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}if(child.exitCode===null&&child.signalCode===null)await Promise.race([new Promise(done=>child.once('exit',done)),new Promise(done=>setTimeout(done,2000))]);try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}return{pid:child.pid,signal:'owned group only',exitCode:child.exitCode,exitSignal:child.signalCode};}
function portOwnership(group,runtime){const text=execFileSync('ss',['-H','-ltnp','sport = :3121'],{encoding:'utf8'});assert(text.includes('127.0.0.1:3121'));const pids=[...text.matchAll(/pid=(\d+)/g)].map(match=>Number(match[1]));assert(pids.length);return pids.map(pid=>{assert.equal(Number(execFileSync('ps',['-o','pgid=','-p',String(pid)],{encoding:'utf8'}).trim()),group);assert.equal(realpathSync(`/proc/${pid}/cwd`),runtime);return{pid,pgid:group,cwd:runtime,commandSha256:sha(readFileSync(`/proc/${pid}/cmdline`))};});}
function readRunnerTrace(fflate,path){const entries=fflate.unzipSync(readFileSync(path));return Object.entries(entries).filter(([name])=>name.endsWith('.trace')&&name!=='test.trace').flatMap(([,data])=>new TextDecoder().decode(data).split('\n').filter(Boolean).map(line=>JSON.parse(line)));}

export function analyzeNativeTail(events,deadlineWall){
  const clocks=events.filter(event=>event.type==='context-options'&&event.browserName==='webkit'&&Number.isFinite(event.wallTime)&&Number.isFinite(event.monotonicTime));
  if(clocks.length!==1||!Number.isFinite(deadlineWall))return{traceClockAvailable:false,lateInput:true,traceTailComplete:false};
  const clock=clocks[0],cutoff=clock.monotonicTime+deadlineWall-clock.wallTime,methods=['click','fill','press','tap','hover','focus','goto','reload','setViewportSize','fetch'],before=new Map(events.filter(event=>event.type==='before').map(event=>[event.callId,event]));
  const after=new Map(events.filter(event=>event.type==='after').map(event=>[event.callId,event]));
  const lateActions=events.filter(event=>event.type==='before'&&event.startTime>=cutoff&&methods.includes(event.method)).map(event=>({callId:event.callId,method:event.method,startTime:event.startTime}));
  const lateInputLogs=events.filter(event=>event.type==='log'&&event.time>=cutoff&&/performing .*?(click|tap)|click action done|scrolling into view|done scrolling|sending key|typing|input events/.test(event.message)).map(event=>({callId:event.callId,time:event.time,lateInputLog:true}));
  const lateCompletions=events.filter(event=>event.type==='after'&&!event.error&&event.endTime>=cutoff&&methods.includes(before.get(event.callId)?.method)).map(event=>({callId:event.callId,method:before.get(event.callId).method,endTime:event.endTime}));
  const nativeClockComplete=[...before.values()].filter(event=>methods.includes(event.method)).every(event=>Number.isFinite(event.startTime)&&Number.isFinite(after.get(event.callId)?.endTime));
  const logClockComplete=events.filter(event=>event.type==='log'&&/performing .*?(click|tap)|click action done|scrolling into view|done scrolling|sending key|typing|input events/.test(event.message)).every(event=>Number.isFinite(event.time));
  const pendingNative=[...before.values()].filter(event=>methods.includes(event.method)&&!after.has(event.callId)).map(event=>event.callId);
  const pageClose=[...before.values()].filter(event=>event.class==='Page'&&event.method==='close').map(event=>({before:event,after:after.get(event.callId)})).find(call=>call.after&&!call.after.error&&Number.isFinite(call.after.endTime));
  return{traceClockAvailable:true,cutoff,lateActions,lateInputLogs,lateCompletions,pendingNative,lateInput:lateActions.length>0||lateInputLogs.length>0||lateCompletions.length>0,nativeClockComplete,logClockComplete,traceTailComplete:Boolean(pageClose&&!pendingNative.length&&nativeClockComplete&&logClockComplete),pageClose:pageClose?{startTime:pageClose.before.startTime,endTime:pageClose.after.endTime}:null,clockLimit:'Public result.startTime and trace wall milliseconds are quantized; equality at native cutoff is invalid, no tolerance/rounding added.'};
}

async function runSampleProcess(runtime,sources,totalDeadline){
  mkdirSync(sources.dir,{recursive:true});mkdirSync(sources.artifacts,{recursive:true});const generated=[];
  for(const [name,content]of Object.entries(sources.files)){writeFileSync(join(sources.dir,name),content);writeFileSync(join(sources.artifacts,name),content);generated.push({name,sha256:sha(content)});}
  const started=performance.now(),startWall=Date.now(),log=join(sources.artifacts,'runner.log'),runner=spawn(process.execPath,[join(runtime,'node_modules/playwright/cli.js'),'test','--config',join(sources.dir,'config.cjs')],{cwd:runtime,env:{...safeChildEnv(),CI:'true'},detached:true,stdio:['ignore','pipe','pipe']});
  const receipt={pid:runner.pid,pgid:runner.pid,cwd:runtime,createdByThisCLI:true,started,startWall,generated};let timer,watchdog=false,spawnError;
  runner.stdout.on('data',data=>appendFileSync(log,data));runner.stderr.on('data',data=>appendFileSync(log,data));runner.once('error',error=>{spawnError=error.name;});
  const read=file=>{try{return JSON.parse(readFileSync(file,'utf8'));}catch{return null;}};
  const supervise=()=>{let remaining=totalDeadline-performance.now();const begin=read(sources.begin),life=read(sources.life);if(begin)remaining=Math.min(remaining,begin.startWall+BUDGET.operation+BUDGET.teardown-Date.now());if(life?.afterEachStarted)remaining=Math.min(remaining,life.afterEachStarted.wall+BUDGET.teardown-Date.now());if(remaining<=0){watchdog=true;if(Number.isInteger(runner.pid)){try{process.kill(-runner.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')receipt.supervisionError=error.code;}}return;}timer=setTimeout(supervise,Math.min(50,remaining));};supervise();
  const closed=await new Promise(done=>runner.once('close',(exitCode,signal)=>done({exitCode,signal})));clearTimeout(timer);const exited=performance.now(),exitWall=Date.now();let groupExited=false;
  if(Number.isInteger(runner.pid)){try{process.kill(-runner.pid,0);}catch(error){if(error.code==='ESRCH')groupExited=true;else throw error;}if(!groupExited){receipt.cleanup=await stopOwned(runner,receipt);}}
  return{...receipt,...closed,spawnError,watchdog,groupExited,exited,exitWall,elapsed:exited-started,life:read(sources.life),outcome:read(sources.outcome)};
}

async function run(){
  requireCI();const prep=JSON.parse(readFileSync(join(output,'preparation.json')));assert.equal(prep.checkout,git('rev-parse','HEAD').trim());assert.equal(prep.scriptSha256,sha(readFileSync(fileURLToPath(import.meta.url))));
  const namespace=readlinkSync('/proc/self/ns/net');assert.notEqual(namespace,prep.outsideNamespace);const links=JSON.parse(execFileSync('ip',['-j','link'],{encoding:'utf8'}));assert.equal(links.length,1);assert.equal(links[0].ifname,'lo');assert(links[0].flags.includes('UP'));const routes=JSON.parse(execFileSync('ip',['-j','route'],{encoding:'utf8'}));assert.equal(routes.length,0);
  assert(!Object.keys(process.env).some(key=>/TOKEN|SECRET|PASSWORD|CREDENTIAL|SUPABASE|VERCEL|DATABASE|AWS_|AZURE_|SSH_AUTH/.test(key)),'private variable present in namespace runtime');
  assert(!process.env.DEBUG&&!process.env.PWDEBUG&&!process.env.PLAYWRIGHT_DEBUG_LOG,'DEBUG/protocol logging is not permitted');
  const runtime=realpathSync(prep.runtime);assert(relative(join(cwd,'.local/color-scroll-edge'),runtime).startsWith('runtime-'));verifyRuntime(runtime,prep.manifest,prep.transform.afterSha256);
  const native=createRequire(join(runtime,'package.json')),{webkit}=native('@playwright/test'),fflate=native('fflate'),callbackProof=extractCallback(native('typescript'),readFileSync(join(runtime,'tests/browser/site-ui-recheck.spec.ts'),'utf8'));
  const report={experiment:'real-routed-scroll-write-edge',lifecycle:'public-test-runner-sealed-prefix',source:prep.checkout,baseline:BASE,budget:BUDGET,namespace:{current:namespace,outside:prep.outsideNamespace,links:links.map(link=>({ifname:link.ifname,flags:link.flags})),routes},versions:{node:process.version,platform:platform(),arch:arch(),os:release(),cpuModel:cpus()[0]?.model,cpuCount:cpus().length,playwright:'1.63.0',webkitRevision:2359},transform:prep.transform,callback:callbackProof.proof,samples:[],status:'INCONCLUSIVE',namespaceEnvKeys:Object.keys(process.env).sort(),previewEnvKeys:Object.keys(previewEnv()),notExecuted:['A0','B','A1']};
  let child,owner;const logStream=join(output,'next-owned.log');
  try{
    await exclusivePort();child=spawn(process.execPath,[join(runtime,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3121'],{cwd:runtime,env:previewEnv(),detached:true,stdio:['ignore','pipe','pipe']});owner=Number.isInteger(child.pid)?{pid:child.pid,pgid:child.pid,cwd:runtime,createdByThisCLI:true}:null;report.server=owner;child.stdout.on('data',data=>appendFileSync(logStream,data));child.stderr.on('data',data=>appendFileSync(logStream,data));await new Promise((done,fail)=>{child.once('spawn',done);child.once('error',fail);});Object.assign(owner,ownedProcess(child.pid,runtime),{verified:true});
    const readyDeadline=performance.now()+60000;let ready=false;while(performance.now()<readyDeadline){if(child.exitCode!==null)throw new Error('owned Next exited during readiness');try{const response=await fetch(ORIGIN+'/login',{signal:AbortSignal.timeout(1000)});if(response.status===200){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,100));}assert(ready,'readiness budget exceeded');
    report.portOwners=portOwnership(child.pid,runtime);report.runtimeAfterStartup=verifyRuntime(runtime,prep.manifest,prep.transform.afterSha256,true);assert(webkit.executablePath().includes('/webkit-2359/'));
    const totalStart=performance.now(),totalDeadline=totalStart+BUDGET.total;
    for(const sampleId of ['A0','B','A1']){
      if(totalDeadline-performance.now()<BUDGET.operation+BUDGET.teardown){report.status='INCONCLUSIVE_TOTAL_BUDGET_INSUFFICIENT';break;}
      const sample={sampleId,gate:sampleId==='B',records:[],documents:[],streamErrors:[]};report.samples.push(sample);report.notExecuted=['A0','B','A1'].slice(report.samples.length);
      const sources=runnerSources(callbackProof,sampleId,runtime);sample.process=await runSampleProcess(runtime,sources,totalDeadline);const life=sample.process.life,result=sample.process.outcome?.results?.[0];sample.lifecycle=life;
      if(life)sample.streamErrors.push(...life.streamErrors);
      try{for(const line of readFileSync(sources.stream,'utf8').split('\n').filter(Boolean)){const packet=JSON.parse(line);if(packet.kind==='place')sample.records.push(packet);else sample.documents.push(packet);}}catch{sample.streamErrors.push('raw-stream-unavailable');}
      const deadlineWall=result?.startWall+BUDGET.operation,cutoffWall=life?.passed?Math.min(life.callbackSettledAt?.wall,deadlineWall):deadlineWall;
      sample.state={timedOut:result?.status==='timedOut',pendingAtDeadline:life?.pendingAtDeadline===true,passed:life?.passed===true,settled:Boolean(life?.callbackSettled&&life?.callbackFinally),lateSuccessfulCompletion:Boolean(life?.passed&&life.callbackSettledAt?.wall>=deadlineWall)};
      sample.operationRecords=classifyOperationRecords(sample,cutoffWall);sample.terminalCountersComplete=validateTerminalCounters(sample);
      const sealDoc=sample.documents.find(packet=>packet.kind==='document'&&packet.documentId===life?.seal?.documentId),terminal=sample.documents.find(packet=>packet.kind==='terminal'&&packet.documentId===life?.seal?.documentId);
      sample.documentPrefixes=sample.documents.filter(packet=>packet.kind==='terminal').map(packet=>({documentId:packet.documentId,lastSequence:packet.lastSequence,completion:packet.reason==='pagehide'?'node-complete-prefix-browser-drain-unobserved':'active-browser-drain-required',browserPending:packet.reason==='pagehide'?null:life?.seal?.pending}));
      sample.operationWindowComplete=Boolean(sample.operationRecords.clockAvailable&&sample.terminalCountersComplete&&terminal&&sealDoc&&sealDoc.timeOrigin+terminal.time>=cutoffWall&&life?.sealAcknowledged&&life.seal?.pending===0&&life.seal?.transportErrors===0);
      try{
        const attachment=result?.attachments.filter(item=>item.name==='trace');assert.equal(attachment?.length,1);const trace=attachment[0].path;assert(relative(sources.artifacts,trace)&&!relative(sources.artifacts,trace).startsWith('..'));assert(lstatSync(trace).isFile()&&!lstatSync(trace).isSymbolicLink());
        const events=readRunnerTrace(fflate,trace);sample.shape=classifyNativeTrace(events,sample.state);Object.assign(sample,analyzeNativeTail(events,deadlineWall));sample.traceSha256=sha(readFileSync(trace));sample.tracePath=trace;sample.tracePersistence='public runner trace:on, page.close and original Promise settled before context.close stopChunk; unchanged zip';
      }catch(error){sample.traceUnavailable=true;sample.traceError=String(error.message).split('\n')[0];}
      try{sample.runtimeInputProof=verifyRuntime(runtime,prep.manifest,prep.transform.afterSha256,true);}catch(error){sample.streamErrors.push('runtime-tracked-input-drift');sample.runtimeInputError=error.message;}
      sample.operationElapsedMs=life?.afterEachStarted?.wall-result?.startWall;sample.readonlySealDrainMs=life?.sealAcknowledged?.monotonic-life?.sealRequested?.monotonic;sample.pageCloseMs=life?.pageCloseCompleted?.monotonic-life?.pageCloseRequested?.monotonic;sample.contextCloseMs=life?.contextCloseCompleted?.monotonic-life?.contextCloseRequested?.monotonic;sample.readonlyTailThroughWorkerExitMs=sample.process.exitWall-life?.afterEachStarted?.wall;sample.workerWaitMs=sample.process.exitWall-life?.afterEachFinished?.wall;sample.finished=performance.now();sample.readonlyTailMs=sample.readonlyTailThroughWorkerExitMs+(sample.finished-sample.process.exited);
      const outcome=sample.process.outcome,expectedExit=sample.state.passed?0:1;
      sample.valid=Boolean(result&&outcome.registered===1&&outcome.results.length===1&&!outcome.errors.length&&outcome.publicReporterExit&&result.retry===0&&result.expectedStatus==='passed'&&sample.process.exitCode===expectedExit&&!sample.process.signal&&!sample.process.watchdog&&sample.process.groupExited&&life?.complete&&life.pageClosed&&life.contextClosed&&life.callbackAwaitCompleted&&life.callbackSettled&&life.callbackFinally&&life.operationTimeout===BUDGET.operation&&life.browserVersion==='26.6'&&life.clock?.publicStartWall===result.startWall&&life.clock.timeout===BUDGET.operation&&life.callbackStarted?.wall<deadlineWall&&life.pageCloseCompleted.monotonic<=life.callbackAwaitCompleted.monotonic&&life.callbackAwaitCompleted.monotonic<=life.contextCloseRequested.monotonic&&sample.readonlyTailMs<=BUDGET.teardown&&sample.readonlyTailThroughWorkerExitMs>=0&&sample.state.settled&&!sample.state.lateSuccessfulCompletion&&sample.terminalCountersComplete&&sample.operationWindowComplete&&sample.operationRecords.operationSuppressionValid&&!sample.traceUnavailable&&sample.traceClockAvailable&&sample.traceTailComplete&&!sample.lateInput&&!sample.streamErrors.length&&sample.finished<=totalDeadline);
      if(sample.state.passed&&result?.status!=='passed')sample.valid=false;if(sample.state.timedOut&&(!life?.cutoffObserved||!sample.state.pendingAtDeadline))sample.valid=false;json(join(output,`${sampleId}.json`),sample);
      if(!sample.valid){report.status='INCONCLUSIVE_INVALID_SAMPLE';break;}
      if(sampleId==='B'){if(!sample.state.passed){report.status=sample.shape?.shape?'EDGE_CUT_DID_NOT_ELIMINATE':'INCONCLUSIVE_B_OTHER_FAILURE';break;}}
      else if(!sample.shape?.shape){report.status='ORIGINAL_SHAPE_NOT_REPRODUCED';break;}
      if(sampleId==='A1')report.status='REDUCER_WRITE_EDGE_NECESSARY';
    }
    report.sampleWindowMs=performance.now()-totalStart;if(report.sampleWindowMs>BUDGET.total)report.status='INCONCLUSIVE_TOTAL_DEADLINE';
  }catch(error){report.status='INCONCLUSIVE_ENVIRONMENT';report.error={name:error.name,firstLine:String(error.message).split('\n')[0]};}
  finally{if(child&&owner)report.serverCleanup=await stopOwned(child,owner);report.limit='Runtime diagnostic shell only; H1 observers/locks and all other d60 consumers preserved. Not evidence of first-scroll cause or a historical main/production bug. No product patch or release GO.';json(join(output,'result.json'),report);}
}

export async function selfTest(dependencies){const checked=preflight(dependencies),ts=checked.ts;const checks=[];for(const gate of [false,true])for(const type of [undefined,'resize','scroll']){
  let reads=0,writes=0,scrollHeightReads=0,captured;const bounds={x:10,y:100,left:10,top:100,right:310,bottom:144,width:300,height:44};const sandbox={module:{exports:{}},disclosure:{current:{querySelector:()=>({getBoundingClientRect:()=>{reads++;return bounds;}})}},palette:{current:{get scrollHeight(){scrollHeightReads++;return 400;}}},setPosition:next=>{writes++;assert.equal(next.width,360);},Math,window:{innerWidth:1024,innerHeight:1000,__colorScrollEdge:{gate,capture:(source,b,next,suppressed)=>{captured={source,next,suppressed};assert.equal(b,bounds);}}}};
  const code=ts.transpileModule(`module.exports=(${checked.transform.derivedPlace});`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;runInNewContext(code,sandbox);sandbox.module.exports(type?{type}:undefined);assert.equal(reads,1);assert.equal(scrollHeightReads,1);assert.equal(writes,gate&&type==='scroll'?0:1);assert.equal(captured.suppressed,gate&&type==='scroll');checks.push({gate,type:type??'initial',reads,scrollHeightReads,writes});
  }
  for(const path of ['../escape','.env.local','nested/.npmrc'])assert.throws(()=>safeArchivePath(path,'100644'));assert.throws(()=>safeArchivePath('link','120000'));
  assert.equal(BUDGET.operation*3,90000);assert.equal(BUDGET.teardown*3,15000);assert.equal(BUDGET.total,105000);
  const generated=runnerSources(checked.callback,'A0','/runtime-only-model'),registered=[],hooks={};const test=(title,fn)=>registered.push({title,fn});test.beforeEach=fn=>{hooks.before=fn;};test.afterEach=fn=>{hooks.after=fn;};
  runInNewContext(generated.files['sample.spec.cjs'],{require:name=>name==='@playwright/test'?{test,expect:()=>{}}:checked.native(name)});assert.equal(registered.length,1);assert.equal(registered[0].title,TITLE);assert(hooks.before&&hooks.after);assert(generated.files['sample.spec.cjs'].includes(checked.callback.code));assert(!generated.files['sample.spec.cjs'].includes('site-ui-recheck.spec'));
  const configModule={exports:{}};runInNewContext(generated.files['config.cjs'],{module:configModule,__dirname:generated.dir,require:()=>({defineConfig:value=>value,devices:{'iPhone 13':{browserName:'webkit'}}})});const config=configModule.exports;assert.equal(config.timeout,BUDGET.operation);assert.equal(config.workers,1);assert.equal(config.retries,0);assert.equal(config.expect.timeout,5000);assert.equal(config.projects.length,1);assert.equal(config.projects[0].name,'webkit-touch');assert.equal(config.projects[0].use.trace,'on');assert.equal(config.projects[0].use.screenshot,'off');assert(!config.webServer);
  for(const [name,source]of Object.entries(generated.files))assert.equal(ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS).parseDiagnostics.length,0);
  const packets=[],releases=[];let tick=0;const window={};window.top=window;window.__colorScrollEdgeSink=packet=>{packets.push(packet);return new Promise(done=>releases.push(done));};
  runInNewContext('('+browserEdgeInit.toString()+')({sampleId:"model",gate:false})',{window,performance:{timeOrigin:1000,now:()=>++tick},addEventListener:()=>{}});
  const bounds={x:0,y:0,left:0,top:0,right:10,bottom:10,width:10,height:10},next={width:10,left:0,top:0,maxHeight:10},edge=window.__colorScrollEdge;edge.capture('initial',bounds,next,false);const sealing=edge.seal('model');assert.equal(edge.seal('again'),sealing);const frozen=JSON.stringify(packets.find(packet=>packet.kind==='terminal'));edge.capture('scroll',bounds,next,false);assert.equal(JSON.stringify(packets.find(packet=>packet.kind==='terminal')),frozen);assert.equal(packets.length,3);for(const release of releases.splice(0))release();await new Promise(done=>setImmediate(done));assert.equal(packets.at(-1).kind,'drained');for(const release of releases.splice(0))release();const ack=await sealing;assert.equal(ack.pending,0);assert.equal(ack.transportErrors,0);assert.equal(ack.counts.reads,1);assert(Object.isFrozen(ack.counts));edge.capture('scroll',bounds,next,false);assert.equal(packets.length,4);
  const model={gate:false,records:packets.filter(packet=>packet.kind==='place'),documents:packets.filter(packet=>packet.kind!=='place')};assert(validateTerminalCounters(model));const missing={...model,documents:model.documents.filter(packet=>packet.kind!=='terminal')};assert(!validateTerminalCounters(missing));const noDrain={...model,documents:model.documents.filter(packet=>packet.kind!=='drained')};assert(!validateTerminalCounters(noDrain));const unloaded=JSON.parse(JSON.stringify(noDrain));unloaded.documents.find(packet=>packet.kind==='terminal').reason='pagehide';assert(validateTerminalCounters(unloaded));const unloadedMissing={...unloaded,documents:unloaded.documents.filter(packet=>packet.kind!=='terminal')};assert(!validateTerminalCounters(unloadedMissing));const zeroDoc=JSON.parse(JSON.stringify(model));zeroDoc.documents.push({kind:'document',documentId:'zero',timeOrigin:0},{kind:'terminal',documentId:'zero',reason:'pagehide',lastSequence:0,counts:{initial:0,resize:0,scroll:0,other:0,reads:0,writes:0,suppressed:0,late:0,overflow:false,sendErrors:0}});assert(validateTerminalCounters(zeroDoc));zeroDoc.documents.pop();assert(!validateTerminalCounters(zeroDoc));const broken=JSON.parse(JSON.stringify(model));broken.documents.find(packet=>packet.kind==='drained').transportErrors=1;assert(!validateTerminalCounters(broken));
  const bModel={gate:true,documents:[{kind:'document',documentId:'b',timeOrigin:1000}],records:[{documentId:'b',time:1,source:'initial',suppressed:false},{documentId:'b',time:20,source:'scroll',suppressed:true}]};assert(!classifyOperationRecords(bModel,1010).operationSuppressionValid);assert(classifyOperationRecords(bModel,1030).operationSuppressionValid);assert.equal(classifyOperationRecords(bModel,1010).readonlyTailBeforeSeal.suppressed,1);assert(!classifyOperationRecords(bModel,NaN).clockAvailable);
  const state={timedOut:true,pendingAtDeadline:true,settled:true,passed:false};
  const tailEvents=[{type:'context-options',browserName:'webkit',wallTime:1000,monotonicTime:100},{type:'before',callId:'p',class:'Frame',method:'click',startTime:900},{type:'after',callId:'p',error:{message:'closed'},endTime:1101},{type:'before',callId:'c',class:'Page',method:'close',startTime:1100},{type:'after',callId:'c',endTime:1102}];assert(analyzeNativeTail(tailEvents,2000).traceTailComplete);assert(!analyzeNativeTail(tailEvents,2000).lateInput);assert(analyzeNativeTail([...tailEvents,{type:'log',callId:'p',time:1100,message:'performing click action'}],2000).lateInput);assert(analyzeNativeTail([...tailEvents,{type:'before',callId:'late',method:'fill',startTime:1100},{type:'after',callId:'late',endTime:1103}],2000).lateInput);const lateCompletion=JSON.parse(JSON.stringify(tailEvents));delete lateCompletion[2].error;assert(analyzeNativeTail(lateCompletion,2000).lateInput);assert(!analyzeNativeTail(tailEvents.slice(0,-2),2000).traceTailComplete);assert(!analyzeNativeTail(tailEvents.slice(1),2000).traceClockAvailable);
  const selector='internal:role=region[name="编辑颜色"s] >> internal:role=radio[name="其他颜色"s] >> ..';const events=[{type:'before',callId:'v1',method:'setViewportSize',params:{viewportSize:{width:1440}}},{type:'before',callId:'a',method:'click',params:{selector}},{type:'after',callId:'a'},{type:'before',callId:'r',method:'reload',params:{}},{type:'after',callId:'r'},{type:'before',callId:'v2',method:'setViewportSize',params:{viewportSize:{width:1024}}},{type:'before',callId:'b',method:'click',params:{selector}}];for(let i=0;i<2;i++)events.push({type:'log',callId:'b',message:'waiting for element to be visible, enabled and stable'},{type:'log',callId:'b',message:'element is not stable'});assert(classifyNativeTrace(events,state).shape);assert(!classifyNativeTrace([...events,{type:'log',callId:'b',message:'scrolling into view if needed'}],state).shape);assert(!classifyNativeTrace(events.slice(0,-2),state).shape);assert(!classifyNativeTrace(events,{...state,pendingAtDeadline:false}).shape);
  const input=baseline('next-env.d.ts'),devOutput=Buffer.from(input.toString().replaceAll('./.next-backend/types/','./.next/dev/types/'));assert.equal(describeNextEnv(input).classification,'EXACT_ARCHIVE_INPUT');assert.equal(describeNextEnv(devOutput).classification,'EXACT_LOCKED_DEV_OUTPUT');const oldOutput=Buffer.from(input.toString().replaceAll('./.next-backend/types/','./.next/types/'));assert.equal(describeNextEnv(oldOutput).classification,'EXACT_SUPERSEDED_NON_DEV_PREDICTION');const unsafe=describeNextEnv(Buffer.from('import "./private/SENSITIVE-MARKER.d.ts";\nconst marker="SENSITIVE-MARKER";\n'));assert.equal(unsafe.classification,'UNEXPECTED_NOT_ALLOWED');assert.equal(unsafe.nonWhitelistedImportCount,1);assert(!JSON.stringify(unsafe).includes('SENSITIVE-MARKER'));assert.equal(describeNextEnv(Buffer.from(devOutput.toString().replaceAll('\n','\r\n'))).classification,'UNEXPECTED_NOT_ALLOWED');
  return{...checked.proof,deterministicChecks:checks,archiveNegativeCases:4,lifecycleModels:{singleGeneratedCase:true,generatedFiles:Object.fromEntries(Object.entries(generated.files).map(([name,source])=>[name,sha(source)])),publicConfig:{timeout:config.timeout,workers:config.workers,retries:config.retries,trace:config.projects[0].use.trace},sealImmutableIdempotentDrain:true,passiveAfterSealAllowed:true,missingTerminalAndDrainRejected:true,transportErrorRejected:true,operationTailSuppressionSeparated:true,lateInputAndMissingTraceRejected:true,budget:BUDGET},nativeShapeSyntheticNegativeCases:3,nextEnvExactAndSafeEvidenceModels:5,meaning:'AST/formula/gate/lifecycle models only; no browser/server/network/CI run'};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const mode=process.argv[2];if(mode==='--preflight'){const index=process.argv.indexOf('--dependencies');const dependencies=index>=0?process.argv[index+1]:cwd;const proof=await selfTest(dependencies);process.stdout.write(JSON.stringify(proof,null,2)+'\n');}
  else if(mode==='--prepare'||mode==='--run'){try{if(mode==='--prepare')prepare();else await run();}catch(error){json(join(output,'capability-failure.json'),{status:'INCONCLUSIVE_CAPABILITY_OR_INPUT',mode,error:{name:error.name,firstLine:String(error.message).split('\n')[0]},noFallback:true});process.exitCode=1;}}else throw new Error('Expected --preflight, --prepare or --run');
}
