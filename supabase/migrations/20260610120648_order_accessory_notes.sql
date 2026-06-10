alter table public.repair_orders
  add column if not exists accessory_notes text;

with classified as (
  select
    id,
    internal_tag,
    accessory_notes,
    case
      when internal_tag ~* '\mvip\M' then 'VIP'
      when internal_tag ~* '(加急|急件|优先|urgent|urgente|priority)' then '加急'
      when internal_tag ~* '(sim|卡托|卡槽|取卡针|卡针|手机壳|保护壳|壳|充电器|充电头|数据线|充电线|耳机|盒子|包装|保护膜|scheda|caricatore|cavo|cover|custodia|accessori)' then null
      else internal_tag
    end as next_internal_tag,
    case
      when internal_tag ~* '(sim|卡托|卡槽|取卡针|卡针|手机壳|保护壳|壳|充电器|充电头|数据线|充电线|耳机|盒子|包装|保护膜|scheda|caricatore|cavo|cover|custodia|accessori)'
        then concat_ws('；', nullif(btrim(accessory_notes), ''), nullif(btrim(internal_tag), ''))
      else accessory_notes
    end as next_accessory_notes
  from public.repair_orders
  where nullif(btrim(internal_tag), '') is not null
)
update public.repair_orders ro
set
  internal_tag = nullif(btrim(classified.next_internal_tag), ''),
  accessory_notes = nullif(btrim(classified.next_accessory_notes), ''),
  updated_at = now()
from classified
where ro.id = classified.id
  and (
    ro.internal_tag is distinct from nullif(btrim(classified.next_internal_tag), '')
    or ro.accessory_notes is distinct from nullif(btrim(classified.next_accessory_notes), '')
  );
