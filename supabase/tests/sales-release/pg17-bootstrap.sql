-- Disposable PG17 synthetic bootstrap. NEVER run against a linked or production database.
-- Base columns/constraints: task live-schema-metadata.json (222 columns / 99 constraints, no rows).
-- External auth/catalog/order/supplier dependencies below are minimal synthetic stubs.
-- Numeric typmods were not captured in metadata; transactions are independently checked in cents.
\set ON_ERROR_STOP on
create schema auth;
create schema private;
create extension if not exists pgtap;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create table auth.users(id uuid primary key);
create table public.repair_orders(id uuid primary key);
create table public.suppliers(id uuid primary key,store_id uuid,unique(id,store_id));
create table public.inventory_product_catalog_items(id uuid primary key,store_id uuid,unique(id,store_id));
create sequence public.inventory_item_public_no_seq;


-- Applied source: 20260517143000_repairdesk_schema.sql
create type public.message_channel as enum ('whatsapp', 'sms');

-- Applied source: 20260610234427_buyback_resale_inventory.sql
create type public.staff_role as enum ('owner', 'manager', 'technician', 'sales', 'viewer');

-- Applied source: 20260610234427_buyback_resale_inventory.sql
create type public.staff_status as enum ('active', 'inactive');

-- Applied source: 20260610234427_buyback_resale_inventory.sql
create type public.inventory_item_status as enum (
    'intake',
    'evaluating',
    'offer_made',
    'purchased',
    'data_wipe',
    'refurbishing',
    'ready_for_sale',
    'listed',
    'reserved',
    'sold',
    'cancelled',
    'returned',
    'recycled'
  );

-- Applied source: 20260611002831_enterprise_multi_store_foundation.sql
create type public.store_status as enum ('active', 'suspended', 'deleted');

-- Applied source: 20260611002831_enterprise_multi_store_foundation.sql
create type public.store_plan as enum ('starter', 'pro', 'enterprise');

-- Applied source: 20260611002831_enterprise_multi_store_foundation.sql
create type public.store_membership_status as enum ('active', 'invited', 'inactive');

