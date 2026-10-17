import assert from'node:assert/strict';
import{sourceLoader}from'./typescript-source.mjs';
const load=sourceLoader(),{fixtureIntakeReceipt,validLocalIntake}=load('./lib/repair-intake-record'),{repairOrders}=load('./lib/repair-fixtures'),{emptyRetailUnit,parseStoredRetailUnits}=load('./lib/retail'),{validateProcurementDraft,appendProcurementEvent}=load('./lib/procurement'),{defaultStoreSettings}=load('./lib/store-settings');
export const dashboardAccess={repairs:true,retail:true,financial:false};
export function dashboardIntake(index,extra={}){
 const value={...fixtureIntakeReceipt(repairOrders[0]),id:'LOCAL-'+index.toString(16).toUpperCase().padStart(16,'0'),customerName:'DEMO buyer',phone:'+390007774444',email:'',brand:'DEMO',model:'Device '+index,serial:'DEMO-DASH-'+index,createdAt:'2026-10-17 10:00:00',updatedAt:'2026-10-17 10:00:00',previewAt:'2026-10-17 10:00:00',photoCount:0,photos:[],...extra};assert(validLocalIntake(value));return value;
}
export function dashboardUnit(id,extra={}){
 const value={...emptyRetailUnit(),id,code:'CODE-'+id,brand:'DEMO',model:'Store unit',storeOwned:true,events:[{id:'event',title:'商品资料已核对',detail:'DEMO original',time:'2026-10-17 11:00:00'}],...extra};assert.equal(parseStoredRetailUnits(JSON.stringify({version:1,units:[value]}),[]).length,1);return value;
}
export function dashboardPurchase(id,repairId,extra={}){
 const value=validateProcurementDraft({id,repairId,item:'屏幕',supplier:'DEMO supplier',quantity:2,unitCostCents:null,expectedAt:'',reference:'',events:[],...extra});
 return appendProcurementEvent(value,{id:id+'-ordered',type:'ordered',time:'2026-10-17 11:00:00',note:'PRIVATE-PROCUREMENT-NOTE',quantity:0});
}
export function dashboardSource(){return{intakes:[],workflows:{},procurement:[],retail:[],history:[],settings:structuredClone(defaultStoreSettings)};}
