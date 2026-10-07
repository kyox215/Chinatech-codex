import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),key=Buffer.alloc(32,23);
const source=readFileSync(new URL('../lib/toolbox/office-token.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const ctx=createContext({exports:{},require,Buffer,URL,process:{env:{}}});runInContext(compiled,ctx);const api=ctx.exports;
const payload={v:1,action:'install',epoch:'7',digest:'a'.repeat(64)};
test('signed Office token binds operation, version and script content',()=>{
 const token=api.signOfficeToken(payload,key);assert.deepEqual(JSON.parse(JSON.stringify(api.readOfficeToken(token,key))),payload);
 const [part,signature]=token.split('.');const p=JSON.parse(Buffer.from(part,'base64url'));p.epoch='9';
 assert.throws(()=>api.readOfficeToken(Buffer.from(JSON.stringify(p)).toString('base64url')+'.'+signature,key));
 assert.throws(()=>api.readOfficeToken(token,Buffer.alloc(32,24)));assert.throws(()=>api.readOfficeToken(token+'.extra',key));
 for(const bad of [{...payload,action:['install']},{...payload,epoch:['7']},{...payload,extra:1},{...payload,digest:'a'.repeat(63)},{...payload,action:'../../config'}])assert.throws(()=>api.readOfficeToken(api.signOfficeToken(bad,key),key));
});
test('disable then re-enable never restores old signed commands',()=>{
 assert.doesNotThrow(()=>api.assertOfficePermission({enabled:true,version:'7'},payload));
 assert.throws(()=>api.assertOfficePermission({enabled:false,version:'8'},payload),e=>e.status===403);
 assert.throws(()=>api.assertOfficePermission({enabled:true,version:'9'},payload),e=>e.status===410);
 const fresh={...payload,epoch:'9'};assert.doesNotThrow(()=>api.assertOfficePermission({enabled:true,version:'9'},fresh));
});
test('missing or malformed signing configuration fails closed',()=>{
 for(const value of [undefined,'','A'.repeat(64),'0'.repeat(63),'00'.repeat(33)])assert.throws(()=>api.officeKey(value));
 assert.equal(api.officeKey('01'.repeat(32)).length,32);assert.throws(()=>api.officeAction(['install']));assert.throws(()=>api.officeTerminal('bash'));
});
test('eight Windows launchers contain only a controlled download and fixed digest',()=>{
 const token=api.signOfficeToken(payload,key);
 for(const action of ['install','activate','uninstall','reinstall'])for(const terminal of ['cmd','powershell']){
  const body=readFileSync(new URL('../server-assets/office/'+action+'.ps1.txt',import.meta.url));
  const digest=api.scriptDigest(body),signed=api.signOfficeToken({...payload,action,digest},key);
  const command=api.buildOfficeCommand('https://www.chinatech.in',signed,digest,terminal,'en');
  assert.ok(command.length<8191);assert.match(command,/^powershell\.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand [A-Za-z0-9+/=]+$/);
  const script=Buffer.from(command.split(' ').at(-1),'base64').toString('utf16le');
  assert.ok(script.includes('/api/toolbox/office/script?token='+signed));assert.ok(script.includes(digest));assert.ok(script.includes("$verified=$true"));assert.ok(script.includes("$LASTEXITCODE=0\n & $f\n exit $LASTEXITCODE"));
  assert.ok(script.indexOf("$verified=$true")>script.indexOf('Get-FileHash'));assert.ok(script.indexOf('& $f')>script.indexOf('Get-FileHash'));
  assert.ok(!script.includes('s1.kms.cx'));assert.ok(!script.includes('FromBase64String'));assert.ok(!script.includes(key.toString('hex')));
 }
 assert.throws(()=>api.officeOrigin('https://evil.test/path'));assert.throws(()=>api.officeOrigin('https://user:pass@www.chinatech.in'));
 assert.ok(token);
});
test('server-only source preserves full-reinstall original bytes and public payloads are gone',()=>{
 const crypto=require('node:crypto');assert.equal(crypto.createHash('sha256').update(readFileSync(new URL('../server-assets/office/reinstall.ps1.txt',import.meta.url))).digest('hex'),'f476281a3e0c06ac3d80ae4987151a443f1627083ef0fea6fe68c05cb03276e4');
 for(const action of ['install','activate','uninstall','reinstall'])assert.throws(()=>readFileSync(new URL('../public/toolbox/office/'+action+'-source.ps1.txt',import.meta.url)));
});
