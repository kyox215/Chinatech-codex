-- Equivalent execution rollback after draining writers. Original Unicode9 data/rules remain.
-- Exact old lower function, original source SHA256 2f6f20219d632ed2eec96e97d6db810109ce35f1d64408f600ceff8a45e6597f.
BEGIN;
create or replace function chinatech_v2_private.unicode17_lower(value text)returns text
language plpgsql immutable strict set search_path='' as $$
declare prepared text:=translate(value,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz');result text;
begin
 if prepared !~ '[À-ÖØ-ÞĀĂĄĆĈĊČĎĐĒĔĖĘĚĜĞĠĢĤĦĨĪĬĮİĲĴĶĹĻĽĿŁŃŅŇŊŌŎŐŒŔŖŘŚŜŞŠŢŤŦŨŪŬŮŰŲŴŶŸ-ŹŻŽƁ-ƂƄƆ-ƇƉ-ƋƎ-ƑƓ-ƔƖ-ƘƜ-ƝƟ-ƠƢƤƦ-ƧƩƬƮ-ƯƱ-ƳƵƷ-ƸƼǄ-ǅǇ-ǈǊ-ǋǍǏǑǓǕǗǙǛǞǠǢǤǦǨǪǬǮǱ-ǲǴǶ-ǸǺǼǾȀȂȄȆȈȊȌȎȐȒȔȖȘȚȜȞȠȢȤȦȨȪȬȮȰȲȺ-ȻȽ-ȾɁɃ-ɆɈɊɌɎͰͲͶͿΆΈ-ΊΌΎ-ΏΑ-ΡΣ-ΫϏϘϚϜϞϠϢϤϦϨϪϬϮϴϷϹ-ϺϽ-ЯѠѢѤѦѨѪѬѮѰѲѴѶѸѺѼѾҀҊҌҎҐҒҔҖҘҚҜҞҠҢҤҦҨҪҬҮҰҲҴҶҸҺҼҾӀ-ӁӃӅӇӉӋӍӐӒӔӖӘӚӜӞӠӢӤӦӨӪӬӮӰӲӴӶӸӺӼӾԀԂԄԆԈԊԌԎԐԒԔԖԘԚԜԞԠԢԤԦԨԪԬԮԱ-ՖႠ-ჅჇჍᎠ-ᏵᲉᲐ-ᲺᲽ-ᲿḀḂḄḆḈḊḌḎḐḒḔḖḘḚḜḞḠḢḤḦḨḪḬḮḰḲḴḶḸḺḼḾṀṂṄṆṈṊṌṎṐṒṔṖṘṚṜṞṠṢṤṦṨṪṬṮṰṲṴṶṸṺṼṾẀẂẄẆẈẊẌẎẐẒẔẞẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸỺỼỾἈ-ἏἘ-ἝἨ-ἯἸ-ἿὈ-ὍὙὛὝὟὨ-Ὧᾈ-ᾏᾘ-ᾟᾨ-ᾯᾸ-ᾼῈ-ῌῘ-ΊῨ-ῬῸ-ῼΩK-ÅℲⅠ-ⅯↃⒶ-ⓏⰀ-ⰯⱠⱢ-ⱤⱧⱩⱫⱭ-ⱰⱲⱵⱾ-ⲀⲂⲄⲆⲈⲊⲌⲎⲐⲒⲔⲖⲘⲚⲜⲞⲠⲢⲤⲦⲨⲪⲬⲮⲰⲲⲴⲶⲸⲺⲼⲾⳀⳂⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢⳫⳭⳲꙀꙂꙄꙆꙈꙊꙌꙎꙐꙒꙔꙖꙘꙚꙜꙞꙠꙢꙤꙦꙨꙪꙬꚀꚂꚄꚆꚈꚊꚌꚎꚐꚒꚔꚖꚘꚚꜢꜤꜦꜨꜪꜬꜮꜲꜴꜶꜸꜺꜼꜾꝀꝂꝄꝆꝈꝊꝌꝎꝐꝒꝔꝖꝘꝚꝜꝞꝠꝢꝤꝦꝨꝪꝬꝮꝹꝻꝽ-ꝾꞀꞂꞄꞆꞋꞍꞐꞒꞖꞘꞚꞜꞞꞠꞢꞤꞦꞨꞪ-ꞮꞰ-ꞴꞶꞸꞺꞼꞾꟀꟂꟄ-ꟇꟉꟋ-Ꟍ꟎Ꟑ꟒꟔ꟖꟘꟚꟜꟵＡ-Ｚ𐐀-𐐧𐒰-𐓓𐕰-𐕺𐕼-𐖊𐖌-𐖒𐖔-𐖕𐲀-𐲲𐵐-𐵥𑢠-𑢿𖹀-𖹟𖺠-𖺸𞤀-𞤡]' then return prepared;end if;
 with chars as materialized(
  select c,n,coalesce(m.cased,false)cased,coalesce(m.ignorable,false)ignorable,coalesce(m.lower_value,c)lowered
  from regexp_split_to_table(prepared,'')with ordinality t(c,n)left join chinatech_v2_private.unicode17_scalars m on m.codepoint=ascii(c)where c<>''
 ),context as(
  select *,max(n)filter(where not ignorable)over(order by n rows between unbounded preceding and 1 preceding)before,
  min(n)filter(where not ignorable)over(order by n rows between 1 following and unbounded following)after from chars
 )select string_agg(case when x.c='Σ'and coalesce(b.cased,false)and not coalesce(a.cased,false)then 'ς'else x.lowered end,''order by x.n)into result
 from context x left join chars b on b.n=x.before left join chars a on a.n=x.after;
 return coalesce(result,'');
end;
$$;
revoke all on function chinatech_v2_private.unicode17_lower(text)from public,anon,authenticated,chinatech_runtime;
COMMIT;
