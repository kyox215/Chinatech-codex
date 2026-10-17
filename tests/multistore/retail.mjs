import {origin} from './local-only.mjs';
import sharp from 'sharp';
import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';import {randomUUID} from 'node:crypto';
const f=JSON.parse(fs.readFileSync('.company-tmp/multistore-pilot-20261017/fixture.private.json','utf8'));const owner=f.owner;
async function req(path,body){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:owner.jar.map(([k,v])=>k+'='+v).join('; '),'x-ct-store-id':f.storeId},body:body?JSON.stringify(body):undefined});const bytes=Buffer.from(await r.arrayBuffer());let data;try{data=JSON.parse(bytes);}catch{data=bytes;}return {status:r.status,data};}
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const customerModule='data:text/javascript;base64,'+Buffer.from(compile(fs.readFileSync('lib/customers.ts','utf8'))).toString('base64');
const retail=await import('data:text/javascript;base64,'+Buffer.from(compile(fs.readFileSync('lib/retail.ts','utf8')).replace('"./customers"',JSON.stringify(customerModule))).toString('base64'));
const state=await req('/api/backend/state');assert.equal(state.status,200);const id=randomUUID(),memberId=state.data.staff.currentId;
const unit={...retail.emptyRetailUnit(),id,brand:'Apple',model:'Synthetic private retail',storeOwned:true};const photo='data:image/png;base64,'+(await sharp({create:{width:4,height:4,channels:3,background:'#6255cc'}}).png().toBuffer()).toString('base64');
const requestId=randomUUID(),body={kind:'retail',storeId:f.storeId,memberId,requestId,payload:{type:'create',unit,photos:[photo]}};
const result=await req('/api/backend/command',body);assert.equal(result.status,200,JSON.stringify(result));const saved=result.data.retail.find(u=>u.id===id);assert.match(saved.photos[0],/^ct-photo:/);
const replay=await req('/api/backend/command',body);assert.equal(replay.status,200,JSON.stringify(replay));assert.equal(replay.data.operation.replayed,true);
const read=await req(`/api/backend/retail-photo?unit=${id}&photo=${saved.photos[0].slice(9)}`);assert.equal(read.status,200,JSON.stringify(read));assert.deepEqual(read.data,Buffer.from(photo.split(',')[1],'base64'));
fs.writeFileSync('.company-tmp/multistore-pilot-20261017/retail-storage-api.json',JSON.stringify({checks:['retail PNG original stored privately','retail reference replaces embedded original','same request replay no duplicate','authenticated proxy exact original'],unitId:id,photoId:saved.photos[0].slice(9)},null,2));console.log('PASS real retail private PNG original/reference/replay/bytes');
