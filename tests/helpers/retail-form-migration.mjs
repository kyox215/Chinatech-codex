import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
/** Exact local test setup. Caller owns its transaction/isolated target guard. */
export async function reviewedRetailFormMigrations(tx){
 const files=['supabase/migrations/20261017060716_performance_retail_form_reads.sql','supabase/migrations/20261017063155_performance_unicode17_compatibility.sql'],bodies=new Map(),sha256={};
 for(let index=0;index<files.length;index++){
  const file=files[index],ddl=readFileSync(file,'utf8');sha256[file]=createHash('sha256').update(ddl).digest('hex');
  const[installed]=await tx`select to_regclass(${index?'chinatech_v2_private.unicode17_scalars':'chinatech_v2_private.retail_form_values'}) present`;
  if(!installed.present)await tx.unsafe(ddl);
  for(const[,name,body]of ddl.matchAll(/create (?:or replace )?function chinatech_v2_private\.(\w+)\([\s\S]*?as \$\$([\s\S]*?)\$\$/g))bodies.set(name,body);
 }
 assert.equal(bodies.size,9);
 for(const[name,body]of bodies){const[row]=await tx`select prosrc from pg_proc where pronamespace='chinatech_v2_private'::regnamespace and proname=${name}`;assert.equal(row?.prosrc.trim(),body.trim(),'Exact latest reviewed body '+name);}
 return{sha256,functions:bodies.size,condition:'Exact additive migrations8+9, either already installed or inside caller rollback transaction; historical8 not rewritten'};
}
