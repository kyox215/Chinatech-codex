// Exercises the complete reference seed inside one transaction and rolls it back.
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import postgres from 'postgres';
const config=JSON.parse(readFileSync('.local/backend/connection.private.json','utf8'));
const target=new URL(config.DB_URL);
if(target.hostname!=='127.0.0.1'||target.port!=='55422'||target.pathname!=='/postgres')throw Error('The catalog seed probe only accepts this project local database.');
const source=ts.transpileModule(readFileSync('lib/device-catalog.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {catalogIdentity,catalogNameSort,catalogSearchText,validateCatalogEntry}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const entries=JSON.parse(readFileSync('data/device-catalog/catalog.json','utf8')).map(validateCatalogEntry);
const connection=postgres(config.DB_URL,{max:1,prepare:false,connect_timeout:5});
const rollback=new Error('CATALOG_SEED_PROBE_ROLLBACK');
try{
 const [before]=await connection`select revision::text,admin_user_id from chinatech_v2_private.device_catalog_control where singleton`;
 const [existing]=await connection`select count(*)::int as count from chinatech_v2_private.device_catalog_entries`;
 if(before?.revision!=='0'||before.admin_user_id!==null||existing.count!==0)throw Error('The local catalog is not empty; preserve its state.');
 try{
  await connection.begin(async tx=>{
   await tx`select singleton from chinatech_v2_private.device_catalog_control where singleton for update`;
   for(let offset=0;offset<entries.length;offset+=250){
    const values=entries.slice(offset,offset+250).map(entry=>({id:entry.id,category:entry.category,brand:entry.brand,family:entry.family,enabled:entry.enabled,
     release_sort:entry.releasedAt??(entry.year?`${entry.year}-01-01`:''),name_sort:catalogNameSort(entry.name),search_text:catalogSearchText(entry),identity_key:catalogIdentity(entry),version:1,data:tx.json(entry)}));
    await tx`insert into chinatech_v2_private.device_catalog_entries ${tx(values)}`;
   }
   const [count]=await tx`select count(*)::int as count,count(distinct brand)::int as brands from chinatech_v2_private.device_catalog_entries`;
   if(count.count!==entries.length||count.brands!==33)throw Error('Seed count did not match the frozen catalog.');
   const samsung=await tx`select data->>'name' as name from chinatech_v2_private.device_catalog_entries where category='phone' and brand='Samsung' and data->>'name' like 'Galaxy A13%'`;
   if(samsung.length!==3)throw Error('Samsung A13 hardware variants did not survive the seed.');
   console.log(JSON.stringify({validatedModels:count.count,brands:count.brands,a13Variants:samsung.length,committed:false}));
   throw rollback;
  });
 }catch(error){if(error!==rollback)throw error;}
 const [after]=await connection`select count(*)::int as count from chinatech_v2_private.device_catalog_entries`;
 const [control]=await connection`select revision::text,admin_user_id from chinatech_v2_private.device_catalog_control where singleton`;
 if(after.count!==0||control.revision!=='0'||control.admin_user_id!==null)throw Error('The local seed probe did not roll back completely.');
 console.log('Local catalog remained empty after rollback.');
}finally{await connection.end();}
