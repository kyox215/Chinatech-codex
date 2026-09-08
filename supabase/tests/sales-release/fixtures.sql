-- Synthetic customers/devices only; UUIDs deliberately unrelated to live stores.
insert into auth.users(id) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,6) n;
insert into public.staff_profiles(id,email,display_name,role,status)
select id,'synthetic-'||row_number() over()||'@example.invalid','Synthetic '||row_number() over(),
  case right(id::text,1) when '1' then 'owner'::public.staff_role when '2' then 'manager'::public.staff_role
  when '3' then 'sales'::public.staff_role when '4' then 'technician'::public.staff_role else 'viewer'::public.staff_role end,'active'
from auth.users;
insert into public.stores(id,store_code,name,slug) values
('10000000-0000-4000-8000-000000000001','SYN1','Synthetic Store One','synthetic-one'),
('10000000-0000-4000-8000-000000000002','SYN2','Synthetic Store Two','synthetic-two');
insert into public.store_memberships(store_id,user_id,email,display_name,role,status)
select '10000000-0000-4000-8000-000000000001',id,email,display_name,role,
  case when right(id::text,1)='6' then 'inactive'::public.store_membership_status else 'active'::public.store_membership_status end from public.staff_profiles;
insert into public.customers(id,store_id,name,phone_e164) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Synthetic Customer','+39000000001'),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Other Synthetic Customer','+39000000002');
insert into public.store_settings(id,store_id,store_name,store_address,store_phone,print_footer,message_signature) values('synthetic-settings','10000000-0000-4000-8000-000000000001','Synthetic Store One','Synthetic Road 1','+39000000001','Synthetic footer','Synthetic Store One');
create function public.synthetic_item_id(n integer) returns uuid language sql immutable as $$ select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
create function public.synthetic_seed_item(n integer,category text default 'computer') returns void language plpgsql as $$
declare v_id uuid:=public.synthetic_item_id(n);v_unit uuid:=('60000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  v_variant uuid:=('70000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;v_catalog uuid:=('80000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
begin
  insert into public.inventory_product_catalog_items(id,store_id) values(v_catalog,'10000000-0000-4000-8000-000000000001');
  insert into public.inventory_product_variants(id,store_id,catalog_item_id,normalized_key)
    values(v_variant,'10000000-0000-4000-8000-000000000001',v_catalog,'synthetic-variant-'||n);
  insert into public.inventory_items(id,store_id,public_no,brand,model,category,status,source_type,serial_or_imei,
    imei_check_status,activation_lock_status,data_wipe_status,functional_grade,cosmetic_grade,list_price,buyback_price,
    legacy_payload,created_by,updated_by)
  values(v_id,'10000000-0000-4000-8000-000000000001','SYN-'||n,'Synthetic','Device '||n,category,'listed','manual_stock','SYN-SERIAL-'||n,
    'pass','pass','pass','passed','good',100,50,
    jsonb_build_object('inventory_v2_intake',true,'inventory_v2_unit_id',v_unit),
    '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
  insert into public.inventory_stock_units(id,store_id,variant_id,legacy_inventory_item_id,source_type,status,cost_amount,list_price,created_by,updated_by)
    values(v_unit,'10000000-0000-4000-8000-000000000001',v_variant,v_id,'manual_stock','listed',50,100,
      '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
  insert into public.inventory_stock_unit_identifiers(store_id,stock_unit_id,kind,display_value,normalized_value,source,is_primary,created_by)
    values('10000000-0000-4000-8000-000000000001',v_unit,'serial','SYN-SERIAL-'||n,'SYNSERIAL'||n,'manual',true,'20000000-0000-4000-8000-000000000001');
end;
$$;
select public.synthetic_seed_item(n) from generate_series(1,30)n;
create function public.synthetic_sales_payload(n integer,command text default 'sale.create',amount bigint default 3000,deliver boolean default false)
returns jsonb language plpgsql as $$
declare i public.inventory_items%rowtype;u public.inventory_stock_units%rowtype;o public.inventory_sale_orders%rowtype;p jsonb;
begin
  select * into i from public.inventory_items where id=public.synthetic_item_id(n);
  select * into u from public.inventory_stock_units where legacy_inventory_item_id=i.id;
  select * into o from public.inventory_sale_orders where inventory_item_id=i.id;
  p:=jsonb_build_object('inventory_item_id',i.id,'stock_unit_id',u.id,'expected_item_updated_at',i.updated_at,'expected_unit_version',u.version);
  if command='sale.create' then p:=p||jsonb_build_object('customer_id','30000000-0000-4000-8000-000000000001','price_cents',10000,
    'agreed_at','2024-02-28T10:00:00Z','warranty_months',24,'used_device',true,'shortening_agreed',false,'terms_version','inventory-sales-2026-09-v1');
  else p:=p||jsonb_build_object('sale_order_id',o.id,'expected_order_version',o.version); end if;
  if command<>'pickup.confirm' then p:=p||jsonb_build_object('payment',jsonb_build_object('amount_cents',amount,'method','cash','occurred_at','2024-02-29T10:00:00Z'),'deliver',deliver); end if;
  if command='pickup.confirm' or deliver then p:=p||jsonb_build_object('delivered_at','2024-02-29T11:00:00Z'); end if;
  return p;
end;
$$;
-- This wrapper preserves the service_role authorization path while keeping fixture SQL concise.
create function public.synthetic_sales_call(n integer,command text default 'sale.create',amount bigint default 3000,deliver boolean default false)
returns jsonb language sql as $$ select public.repairdesk_inventory_sales_command('10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',command,gen_random_uuid(),public.synthetic_sales_payload(n,command,amount,deliver)); $$;
create table public.synthetic_requests(name text primary key,key uuid,payload jsonb,result jsonb);
