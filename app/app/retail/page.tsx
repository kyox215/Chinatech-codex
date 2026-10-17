import{createHash}from'node:crypto';
import{BackendPageFrame}from'@/components/backend-page-frame';
import type{Metadata}from'next';
import{RetailList}from'@/components/retail/retail-list';
import{retailCategories,retailStatuses}from'@/lib/retail';
import{retailQueryFromParams}from'@/lib/retail-list-location';
export const metadata:Metadata={title:'整机商品'};
export default async function RetailPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const input=await searchParams,params=new URLSearchParams(Object.entries(input).filter((entry):entry is[string,string]=>typeof entry[1]==='string'));
 let category=params.get('category')??'all',status=params.get('status')??'all';
 if(params.get('source')==='units'){if(Object.hasOwn(retailCategories,category))category=retailCategories[category as keyof typeof retailCategories];if(Object.hasOwn(retailStatuses,status))status=retailStatuses[status as keyof typeof retailStatuses].label;}
 if(status==='processing')status='all';
 const hash=(value:string)=>value==='all'?'all':createHash('sha256').update(value).digest('hex'),legacyFacets={category:hash(category),status:hash(status)},raw=retailQueryFromParams(params,legacyFacets),query={...raw,q:raw.q.length<=160?raw.q:''},anchor=params.get('anchor');
 return <BackendPageFrame plan={{kind:'retail',retailQuery:query,...(anchor&&/^(unit|history):[\s\S]{1,100}$/u.test(anchor)?{anchor}:{})}}><RetailList legacyFacets={legacyFacets}/></BackendPageFrame>;
}
