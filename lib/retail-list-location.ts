import{retailListQuery,type RetailListQuery}from'./backend/retail-list-contract';
import{defaultRetailListSort,resolveRetailListSort,retailViewFromParams}from'./retail-list-model';
export function retailQueryFromParams(params:Pick<URLSearchParams,'get'>,legacy:{category?:string;status?:string}={}):RetailListQuery{
 const view=retailViewFromParams(params),q=params.get('q')??'',condition=params.get('condition'),category=params.get('categoryKey')??legacy.category??'all',status=params.get('statusKey')??legacy.status??'all';
 const safe=retailListQuery({view,q:q.length<=160?q:'',condition:condition==='新机'||condition==='翻新机'?condition:'all',category:/^[0-9a-f]{64}$/.test(category)?category:'all',status:/^[0-9a-f]{64}$/.test(status)?status:'all',review:params.get('review')==='pending',sort:resolveRetailListSort(view,params.get('sort'))});
 return{...safe,q};
}
export function retailListLocation(query:RetailListQuery,anchor='',offset=0){
 const params=new URLSearchParams();if(query.view!=='available')params.set('view',query.view);if(query.q&&query.q.length<=160)params.set('q',query.q);
 if(query.condition!=='all')params.set('condition',query.condition);if(query.category!=='all')params.set('categoryKey',query.category);if(query.status!=='all'&&query.view==='other')params.set('statusKey',query.status);if(query.review)params.set('review','pending');if(query.sort!==defaultRetailListSort(query.view))params.set('sort',query.sort);
 if(/^(unit|history):[\s\S]{1,100}$/u.test(anchor))params.set('anchor',anchor);if(anchor&&Number.isFinite(offset))params.set('offset',String(Math.max(-2000,Math.min(2000,Math.round(offset)))));
 return'/app/retail'+(params.size?'?'+params:'');
}
export function safeRetailListLocation(raw:string|null){try{if(!raw||raw.length>3000)return'/app/retail';const url=new URL(raw,'https://local.invalid');if(url.origin!=='https://local.invalid'||url.pathname!=='/app/retail'||[...url.searchParams.keys()].some(key=>!['view','q','condition','categoryKey','statusKey','review','sort','anchor','offset'].includes(key)))return'/app/retail';return retailListLocation(retailQueryFromParams(url.searchParams),url.searchParams.get('anchor')??'',Number(url.searchParams.get('offset')??0));}catch{return'/app/retail';}}
let position:{scope:string;id:string;location:string}|null=null,bound=false;
export function rememberRetailListPosition(scope:string,id:string,location:string){position={scope,id,location:safeRetailListLocation(location)};}
export function retailListReturnPosition(scope:string,id:string){return position?.scope===scope&&position.id===id?position.location:null;}
export function bindRetailListPosition(readScope:()=>string|null,subscribe:(notify:()=>void)=>()=>void){if(bound||typeof window==='undefined')return;bound=true;subscribe(()=>{if(position&&position.scope!==readScope())position=null;});}