create table public.audit_logs (
  id text not null,
  actor_id uuid,
  actor_email text,
  actor_name text default 'system'::text not null,
  store_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

create table public.customers (
  id uuid default gen_random_uuid() not null,
  store_id uuid not null,
  name text,
  phone_raw text,
  phone_e164 text not null,
  consent_required_notify bool default true not null,
  consent_marketing bool default false not null,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  email text,
  preferred_channel message_channel default 'whatsapp'::message_channel not null,
  language text default 'it'::text not null,
  last_contacted_at timestamptz,
  marketing_notes text,
  blacklisted_at timestamptz,
  contact_phones text[] default '{}'::text[] not null,
  consent_sms bool default true not null
);

create table public.inventory_events (
  id uuid default gen_random_uuid() not null,
  store_id uuid not null,
  inventory_item_id uuid not null,
  event_type text not null,
  payload jsonb default '{}'::jsonb not null,
  operator_name text,
  created_at timestamptz default now() not null,
  item_id uuid,
  from_status text,
  to_status text,
  operator_user_id uuid,
  operator_email text
);

create table public.inventory_items (
  id uuid default gen_random_uuid() not null,
  store_id uuid not null,
  public_no text default ('I'::text || lpad((nextval('inventory_item_public_no_seq'::regclass))::text, 6, '0'::text)) not null,
  product_channel text default 'trade_in'::text not null,
  lifecycle_status text default 'draft'::text not null,
  brand text not null,
  model text not null,
  imei_or_serial text,
  purchase_cost numeric,
  list_price numeric,
  sold_price numeric,
  seller_customer_id uuid,
  buyer_customer_id uuid,
  source_repair_order_id uuid,
  qa_report jsonb default '{}'::jsonb not null,
  qa_completed_at timestamptz,
  listing_hold_until timestamptz,
  imei_check_done bool default false not null,
  imei_check_note text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  status text default 'intake'::text not null,
  source_type text default 'buyback'::text not null,
  source_ref text,
  legacy_source text,
  customer_id uuid,
  category text default 'phone'::text not null,
  color text,
  storage_capacity text,
  serial_or_imei text,
  imei_check_status text default 'unchecked'::text not null,
  activation_lock_status text default 'unchecked'::text not null,
  data_wipe_status text default 'unchecked'::text not null,
  cosmetic_grade text default 'unknown'::text not null,
  functional_grade text default 'untested'::text not null,
  battery_health numeric,
  buyback_price numeric default 0 not null,
  sale_price numeric default 0 not null,
  deposit_amount numeric default 0 not null,
  repair_cost_amount numeric default 0 not null,
  fees_amount numeric default 0 not null,
  currency_code text default 'EUR'::text not null,
  payment_method text,
  sale_channel text,
  warranty_months int4 default 12 not null,
  warranty_until timestamptz,
  purchased_at timestamptz,
  listed_at timestamptz,
  sold_at timestamptz,
  returned_at timestamptz,
  recycled_at timestamptz,
  cancelled_at timestamptz,
  legacy_payload jsonb default '{}'::jsonb not null,
  created_by uuid,
  updated_by uuid
);

create table public.inventory_product_variants (
  id uuid default gen_random_uuid() not null,
  store_id uuid not null,
  catalog_item_id uuid not null,
  ram_capacity text,
  storage_capacity text,
  color text,
  gtin text,
  internal_sku text,
  normalized_key text not null,
  active bool default true not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  specifications jsonb default '{}'::jsonb not null,
  specification_schema_version int2 default 1 not null
);

create table public.inventory_stock_movements (
  id uuid default gen_random_uuid() not null,
  store_id uuid not null,
  stock_unit_id uuid not null,
  variant_id uuid not null,
  movement_type text not null,
  quantity int4 not null,
  source_kind text not null,
  source_id text not null,
  idempotency_key uuid not null,
  actor_id uuid not null,
  metadata jsonb default '{}'::jsonb not null,
  occurred_at timestamptz not null,
  created_at timestamptz default now() not null
);

create table public.inventory_stock_unit_identifiers (
  id uuid default gen_random_uuid() not null,
  store_id uuid not null,
  stock_unit_id uuid not null,
  kind text not null,
  slot int4,
  display_value text not null,
  normalized_value text not null,
  source text not null,
  is_primary bool default false not null,
  retired_at timestamptz,
  created_by uuid not null,
  created_at timestamptz default now() not null
);

create table public.inventory_stock_units (
  id uuid default gen_random_uuid() not null,
  store_id uuid not null,
  variant_id uuid not null,
  legacy_inventory_item_id uuid not null,
  source_type text not null,
  source_supplier_id uuid,
  source_customer_id uuid,
  status text default 'intake'::text not null,
  location text,
  cost_amount numeric default 0 not null,
  list_price numeric default 0 not null,
  currency_code text default 'EUR'::text not null,
  version int8 default 1 not null,
  notes text,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.inventory_transactions (
  id uuid default gen_random_uuid() not null,
  store_id uuid not null,
  item_id uuid not null,
  transaction_type text not null,
  amount numeric default 0 not null,
  currency_code text default 'EUR'::text not null,
  method text,
  note text,
  actor_id uuid,
  created_at timestamptz default now() not null
);

create table public.staff_profiles (
  id uuid not null,
  email text not null,
  display_name text not null,
  role staff_role default 'viewer'::staff_role not null,
  status staff_status default 'active'::staff_status not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  phone_e164 text,
  phone_verified_at timestamptz
);

create table public.store_memberships (
  id uuid default gen_random_uuid() not null,
  store_id uuid not null,
  user_id uuid not null,
  email text not null,
  display_name text,
  role staff_role default 'viewer'::staff_role not null,
  status store_membership_status default 'active'::store_membership_status not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.store_settings (
  id text default 'default'::text not null,
  store_id uuid not null,
  store_name text default ''::text not null,
  store_address text default ''::text not null,
  store_phone text default ''::text not null,
  store_whatsapp text default ''::text not null,
  store_email text default ''::text not null,
  default_order_warranty_text text default '6个月'::text not null,
  default_inventory_warranty_months int4 default 12 not null,
  print_footer text default ''::text not null,
  message_signature text default ''::text not null,
  updated_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  default_order_warranty_months int4 default 6 not null,
  public_base_url text default ''::text not null,
  new_order_entry_mode text default 'professional'::text not null
);

create table public.stores (
  id uuid default gen_random_uuid() not null,
  store_code text not null,
  name text not null,
  timezone text default 'Europe/Rome'::text not null,
  approval_overdue_hours int4 default 48 not null,
  pickup_overdue_days int4 default 5 not null,
  created_at timestamptz default now() not null,
  print_paper text default 'A5'::text not null,
  print_orientation text default 'landscape'::text not null,
  print_density text default 'normal'::text not null,
  print_margin_mm int4 default 5 not null,
  order_ui_config jsonb,
  slug text,
  owner_user_id uuid,
  status store_status default 'active'::store_status not null,
  plan store_plan default 'starter'::store_plan not null,
  currency_code text default 'EUR'::text not null,
  updated_at timestamptz default now() not null
);

alter table public.audit_logs add constraint audit_logs_after_object CHECK (((after_data IS NULL) OR (jsonb_typeof(after_data) = 'object'::text)));

alter table public.audit_logs add constraint audit_logs_before_object CHECK (((before_data IS NULL) OR (jsonb_typeof(before_data) = 'object'::text)));

alter table public.audit_logs add constraint audit_logs_metadata_object CHECK ((jsonb_typeof(metadata) = 'object'::text));

alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);

alter table public.customers add constraint customers_language_supported CHECK ((language = ANY (ARRAY['it'::text, 'zh'::text, 'en'::text])));

alter table public.customers add constraint customers_pkey1 PRIMARY KEY (id);

alter table public.inventory_events add constraint inventory_events_pkey PRIMARY KEY (id);

alter table public.inventory_items add constraint inventory_items_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['draft'::text, 'in_stock'::text, 'reserved'::text, 'sold'::text, 'cancelled'::text])));

alter table public.inventory_items add constraint inventory_items_pkey PRIMARY KEY (id);

alter table public.inventory_items add constraint inventory_items_product_channel_check CHECK ((product_channel = ANY (ARRAY['new_retail'::text, 'refurbished'::text, 'trade_in'::text])));

