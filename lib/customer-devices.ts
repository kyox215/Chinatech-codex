import type{RepairDirectoryEntry}from'./repair-intake-record';
import type{RetailUnit}from'./retail';
export type CustomerDeviceRecord={id:string;phone:string;time:string;type:'repair'|'sale';href:string};
export type CustomerDevice={key:string;category:string;model:string;serial:string;records:CustomerDeviceRecord[]};
export function repairCustomerDeviceIdentity(id:string,brand:string,serial:string){
 const normalized=serial.trim().toUpperCase().replace(/\s/g,'');
 return{key:normalized?`${/^\d{15}$/.test(normalized)?'IMEI':brand.trim().toUpperCase()}:${normalized}`:`repair:${id}`,serial:normalized};
}
export function latestCustomerDeviceTime(device:Pick<CustomerDevice,'records'>){return device.records.reduce((latest,row)=>row.time>latest?row.time:latest,'');}
/** Existing device semantics: repairs can share an explicitly identified device;
 * each sold store unit remains its own physical identity. Search includes every
 * record of a matching device; it never filters that device's record history. */
export function buildCustomerDevices(repairs:readonly RepairDirectoryEntry[],units:readonly RetailUnit[]):CustomerDevice[]{
 const devices=new Map<string,CustomerDevice>();
 for(const repair of repairs){
  const identity=repairCustomerDeviceIdentity(repair.id,repair.device.brand,repair.device.serial),device=devices.get(identity.key)??{key:identity.key,category:repair.device.category,model:`${repair.device.brand} ${repair.device.model}`,serial:identity.serial,records:[]};
  device.records.push({id:repair.id,phone:repair.customer.phone,time:repair.createdAt,type:'repair',href:`/app/repairs/${repair.id}`});devices.set(identity.key,device);
 }
 for(const unit of units)for(const sale of unit.sales){
  if(!sale.customerPhone)continue;
  const key=`retail:${unit.id}`,device=devices.get(key)??{key,category:unit.category,model:`${unit.brand} ${unit.model}`,serial:unit.imei1||unit.serial||unit.code,records:[]};
  device.records.push({id:unit.code,phone:sale.customerPhone,time:sale.time,type:'sale',href:`/app/retail/units/${unit.id}`});devices.set(key,device);
 }
 return[...devices.values()];
}
export function queryCustomerDevices(devices:readonly CustomerDevice[],query:string){return devices.filter(device=>`${device.model} ${device.serial} ${device.records.map(row=>`${row.phone} ${row.id}`).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())).toSorted((a,b)=>latestCustomerDeviceTime(b).localeCompare(latestCustomerDeviceTime(a)));}
