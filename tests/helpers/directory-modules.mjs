import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=resolve('.local/device-directory/test-modules');mkdirSync(dir,{recursive:true});
function compile(path,name,replace=s=>s){const out=resolve(dir,name+'.mjs');writeFileSync(out,ts.transpileModule(replace(readFileSync(path,'utf8')),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);return pathToFileURL(out).href;}
const domain=compile('lib/device-catalog.ts','domain');
const contract=compile('lib/device-directory.ts','contract',s=>s.replace("'./device-catalog'",JSON.stringify(domain)));
export const directory=await import(contract);
export const client=await import(compile('lib/device-directory-client.ts','client',s=>s.replace("'./device-catalog'",JSON.stringify(domain)).replace("'./device-directory'",JSON.stringify(contract))));
export const storage=await import(compile('lib/device-directory-storage.ts','storage',s=>s.replace("'./device-directory'",JSON.stringify(contract))));
export const catalog=await import(domain);
export async function makePackage(rows,revision='1',checkedAt=1){
 const groups=new Map();for(const row of rows){const key=row.category+'-'+await directory.directorySHA(row.brand);groups.set(key,[...(groups.get(key)??[]),row]);}
 const shards={},descriptors=[];
 for(const [key,models] of groups){const {category,brand}=models[0],body=JSON.stringify({formatVersion:1,category,brand,models});shards[key]=body;descriptors.push({key,category,brand,count:models.length,sha256:await directory.directorySHA(body)});}
 const base={formatVersion:1,revision,shards:descriptors};return {manifest:JSON.stringify({...base,version:await directory.directorySHA(JSON.stringify(base))}),shards,checkedAt};
}
