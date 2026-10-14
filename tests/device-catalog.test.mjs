import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
const dir=resolve('.local/device-catalog/test-modules');mkdirSync(dir,{recursive:true});
function compile(path,name,replace=source=>source){const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const file=dir+'/'+name+'.mjs';writeFileSync(file,replace(source));return pathToFileURL(file).href;}
const domainUrl=compile('lib/device-catalog.ts','domain');
for(const name of ['interface','errors','public'])compile('lib/i18n/'+name+'.ts',name);
const translateUrl=compile('lib/i18n/translate.ts','translate',source=>source.replaceAll('"./interface"','"./interface.mjs"').replaceAll('"./errors"','"./errors.mjs"').replaceAll('"./public"','"./public.mjs"').replace(/import structuredMessages from "\.\/structured.json";/,'const structuredMessages='+readFileSync('lib/i18n/structured.json','utf8')+';'));
const workbookUrl=compile('lib/device-catalog-workbook.ts','workbook',source=>source.replaceAll("'./device-catalog'",JSON.stringify(domainUrl)).replaceAll("'./i18n/translate'",JSON.stringify(translateUrl)));
const d=await import(domainUrl);const x=await import(workbookUrl);
const base=(extra={})=>({id:'samsung-galaxy-a13-4g-a137',category:'phone',brand:'Samsung',family:'Galaxy A',name:'Galaxy A13 4G (SM-A137)',releasedAt:'2022-07-01',year:2022,generation:'',network:'4G',platform:'SM-A137',modelCodes:['SM-A137F'],aliases:['A13 LTE'],markets:['IT'],status:'verified',enabled:true,sourceUrls:['https://www.samsung.com/it/support/model/SM-A137F/'],checkedAt:'2026-10-07',notes:'',...extra});
const row=(extra={})=>({...base(extra),version:1});
const plain=entry=>Object.fromEntries(Object.entries(entry).filter(([key])=>key!=='version'));
test('brand aliases remain distinct brands; code search handles formatting and historical names',()=>{
 assert.equal(d.canonicalCatalogBrand('红米'),'Redmi');assert.equal(d.canonicalCatalogBrand('REDMI'),'Redmi');assert.equal(d.canonicalCatalogBrand('小米'),'Xiaomi');assert.notEqual(d.canonicalCatalogBrand('POCO'),d.canonicalCatalogBrand('Xiaomi'));
 assert.ok(d.catalogSearchText(base()).includes(d.catalogNormalize('SM A137F')));assert.equal(d.catalogCategory('电脑'),'laptop');assert.equal(d.catalogCategory('desktop'),'desktop');assert.notEqual(d.catalogIdentity(base({name:'HONOR 70 Pro+'})),d.catalogIdentity(base({name:'HONOR 70 Pro'})));assert.deepEqual(d.catalogQueryCategories('电脑'),['laptop','desktop']);
});
test('unknown year remains null; 4G/5G and distinct hardware are never merged',()=>{
 const unknown=d.validateCatalogEntry(base({year:null,releasedAt:null}));assert.equal(unknown.year,null);assert.equal(unknown.releasedAt,null);
 assert.notEqual(d.catalogIdentity(base()),d.catalogIdentity(base({network:'5G',platform:'SM-A136',modelCodes:['SM-A136B']})));
 assert.notEqual(d.catalogIdentity(base()),d.catalogIdentity(base({platform:'SM-A135',modelCodes:['SM-A135F']})));
 for(const patch of [{year:0},{releasedAt:'2022-02-30'},{year:2024},{network:'LTE-X'},{sourceUrls:['file:///secret']},{sourceUrls:['https://user:password@example.com/']},{checkedAt:null},{sourceUrls:[]}])assert.throws(()=>d.validateCatalogEntry(base(patch)),d.CatalogError);
 assert.throws(()=>d.validateCatalogEntry({...base(),admin_user_id:'forged'}));assert.throws(()=>d.validateCatalogEntry(base({modelCodes:['SM-A137F','sm a137f']})));
});
test('query covers all results and supports old models beyond the first page',()=>{
 const rows=Array.from({length:130},(_,i)=>row({id:'model-'+String(i).padStart(3,'0'),name:'Model '+i,year:2000+i%25,releasedAt:null,aliases:['old '+i]}));
 const result=d.catalogQueryPage(rows,{category:'phone',brand:'三星',page:3},'7');assert.equal(result.total,130);assert.equal(result.rows.length,30);
 assert.equal(d.catalogQueryPage(rows,{q:'old 129'},'7').rows[0].name,'Model 129');
 const unknownNames=[9,24,25].map(n=>row({id:'s-series-'+n,name:'Galaxy S'+n,year:null,releasedAt:null}));assert.deepEqual(d.catalogQueryPage(unknownNames,{},'1').rows.map(r=>r.name),['Galaxy S25','Galaxy S24','Galaxy S9']);
 const filtered=d.catalogQueryPage([...rows,row({id:'disabled-model',enabled:false})],{},'7');assert.equal(filtered.total,130);
 assert.equal(d.catalogQueryPage([...rows,row({id:'disabled-model',enabled:false})],{includeDisabled:true},'7').total,131);
 const exact=row({id:'iphone-16',brand:'Apple',family:'iPhone',name:'iPhone 16 Pro',releasedAt:null,year:2024,modelCodes:['A3101']});
 const misleading=row({id:'iphone-18',brand:'Apple',family:'iPhone',name:'iPhone 18 Pro Max',releasedAt:null,year:2026,modelCodes:['A3716']});
 assert.deepEqual(d.catalogQueryPage([exact,misleading],{q:'iPhone 16'},'7').rows.map(item=>item.name),['iPhone 16 Pro']);
 assert.deepEqual(d.catalogQueryPage([exact,misleading],{q:'A3716'},'7').rows.map(item=>item.name),['iPhone 18 Pro Max']);
});
test('preview changes no source rows; omission is not deletion, invalid row blocks confirmation',()=>{
 const current=[row(),row({id:'other-model',name:'Galaxy A13 5G',network:'5G',platform:'SM-A136'})];const original=JSON.stringify(current);
 const result=d.previewCatalogImport(current,[{entry:base({enabled:false}),expectedVersion:1}],'4');assert.equal(result.errors.length,0);assert.equal(result.changes[0].kind,'disable');assert.equal(JSON.stringify(current),original);assert.equal(current[1].enabled,true);
 const same=d.previewCatalogImport(current,[{entry:plain(current[0]),expectedVersion:1}],'4');assert.equal(same.changes[0].kind,'unchanged');
 assert.equal(d.previewCatalogImport(current,[{entry:base(),expectedVersion:0}],'4').errors.length,1);
 assert.equal(d.previewCatalogImport(current,[{entry:base({id:'forged-copy'}),expectedVersion:0}],'4').errors.length,1);
 const duplicate=d.previewCatalogImport([],Array.from({length:2},()=>({entry:base(),expectedVersion:0})),'0');assert.equal(duplicate.errors.length,1);
});
test('real xlsx export/import is lossless in three languages, including leading zeros and original notes',()=>{
 const entry=row({modelCodes:['000123','SM-A137F'],notes:'中文原文 & <tag>\nRiga originale',aliases:['A13 LTE','ProArt PX13 | HN7306']});
 for(const locale of ['zh-CN','it','en']) {
  const bytes=x.writeCatalogWorkbook([entry],'12',locale);assert.equal(bytes[0],0x50);const parsed=x.readCatalogWorkbook(bytes);assert.deepEqual(parsed.errors,[]);assert.deepEqual(parsed.rows,[{entry:plain(entry),expectedVersion:1}]);
  const files=unzipSync(bytes);const name=strFromU8(files['xl/workbook.xml']);assert.ok(name.includes(locale==='it'?'Modelli':locale==='en'?'Models':'型号主表'));
 }
 assert.ok(x.writeCatalogCsv([row({name:'=SUM(1,2)'})]).includes("'=SUM(1,2)"));
});
test('worksheet formulas, external worksheets, macros, broken zip and oversized metadata are rejected',()=>{
 const original=unzipSync(x.writeCatalogWorkbook([row()],'1'));
 const mutate=(key,fn)=>{const files={...original,[key]:strToU8(fn(strFromU8(original[key])))};return zipSync(files);};
 assert.throws(()=>x.readCatalogWorkbook(mutate('xl/worksheets/sheet1.xml',value=>value.replace('<is><t xml:space="preserve">Galaxy A13','<f>1+1</f><is><t xml:space="preserve">Galaxy A13'))));
 assert.throws(()=>x.readCatalogWorkbook(mutate('xl/_rels/workbook.xml.rels',value=>value.replace('Target="worksheets/sheet1.xml"','Target="https://example.com/remote.xml" TargetMode="External"'))));
 assert.throws(()=>x.readCatalogWorkbook(zipSync({...original,'xl/vbaProject.bin':strToU8('not executed')})));
 const macro=zipSync({...original,'xl/vbaProject.bin':strToU8('not executed')});
 const altered=new Uint8Array(macro);const zipView=new DataView(altered.buffer,altered.byteOffset,altered.byteLength);
 const end=altered.length-22;assert.equal(zipView.getUint32(end,true),0x06054b50);
 zipView.setUint16(end+10,0,true);assert.throws(()=>x.readCatalogWorkbook(altered),'mismatched entry counts must not skip macro scanning');
 const split=new Uint8Array(macro);new DataView(split.buffer).setUint16(end+4,1,true);
 assert.throws(()=>x.readCatalogWorkbook(split),'multi-volume archives are not supported');
 const badSize=new Uint8Array(macro);new DataView(badSize.buffer).setUint32(end+12,1,true);
 assert.throws(()=>x.readCatalogWorkbook(badSize),'central-directory size must meet the EOCD');
 const zip64=new Uint8Array(macro);new DataView(zip64.buffer).setUint32(end+16,0xffffffff,true);
 assert.throws(()=>x.readCatalogWorkbook(zip64),'ZIP64 sentinel is rejected before decompression');
 assert.throws(()=>x.readCatalogWorkbook(new Uint8Array(30)));
 const oversized=x.writeCatalogWorkbook([row()],'1');const view=new DataView(oversized.buffer,oversized.byteOffset,oversized.byteLength);for(let i=0;i<oversized.length-46;i++)if(view.getUint32(i,true)===0x02014b50){view.setUint32(i+24,30*1024*1024,true);break;}assert.throws(()=>x.readCatalogWorkbook(oversized));
});
test('invalid workbook rows retain exact row errors and no silent zero',()=>{
 const rows=[row(),row({id:'second-row',name:'Another',year:null,releasedAt:null})];const files=unzipSync(x.writeCatalogWorkbook(rows,'1'));const body=strFromU8(files['xl/worksheets/sheet1.xml']);files['xl/worksheets/sheet1.xml']=strToU8(body.replace('r="G3" t="inlineStr" s="1"><is><t xml:space="preserve"></t>','r="G3" t="inlineStr" s="1"><is><t xml:space="preserve">0</t>'));
 const result=x.readCatalogWorkbook(zipSync(files));assert.equal(result.errors.length,1);assert.equal(result.errors[0].row,3);assert.equal(result.rows.length,1);
});
test('Excel date-typed ISO cells preserve the source calendar date',()=>{
 const entry=row();const files=unzipSync(x.writeCatalogWorkbook([entry],'1'));
 const xml=strFromU8(files['xl/worksheets/sheet1.xml']);
 const date='<c r="Q2" t="inlineStr" s="1"><is><t xml:space="preserve">2026-10-07</t></is></c>';
 assert.ok(xml.includes(date));
 files['xl/worksheets/sheet1.xml']=strToU8(xml.replace(date,'<c r="Q2" t="d" s="1"><v>2026-10-07T00:00:00.000Z</v></c>'));
 assert.deepEqual(x.readCatalogWorkbook(zipSync(files)).rows,[{entry:plain(entry),expectedVersion:1}]);
});
test('published domain has no measured configuration or business write coupling',()=>{
 const source=readFileSync('lib/device-catalog.ts','utf8');assert.doesNotMatch(source,/RetailUnit|RepairWorkflow|backendCommand|batteryPercent|imei1|costCents/);
 const migration=readFileSync('supabase/migrations/20261013095303_device_catalog.sql','utf8');assert.equal((migration.match(/force row level security/g)||[]).length,4);assert.doesNotMatch(migration,/grant.*admin_user_id.*to chinatech_runtime/i);assert.doesNotMatch(migration,/delete on|bypassrls|security definer/i);
});
