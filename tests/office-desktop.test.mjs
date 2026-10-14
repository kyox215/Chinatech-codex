import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,createDecipheriv,randomUUID} from 'node:crypto';
import ts from 'typescript';
const moduleUrl=(file)=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const api=await import(moduleUrl('lib/toolbox/office-desktop-token.ts'));
const {officeDesktopRelease}=await import(moduleUrl('lib/toolbox/office-desktop-release.ts'));
const key=Buffer.alloc(32,17),now=Date.now();
const session={v:1,licenseId:randomUUID(),installationId:randomUUID(),keyHash:'1'.repeat(64),revision:'1',epoch:'4',exp:now+600000};
const rejected=(fn,code)=>assert.throws(fn,e=>e.code===code);
test('desktop license is deterministic only within the same actor, receipt and signing key',()=>{
 const id=randomUUID(),actor=randomUUID();const raw=api.mintDesktopLicense(actor,id,key);
 assert.equal(api.mintDesktopLicense(actor,id,key),raw);assert.match(raw,/^CTO-[\w-]{43}$/);assert.notEqual(api.mintDesktopLicense(randomUUID(),id,key),raw);assert.notEqual(api.mintDesktopLicense(actor,randomUUID(),key),raw);assert.notEqual(api.mintDesktopLicense(actor,id,Buffer.alloc(32,18)),raw);
 assert.equal(api.licenseHash(' '+raw+' '),createHash('sha256').update(raw).digest('hex'));rejected(()=>api.licenseHash('CTO-test'),'KEY_INVALID');rejected(()=>api.desktopKey('public'),'SERVICE_UNAVAILABLE');
});
test('signed capability rejects edits, extra claims, expired tokens and another signing key',()=>{
 const token=api.signDesktopSession(session,key);assert.deepEqual(api.readDesktopSession(token,key,now),session);
 rejected(()=>api.readDesktopSession(token+'x',key,now),'SESSION_INVALID');rejected(()=>api.readDesktopSession(token,Buffer.alloc(32,18),now),'SESSION_INVALID');
 const altered={...session,epoch:'5'};rejected(()=>api.readDesktopSession(Buffer.from(JSON.stringify(altered)).toString('base64url')+'.'+token.split('.')[1],key,now),'SESSION_INVALID');
 rejected(()=>api.readDesktopSession(api.signDesktopSession({...session,admin:true},key),key,now),'SESSION_INVALID');rejected(()=>api.readDesktopSession(token,key,session.exp),'SESSION_EXPIRED');rejected(()=>api.readDesktopSession(api.signDesktopSession({...session,exp:now+3600001},key),key,now),'SESSION_EXPIRED');
 for(const value of [null,42,'x','0',new Array(1600).fill('x').join('')])rejected(()=>api.readDesktopSession(value,key,now),'SESSION_INVALID');
});
test('disable, re-enable, global epoch and action changes revoke old capabilities',()=>{
 const license={enabled:true,expiresAt:new Date(now+86400000).toISOString(),revision:'1',actions:['install']};api.assertDesktopLicense(license,session,'4','install',now);
 rejected(()=>api.assertDesktopLicense({...license,enabled:false},session,'4','install',now),'KEY_INVALID');rejected(()=>api.assertDesktopLicense({...license,revision:'3'},session,'4','install',now),'SESSION_REVOKED');rejected(()=>api.assertDesktopLicense(license,session,'5','install',now),'SESSION_REVOKED');rejected(()=>api.assertDesktopLicense(license,session,'4','uninstall',now),'ACTION_NOT_ALLOWED');rejected(()=>api.assertDesktopLicense({...license,expiresAt:new Date(now).toISOString()},session,'4','install',now),'KEY_INVALID');
});
test('AES GCM authenticates action, epoch, expiry, job and script; randomized nonce',()=>{
 const script=readFileSync('server-assets/office-desktop/runner.ps1.txt'),token=api.signDesktopSession(session,key),job=randomUUID(),expiry=new Date(now+240000).toISOString();
 const pkg=api.encryptDesktopPackage(script,token,'install','4',job,expiry);
 const decode=(p,t=token)=>{const d=createDecipheriv('aes-256-gcm',createHash('sha256').update('chinatech-office-desktop:payload:v1\0'+t).digest(),Buffer.from(p.nonce,'base64'));d.setAuthTag(Buffer.from(p.tag,'base64'));d.setAAD(Buffer.from(JSON.stringify([p.v,p.action,p.version,p.digest,p.expiresAt,p.jobId])));return Buffer.concat([d.update(Buffer.from(p.ciphertext,'base64')),d.final()]);};
 assert.deepEqual(decode(pkg),script);assert.notEqual(api.encryptDesktopPackage(script,token,'install','4',job,expiry).nonce,pkg.nonce);
 for(const patch of [{action:'uninstall'},{version:'5'},{jobId:randomUUID()},{expiresAt:new Date(now+250000).toISOString()},{digest:'f'.repeat(64)},{tag:Buffer.alloc(16).toString('base64')}])assert.throws(()=>decode({...pkg,...patch}));assert.throws(()=>decode(pkg,'another session'));
 mkdirSync('.local/office-desktop/proof',{recursive:true});writeFileSync('.local/office-desktop/proof/protocol-fixture.json',JSON.stringify({package:pkg,token,clock:new Date(now).toISOString()}));
});
test('public website excludes private native sources and retains protocol and release validation',()=>{
 assert.ok(!existsSync('desktop/office-assistant/Client/MainWindow.cs'));
 const workflow=readFileSync('.github/workflows/ci.yml','utf8');assert.ok(!workflow.includes('desktop/office-assistant/'));
 assert.ok(readFileSync('desktop/README.md','utf8').includes('private'));
});
test('public 1.3.0 downloads use the approved architecture assets and exact binary checksums',()=>{
 const base='https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.3.0';
 assert.equal(officeDesktopRelease.version,'1.3.0');
 assert.deepEqual(officeDesktopRelease.files,[
  {architecture:'x64',bytes:64973194,sha256:'472f935742d8da0144264a0f1e584a5b013ff724dda4a922882cdabc9b846173',href:base+'/ChinaTech-Office-Assistant-x64.exe'},
  {architecture:'ARM64',bytes:61126536,sha256:'a576385bddab1bd5489dd4392a6ca12f008a31da784a102a2ccc3ff0b51c3144',href:base+'/ChinaTech-Office-Assistant-ARM64.exe'},
 ]);
 assert.equal(officeDesktopRelease.instructions,base+'/README.txt');
 assert.equal(officeDesktopRelease.checksums,base+'/SHA256SUMS.txt');
});
test('public copy identifies selected installation and removal with explicit unsupported boundaries',()=>{
 const source=['components/toolbox/office-desktop-download.tsx','components/toolbox/office-tools-page.tsx'].map(file=>readFileSync(file,'utf8')).join('\n');
 for(const fact of ['测试版','独立运行','无需网站登录','八项应用默认全选','可单独选择安装','OneDrive','Skype for Business','语言跟随 Windows','全部 Office（包括 Visio 和 Project）','个人文档保留','MSI 产品须整项卸载','OneDrive 仅支持当前账户卸载','仍待 Windows 验收','尚未数字签名'])assert.ok(source.includes(fact),fact);
 for(const obsolete of ['打开后自动联网检查','通过检查后','六个应用','激活只检查和使用已有有效许可','安装替换全部旧 Office'])assert.ok(!source.includes(obsolete),obsolete);
});
