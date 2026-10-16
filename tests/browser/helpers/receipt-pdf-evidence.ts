import { defaultStoreSettings } from '../../../lib/store-settings';
import { MultiFormatWriter, BarcodeFormat } from '@zxing/library';
import { renderRepairReceipt } from '../../../lib/backend/repair-receipt-renderer';
import { intakeDirectoryEntry, matchingIntakeSignature, type IntakeReceiptData, type IntakeSignature } from '../../../lib/repair-intake-record';
import { currentRepairRequirements } from '../../../lib/repair-requirements';
import { initialRepairWorkflow, type RepairWorkflow } from '../../../lib/repair-workflow';
import { itemQuoteTotal } from '../../../lib/repair-item-pricing';
import { repairPrintProjection } from '../../../lib/repair-print-layout';
import { printLabel, type PrintLanguage } from '../../../lib/print-language';
/** Real saved DEMO facts -> production projection/renderer -> PDF text. No HTTP. */
export async function receiptPdfEvidence(data:IntakeReceiptData, language:PrintLanguage, workflow?:RepairWorkflow, signatures:IntakeSignature[]=[]){
 const policy=data.policy??{months:defaultStoreSettings.repairWarrantyMonths,shopName:defaultStoreSettings.shopName,address:defaultStoreSettings.address,phone:defaultStoreSettings.phone};
 const order=intakeDirectoryEntry(data), requirements=currentRepairRequirements(order,workflow??initialRepairWorkflow(order));
 const matrix=new MultiFormatWriter().encode('https://www.chinatech.in/app/repairs/'+data.id,BarcodeFormat.QR_CODE,0,0,new Map());let path='';for(let y=0;y<matrix.getHeight();y++)for(let x=0;x<matrix.getWidth();x++)if(matrix.get(x,y))path+=`M${x} ${y}h1v1h-1z`;
 const p=repairPrintProjection({data,requirements,policy,signature:matchingIntakeSignature(signatures,data,policy),hasHistory:signatures.length>0,language,totalCents:data.itemQuotes?.length?itemQuoteTotal(data.itemQuotes,requirements.map(r=>r.title)):null,technician:printLabel('unassigned',language),status:workflow?.status??order.status,custody:workflow?.custody??data.custody??'unknown',formal:true,qr:{path,size:matrix.getWidth()}});
 const result=await renderRepairReceipt(p,'a5');const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=pdfjs.getDocument({data:result.bytes.slice(),useSystemFonts:false});try{const document=await loading.promise;if(document.numPages!==1)throw new Error('Receipt must be one page');const page=await document.getPage(1);const text=(await page.getTextContent({disableNormalization:true})).items.map(item=>'str'in item?item.str:'').join(' ');return {text,projection:p,bytes:result.bytes};}finally{await loading.destroy();}
}
