import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const cache=new Map();
function sourceUrl(name){
 if(cache.has(name))return cache.get(name);
 let code=ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const match of [...code.matchAll(/from "\.\/([^";]+)"/g)])code=code.replace(match[0],`from ${JSON.stringify(sourceUrl(match[1]))}`);
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(name,url);return url;
}
const {importRetailHistoryRow,markRetailHistoryConflicts,retailHistoryCanonicalText}=await import(sourceUrl('retail-history-import'));
const {projectRetailHistory,retailHistorySearch,validateRetailHistoryRecord}=await import(sourceUrl('retail-history'));
const {buildCustomerDirectory}=await import(sourceUrl('customers'));
const context={id:'00000000-0000-5000-8000-000000000001',sourceSnapshot:'a'.repeat(64),importedAt:'2026-10-02T10:00:00Z'};
const row={sourceExcelRow:2,'状态':'以售',NOME:'Synthetic', 'NUMERO TELEFONO':'3200000011',CATEGORIA:'电脑',MARCA:'Test',MODELLO:'Synthetic laptop',COLORE:'NERO',MEMORIA:'512GB',DATA:'2024-01-01T10:20:30','1':'2026-09-01T10:30:00','DATA RITIRO':null,PREZZO:150,'PREZZO PAGATO':null,ACCONTO:0,'-':45,NOTE:'Synthetic purchase cost and screen issue',BATTERIA:0.85,'IMEI/序列号':'123456789012345'};

