import{readFileSync,writeFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{sourceLoader}from'../tests/helpers/typescript-source.mjs';
const load=sourceLoader(),messages={...JSON.parse(readFileSync('lib/i18n/structured.json')),...load('./lib/i18n/errors').errorMessages,...load('./lib/i18n/interface').interfaceMessages,...load('./lib/i18n/public').publicMessages};
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const rows=Object.entries(messages).map(([key,values],index)=>{
 const names=[],pieces=key.split(/\{(\w+)\}/g),pattern=key.includes('{')?'^'+pieces.map((piece,i)=>{if(i%2){names.push(piece);return'(.+?)';}return piece.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('')+'$':null;
 return`(${quote(key)},array[${values.map(quote).join(',')}],${index},${pattern?quote(pattern):'null'},array[${names.map(quote).join(',')}]::text[])`;
});
const version=createHash('sha256').update(JSON.stringify(messages)).update(readFileSync('lib/i18n/translate.ts')).digest('hex');
const content='-- BEGIN GENERATED RETAIL VOCABULARY\n-- First-party presentation dictionary SHA256 '+createHash('sha256').update(JSON.stringify(messages)).digest('hex')+'\ninsert into chinatech_v2_private.retail_list_vocabulary(original,translations,position,pattern,slots) values\n'+rows.join(',\n')+';\n-- END GENERATED RETAIL VOCABULARY';
const path='supabase/migrations/20261017050521_performance_retail_read_model.sql',source=readFileSync(path,'utf8'),start=source.indexOf('-- BEGIN GENERATED RETAIL VOCABULARY'),end=source.indexOf('-- END GENERATED RETAIL VOCABULARY');
if(start<0||end<start)throw new Error('Expected versioned migration vocabulary markers');
const next=(source.slice(0,start)+content+source.slice(end+'-- END GENERATED RETAIL VOCABULARY'.length)).replace(/vocabulary_hash text not null default '[^']*'/,"vocabulary_hash text not null default '"+version+"'");
const binding='// Generated from the first-party vocabulary and translate implementation.\nexport const retailVocabularyHash='+JSON.stringify(version)+';\n';
if(process.argv.includes('--write')){writeFileSync(path,next);writeFileSync('lib/backend/retail-vocabulary-version.ts',binding);}else if(next!==source||readFileSync('lib/backend/retail-vocabulary-version.ts','utf8')!==binding)throw new Error('Retail vocabulary differs: review a new projection format/migration before changing existing deployed semantics');
console.log(JSON.stringify({pass:true,entries:rows.length,mode:process.argv.includes('--write')?'generate-unreleased-migration':'check'}));
