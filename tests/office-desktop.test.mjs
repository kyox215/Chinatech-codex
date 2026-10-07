import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash,createDecipheriv,randomUUID} from 'node:crypto';
import ts from 'typescript';
const moduleUrl=(file)=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const api=await import(moduleUrl('lib/toolbox/office-desktop-token.ts'));
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
test('native messages cover every fixed UI key, phase and stable failure code in three languages',()=>{
 const messages=JSON.parse(readFileSync('desktop/office-assistant/messages.json','utf8'));for(const [id,translations]of Object.entries(messages)){assert.equal(translations.length,3,id);for(const text of translations)assert.ok(typeof text==='string'&&text.trim(),id);}
 const source=readFileSync('desktop/office-assistant/Client/Program.cs','utf8')+readFileSync('desktop/office-assistant/Client/Native.cs','utf8')+readFileSync('desktop/office-assistant/Client/Core.cs','utf8');
 const codes=[...source.matchAll(/(?:ToolException|T)\("([A-Z_a-z]+)"\)/g)].map(m=>m[1]);const runner=readFileSync('server-assets/office-desktop/runner.ps1.txt','utf8');codes.push(...[...runner.matchAll(/(?:Fail|Event) '([A-Z_a-z]+)'/g)].map(m=>m[1]));
 for(const code of codes)assert.ok(messages[code],code);for(const action of api.desktopActions)assert.ok(messages[action+'Info']);
});
