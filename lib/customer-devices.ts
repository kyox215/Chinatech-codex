import type { RepairDirectoryEntry } from "./repair-intake-record";
import type { RetailUnit } from "./retail";
export type CustomerDeviceRecord = {key:string;category:string;model:string;serial:string;records:{id:string;phone:string;time:string;type:"repair"|"sale";href:string}[]};
export function buildCustomerDevices(repairs:readonly RepairDirectoryEntry[],units:readonly RetailUnit[]) {
  const devices=new Map<string,CustomerDeviceRecord>();
  for(const repair of repairs){const serial=repair.device.serial.trim().toUpperCase().replace(/\s/g,"");const key=serial?`${/^\d{15}$/.test(serial)?"IMEI":repair.device.brand.trim().toUpperCase()}:${serial}`:`repair:${repair.id}`;const device=devices.get(key)??{key,category:repair.device.category,model:`${repair.device.brand} ${repair.device.model}`,serial,records:[]};device.records.push({id:repair.id,phone:repair.customer.phone,time:repair.createdAt,type:"repair",href:`/app/repairs/${repair.id}`});devices.set(key,device);}
  for(const unit of units)for(const sale of unit.sales){if(!sale.customerPhone)continue;const key=`retail:${unit.id}`;const device=devices.get(key)??{key,category:unit.category,model:`${unit.brand} ${unit.model}`,serial:unit.imei1||unit.serial||unit.code,records:[]};device.records.push({id:unit.code,phone:sale.customerPhone,time:sale.time,type:"sale",href:`/app/retail/units/${unit.id}`});devices.set(key,device);}
  return [...devices.values()];
}
export function latestCustomerDeviceTime(device:CustomerDeviceRecord) {return device.records.reduce((latest,row)=>row.time>latest?row.time:latest,"");}