alter table public.inventory_items add constraint inventory_items_store_id_public_no_key UNIQUE (store_id, public_no);

alter table public.inventory_product_variants add constraint inventory_product_variants_id_store_unique UNIQUE (id, store_id);

alter table public.inventory_product_variants add constraint inventory_product_variants_key_check CHECK (((char_length(normalized_key) >= 3) AND (char_length(normalized_key) <= 512)));

alter table public.inventory_product_variants add constraint inventory_product_variants_key_unique UNIQUE (store_id, normalized_key);

alter table public.inventory_product_variants add constraint inventory_product_variants_pkey PRIMARY KEY (id);

alter table public.inventory_product_variants add constraint inventory_product_variants_specification_version_check CHECK ((specification_schema_version = 1));

alter table public.inventory_product_variants add constraint inventory_product_variants_specifications_object_check CHECK ((jsonb_typeof(specifications) = 'object'::text));

alter table public.inventory_product_variants add constraint inventory_product_variants_specifications_size_check CHECK ((pg_column_size(specifications) <= 4096));

alter table public.inventory_stock_movements add constraint inventory_stock_movements_idempotency_unique UNIQUE (store_id, idempotency_key);

alter table public.inventory_stock_movements add constraint inventory_stock_movements_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text));

alter table public.inventory_stock_movements add constraint inventory_stock_movements_pkey PRIMARY KEY (id);

alter table public.inventory_stock_movements add constraint inventory_stock_movements_serial_quantity_check CHECK ((quantity = ANY (ARRAY['-1'::integer, 1])));

alter table public.inventory_stock_movements add constraint inventory_stock_movements_type_check CHECK ((movement_type = ANY (ARRAY['receive'::text, 'reserve'::text, 'release'::text, 'sell'::text, 'return'::text, 'adjust'::text, 'write_off'::text])));

alter table public.inventory_stock_unit_identifiers add constraint inventory_stock_unit_identifiers_id_store_unique UNIQUE (id, store_id);

alter table public.inventory_stock_unit_identifiers add constraint inventory_stock_unit_identifiers_kind_check CHECK ((kind = ANY (ARRAY['imei1'::text, 'imei2'::text, 'serial'::text, 'eid'::text, 'ean'::text, 'sku'::text])));

alter table public.inventory_stock_unit_identifiers add constraint inventory_stock_unit_identifiers_pkey PRIMARY KEY (id);

alter table public.inventory_stock_unit_identifiers add constraint inventory_stock_unit_identifiers_slot_check CHECK (((slot IS NULL) OR ((slot >= 1) AND (slot <= 8))));

alter table public.inventory_stock_unit_identifiers add constraint inventory_stock_unit_identifiers_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'scan'::text, 'ai_confirmed'::text])));

alter table public.inventory_stock_unit_identifiers add constraint inventory_stock_unit_identifiers_value_check CHECK ((((char_length(btrim(display_value)) >= 3) AND (char_length(btrim(display_value)) <= 128)) AND ((char_length(normalized_value) >= 3) AND (char_length(normalized_value) <= 128))));

alter table public.inventory_stock_units add constraint inventory_stock_units_amount_check CHECK (((cost_amount >= (0)::numeric) AND (cost_amount = round(cost_amount, 2)) AND (list_price >= (0)::numeric) AND (list_price = round(list_price, 2))));

alter table public.inventory_stock_units add constraint inventory_stock_units_currency_check CHECK ((currency_code = 'EUR'::text));

alter table public.inventory_stock_units add constraint inventory_stock_units_id_store_unique UNIQUE (id, store_id);

alter table public.inventory_stock_units add constraint inventory_stock_units_legacy_unique UNIQUE (store_id, legacy_inventory_item_id);

alter table public.inventory_stock_units add constraint inventory_stock_units_pkey PRIMARY KEY (id);

alter table public.inventory_stock_units add constraint inventory_stock_units_source_check CHECK ((source_type = ANY (ARRAY['supplier_purchase'::text, 'repair_resale'::text, 'manual_stock'::text])));

alter table public.inventory_stock_units add constraint inventory_stock_units_status_check CHECK ((status = ANY (ARRAY['intake'::text, 'evaluating'::text, 'refurbishing'::text, 'ready_for_sale'::text, 'listed'::text, 'reserved'::text, 'sold'::text, 'returned'::text, 'cancelled'::text, 'recycled'::text])));

alter table public.inventory_stock_units add constraint inventory_stock_units_version_check CHECK ((version >= 1));

alter table public.inventory_transactions add constraint inventory_transactions_currency_eur CHECK ((currency_code = 'EUR'::text));

alter table public.inventory_transactions add constraint inventory_transactions_pkey PRIMARY KEY (id);

alter table public.staff_profiles add constraint staff_profiles_email_key UNIQUE (email);

alter table public.staff_profiles add constraint staff_profiles_email_lowercase_check CHECK (((email IS NULL) OR (email = lower(email))));

