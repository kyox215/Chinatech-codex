import test from'node:test';import assert from'node:assert/strict';import{sourceLoader}from'./helpers/typescript-source.mjs';
const load=sourceLoader(),{buildCustomerDevices,queryCustomerDevices,repairCustomerDeviceIdentity}=load('./lib/customer-devices'),{customerDeviceQuery}=load('./lib/backend/customer-device-contract');
const repair=(id,brand,serial,model=id,time='2026-10-17 10:00:00',phone='+3900000001')=>({id,device:{brand,serial,model,category:'手机'},customer:{phone},createdAt:time}),unit=(id,code,serial,phone='+3900000001',time='2026-10-17T10:00')=>({id,code,serial,imei1:'',brand:'DEMO',model:id,category:'phone',sales:[{id:'SALE-'+id,customerPhone:phone,time}]});
test('physical device identity retains original trim, case, whitespace and source rules',()=>{
 assert.deepEqual(repairCustomerDeviceIdentity('A',' aPpLe ',' s n\uFEFFß '),{key:'APPLE:SNSS',serial:'SNSS'});
 assert.equal(repairCustomerDeviceIdentity('A','ＤＥＭＯ','Ａ').key,'ＤＥＭＯ:Ａ');
 assert.equal(repairCustomerDeviceIdentity('A','DEMO','Ａ').key,'DEMO:Ａ');
 const rows=buildCustomerDevices([repair('A','Apple','s n'),repair('B','APPLE','SN'),repair('C','Other','SN'),repair('D','Apple','123456789012345'),repair('E','Other','123456789012345'),repair('F','Apple',''),repair('G','Apple','')],[unit('U1','SAME','SN'),unit('U2','SAME','SN')]);
 assert.equal(rows.length,7);assert.equal(rows[0].records.length,2);assert.equal(rows[2].records.length,2);assert.equal(rows[0].model,'Apple A');assert.deepEqual(rows.slice(-2).map(r=>r.key),['retail:U1','retail:U2']);
});
test('tail-record search returns the full device history and retains first-source model and stable time ties',()=>{
 const rows=buildCustomerDevices(Array.from({length:550},(_,i)=>repair('R'+String(i).padStart(3,'0'),'DEMO','SAME',i?'Later model':'First model','2026-10-17 10:00:00',i===549?'+39099999549':'+3900000001')),[]);
 assert.equal(queryCustomerDevices(rows,'99999549')[0].records.length,550);assert.equal(queryCustomerDevices(rows,'first model').length,1);assert.equal(queryCustomerDevices(rows,'later model').length,0);
 const ties=buildCustomerDevices([repair('B','DEMO','B'),repair('A','DEMO','A')],[]);assert.deepEqual(queryCustomerDevices(ties,'').map(r=>r.key),['DEMO:B','DEMO:A']);
});
test('search retains exact old cross-record and metadata separators',()=>{
 const rows=buildCustomerDevices([repair('A','DEMO','SN','MODEL','2026-10-17 10:00:00','+3900000001'),repair('B','DEMO','SN','LATER','2026-10-17 10:00:00','+3900000002')],[]);
 assert.equal(queryCustomerDevices(rows,'model sn +3900000001 a +3900000002')[0].records.length,2);
 assert.equal(queryCustomerDevices(rows,'LATER').length,0);
});
test('record sorting uses locale while latest selection uses JavaScript UTF16 order; empty buyers stay excluded',()=>{
 const rows=buildCustomerDevices([],[{...unit('U','C','S'),sales:[{id:'a',customerPhone:'+3900000001',time:'2026-10-17T😀'},{id:'b',customerPhone:'+3900000002',time:'2026-10-17T\uE000'}]},unit('V','D','S','')]);
 assert.equal(rows.length,1);assert.equal(rows[0].records.length,2);assert.equal(queryCustomerDevices(rows,'').length,1);
});
test('device queries keep raw bounded Unicode input idempotent and records require exact opaque identity',()=>{
 const q='İ'.repeat(100);assert.deepEqual(customerDeviceQuery(customerDeviceQuery({q})),{kind:'devices',q,deviceId:''});
 assert.throws(()=>customerDeviceQuery({q:'a'.repeat(161)}));assert.throws(()=>customerDeviceQuery({kind:'records',deviceId:'bad'}));assert.throws(()=>customerDeviceQuery({kind:'records',deviceId:'a'.repeat(64),q:'filtered'}));
 assert.equal(customerDeviceQuery({kind:'records',deviceId:'a'.repeat(64)}).q,'');
});
const{mergeCustomerDeviceWindow}=load('./lib/backend/customer-device-window'),{customerDeviceLocation,safeCustomerDeviceLocation}=load('./lib/customer-device-location');
test('device response cache retains ten actual batches and rejects different read owners',()=>{
 const scope={formatVersion:2,storeId:'DEMO',accountId:'A',sessionId:'S',memberId:'M',memberRevision:1,permissions:['repairs.view']},page=(start,size)=>({formatVersion:1,scope,stateToken:'T',generation:'1',query:{kind:'devices',q:'',deviceId:''},total:1000,startIndex:start,previousCursor:null,nextCursor:null,items:Array.from({length:size},(_,i)=>({id:'D'+(start+i)}))});let current=page(0,50);
 for(let i=1;i<12;i++)current=mergeCustomerDeviceWindow(current,page(i*50,50),'after');assert.equal(current.items.length,500);assert.equal(current.startIndex,100);assert.equal(current.windowBatches.length,10);
 for(const incoming of[{...page(600,50),formatVersion:2},{...page(600,50),scope:{...scope,sessionId:'OTHER'}},{...page(600,50),stateToken:'OTHER'},{...page(600,50),query:{kind:'records',q:'',deviceId:'a'.repeat(64)}}])assert.throws(()=>mergeCustomerDeviceWindow(current,incoming,'after'));
});
test('device return location keeps only a bounded same-origin device path and exact record identity',()=>{
 const raw=customerDeviceLocation('DEMO ꟏','a'.repeat(64),317,'["repair", "LOCAL-ID", "LOCAL-ID"]',202);assert.equal(safeCustomerDeviceLocation(raw),raw);const customer=customerDeviceLocation('DEMO ꟏','a'.repeat(64),317,'["repair", "LOCAL-ID", "LOCAL-ID"]',202,'customer');assert.equal(safeCustomerDeviceLocation(customer),customer);assert.equal(new URL(customer,'https://local.invalid').searchParams.get('recordTarget'),'customer');const{customerRecordLocation,safeCustomerRecordLocation}=load('./lib/customer-record-location');const nested=customerRecordLocation('PHONE-390000001','repairs','','',0,customer);assert.equal(safeCustomerRecordLocation(nested),nested);assert.equal(new URL(nested,'https://local.invalid').searchParams.get('returnTo'),customer);
 for(const raw of['https://evil.example/app/customer-devices','/app/customer-devices#private','/app/customers/PHONE-390000001','/app/customer-devices?unexpected=1','/app/customer-devices?anchor=bad','/app/customer-devices?record=unscoped','/app/customer-devices?recordTarget=customer','/app/customer-devices?anchor='+ 'a'.repeat(64)+'&record=DEMO&recordTarget=first'])assert.equal(safeCustomerDeviceLocation(raw),null);
 assert.equal(new URL(safeCustomerDeviceLocation('/app/customer-devices?anchor='+'a'.repeat(64)+'&offset=90000'),'https://local.invalid').searchParams.get('offset'),'2000');
});
