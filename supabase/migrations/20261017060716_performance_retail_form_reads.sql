-- Narrow, same-transaction recorded suggestions for new retail drafts.
-- Canonical records, prices, photographs and command authorization are unchanged.
-- BEGIN GENERATED RETAIL FORM RULES
-- Exact JS Unicode 17.0; first-party catalog source binding 3552462226145675af3bd5dade51cbdb99ff597ca8e45f2dd22f10d75eea6672
create function chinatech_v2_private.retail_form_catalog_key(value text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(replace(lower(normalize(coalesce(value,''),NFKC) collate chinatech_v2_private.retail_list_ties),'+','plus'),'[^0-9A-Za-zª²-³µ¹-º¼-¾À-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶ-ͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙՠ-ֈא-תׯ-ײؠ-ي٠-٩ٮ-ٯٱ-ۓەۥ-ۦۮ-ۼۿܐܒ-ܯݍ-ޥޱ߀-ߪߴ-ߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࡠ-ࡪࡰ-ࢇࢉ-࢏ࢠ-ࣉऄ-हऽॐक़-ॡ०-९ॱ-ঀঅ-ঌএ-ঐও-নপ-রলশ-হঽৎড়-ঢ়য়-ৡ০-ৱ৴-৹ৼਅ-ਊਏ-ਐਓ-ਨਪ-ਰਲ-ਲ਼ਵ-ਸ਼ਸ-ਹਖ਼-ੜਫ਼੦-੯ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલ-ળવ-હઽૐૠ-ૡ૦-૯ૹଅ-ଌଏ-ଐଓ-ନପ-ରଲ-ଳଵ-ହଽଡ଼-ଢ଼ୟ-ୡ୦-୯ୱ-୷ஃஅ-ஊஎ-ஐஒ-கங-சஜஞ-டண-தந-பம-ஹௐ௦-௲అ-ఌఎ-ఐఒ-నప-హఽౘ-ౚ౜-ౝౠ-ౡ౦-౯౸-౾ಀಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ೜-ೞೠ-ೡ೦-೯ೱ-ೲഄ-ഌഎ-ഐഒ-ഺഽൎൔ-ൖ൘-ൡ൦-൸ൺ-ൿඅ-ඖක-නඳ-රලව-ෆ෦-෯ก-ะา-ำเ-ๆ๐-๙ກ-ຂຄຆ-ຊຌ-ຣລວ-ະາ-ຳຽເ-ໄໆ໐-໙ໜ-ໟༀ༠-༳ཀ-ཇཉ-ཬྈ-ྌက-ဪဿ-၉ၐ-ၕၚ-ၝၡၥ-ၦၮ-ၰၵ-ႁႎ႐-႙Ⴀ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፩-፼ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜑᜟ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜ០-៩៰-៹᠐-᠙ᠠ-ᡸᢀ-ᢄᢇ-ᢨᢪᢰ-ᣵᤀ-ᤞ᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧚ᨀ-ᨖᨠ-ᩔ᪀-᪉᪐-᪙ᪧᬅ-ᬳᭅ-ᭌ᭐-᭙ᮃ-ᮠᮮ-ᯥᰀ-ᰣ᱀-᱉ᱍ-ᱽᲀ-ᲊᲐ-ᲺᲽ-Ჿᳩ-ᳬᳮ-ᳳᳵ-ᳶᳺᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ⁰-ⁱ⁴-⁹ⁿ-₉ₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎ⅐-↉①-⒛⓪-⓿❶-➓Ⰰ-ⳤⳫ-ⳮⳲ-ⳳ⳽ⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄯㄱ-ㆎ㆒-㆕ㆠ-ㆿㇰ-ㇿ㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿㐀-䶿一-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-Ƛ꟱-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢ꠰-꠵ꡀ-ꡳꢂ-ꢳ꣐-꣙ꣲ-ꣷꣻꣽ-ꣾ꤀-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏ-꧙ꧠ-ꧤꧦ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋ꩐-꩙ꩠ-ꩶꩺꩾ-ꪯꪱꪵ-ꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭩꭰ-ꯢ꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּ-סּףּ-פּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ𐀀-𐀋𐀍-𐀦𐀨-𐀺𐀼-𐀽𐀿-𐁍𐁐-𐁝𐂀-𐃺𐄇-𐄳𐅀-𐅸𐆊-𐆋𐊀-𐊜𐊠-𐋐𐋡-𐋻𐌀-𐌣𐌭-𐍊𐍐-𐍵𐎀-𐎝𐎠-𐏃𐏈-𐏏𐏑-𐏕𐐀-𐒝𐒠-𐒩𐒰-𐓓𐓘-𐓻𐔀-𐔧𐔰-𐕣𐕰-𐕺𐕼-𐖊𐖌-𐖒𐖔-𐖕𐖗-𐖡𐖣-𐖱𐖳-𐖹𐖻-𐖼𐗀-𐗳𐘀-𐜶𐝀-𐝕𐝠-𐝧𐞀-𐞅𐞇-𐞰𐞲-𐞺𐠀-𐠅𐠈𐠊-𐠵𐠷-𐠸𐠼𐠿-𐡕𐡘-𐡶𐡹-𐢞𐢧-𐢯𐣠-𐣲𐣴-𐣵𐣻-𐤛𐤠-𐤹𐥀-𐥙𐦀-𐦷𐦼-𐧏𐧒-𐨀𐨐-𐨓𐨕-𐨗𐨙-𐨵𐩀-𐩈𐩠-𐩾𐪀-𐪟𐫀-𐫇𐫉-𐫤𐫫-𐫯𐬀-𐬵𐭀-𐭕𐭘-𐭲𐭸-𐮑𐮩-𐮯𐰀-𐱈𐲀-𐲲𐳀-𐳲𐳺-𐴣𐴰-𐴹𐵀-𐵥𐵯-𐶅𐹠-𐹾𐺀-𐺩𐺰-𐺱𐻂-𐻇𐼀-𐼧𐼰-𐽅𐽑-𐽔𐽰-𐾁𐾰-𐿋𐿠-𐿶𑀃-𑀷𑁒-𑁯𑁱-𑁲𑁵𑂃-𑂯𑃐-𑃨𑃰-𑃹𑄃-𑄦𑄶-𑄿𑅄𑅇𑅐-𑅲𑅶𑆃-𑆲𑇁-𑇄𑇐-𑇚𑇜𑇡-𑇴𑈀-𑈑𑈓-𑈫𑈿-𑉀𑊀-𑊆𑊈𑊊-𑊍𑊏-𑊝𑊟-𑊨𑊰-𑋞𑋰-𑋹𑌅-𑌌𑌏-𑌐𑌓-𑌨𑌪-𑌰𑌲-𑌳𑌵-𑌹𑌽𑍐𑍝-𑍡𑎀-𑎉𑎋𑎎𑎐-𑎵𑎷𑏑𑏓𑐀-𑐴𑑇-𑑊𑑐-𑑙𑑟-𑑡𑒀-𑒯𑓄-𑓅𑓇𑓐-𑓙𑖀-𑖮𑗘-𑗛𑘀-𑘯𑙄𑙐-𑙙𑚀-𑚪𑚸𑛀-𑛉𑛐-𑛣𑜀-𑜚𑜰-𑜻𑝀-𑝆𑠀-𑠫𑢠-𑣲𑣿-𑤆𑤉𑤌-𑤓𑤕-𑤖𑤘-𑤯𑤿𑥁𑥐-𑥙𑦠-𑦧𑦪-𑧐𑧡𑧣𑨀𑨋-𑨲𑨺𑩐𑩜-𑪉𑪝𑪰-𑫸𑯀-𑯠𑯰-𑯹𑰀-𑰈𑰊-𑰮𑱀𑱐-𑱬𑱲-𑲏𑴀-𑴆𑴈-𑴉𑴋-𑴰𑵆𑵐-𑵙𑵠-𑵥𑵧-𑵨𑵪-𑶉𑶘𑶠-𑶩𑶰-𑷛𑷠-𑷩𑻠-𑻲𑼂𑼄-𑼐𑼒-𑼳𑽐-𑽙𑾰𑿀-𑿔𒀀-𒎙𒐀-𒑮𒒀-𒕃𒾐-𒿰𓀀-𓐯𓑁-𓑆𓑠-𔏺𔐀-𔙆𖄀-𖄝𖄰-𖄹𖠀-𖨸𖩀-𖩞𖩠-𖩩𖩰-𖪾𖫀-𖫉𖫐-𖫭𖬀-𖬯𖭀-𖭃𖭐-𖭙𖭛-𖭡𖭣-𖭷𖭽-𖮏𖵀-𖵬𖵰-𖵹𖹀-𖺖𖺠-𖺸𖺻-𖻓𖼀-𖽊𖽐𖾓-𖾟𖿠-𖿡𖿣𖿲-𖿶𗀀-𘳕𘳿-𘴞𘶀-𘷲𚿰-𚿳𚿵-𚿻𚿽-𚿾𛀀-𛄢𛄲𛅐-𛅒𛅕𛅤-𛅧𛅰-𛋻𛰀-𛱪𛱰-𛱼𛲀-𛲈𛲐-𛲙𜳰-𜳹𝋀-𝋓𝋠-𝋳𝍠-𝍸𝐀-𝑔𝑖-𝒜𝒞-𝒟𝒢𝒥-𝒦𝒩-𝒬𝒮-𝒹𝒻𝒽-𝓃𝓅-𝔅𝔇-𝔊𝔍-𝔔𝔖-𝔜𝔞-𝔹𝔻-𝔾𝕀-𝕄𝕆𝕊-𝕐𝕒-𝚥𝚨-𝛀𝛂-𝛚𝛜-𝛺𝛼-𝜔𝜖-𝜴𝜶-𝝎𝝐-𝝮𝝰-𝞈𝞊-𝞨𝞪-𝟂𝟄-𝟋𝟎-𝟿𝼀-𝼞𝼥-𝼪𞀰-𞁭𞄀-𞄬𞄷-𞄽𞅀-𞅉𞅎𞊐-𞊭𞋀-𞋫𞋰-𞋹𞓐-𞓫𞓰-𞓹𞗐-𞗭𞗰-𞗺𞛀-𞛞𞛠-𞛢𞛤-𞛥𞛧-𞛭𞛰-𞛴𞛾-𞛿𞟠-𞟦𞟨-𞟫𞟭-𞟮𞟰-𞟾𞠀-𞣄𞣇-𞣏𞤀-𞥃𞥋𞥐-𞥙𞱱-𞲫𞲭-𞲯𞲱-𞲴𞴁-𞴭𞴯-𞴽𞸀-𞸃𞸅-𞸟𞸡-𞸢𞸤𞸧𞸩-𞸲𞸴-𞸷𞸹𞸻𞹂𞹇𞹉𞹋𞹍-𞹏𞹑-𞹒𞹔𞹗𞹙𞹛𞹝𞹟𞹡-𞹢𞹤𞹧-𞹪𞹬-𞹲𞹴-𞹷𞹹-𞹼𞹾𞺀-𞺉𞺋-𞺛𞺡-𞺣𞺥-𞺩𞺫-𞺻🄀-🄌🯰-🯹𠀀-𪛟𪜀-𫠝𫠠-𬺭𬺰-𮯠𮯰-𮹝丽-𪘀𰀀-𱍊𱍐-𳑹]','','g');
$$;
create function chinatech_v2_private.retail_form_brand(value text) returns text language sql immutable set search_path='' as $$
 select case chinatech_v2_private.retail_form_catalog_key(value) when 'apple' then 'Apple' when '苹果' then 'Apple' when 'samsung' then 'Samsung' when '三星' then 'Samsung' when 'xiaomi' then 'Xiaomi' when '小米' then 'Xiaomi' when 'mi' then 'Xiaomi' when 'redmi' then 'Redmi' when '红米' then 'Redmi' when 'poco' then 'POCO' when 'pocophone' then 'POCO' when 'huawei' then 'Huawei' when '华为' then 'Huawei' when 'honor' then 'Honor' when '荣耀' then 'Honor' when 'oppo' then 'OPPO' when '欧珀' then 'OPPO' when 'realme' then 'realme' when '真我' then 'realme' when 'vivo' then 'vivo' when 'oneplus' then 'OnePlus' when '一加' then 'OnePlus' when 'google' then 'Google' when '谷歌' then 'Google' when 'motorola' then 'Motorola' when '摩托罗拉' then 'Motorola' when 'lenovo' then 'Lenovo' when '联想' then 'Lenovo' when 'hp' then 'HP' when '惠普' then 'HP' when 'hewlettpackard' then 'HP' when 'dell' then 'Dell' when '戴尔' then 'Dell' when 'asus' then 'ASUS' when '华硕' then 'ASUS' when 'acer' then 'Acer' when '宏碁' then 'Acer' when 'msi' then 'MSI' when '微星' then 'MSI' when 'microsoft' then 'Microsoft' when '微软' then 'Microsoft' when 'sony' then 'Sony' when '索尼' then 'Sony' when 'nintendo' then 'Nintendo' when '任天堂' then 'Nintendo' when 'nokia' then 'Nokia' when '诺基亚' then 'Nokia' when 'tcl' then 'TCL' when 'zte' then 'ZTE' when '中兴' then 'ZTE' when 'lg' then 'LG' when '乐金' then 'LG' when 'dynabook' then 'Dynabook' when 'gigabyte' then 'Gigabyte' when '技嘉' then 'Gigabyte' else chinatech_v2_private.directory_trim(coalesce(value,'')) end;
$$;
-- END GENERATED RETAIL FORM RULES
create function chinatech_v2_private.retail_form_value_key(value text) returns text
language sql immutable set search_path='' as $$
 select lower(regexp_replace(chinatech_v2_private.directory_trim(normalize(coalesce(value,''),NFKC)),('['||U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'||']+'),' ','g') collate chinatech_v2_private.retail_list_ties);
$$;
create table chinatech_v2_private.retail_form_models(
 store_id uuid primary key references chinatech_v2.stores(id) on delete cascade,
 format_version integer not null default 1 check(format_version=1),
 rules_hash text not null default '3552462226145675af3bd5dade51cbdb99ff597ca8e45f2dd22f10d75eea6672',generation bigint not null default 0,
 ready boolean not null default false,backfill_cursor text,verified_at timestamptz
);
create table chinatech_v2_private.retail_form_values(
 store_id uuid not null references chinatech_v2.stores(id) on delete cascade,
 unit_id text not null,field text not null check(field in('brand','model','cpu','gpu','keyboard','edition')),
 category text not null,brand_key text not null,value text not null,option_key text not null,
 value_key text not null,catalog_key text not null,search text not null,primary key(store_id,unit_id,field)
);
create index retail_form_lookup on chinatech_v2_private.retail_form_values(store_id,field,category,brand_key,unit_id);
create index retail_form_exact on chinatech_v2_private.retail_form_values(store_id,field,category,option_key,unit_id);
alter table chinatech_v2_private.retail_form_models enable row level security;
alter table chinatech_v2_private.retail_form_models force row level security;
alter table chinatech_v2_private.retail_form_values enable row level security;
alter table chinatech_v2_private.retail_form_values force row level security;
revoke all on chinatech_v2_private.retail_form_models,chinatech_v2_private.retail_form_values from public,anon,authenticated,chinatech_runtime;
grant select on chinatech_v2_private.retail_form_models,chinatech_v2_private.retail_form_values to chinatech_runtime;
create policy retail_form_model_scope on chinatech_v2_private.retail_form_models for select to chinatech_runtime using(
 store_id::text=(select current_setting('app.store_id',true)) and(select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'retail.view'))
);
create policy retail_form_value_scope on chinatech_v2_private.retail_form_values for select to chinatech_runtime using(
 store_id::text=(select current_setting('app.store_id',true)) and(select chinatech_v2_private.member_access(nullif(current_setting('app.store_id',true),'')::uuid,'retail.view'))
);
create function chinatech_v2_private.project_retail_form(target_store uuid,target_id text,document jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare kind text;raw text;value text;
begin
 delete from chinatech_v2_private.retail_form_values where store_id=target_store and unit_id=target_id;
 if document is null then return;end if;
 foreach kind in array array['brand','model','cpu','gpu','keyboard','edition'] loop
  raw:=coalesce(document->>kind,'');value:=case when kind in('brand','model')then raw else chinatech_v2_private.directory_trim(raw)end;
  if chinatech_v2_private.directory_trim(raw)='' then continue;end if;
  if kind not in('brand','model') and(octet_length(chinatech_v2_private.retail_list_utf16(raw))>10000 or raw~U&'[\0001-\001F\007F]')then continue;end if;
  insert into chinatech_v2_private.retail_form_values(store_id,unit_id,field,category,brand_key,value,option_key,value_key,catalog_key,search)
  values(target_store,target_id,kind,document->>'category',chinatech_v2_private.retail_form_brand(document->>'brand'),value,encode(sha256(convert_to(value,'UTF8')),'hex'),chinatech_v2_private.retail_form_value_key(value),chinatech_v2_private.retail_form_catalog_key(value),lower(value collate chinatech_v2_private.retail_list_ties));
 end loop;
end;
$$;
create function chinatech_v2_private.retail_form_sync()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or tg_op='UPDATE' and(old.store_id<>new.store_id or old.id<>new.id)then
  perform chinatech_v2_private.project_retail_form(old.store_id,old.id,null);
  update chinatech_v2_private.retail_form_models set generation=generation+1 where store_id=old.store_id;
 end if;
 if tg_op<>'DELETE'then
  insert into chinatech_v2_private.retail_form_models(store_id)values(new.store_id)on conflict do nothing;
  perform chinatech_v2_private.project_retail_form(new.store_id,new.id,new.data);
  update chinatech_v2_private.retail_form_models set generation=generation+1 where store_id=new.store_id;
 end if;
 return null;
end;
$$;
create function chinatech_v2_private.retail_form_store_init()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into chinatech_v2_private.retail_form_models(store_id,ready,verified_at)values(new.id,true,now())on conflict do nothing;return null;
end;
$$;
revoke all on function chinatech_v2_private.retail_form_catalog_key(text),chinatech_v2_private.retail_form_brand(text),chinatech_v2_private.retail_form_value_key(text),chinatech_v2_private.project_retail_form(uuid,text,jsonb),chinatech_v2_private.retail_form_sync(),chinatech_v2_private.retail_form_store_init()from public,anon,authenticated,chinatech_runtime;
create trigger retail_form_unit_sync after insert or update or delete on chinatech_v2_private.retail_units for each row execute function chinatech_v2_private.retail_form_sync();
create trigger retail_form_store_init after insert on chinatech_v2.stores for each row execute function chinatech_v2_private.retail_form_store_init();
insert into chinatech_v2_private.retail_form_models(store_id)select id from chinatech_v2.stores on conflict do nothing;
