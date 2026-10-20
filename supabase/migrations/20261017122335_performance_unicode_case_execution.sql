-- Equivalent Unicode17 lowercase execution, preserving original data/rules.
-- Generated from reviewed migration9 SHA256 2f6f20219d632ed2eec96e97d6db810109ce35f1d64408f600ceff8a45e6597f.
-- No canonical/projection rows, indexes, model generations, roles or grants change.
-- The immutable function's outputs must remain byte-identical; full-context
-- oracle and the preserved slow canonical-write example are separate gates.
create or replace function chinatech_v2_private.unicode17_lower(value text)returns text
language plpgsql immutable strict set search_path='' as $$
declare prepared text:=translate(value,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz');result text;
begin
 if prepared !~ '[À-ÖØ-ÞĀĂĄĆĈĊČĎĐĒĔĖĘĚĜĞĠĢĤĦĨĪĬĮİĲĴĶĹĻĽĿŁŃŅŇŊŌŎŐŒŔŖŘŚŜŞŠŢŤŦŨŪŬŮŰŲŴŶŸ-ŹŻŽƁ-ƂƄƆ-ƇƉ-ƋƎ-ƑƓ-ƔƖ-ƘƜ-ƝƟ-ƠƢƤƦ-ƧƩƬƮ-ƯƱ-ƳƵƷ-ƸƼǄ-ǅǇ-ǈǊ-ǋǍǏǑǓǕǗǙǛǞǠǢǤǦǨǪǬǮǱ-ǲǴǶ-ǸǺǼǾȀȂȄȆȈȊȌȎȐȒȔȖȘȚȜȞȠȢȤȦȨȪȬȮȰȲȺ-ȻȽ-ȾɁɃ-ɆɈɊɌɎͰͲͶͿΆΈ-ΊΌΎ-ΏΑ-ΡΣ-ΫϏϘϚϜϞϠϢϤϦϨϪϬϮϴϷϹ-ϺϽ-ЯѠѢѤѦѨѪѬѮѰѲѴѶѸѺѼѾҀҊҌҎҐҒҔҖҘҚҜҞҠҢҤҦҨҪҬҮҰҲҴҶҸҺҼҾӀ-ӁӃӅӇӉӋӍӐӒӔӖӘӚӜӞӠӢӤӦӨӪӬӮӰӲӴӶӸӺӼӾԀԂԄԆԈԊԌԎԐԒԔԖԘԚԜԞԠԢԤԦԨԪԬԮԱ-ՖႠ-ჅჇჍᎠ-ᏵᲉᲐ-ᲺᲽ-ᲿḀḂḄḆḈḊḌḎḐḒḔḖḘḚḜḞḠḢḤḦḨḪḬḮḰḲḴḶḸḺḼḾṀṂṄṆṈṊṌṎṐṒṔṖṘṚṜṞṠṢṤṦṨṪṬṮṰṲṴṶṸṺṼṾẀẂẄẆẈẊẌẎẐẒẔẞẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸỺỼỾἈ-ἏἘ-ἝἨ-ἯἸ-ἿὈ-ὍὙὛὝὟὨ-Ὧᾈ-ᾏᾘ-ᾟᾨ-ᾯᾸ-ᾼῈ-ῌῘ-ΊῨ-ῬῸ-ῼΩK-ÅℲⅠ-ⅯↃⒶ-ⓏⰀ-ⰯⱠⱢ-ⱤⱧⱩⱫⱭ-ⱰⱲⱵⱾ-ⲀⲂⲄⲆⲈⲊⲌⲎⲐⲒⲔⲖⲘⲚⲜⲞⲠⲢⲤⲦⲨⲪⲬⲮⲰⲲⲴⲶⲸⲺⲼⲾⳀⳂⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢⳫⳭⳲꙀꙂꙄꙆꙈꙊꙌꙎꙐꙒꙔꙖꙘꙚꙜꙞꙠꙢꙤꙦꙨꙪꙬꚀꚂꚄꚆꚈꚊꚌꚎꚐꚒꚔꚖꚘꚚꜢꜤꜦꜨꜪꜬꜮꜲꜴꜶꜸꜺꜼꜾꝀꝂꝄꝆꝈꝊꝌꝎꝐꝒꝔꝖꝘꝚꝜꝞꝠꝢꝤꝦꝨꝪꝬꝮꝹꝻꝽ-ꝾꞀꞂꞄꞆꞋꞍꞐꞒꞖꞘꞚꞜꞞꞠꞢꞤꞦꞨꞪ-ꞮꞰ-ꞴꞶꞸꞺꞼꞾꟀꟂꟄ-ꟇꟉꟋ-Ꟍ꟎Ꟑ꟒꟔ꟖꟘꟚꟜꟵＡ-Ｚ𐐀-𐐧𐒰-𐓓𐕰-𐕺𐕼-𐖊𐖌-𐖒𐖔-𐖕𐲀-𐲲𐵐-𐵥𑢠-𑢿𖹀-𖹟𖺠-𖺸𞤀-𞤡]' then return prepared;end if;

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
end;
$$;
revoke all on function chinatech_v2_private.unicode17_lower(text)from public,anon,authenticated,chinatech_runtime;
