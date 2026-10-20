import'server-only';
import{createRequire}from'node:module';
import{resolve}from'node:path';
import{nativeSortContract,nativeSortNodeVersions,nativeSortSourceSHA256,nativeSortRulesHash,type NativeSortMode}from'./intl-sort-contract';

type NativeRuntime={key:(value:string,mode:NativeSortMode)=>Buffer;requireRuntime:()=>void};
let runtime:NativeRuntime|undefined;
function current(){
 if(!runtime){
  try{const factory=createRequire(resolve(process.cwd(),'package.json'))(resolve(process.cwd(),'native/icu-sort-key/runtime.cjs')) as (contract:object)=>NativeRuntime;
   runtime=factory({contract:nativeSortContract,rulesHash:nativeSortRulesHash,sourceSHA256:nativeSortSourceSHA256,nodeVersions:nativeSortNodeVersions});
  }catch{throw new Error('后台资料暂不可用。');}
 }
 return runtime;
}
export function requireNativeSortRuntime(){current().requireRuntime();}
export function nativeSortKey(value:string,mode:NativeSortMode):Buffer{
 return current().key(value,mode);
}
export function nativeRetailSortKeys(value:{title:string;key:string;intakeDate:string;saleSortDate:string|null}){
 return{name:nativeSortKey(value.title.normalize('NFKC').trim().toLowerCase(),'retail-name'),tie:nativeSortKey(value.key,'default-tie'),intake:nativeSortKey(value.intakeDate,'default-tie'),sale:value.saleSortDate?nativeSortKey(value.saleSortDate.replace('T',' '),'default-tie'):null};
}
