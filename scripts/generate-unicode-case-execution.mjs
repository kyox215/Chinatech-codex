// Preserve Unicode17 data/semantics from migration9; only change execution shape.
import assert from'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
assert(process.argv.slice(2).every(argument=>argument==='--check'),'Only the optional --check argument is supported');
const prior='supabase/migrations/20261017063155_performance_unicode17_compatibility.sql',target='supabase/migrations/20261017122335_performance_unicode_case_execution.sql',input=readFileSync(prior,'utf8');
assert.equal(createHash('sha256').update(input).digest('hex'),'2f6f20219d632ed2eec96e97d6db810109ce35f1d64408f600ceff8a45e6597f','Reviewed migration9 must remain unchanged before deriving execution');
const match=/create function chinatech_v2_private\.unicode17_lower\(value text\)returns text\n([\s\S]*?)\n\$\$;/.exec(input);assert(match);const header=match[1].slice(0,match[1].indexOf(' with chars as materialized('));assert(header.includes("if prepared !~")&&header.includes('then return prepared;end if;'));
const body=header+`
 -- Most mapped strings have no context-sensitive Sigma. A single character
 -- lookup/ordered aggregation avoids building any context windows for them.
 if strpos(prepared,'Σ')=0 then
  select string_agg(coalesce(m.lower_value,c),''order by n)into result
  from regexp_split_to_table(prepared,'')with ordinality t(c,n)left join chinatech_v2_private.unicode17_scalars m on m.codepoint=ascii(c)where c<>'';
  return coalesce(result,'');
 end if;
 -- Prefix aggregates in both directions identify the nearest nonignorable
 -- character's Cased property without two quadratic materialized self-joins.
 with chars as materialized(
  select c,n,coalesce(m.cased,false)cased,coalesce(m.ignorable,false)ignorable,coalesce(m.lower_value,c)lowered
  from regexp_split_to_table(prepared,'')with ordinality t(c,n)left join chinatech_v2_private.unicode17_scalars m on m.codepoint=ascii(c)where c<>''
 ),preceding as(
  select *,max(n)filter(where not ignorable)over(order by n rows between unbounded preceding and 1 preceding)before_any,
  max(n)filter(where not ignorable and cased)over(order by n rows between unbounded preceding and 1 preceding)before_cased from chars
 ),context as(
  select *,min(n)filter(where not ignorable)over(order by n desc rows between unbounded preceding and 1 preceding)after_any,
  min(n)filter(where not ignorable and cased)over(order by n desc rows between unbounded preceding and 1 preceding)after_cased from preceding
 )select string_agg(case when c='Σ'and before_any is not null and before_any=before_cased and(after_any is null or after_any is distinct from after_cased)then 'ς'else lowered end,''order by n)into result from context;
 return coalesce(result,'');
end;`;
const output=`-- Equivalent Unicode17 lowercase execution, preserving original data/rules.
-- Generated from reviewed migration9 SHA256 ${createHash('sha256').update(input).digest('hex')}.
-- No canonical/projection rows, indexes, model generations, roles or grants change.
-- The immutable function's outputs must remain byte-identical; full-context
-- oracle and the preserved slow canonical-write example are separate gates.
create or replace function chinatech_v2_private.unicode17_lower(value text)returns text
${body}
$$;
revoke all on function chinatech_v2_private.unicode17_lower(text)from public,anon,authenticated,chinatech_runtime;
`;
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),output);else writeFileSync(target,output);console.log(JSON.stringify({target,sha256:createHash('sha256').update(output).digest('hex'),equivalentAlgorithmOnly:true}));