alter table public.staff_profiles add constraint staff_profiles_phone_e164_format_check CHECK (((phone_e164 IS NULL) OR (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'::text)));

alter table public.staff_profiles add constraint staff_profiles_pkey PRIMARY KEY (id);

alter table public.store_memberships add constraint store_memberships_email_lowercase_check CHECK (((email IS NULL) OR (email = lower(email))));

alter table public.store_memberships add constraint store_memberships_pkey PRIMARY KEY (id);

alter table public.store_memberships add constraint store_memberships_store_user_unique UNIQUE (store_id, user_id);

alter table public.store_settings add constraint store_settings_inventory_warranty_check CHECK ((default_inventory_warranty_months >= 0));

alter table public.store_settings add constraint store_settings_new_order_entry_mode_check CHECK ((new_order_entry_mode = ANY (ARRAY['simple'::text, 'professional'::text])));

alter table public.store_settings add constraint store_settings_order_warranty_months_check CHECK ((default_order_warranty_months = ANY (ARRAY[0, 3, 6, 12, 24])));

alter table public.store_settings add constraint store_settings_pkey PRIMARY KEY (id);

alter table public.store_settings add constraint store_settings_public_base_url_check CHECK (((public_base_url = ''::text) OR ((length(public_base_url) <= 2048) AND (public_base_url !~ '[[:space:]@?#]'::text) AND ((public_base_url ~ '^https://[^[:space:]@?#]+$'::text) OR (public_base_url ~ '^http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?(/[^[:space:]@?#]*)?$'::text)))));

alter table public.stores add constraint stores_pkey PRIMARY KEY (id);

alter table public.stores add constraint stores_print_density_check CHECK ((print_density = ANY (ARRAY['compact'::text, 'normal'::text, 'relaxed'::text])));

alter table public.stores add constraint stores_print_margin_mm_check CHECK ((print_margin_mm = ANY (ARRAY[3, 5, 8])));

alter table public.stores add constraint stores_print_orientation_check CHECK ((print_orientation = ANY (ARRAY['landscape'::text, 'portrait'::text])));

alter table public.stores add constraint stores_print_paper_check CHECK ((print_paper = ANY (ARRAY['A5'::text, 'A4'::text])));

alter table public.stores add constraint stores_store_code_key UNIQUE (store_code);

create unique index synthetic_audit_logs_id_store on public.audit_logs(id,store_id);

create unique index synthetic_customers_id_store on public.customers(id,store_id);

create unique index synthetic_inventory_events_id_store on public.inventory_events(id,store_id);

create unique index synthetic_inventory_items_id_store on public.inventory_items(id,store_id);

create unique index synthetic_inventory_product_variants_id_store on public.inventory_product_variants(id,store_id);

create unique index synthetic_inventory_stock_movements_id_store on public.inventory_stock_movements(id,store_id);

create unique index synthetic_inventory_stock_unit_identifiers_id_store on public.inventory_stock_unit_identifiers(id,store_id);

create unique index synthetic_inventory_stock_units_id_store on public.inventory_stock_units(id,store_id);

create unique index synthetic_inventory_transactions_id_store on public.inventory_transactions(id,store_id);

create unique index synthetic_store_memberships_id_store on public.store_memberships(id,store_id);

create unique index synthetic_store_settings_id_store on public.store_settings(id,store_id);

alter table public.audit_logs add constraint audit_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE SET NULL;

alter table public.customers add constraint customers_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT;

alter table public.inventory_events add constraint inventory_events_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;

alter table public.inventory_events add constraint inventory_events_item_id_fkey FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON UPDATE CASCADE ON DELETE CASCADE;

alter table public.inventory_events add constraint inventory_events_item_same_store_fkey FOREIGN KEY (item_id, store_id) REFERENCES inventory_items(id, store_id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

alter table public.inventory_events add constraint inventory_events_operator_user_id_fkey FOREIGN KEY (operator_user_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;

alter table public.inventory_events add constraint inventory_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT;

alter table public.inventory_items add constraint inventory_items_buyer_customer_id_fkey FOREIGN KEY (buyer_customer_id) REFERENCES customers(id) ON DELETE SET NULL;

alter table public.inventory_items add constraint inventory_items_buyer_same_store_fkey FOREIGN KEY (buyer_customer_id, store_id) REFERENCES customers(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;

alter table public.inventory_items add constraint inventory_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;

alter table public.inventory_items add constraint inventory_items_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL;

alter table public.inventory_items add constraint inventory_items_customer_same_store_fkey FOREIGN KEY (customer_id, store_id) REFERENCES customers(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;

alter table public.inventory_items add constraint inventory_items_seller_customer_id_fkey FOREIGN KEY (seller_customer_id) REFERENCES customers(id) ON DELETE SET NULL;

alter table public.inventory_items add constraint inventory_items_source_repair_order_id_fkey FOREIGN KEY (source_repair_order_id) REFERENCES repair_orders(id) ON DELETE SET NULL;

alter table public.inventory_items add constraint inventory_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT;

alter table public.inventory_items add constraint inventory_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;

alter table public.inventory_product_variants add constraint inventory_product_variants_catalog_same_store_fkey FOREIGN KEY (catalog_item_id, store_id) REFERENCES inventory_product_catalog_items(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_product_variants add constraint inventory_product_variants_store_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_movements add constraint inventory_stock_movements_actor_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_movements add constraint inventory_stock_movements_store_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_movements add constraint inventory_stock_movements_unit_same_store_fkey FOREIGN KEY (stock_unit_id, store_id) REFERENCES inventory_stock_units(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_movements add constraint inventory_stock_movements_variant_same_store_fkey FOREIGN KEY (variant_id, store_id) REFERENCES inventory_product_variants(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_unit_identifiers add constraint inventory_stock_unit_identifiers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_unit_identifiers add constraint inventory_stock_unit_identifiers_store_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_unit_identifiers add constraint inventory_stock_unit_identifiers_unit_same_store_fkey FOREIGN KEY (stock_unit_id, store_id) REFERENCES inventory_stock_units(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_units add constraint inventory_stock_units_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_units add constraint inventory_stock_units_customer_same_store_fkey FOREIGN KEY (source_customer_id, store_id) REFERENCES customers(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_units add constraint inventory_stock_units_legacy_same_store_fkey FOREIGN KEY (legacy_inventory_item_id, store_id) REFERENCES inventory_items(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_units add constraint inventory_stock_units_store_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_units add constraint inventory_stock_units_supplier_same_store_fkey FOREIGN KEY (source_supplier_id, store_id) REFERENCES suppliers(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_units add constraint inventory_stock_units_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_stock_units add constraint inventory_stock_units_variant_same_store_fkey FOREIGN KEY (variant_id, store_id) REFERENCES inventory_product_variants(id, store_id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.inventory_transactions add constraint inventory_transactions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;

alter table public.inventory_transactions add constraint inventory_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON UPDATE CASCADE ON DELETE CASCADE;

alter table public.inventory_transactions add constraint inventory_transactions_item_same_store_fkey FOREIGN KEY (item_id, store_id) REFERENCES inventory_items(id, store_id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

alter table public.inventory_transactions add constraint inventory_transactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.staff_profiles add constraint staff_profiles_user_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

alter table public.store_memberships add constraint store_memberships_store_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE CASCADE;

alter table public.store_memberships add constraint store_memberships_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

alter table public.store_settings add constraint store_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE RESTRICT;

alter table public.store_settings add constraint store_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES staff_profiles(id) ON DELETE SET NULL;

alter table public.stores add constraint stores_owner_user_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

grant usage on schema auth,public to service_role;
grant select,insert,update,delete on all tables in schema public to service_role;
grant select on auth.users to service_role;
create table public.repairdesk_store_domain_versions(store_id uuid references public.stores(id),domain text,version bigint,updated_at timestamptz,primary key(store_id,domain));


-- Applied original sale bridge, unchanged:
-- Inventory Product V2 expand step 1: dormant atomic sale bridge.
--
-- This migration is intentionally additive. It does not delete or rewrite V1
-- inventory history and it does not grant runtime EXECUTE to service_role.
-- A later Owner-approved enable migration may grant the RPC after linked
-- dry-run, restore, RLS/Grant and application flag gates pass.

set lock_timeout = '5s';

create unique index if not exists inventory_transactions_id_store_id_uidx
  on public.inventory_transactions (id, store_id);

create table if not exists public.inventory_sale_command_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  inventory_item_id uuid not null,
  buyer_customer_id uuid,
  idempotency_key uuid not null,
  request_hash text not null,
  actor_id uuid not null,
  actor_name_snapshot text not null,
  sale_price numeric(12, 2) not null,
  payment_amount numeric(12, 2) not null,
  payment_method text not null,
  sale_channel text not null default 'store',
  currency_code text not null default 'EUR',
  warranty_months integer not null,
  warranty_snapshot jsonb not null default '{}'::jsonb,
  fiscal_status text not null default 'pending',
  fiscal_reference text,
  payment_transaction_id uuid not null,
  item_updated_at_before timestamptz not null,
  item_updated_at_after timestamptz not null,
  sold_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint inventory_sale_command_ledger_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete restrict,
  constraint inventory_sale_command_ledger_item_same_store_fkey
    foreign key (inventory_item_id, store_id)
    references public.inventory_items(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_sale_command_ledger_buyer_same_store_fkey
    foreign key (buyer_customer_id, store_id)
    references public.customers(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_sale_command_ledger_actor_fkey
    foreign key (actor_id) references auth.users(id)
    on update cascade on delete restrict,
  constraint inventory_sale_command_ledger_payment_fkey
    foreign key (payment_transaction_id, store_id)
    references public.inventory_transactions(id, store_id)
    on update cascade on delete restrict,
  constraint inventory_sale_command_ledger_idempotency_unique
    unique (store_id, idempotency_key),
  constraint inventory_sale_command_ledger_request_hash_check
    check (request_hash ~ '^[0-9a-f]{32}$'),
  constraint inventory_sale_command_ledger_sale_price_check
    check (sale_price > 0 and sale_price = round(sale_price, 2)),
  constraint inventory_sale_command_ledger_payment_check
    check (
      payment_amount > 0
      and payment_amount = round(payment_amount, 2)
      and payment_amount = sale_price
    ),
  constraint inventory_sale_command_ledger_method_check
    check (char_length(payment_method) between 1 and 64),
  constraint inventory_sale_command_ledger_channel_check
    check (char_length(sale_channel) between 1 and 64),
  constraint inventory_sale_command_ledger_currency_check
    check (currency_code = 'EUR'),
  constraint inventory_sale_command_ledger_warranty_check
    check (warranty_months between 0 and 120),
  constraint inventory_sale_command_ledger_warranty_snapshot_check
    check (jsonb_typeof(warranty_snapshot) = 'object'),
  constraint inventory_sale_command_ledger_fiscal_status_check
    check (fiscal_status in ('not_required', 'pending', 'recorded')),
  constraint inventory_sale_command_ledger_fiscal_reference_check
    check (
      (fiscal_status = 'recorded' and nullif(btrim(fiscal_reference), '') is not null)
      or fiscal_status <> 'recorded'
    )
);

create index if not exists inventory_sale_command_ledger_item_created_idx
  on public.inventory_sale_command_ledger (store_id, inventory_item_id, created_at desc);

create index if not exists inventory_sale_command_ledger_buyer_created_idx
  on public.inventory_sale_command_ledger (store_id, buyer_customer_id, created_at desc)
  where buyer_customer_id is not null;

alter table public.inventory_sale_command_ledger enable row level security;

revoke all on table public.inventory_sale_command_ledger
  from public, anon, authenticated, service_role;
grant select, insert on table public.inventory_sale_command_ledger to service_role;

create or replace function public.repairdesk_complete_inventory_sale_v2(
  p_store_id uuid,
  p_item_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_buyer_customer_id uuid,
  p_sale_price numeric,
  p_payment_amount numeric,
  p_payment_method text,
  p_sale_channel text,
  p_warranty_months integer,
  p_warranty_snapshot jsonb,
  p_fiscal_status text,
  p_fiscal_reference text,
  p_sold_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_name text;
  v_actor_role text;
  v_existing public.inventory_sale_command_ledger%rowtype;
  v_item public.inventory_items%rowtype;
  v_request_hash text;
  v_payment_method text := btrim(coalesce(p_payment_method, ''));
  v_sale_channel text := btrim(coalesce(p_sale_channel, 'store'));
  v_fiscal_status text := btrim(coalesce(p_fiscal_status, 'pending'));
  v_fiscal_reference text := nullif(btrim(coalesce(p_fiscal_reference, '')), '');
  v_warranty_snapshot jsonb := coalesce(p_warranty_snapshot, '{}'::jsonb);
  v_sale_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_stock_movement_id uuid := gen_random_uuid();
  v_stock_unit_id uuid;
  v_stock_variant_id uuid;
  v_stock_unit_status text;
  v_now timestamptz := clock_timestamp();
  v_sold_at timestamptz := p_sold_at;
  v_warranty_until timestamptz;
begin
  if p_store_id is null or p_item_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if p_sold_at is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_sold_at');
  end if;
  if p_sale_price is null
     or p_sale_price <= 0
     or p_sale_price <> round(p_sale_price, 2)
     or p_payment_amount is null
     or p_payment_amount <> p_sale_price then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;
  if char_length(v_payment_method) < 1 or char_length(v_payment_method) > 64 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payment_method');
  end if;
  if char_length(v_sale_channel) < 1 or char_length(v_sale_channel) > 64 then
    return jsonb_build_object('ok', false, 'code', 'invalid_sale_channel');
  end if;
  if p_warranty_months is null or p_warranty_months < 0 or p_warranty_months > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_warranty');
  end if;
  if jsonb_typeof(v_warranty_snapshot) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_warranty');
  end if;
  if v_fiscal_status not in ('not_required', 'pending', 'recorded')
     or (v_fiscal_status = 'recorded' and v_fiscal_reference is null) then
    return jsonb_build_object('ok', false, 'code', 'invalid_fiscal_status');
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'item_id', p_item_id,
      'actor_id', p_actor_id,
      'expected_updated_at', p_expected_updated_at,
      'buyer_customer_id', p_buyer_customer_id,
      'sale_price', p_sale_price::numeric(12, 2),
      'payment_amount', p_payment_amount::numeric(12, 2),
      'payment_method', v_payment_method,
      'sale_channel', v_sale_channel,
      'warranty_months', p_warranty_months,
      'warranty_snapshot', v_warranty_snapshot,
      'fiscal_status', v_fiscal_status,
      'fiscal_reference', v_fiscal_reference,
      'sold_at', v_sold_at
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_store_id::text || ':inventory-sale-v2:' || p_idempotency_key::text,
      0
    )
  );

  select coalesce(membership.display_name, profile.display_name, 'Staff'), membership.role::text
    into v_actor_name, v_actor_role
    from public.staff_profiles as profile
    join public.store_memberships as membership
      on membership.user_id = profile.id
     and membership.store_id = p_store_id
     and membership.status::text = 'active'
    join public.stores as store_row
      on store_row.id = membership.store_id
     and store_row.status::text = 'active'
   where profile.id = p_actor_id
     and profile.status::text = 'active'
   limit 1;

  if v_actor_role is null or v_actor_role not in ('owner', 'manager', 'sales') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  select ledger.*
    into v_existing
    from public.inventory_sale_command_ledger as ledger
   where ledger.store_id = p_store_id
     and ledger.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'sale_id', v_existing.id,
      'payment_id', v_existing.payment_transaction_id,
      'item_id', v_existing.inventory_item_id,
      'updated_at', v_existing.item_updated_at_after,
      'fiscal_status', v_existing.fiscal_status
    );
  end if;

  if p_buyer_customer_id is not null and not exists (
    select 1
      from public.customers as customer
     where customer.id = p_buyer_customer_id
       and customer.store_id = p_store_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'customer_not_found');
  end if;

  select item.*
    into v_item
    from public.inventory_items as item
   where item.store_id = p_store_id
     and item.id = p_item_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'item_not_found');
  end if;
  if v_item.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if v_item.status::text not in ('ready_for_sale', 'listed', 'reserved') then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;
  if v_item.source_type = 'buyback'
     and (
       v_item.imei_check_status::text <> 'pass'
       or v_item.activation_lock_status::text <> 'pass'
       or v_item.data_wipe_status::text <> 'pass'
     ) then
    return jsonb_build_object('ok', false, 'code', 'inspection_blocked');
  end if;

  select unit.id, unit.variant_id, unit.status::text
    into v_stock_unit_id, v_stock_variant_id, v_stock_unit_status
    from public.inventory_stock_units as unit
   where unit.store_id = p_store_id
     and unit.legacy_inventory_item_id = p_item_id
   for update;

  if v_stock_unit_id is not null
     and v_stock_unit_status not in (
       'intake', 'evaluating', 'refurbishing', 'ready_for_sale', 'listed', 'reserved'
     ) then
    return jsonb_build_object('ok', false, 'code', 'v2_state_conflict');
  end if;

  v_warranty_until := case
    when p_warranty_months > 0 then v_sold_at + pg_catalog.make_interval(months => p_warranty_months)
    else null
  end;

  update public.inventory_items
     set status = 'sold',
         buyer_customer_id = p_buyer_customer_id,
         sale_price = p_sale_price,
         deposit_amount = p_payment_amount,
         payment_method = v_payment_method,
         sale_channel = v_sale_channel,
         warranty_months = p_warranty_months,
         warranty_until = v_warranty_until,
         sold_at = v_sold_at,
         legacy_payload = coalesce(v_item.legacy_payload, '{}'::jsonb)
           || jsonb_build_object(
             'sale_receipt', v_warranty_snapshot,
             'inventory_v2_sale_id', v_sale_id,
             'fiscal_status', v_fiscal_status,
             'fiscal_reference', v_fiscal_reference
           ),
         updated_by = p_actor_id,
         updated_at = v_now
   where store_id = p_store_id
     and id = p_item_id
     and updated_at = p_expected_updated_at;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;

  insert into public.inventory_transactions (
    id,
    store_id,
    item_id,
    transaction_type,
    amount,
    currency_code,
    method,
    note,
    actor_id,
    created_at
  ) values (
    v_payment_id,
    p_store_id,
    p_item_id,
    'sale_payment',
    p_payment_amount,
    'EUR',
    v_payment_method,
    'Inventory V2 atomic sale',
    p_actor_id,
    v_sold_at
  );

  if v_stock_unit_id is not null then
    update public.inventory_stock_units
       set status = 'sold',
           version = version + 1,
           updated_by = p_actor_id,
           updated_at = v_now
     where store_id = p_store_id
       and id = v_stock_unit_id;

    insert into public.inventory_stock_movements (
      id,
      store_id,
      stock_unit_id,
      variant_id,
      movement_type,
      quantity,
      source_kind,
      source_id,
      idempotency_key,
      actor_id,
      metadata,
      occurred_at,
      created_at
    ) values (
      v_stock_movement_id,
      p_store_id,
      v_stock_unit_id,
      v_stock_variant_id,
      'sell',
      -1,
      'inventory_sale_v2',
      v_sale_id::text,
      p_idempotency_key,
      p_actor_id,
      jsonb_build_object(
        'inventory_item_id', p_item_id,
        'payment_id', v_payment_id,
        'fiscal_status', v_fiscal_status
      ),
      v_sold_at,
      v_now
    );
  end if;

  insert into public.inventory_sale_command_ledger (
    id,
    store_id,
    inventory_item_id,
    buyer_customer_id,
    idempotency_key,
    request_hash,
    actor_id,
    actor_name_snapshot,
    sale_price,
    payment_amount,
    payment_method,
    sale_channel,
    warranty_months,
    warranty_snapshot,
    fiscal_status,
    fiscal_reference,
    payment_transaction_id,
    item_updated_at_before,
    item_updated_at_after,
    sold_at,
    created_at
  ) values (
    v_sale_id,
    p_store_id,
    p_item_id,
    p_buyer_customer_id,
    p_idempotency_key,
    v_request_hash,
    p_actor_id,
    v_actor_name,
    p_sale_price,
    p_payment_amount,
    v_payment_method,
    v_sale_channel,
    p_warranty_months,
    v_warranty_snapshot,
    v_fiscal_status,
    v_fiscal_reference,
    v_payment_id,
    v_item.updated_at,
    v_now,
    v_sold_at,
    v_now
  );

  insert into public.inventory_events (
    id,
    store_id,
    item_id,
    event_type,
    from_status,
    to_status,
    payload,
    operator_user_id,
    operator_name,
    created_at
  ) values (
    gen_random_uuid(),
    p_store_id,
    p_item_id,
    'sold',
    v_item.status,
    'sold',
    jsonb_build_object(
      'sale_id', v_sale_id,
      'payment_id', v_payment_id,
      'sale_price', p_sale_price,
      'currency_code', 'EUR',
      'fiscal_status', v_fiscal_status
    ),
    p_actor_id,
    v_actor_name,
    v_sold_at
  );

  insert into public.audit_logs (
    id,
    actor_id,
    actor_name,
    store_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) values (
    gen_random_uuid()::text,
    p_actor_id,
    v_actor_name,
    p_store_id,
    'sale',
    'inventory_item',
    p_item_id,
    jsonb_build_object(
      'sale_id', v_sale_id,
      'payment_id', v_payment_id,
      'fiscal_status', v_fiscal_status
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'completed',
    'sale_id', v_sale_id,
    'payment_id', v_payment_id,
    'item_id', p_item_id,
    'updated_at', v_now,
    'fiscal_status', v_fiscal_status
  );
end;
$$;

revoke all on function public.repairdesk_complete_inventory_sale_v2(
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  timestamptz
) from public, anon, authenticated, service_role;

comment on table public.inventory_sale_command_ledger is
  'Dormant V2 full-sale command ledger. Runtime access requires a separate Owner-approved enable migration.';

comment on function public.repairdesk_complete_inventory_sale_v2(
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  timestamptz
) is 'Dormant atomic inventory full-sale command. EXECUTE intentionally revoked from every runtime role.';


-- Applied source: 20260709125247_repairdesk_historical_schema_reconcile.sql
create or replace function public.repairdesk_sync_inventory_event_item_id()
returns trigger
language plpgsql
as $$
begin
  if new.inventory_item_id is null then
    new.inventory_item_id := new.item_id;
  end if;
  if new.item_id is null then
    new.item_id := new.inventory_item_id;
  end if;
  return new;
end;
$$;

-- Applied source: 20260718181148_inventory_product_v2_identity.sql
create or replace function public.repairdesk_inventory_v2_normalize_identifier(p_value text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select upper(pg_catalog.regexp_replace(btrim(p_value), '[^A-Za-z0-9]', '', 'g'))
$$;

-- Applied source: 20260718181148_inventory_product_v2_identity.sql
create or replace function public.repairdesk_inventory_v2_imei_is_valid(p_value text)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_value text := public.repairdesk_inventory_v2_normalize_identifier(p_value);
  v_sum integer := 0;
  v_digit integer;
  v_index integer;
begin
  if v_value !~ '^[0-9]{15}$' then
    return false;
  end if;
  for v_index in 1..15 loop
    v_digit := substring(v_value from v_index for 1)::integer;
    if mod(v_index, 2) = 0 then
      v_digit := v_digit * 2;
      if v_digit > 9 then v_digit := v_digit - 9; end if;
    end if;
    v_sum := v_sum + v_digit;
  end loop;
  return mod(v_sum, 10) = 0;
end;
$$;

-- Applied source: 20260726181436_inventory_v2_workflow_expand.sql
create or replace function public.repairdesk_guard_inventory_v2_unit_sale()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.inventory_items%rowtype;
begin
  if new.status <> 'sold' or old.status = 'sold' then return new; end if;
  select item.* into v_item
    from public.inventory_items as item
   where item.store_id = new.store_id
     and item.id = new.legacy_inventory_item_id;
  if not found
     or coalesce((v_item.legacy_payload ->> 'inventory_v2_intake')::boolean, false) is not true
     or coalesce(v_item.legacy_payload ->> 'inventory_v2_unit_id', '') <> new.id::text
     or v_item.status::text <> 'sold'
     or old.status not in ('ready_for_sale', 'listed', 'reserved')
     or v_item.buyback_price <> new.cost_amount
     or v_item.list_price <> new.list_price
     or nullif(btrim(coalesce(v_item.serial_or_imei, '')), '') is null
     or v_item.imei_check_status::text <> 'pass'
     or v_item.activation_lock_status::text <> 'pass'
     or v_item.data_wipe_status::text <> 'pass'
     or v_item.functional_grade::text <> 'passed'
     or v_item.cosmetic_grade::text = 'unknown'
     or v_item.list_price <= 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'Inventory V2 sale projection or inspection gate failed';
  end if;
  return new;
end;
$$;

-- Applied source: 20260729225101_inventory_product_device_data_v2.sql
create or replace function private.bump_repairdesk_inventory_domain_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
begin
  v_store_id := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
  if v_store_id is not null then
    insert into public.repairdesk_store_domain_versions (store_id, domain, version, updated_at)
    values (v_store_id, 'inventory', 1, clock_timestamp())
    on conflict (store_id, domain) do update
      set version = public.repairdesk_store_domain_versions.version + 1,
          updated_at = excluded.updated_at;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger repairdesk_sync_inventory_event_item_id_trg before insert or update on public.inventory_events
  for each row execute function public.repairdesk_sync_inventory_event_item_id();
create trigger inventory_v2_unit_sale_guard before update of status on public.inventory_stock_units
  for each row execute function public.repairdesk_guard_inventory_v2_unit_sale();
create trigger repairdesk_realtime_inventory_revision after insert or update or delete on public.inventory_stock_units
  for each row execute function private.bump_repairdesk_inventory_domain_version();
grant execute on function public.repairdesk_complete_inventory_sale_v2(uuid,uuid,uuid,timestamptz,uuid,uuid,numeric,numeric,text,text,integer,jsonb,text,text,timestamptz) to service_role;