test('历史导入保留未知成交价/拿走日，定金零不变未知，不制造销售或收款',()=>{
 const record=importRetailHistoryRow(row,context);
 assert.equal(record.salePriceCents,null);assert.equal(record.pickupDate,null);assert.equal(record.depositCents,0);
 assert.equal(record.costCents,4500);assert.equal(record.batteryPercent,85);assert.equal(record.memory,'512GB');
 assert.equal(record.category,'电脑');assert.equal(record.condition,'翻新机');assert.equal(record.intakeAt,row.DATA);
 for(const key of ['sales','payments','ramGb','disks','inspection','warranty'])assert.equal(key in record,false);
 assert.ok(record.reviewReasons.includes('已售但成交价未记录'));
});
test('在售日期冲突和重复身份保留全部源行，不吞并原交易或按包装码合并',()=>{
 const a=importRetailHistoryRow({...row,'状态':'在售','DATA RITIRO':'2023-12-01'},context);
 const b=importRetailHistoryRow({...row,sourceExcelRow:3}, {...context,id:'00000000-0000-5000-8000-000000000002'});
 const records=markRetailHistoryConflicts([a,b]);assert.equal(records.length,2);
 assert.ok(records.every(r=>r.reviewReasons.includes('设备标识与其他来源记录重复')));
 assert.ok(records[0].reviewReasons.includes('拿走日期早于入库日期'));
 assert.equal(a.reviewReasons.includes('设备标识与其他来源记录重复'),false);
 const zero=markRetailHistoryConflicts([{...a,identifier:'0'},{...b,identifier:'0'}]);
 assert.equal(zero.some(r=>r.reviewReasons.includes('设备标识与其他来源记录重复')),false);
});
test('金额只接受精确欧分，缺列是未知，电池0和100都保留',()=>{
 assert.equal(importRetailHistoryRow({...row,ACCONTO:undefined,BATTERIA:0},context).depositCents,null);
 assert.equal(importRetailHistoryRow({...row,BATTERIA:0},context).batteryPercent,0);
 assert.equal(importRetailHistoryRow({...row,BATTERIA:1,PREZZO:'10,05'},context).askingPriceCents,1005);
 for(const value of [-1,'10.001','abc'])assert.throws(()=>importRetailHistoryRow({...row,PREZZO:value},context));
 assert.throws(()=>importRetailHistoryRow({...row,BATTERIA:2},context));
});
test('历史成本和可能含成本的原备注在服务端投影移除；撤权拒绝全部历史',()=>{
 const record=importRetailHistoryRow(row,context);
 const member={id:'viewer',role:'viewer',accountStatus:'active',membershipStatus:'active',permissions:['retail.view']};
 const projected=projectRetailHistory([record],member);
 assert.equal(projected[0].costCents,null);assert.equal(projected[0].notes,null);
 assert.equal(JSON.stringify(projected).includes(row.NOTE),false);assert.equal(record.costCents,4500);
 assert.deepEqual(projectRetailHistory([record],{...member,permissions:[]}),[]);
 assert.deepEqual(projectRetailHistory([record],{...member,membershipStatus:'disabled'}),[]);
 assert.equal(projectRetailHistory([record],{...member,permissions:['retail.view','financial.read']})[0].costCents,4500);
});
test('历史整机按统一号码关联客户而不伪装成确认销售，未知价可搜索',()=>{
 const a=importRetailHistoryRow(row,context);
 const b=importRetailHistoryRow({...row,sourceExcelRow:3,'NUMERO TELEFONO':'+39 3200000011'}, {...context,id:'00000000-0000-5000-8000-000000000002'});
 const customers=buildCustomerDirectory([],[],[],[],[a,b]);assert.equal(customers.length,1);
 assert.equal(customers[0].history.length,2);assert.equal(customers[0].sales.length,0);assert.equal(customers[0].repairs.length,0);
 assert.equal(buildCustomerDirectory([],[],[],[],[{...a,customerPhone:'bad'}]).length,0);
 for(const query of ['Synthetic laptop','3200000011','512gb','screen issue','2024-01-01','ST-0001','翻新机'])assert.equal(retailHistorySearch(a,query),true);
});
test('异常16位标识仅标记待核对，包装码与任意长度零占位不合并',()=>{
 const invalid=importRetailHistoryRow({...row,'IMEI/序列号':'1234567890123456'},context);
 assert.equal(invalid.identifier,'1234567890123456');assert.ok(invalid.reviewReasons.includes('设备标识格式待核对'));
 for(const identifier of ['1234567890123','0','000000000000000']) {
  const a=importRetailHistoryRow({...row,'IMEI/序列号':identifier},context);
  const b={...a,id:'00000000-0000-5000-8000-000000000002',sourceRow:3};
  const marked=markRetailHistoryConflicts([a,b]);
  assert.equal(marked.some(r=>r.reviewReasons.includes('设备标识与其他来源记录重复')),false);
  assert.equal(marked[0].identifier,identifier);
 }
 const marked=markRetailHistoryConflicts([invalid,{...invalid,identifier:row['IMEI/序列号']},{...invalid,identifier:row['IMEI/序列号']}]);
 assert.deepEqual(markRetailHistoryConflicts(marked),marked);
});
test('UUID形状/版本/变体与真实日历日期均严格校验，不接受日期截断绕过',()=>{
 const record=importRetailHistoryRow(row,context);
 for(const id of ['-'.repeat(36),'000000000000500080000000000000000001','00000000-0000-0000-8000-000000000001','00000000-0000-5000-0000-000000000001'])assert.throws(()=>validateRetailHistoryRecord({...record,id}));
 for(const value of ['2023-02-29','2024-02-30','2024-13-01','0000-01-01'])assert.throws(()=>validateRetailHistoryRecord({...record,pickupDate:value}));
 for(const field of ['intakeAt','sourceUpdatedAt','importedAt'])for(const value of ['2023-02-29T12:00:00Z','2024-01-01T24:00:00Z','2024-01-01T12:60:00Z','1','2024-01-01'])assert.throws(()=>validateRetailHistoryRecord({...record,[field]:value}));
 for(const value of ['2024-02-30T00:00:00','2024-01-01garbage','2024-01-01T25:00:00'])assert.throws(()=>importRetailHistoryRow({...row,'DATA RITIRO':value},context));
 assert.equal(importRetailHistoryRow({...row,'DATA RITIRO':'2024-02-29T00:00:00'},context).pickupDate,'2024-02-29');
 assert.equal(validateRetailHistoryRecord({...record,intakeAt:'2024-02-29T23:59:59.123456+02:00'}).intakeAt,'2024-02-29T23:59:59.123456+02:00');
});
test('完整内容摘要使用稳定UTF-8结构，顺序无关对象与有序数组不混淆',()=>{
 assert.equal(retailHistoryCanonicalText({b:2,a:'中文'}),retailHistoryCanonicalText({a:'中文',b:2}));
 assert.notEqual(retailHistoryCanonicalText({a:'b:c'}),retailHistoryCanonicalText({'a:b':'c'}));
 assert.notEqual(retailHistoryCanonicalText([1,2]),retailHistoryCanonicalText([2,1]));
 for(const [a,b] of [[null,'null'],[0,'0'],[false,0],[[],{}]])assert.notEqual(retailHistoryCanonicalText(a),retailHistoryCanonicalText(b));
 assert.equal(retailHistoryCanonicalText(1e-7),'d9:0.0000001');assert.equal(retailHistoryCanonicalText(1e21),'d22:1000000000000000000000');
 assert.equal(retailHistoryCanonicalText(-1.25e-7),'d12:-0.000000125');
 assert.throws(()=>retailHistoryCanonicalText(undefined));assert.throws(()=>retailHistoryCanonicalText(NaN));
});
