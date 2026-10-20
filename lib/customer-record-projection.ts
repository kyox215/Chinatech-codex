import{normalizeCustomerPhone}from'./customers';
import{retailHistoryCode}from'./retail-history';
import type{CustomerRecordKind}from'./backend/customer-detail-contract';
/** Independent canonical oracle for owner-only projection verification. */
export function customerRecordFact(kind:CustomerRecordKind,document:Record<string,unknown>){
 const source=document as Record<string,unknown>,sale=source.sale as Record<string,unknown>|undefined;
 let phone:string;try{phone=normalizeCustomerPhone(String((kind==='sales'?sale?.customerPhone:kind==='repairs'?source.phone:source.customerPhone)??''));}catch{return null;}
 let eventAt:string,summary:Record<string,unknown>,raw:unknown[];
 if(kind==='repairs'){
  eventAt=String(source.createdAt);summary={kind,id:source.id,brand:source.brand,model:source.model,createdAt:eventAt,issue:source.issue,rework:Object.hasOwn(source,'repairOrigin')};
  if(source.faults!==undefined)summary.faults=(source.faults as string[]).map(value=>[...value].slice(0,200).join(''));
  if(source.issueNote!==undefined)summary.issueNote=source.issueNote;
  raw=[source.id,source.brand,source.model,source.issue,source.issueNote,(source.faults as string[]|undefined)?.join(' '),eventAt];
 }else if(kind==='sales'){
  const item=sale!,product=item.product as Record<string,unknown>|undefined,deviceName=[product?product.brand:source.brand,product?product.model:source.model].map(value=>value??'').join(' ').trim();eventAt=String(item.time);
  summary={kind,id:item.id,unitId:source.id,unitCode:product?.code||source.code,deviceName,time:eventAt,priceCents:item.priceCents,paidCents:item.paidCents,delivered:item.delivered,customerName:item.customerName||'',customerEmail:item.customerEmail||'',customerAddress:item.customerAddress||'',customerNote:item.customerNote||'',refundedCents:((item.refunds??[])as{void?:unknown;amountCents:number}[]).reduce((sum,entry)=>sum+(entry.void?0:entry.amountCents),0),returned:!!item.returned,afterSaleCount:((item.afterSales??[])as unknown[]).length,...(item.deliveryDate!==undefined?{deliveryDate:item.deliveryDate}:{})};
  raw=[source.code,summary.unitCode,deviceName,item.id,item.customerName,item.customerEmail,item.customerAddress,item.customerNote,eventAt,item.deliveryDate];
 }else{
  eventAt=String(source.intakeAt);summary={kind,id:source.id,sourceRow:source.sourceRow,sourceStatus:source.sourceStatus,brand:source.brand,model:source.model,intakeAt:eventAt,pickupDate:source.pickupDate,salePriceCents:source.salePriceCents,reviewCount:((source.reviewReasons??[])as unknown[]).length};
  raw=[retailHistoryCode({sourceRow:source.sourceRow as number}),source.brand,source.model,source.sourceStatus,source.customerName,source.customerPhone,source.intakeAt,source.pickupDate];
 }
 const previews:string[]=[];if(kind==='repairs'&&(source.faults as string[]|undefined)?.some(value=>[...value].length>200))previews.push('faults');
 for(const key of['brand','model','issue','issueNote','unitCode','deviceName','customerName','customerEmail','customerNote','sourceStatus']){const value=summary[key];if(typeof value==='string'&&[...value].length>200){summary[key]=[...value].slice(0,200).join('');previews.push(key);}}
 return{phone,eventAt,search:raw.filter(value=>value!==null&&value!==undefined).join(' ').normalize('NFKC').toLowerCase(),summary:{...summary,previews}};
}
