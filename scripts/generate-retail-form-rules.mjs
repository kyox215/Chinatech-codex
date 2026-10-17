import{readFileSync,writeFileSync}from'node:fs';
import{createHash}from'node:crypto';
import ts from'typescript';
import{sourceLoader}from'../tests/helpers/typescript-source.mjs';
const file='lib/device-catalog.ts',source=readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),load=sourceLoader(),{catalogNormalize}=load('./lib/device-catalog');
let aliases;
for(const node of ast.statements)if(ts.isVariableStatement(node))for(const declaration of node.declarationList.declarations)if(declaration.name.getText(ast)==='brandAliases'){
 if(!declaration.initializer||!ts.isObjectLiteralExpression(declaration.initializer))throw new Error('Expected first-party brand aliases');
 aliases=declaration.initializer.properties.flatMap(property=>{
  if(!ts.isPropertyAssignment(property)||!ts.isArrayLiteralExpression(property.initializer))throw new Error('Expected static brand aliases');
  const name=property.name.getText(ast).replace(/^['"]|['"]$/g,'');
  return[name,...property.initializer.elements.map(value=>{if(!ts.isStringLiteral(value))throw new Error('Expected literal alias');return value.text;})].map(value=>[catalogNormalize(value),name]);
 });
}
if(!aliases?.length)throw new Error('Missing brand aliases');
// PostgreSQL character classes depend on its Unicode/locale version. Generate
// the exact first-party JS Letter/Number set instead of approximating \p{L}\p{N}.
const ranges=[];let start=-1,last=-1,maxCatalogExpansion=1;
for(let point=0;point<=0x10ffff;point++){
 if(/[\p{L}\p{N}]/u.test(String.fromCodePoint(point))){if(start<0)start=point;last=point;maxCatalogExpansion=Math.max(maxCatalogExpansion,catalogNormalize(String.fromCodePoint(point)).length);}
 else if(start>=0){ranges.push([start,last]);start=-1;}
}
if(start>=0)ranges.push([start,last]);
const allowed='[^'+ranges.map(([first,last])=>String.fromCodePoint(first)+(last===first?'':'-'+String.fromCodePoint(last))).join('')+']';
const quote=value=>"'"+value.replaceAll("'","''")+"'",hash=createHash('sha256').update(source).update(readFileSync('lib/retail-catalog.ts')).update(allowed).digest('hex');
const generated=`-- BEGIN GENERATED RETAIL FORM RULES\n-- Exact JS Unicode ${process.versions.unicode}; first-party catalog source binding ${hash}\ncreate function chinatech_v2_private.retail_form_catalog_key(value text) returns text language sql immutable set search_path='' as $$\n select regexp_replace(replace(lower(normalize(coalesce(value,''),NFKC) collate chinatech_v2_private.retail_list_ties),'+','plus'),${quote(allowed)},'','g');\n$$;\ncreate function chinatech_v2_private.retail_form_brand(value text) returns text language sql immutable set search_path='' as $$\n select case chinatech_v2_private.retail_form_catalog_key(value) ${[...new Map(aliases)].map(([key,name])=>'when '+quote(key)+' then '+quote(name)).join(' ')} else chinatech_v2_private.directory_trim(coalesce(value,'')) end;\n$$;\n-- END GENERATED RETAIL FORM RULES`;
const path='supabase/migrations/20261017060716_performance_retail_form_reads.sql',sql=readFileSync(path,'utf8'),first=sql.indexOf('-- BEGIN GENERATED RETAIL FORM RULES'),lastMarker=sql.indexOf('-- END GENERATED RETAIL FORM RULES');
if(first<0||lastMarker<first)throw new Error('Missing unreleased migration generation markers');
const next=(sql.slice(0,first)+generated+sql.slice(lastMarker+'-- END GENERATED RETAIL FORM RULES'.length)).replace(/rules_hash text not null default '[^']*'/,"rules_hash text not null default '"+hash+"'");
const knownBrands=[...new Set(aliases.map(([,brand])=>brand))];
const binding='// Generated from first-party catalog semantics and exact JS Unicode properties.\nexport const retailFormRulesHash='+JSON.stringify(hash)+';\nexport const retailFormKnownBrands='+JSON.stringify(knownBrands)+';\n// Formal catalog brands are limited to 60 UTF16 units; larger keys cannot match them.\nexport const retailFormBrandKeyMax='+60*maxCatalogExpansion+';\n';
if(process.argv.includes('--write')){writeFileSync(path,next);writeFileSync('lib/backend/retail-form-rules-version.ts',binding);}else if(next!==sql||readFileSync('lib/backend/retail-form-rules-version.ts','utf8')!==binding)throw new Error('Retail form rules differ; review a new version and rebuild existing projections');
console.log(JSON.stringify({pass:true,mode:process.argv.includes('--write')?'generate-unreleased-migration':'check',aliases:new Map(aliases).size,unicodeRanges:ranges.length,hash}));
