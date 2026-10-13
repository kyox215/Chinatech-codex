import { readFileSync,writeFileSync,existsSync,mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const directory='data/device-catalog';mkdirSync(directory,{recursive:true});
const loadTs=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));
const {validateCatalogEntry,catalogIdentity,catalogNormalize,canonicalCatalogBrand}=await loadTs('lib/device-catalog.ts');
const hardwareText=readFileSync('lib/retail-catalog.ts','utf8')+'\nexport { modelEntries };';
const hardware=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(hardwareText,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));
const consoleSources=new Map(hardware.catalogSources.map(source=>[source.id,source]));
const consoleRows=hardware.modelEntries.map(entry=>{
 const name=entry.value;const id='console-'+catalogNormalize(entry.brand)+'-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+createHash('sha256').update(entry.brand+':'+name).digest('hex').slice(0,6);
 const year=name.match(/\b(19\d\d|20\d\d)\b/);const family=entry.brand==='Sony'?name.startsWith('PSP')?'PSP':name.startsWith('PS Vita')?'PS Vita':'PlayStation':entry.brand==='Microsoft'?'Xbox':entry.brand==='Nintendo'?name.startsWith('Switch')?'Switch':'Nintendo legacy':entry.brand==='Valve'?'Steam Deck':entry.brand==='ASUS'?'ROG Ally':'Legion Go';
 return {id,category:'console',brand:entry.brand,family,name,releasedAt:null,year:year?Number(year[1]):null,generation:'',network:'unknown',platform:'',modelCodes:[],aliases:[],markets:[],status:'verified',enabled:true,sourceIds:[entry.source]};
});
writeFileSync(directory+'/consoles-generated.json',JSON.stringify(consoleRows,null,2)+'\n');
const rawRows=[...consoleRows],sources=[...consoleSources.values()].filter(source=>consoleRows.some(row=>row.sourceIds.includes(source.id))),coverage=[];
const parts=[['phones','phones'],['phones-extra','phones-extra'],['apple-other','apple-other'],['computers','computers'],['tablets','tablets'],['other','other']];
for(const [rowsName,metadataName] of parts){
 const path=directory+'/'+rowsName+'.json';if(!existsSync(path))continue;
 rawRows.push(...JSON.parse(readFileSync(path,'utf8')));
 for(const [prefix,array] of [['sources-',sources],['coverage-',coverage]]){const input=directory+'/'+prefix+metadataName+'.json';if(existsSync(input))array.push(...JSON.parse(readFileSync(input,'utf8')));}
}
for(const brand of [...new Set(consoleRows.map(row=>row.brand))])coverage.push({category:'console',brand,verifiedCount:consoleRows.filter(row=>row.brand===brand).length,scope:'复用项目已核验的官方主机／掌机档案，核验日期按原来源保留。',scopeIt:'Archivio ufficiale di console e portatili già verificato nel progetto; conservate le date delle fonti.',scopeEn:'Reuses the project’s verified official console and handheld archive; original source check dates are preserved.',gaps:['未宣称覆盖所有地区修订与限定版；缺失年份保留未知。'],gapsIt:['Copertura non completa di revisioni regionali o edizioni limitate; anni mancanti restano sconosciuti.'],gapsEn:['Not exhaustive for regional revisions or limited editions; missing years remain unknown.'],sourceIds:[...new Set(consoleRows.filter(row=>row.brand===brand).flatMap(row=>row.sourceIds))]});
const sourceById=new Map();for(const source of sources){const previous=sourceById.get(source.id);if(previous&&JSON.stringify(previous)!==JSON.stringify(source))throw new Error('Conflicting source ID '+source.id);sourceById.set(source.id,source);}
const list=value=>{const seen=new Set();return value.map(text=>text.normalize('NFKC').trim()).filter(text=>{const key=catalogNormalize(text);if(!key||seen.has(key))return false;seen.add(key);return true;});};
const rows=rawRows.map(raw=>{
 const {sourceIds=[],...entry}=raw;const referenced=sourceIds.map(id=>{const source=sourceById.get(id);if(!source)throw new Error('Missing source '+id+' for '+raw.id);return source;});
 const sourceUrls=list(entry.sourceUrls??referenced.map(source=>source.url));const checkedAt=entry.checkedAt??referenced.map(source=>source.checkedAt).sort()[0]??null;
 return validateCatalogEntry({...entry,brand:canonicalCatalogBrand(entry.brand),modelCodes:list(entry.modelCodes),aliases:list(entry.aliases),markets:list(entry.markets),sourceUrls,checkedAt,notes:entry.notes??''});
});
const ids=new Set(),identities=new Map();for(const row of rows){if(ids.has(row.id))throw new Error('Duplicate ID '+row.id);ids.add(row.id);const key=catalogIdentity(row);if(identities.has(key))throw new Error('Duplicate model identity '+row.id+' / '+identities.get(key));identities.set(key,row.id);}
for(const row of coverage){if(!row.scopeIt||!row.scopeEn||!Array.isArray(row.gapsIt)||!Array.isArray(row.gapsEn)||row.gaps.length!==row.gapsIt.length||row.gaps.length!==row.gapsEn.length)throw new Error('Missing locale coverage for '+row.brand);}
rows.sort((a,b)=>a.category.localeCompare(b.category)||a.brand.localeCompare(b.brand)||a.family.localeCompare(b.family)||(b.releasedAt??String(b.year??'')).localeCompare(a.releasedAt??String(a.year??''))||a.name.localeCompare(b.name,'en',{numeric:true}));
for(const [file,data]of [['catalog.json',rows],['sources.json',[...sourceById.values()]],['coverage.json',coverage]])writeFileSync(directory+'/'+file,JSON.stringify(data,null,2)+'\n');
const result={models:rows.length,brands:new Set(rows.map(row=>row.brand)).size,sources:sourceById.size,byCategory:Object.fromEntries(['phone','tablet','laptop','desktop','console','other'].map(category=>[category,rows.filter(row=>row.category===category).length])),sha256:createHash('sha256').update(readFileSync(directory+'/catalog.json')).digest('hex')};
mkdirSync('.local/device-catalog',{recursive:true});writeFileSync('.local/device-catalog/data-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
