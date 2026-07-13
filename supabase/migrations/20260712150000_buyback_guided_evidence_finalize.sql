-- Guided buyback evidence and atomic finalize contract.
-- Expand-only application code migration. Production apply requires a separate dry-run,
-- duplicate-payment preflight and owner-approved release window.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'repairdesk-buyback-evidence',
  'repairdesk-buyback-evidence',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.inventory_attachments
  add column if not exists sensitivity text not null default 'internal',
  add column if not exists evidence_status text not null default 'bound',
  add column if not exists sha256 text,
  add column if not exists agreement_hash text,
  add column if not exists staging_expires_at timestamptz,
  add column if not exists retention_until timestamptz,
  add column if not exists legal_hold_until timestamptz,
  add column if not exists bound_at timestamptz;

alter table public.inventory_attachments
  drop constraint if exists inventory_attachments_bucket_check;

alter table public.inventory_attachments
  add constraint inventory_attachments_bucket_check
    check (storage_bucket in ('repairdesk-inventory-attachments', 'repairdesk-buyback-evidence')),
  add constraint inventory_attachments_sensitivity_check
    check (sensitivity in ('internal', 'restricted')),
  add constraint inventory_attachments_evidence_status_check
    check (evidence_status in ('staged', 'bound', 'rejected', 'deleted')),
  add constraint inventory_attachments_sha256_check
    check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  add constraint inventory_attachments_agreement_hash_check
    check (agreement_hash is null or agreement_hash ~ '^[a-f0-9]{64}$');

update public.inventory_attachments as attachment
   set sensitivity = 'restricted'
  from public.inventory_items as item
 where item.store_id = attachment.store_id
   and item.id = attachment.item_id
   and (
     item.source_type = 'buyback'
     or attachment.kind in ('id_front', 'id_back', 'signature', 'invoice_photo', 'box_photo')
   );

create index if not exists inventory_attachments_staged_expiry_idx
  on public.inventory_attachments (staging_expires_at)
  where evidence_status = 'staged';

do $$
begin
  if exists (
    select 1
      from public.inventory_transactions
     where transaction_type = 'buyback_payment'
     group by store_id, item_id
    having count(*) > 1
  ) then
    raise exception using
      message = 'buyback finalize migration blocked: duplicate buyback_payment rows require owner-reviewed reconciliation';
  end if;

  if exists (
    select 1
      from public.inventory_transactions as payment
      join public.inventory_items as item
        on item.store_id = payment.store_id
       and item.id = payment.item_id
     where payment.transaction_type = 'buyback_payment'
       and item.status::text in ('intake', 'evaluating', 'offer_made')
  ) then
    raise exception using
      message = 'buyback finalize migration blocked: pre-finalization items with legacy buyback payments require owner-reviewed reconciliation';
  end if;
end;
$$;

create unique index if not exists inventory_transactions_one_buyback_payment_idx
  on public.inventory_transactions (store_id, item_id)
  where transaction_type = 'buyback_payment';

do $$
declare
  item_id_type text;
  item_id_oid oid;
  item_id_typmod integer;
  transaction_id_type text;
  transaction_id_oid oid;
  transaction_id_typmod integer;
  attachment_id_type text;
  attachment_id_oid oid;
  attachment_id_typmod integer;
  dependent_table text;
  dependent_id_oid oid;
  dependent_id_typmod integer;
begin
  select attribute.atttypid,
         attribute.atttypmod,
         pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
    into item_id_oid, item_id_typmod, item_id_type
    from pg_catalog.pg_attribute as attribute
    join pg_catalog.pg_class as table_class on table_class.oid = attribute.attrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = table_class.relnamespace
   where namespace.nspname = 'public'
     and table_class.relname = 'inventory_items'
     and attribute.attname = 'id'
     and not attribute.attisdropped;

  select attribute.atttypid,
         attribute.atttypmod,
         pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
    into transaction_id_oid, transaction_id_typmod, transaction_id_type
    from pg_catalog.pg_attribute as attribute
    join pg_catalog.pg_class as table_class on table_class.oid = attribute.attrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = table_class.relnamespace
   where namespace.nspname = 'public'
     and table_class.relname = 'inventory_transactions'
     and attribute.attname = 'id'
     and not attribute.attisdropped;

  select attribute.atttypid,
         attribute.atttypmod,
         pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
    into attachment_id_oid, attachment_id_typmod, attachment_id_type
    from pg_catalog.pg_attribute as attribute
    join pg_catalog.pg_class as table_class on table_class.oid = attribute.attrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = table_class.relnamespace
   where namespace.nspname = 'public'
     and table_class.relname = 'inventory_attachments'
     and attribute.attname = 'id'
     and not attribute.attisdropped;

  if item_id_type is null or transaction_id_type is null or attachment_id_type is null then
    raise exception 'buyback finalize requires inventory item, transaction and attachment id columns';
  end if;

  if to_regclass('public.buyback_agreements') is null then
    execute format(
      $sql$
      create table public.buyback_agreements (
        id uuid primary key default gen_random_uuid(),
        store_id uuid not null,
        item_id %s not null,
        idempotency_key uuid not null,
        actor_id uuid not null,
        actor_name_snapshot text not null,
        payment_transaction_id %s not null,
        signature_attachment_id %s not null,
        evidence_attachment_ids jsonb not null,
        document_type text not null,
        document_no_last4 text,
        agreement_version text not null,
        privacy_notice_version text not null,
        language text not null,
        agreement_hash text not null,
        agreement_snapshot jsonb not null,
        status text not null default 'signed',
        item_updated_at_before timestamptz not null,
        item_updated_at_after timestamptz not null,
        signed_at timestamptz not null,
        retention_until timestamptz,
        legal_hold_until timestamptz,
        voided_at timestamptz,
        purged_at timestamptz,
        created_at timestamptz not null default now(),
        constraint buyback_agreements_store_fkey
          foreign key (store_id) references public.stores(id)
          on update cascade on delete restrict,
        constraint buyback_agreements_item_store_fkey
          foreign key (item_id, store_id) references public.inventory_items(id, store_id)
          on update cascade on delete restrict,
        constraint buyback_agreements_actor_fkey
          foreign key (actor_id) references auth.users(id)
          on update cascade on delete restrict,
        constraint buyback_agreements_payment_fkey
          foreign key (payment_transaction_id) references public.inventory_transactions(id)
          on update cascade on delete restrict,
        constraint buyback_agreements_signature_fkey
          foreign key (signature_attachment_id) references public.inventory_attachments(id)
          on update cascade on delete restrict,
        constraint buyback_agreements_idempotency_unique unique (store_id, idempotency_key),
        constraint buyback_agreements_item_unique unique (store_id, item_id),
        constraint buyback_agreements_document_type_check
          check (document_type in ('id_card', 'passport', 'residence_permit', 'driver_license', 'other')),
        constraint buyback_agreements_document_last4_check
          check (document_no_last4 is null or document_no_last4 ~ '^[A-Za-z0-9]{1,4}$'),
        constraint buyback_agreements_hash_check
          check (agreement_hash ~ '^[a-f0-9]{64}$'),
        constraint buyback_agreements_snapshot_object_check
          check (jsonb_typeof(agreement_snapshot) = 'object'),
        constraint buyback_agreements_evidence_array_check
          check (jsonb_typeof(evidence_attachment_ids) = 'array'),
        constraint buyback_agreements_status_check
          check (status in ('signed', 'voided', 'purged'))
      )
      $sql$,
      item_id_type,
      transaction_id_type,
      attachment_id_type
    );
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_attribute as attribute
     where attribute.attrelid = 'public.buyback_agreements'::pg_catalog.regclass
       and attribute.attname = 'item_id'
       and not attribute.attisdropped
       and attribute.atttypid = item_id_oid
       and attribute.atttypmod = item_id_typmod
  ) then
    raise exception 'buyback_agreements.item_id type must match inventory_items.id';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_attribute as attribute
     where attribute.attrelid = 'public.buyback_agreements'::pg_catalog.regclass
       and attribute.attname = 'payment_transaction_id'
       and not attribute.attisdropped
       and attribute.atttypid = transaction_id_oid
       and attribute.atttypmod = transaction_id_typmod
  ) then
    raise exception 'buyback_agreements.payment_transaction_id type must match inventory_transactions.id';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_attribute as attribute
     where attribute.attrelid = 'public.buyback_agreements'::pg_catalog.regclass
       and attribute.attname = 'signature_attachment_id'
       and not attribute.attisdropped
       and attribute.atttypid = attachment_id_oid
       and attribute.atttypmod = attachment_id_typmod
  ) then
    raise exception 'buyback_agreements.signature_attachment_id type must match inventory_attachments.id';
  end if;

  for dependent_table in
    select unnest(array[
      'inventory_quality_checks',
      'inventory_transactions',
      'inventory_attachments',
      'inventory_events'
    ])
  loop
    select attribute.atttypid, attribute.atttypmod
      into dependent_id_oid, dependent_id_typmod
      from pg_catalog.pg_attribute as attribute
      join pg_catalog.pg_class as table_class on table_class.oid = attribute.attrelid
      join pg_catalog.pg_namespace as namespace on namespace.oid = table_class.relnamespace
     where namespace.nspname = 'public'
       and table_class.relname = dependent_table
       and attribute.attname = 'item_id'
       and not attribute.attisdropped;

    if dependent_id_oid is distinct from item_id_oid
       or dependent_id_typmod is distinct from item_id_typmod then
      raise exception '% item_id type must match inventory_items.id', dependent_table;
    end if;
  end loop;
end $$;

create index if not exists buyback_agreements_store_signed_idx
  on public.buyback_agreements (store_id, signed_at desc);

alter table public.buyback_agreements enable row level security;
revoke all on table public.buyback_agreements from public, anon, authenticated, service_role;
grant select, insert, update on table public.buyback_agreements to service_role;

alter table public.inventory_attachments
  add column if not exists agreement_id uuid;

alter table public.inventory_attachments
  drop constraint if exists inventory_attachments_agreement_fkey;

alter table public.inventory_attachments
  add constraint inventory_attachments_agreement_fkey
    foreign key (agreement_id) references public.buyback_agreements(id)
    on update cascade on delete restrict;

create or replace function public.repairdesk_finalize_buyback(
  p_store_id uuid,
  p_item_id text,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_item_patch jsonb,
  p_quality_check jsonb,
  p_agreement_snapshot jsonb,
  p_agreement_hash text,
  p_agreement_version text,
  p_privacy_notice_version text,
  p_language text,
  p_document_type text,
  p_document_no_last4 text,
  p_signature_attachment_id text,
  p_evidence_attachment_ids text[],
  p_payment_method text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_email text;
  v_actor_name text;
  v_actor_role text;
  v_customer_name text;
  v_customer_phone text;
  v_existing public.buyback_agreements%rowtype;
  v_item public.inventory_items%rowtype;
  v_quote jsonb;
  v_device jsonb;
  v_declarations jsonb;
  v_evidence_kinds text[];
  v_evidence_count integer;
  v_amount numeric(12, 2);
  v_serial text;
  v_payment_method text := btrim(coalesce(p_payment_method, ''));
  v_quality_id text := gen_random_uuid()::text;
  v_payment_id public.inventory_transactions.id%type;
  v_signature_attachment_id public.inventory_attachments.id%type;
  v_agreement_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
begin
  if p_store_id is null or nullif(btrim(coalesce(p_item_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_idempotency_key');
  end if;
  if p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'missing_expected_version');
  end if;
  if jsonb_typeof(p_item_patch) <> 'object'
     or jsonb_typeof(p_quality_check) <> 'object'
     or jsonb_typeof(p_agreement_snapshot) <> 'object'
     or p_agreement_hash !~ '^[a-f0-9]{64}$'
     or p_agreement_version <> 'chinatech-buyback-v1'
     or p_privacy_notice_version <> 'chinatech-privacy-v1'
     or p_language <> 'it-IT'
     or coalesce(p_agreement_snapshot ->> 'agreement_version', '') <> 'chinatech-buyback-v1'
     or coalesce(p_agreement_snapshot ->> 'privacy_notice_version', '') <> 'chinatech-privacy-v1'
     or coalesce(p_agreement_snapshot ->> 'language', '') <> 'it-IT'
     or coalesce(p_agreement_snapshot -> 'legal_documents' -> 'privacy_notice' ->> 'version', '') <> 'chinatech-privacy-v1'
     or coalesce(p_agreement_snapshot -> 'legal_documents' -> 'privacy_notice' ->> 'sha256', '') <> '6dc1170ad137c5c8e0b027c24f47adae7f3cada24bf3e9432e4495999996eec6'
     or nullif(btrim(coalesce(p_agreement_snapshot -> 'legal_documents' -> 'privacy_notice' ->> 'text', '')), '') is null
     or coalesce(p_agreement_snapshot -> 'legal_documents' -> 'buyback_terms' ->> 'version', '') <> 'chinatech-buyback-v1'
     or coalesce(p_agreement_snapshot -> 'legal_documents' -> 'buyback_terms' ->> 'sha256', '') <> '6078b738a34bbe22e01b004cef8ebd58f3ae914b941adf605302540c35d73361'
     or nullif(btrim(coalesce(p_agreement_snapshot -> 'legal_documents' -> 'buyback_terms' ->> 'text', '')), '') is null
     or p_document_type not in ('id_card', 'passport', 'residence_permit', 'driver_license', 'other')
     or nullif(btrim(coalesce(p_document_no_last4, '')), '') is null
     or btrim(p_document_no_last4) !~ '^[A-Za-z0-9]{1,4}$'
     or cardinality(p_evidence_attachment_ids) < 3
     or nullif(btrim(coalesce(p_signature_attachment_id, '')), '') is null
     or char_length(v_payment_method) not between 1 and 64 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_store_id::text || ':' || p_idempotency_key::text, 0)
  );

  select profile.email,
         coalesce(membership.display_name, profile.display_name, profile.email),
         membership.role::text
    into v_actor_email, v_actor_name, v_actor_role
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

  if v_actor_role is null or v_actor_role not in ('owner', 'manager') then
    return jsonb_build_object('ok', false, 'code', 'actor_forbidden');
  end if;

  select agreement.*
    into v_existing
    from public.buyback_agreements as agreement
   where agreement.store_id = p_store_id
     and agreement.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.item_id::text <> p_item_id
       or v_existing.actor_id <> p_actor_id
       or v_existing.agreement_hash <> p_agreement_hash
       or v_existing.item_updated_at_before <> p_expected_updated_at then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'idempotent_replay',
      'item_id', v_existing.item_id::text,
      'agreement_id', v_existing.id::text,
      'payment_id', v_existing.payment_transaction_id::text,
      'updated_at', v_existing.item_updated_at_after
    );
  end if;

  select item.*
    into v_item
    from public.inventory_items as item
   where item.store_id = p_store_id
     and item.id::text = p_item_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'item_not_found');
  end if;
  if v_item.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_version');
  end if;
  if v_item.source_type <> 'buyback' then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if v_item.status::text = 'purchased' then
    return jsonb_build_object('ok', false, 'code', 'already_finalized');
  end if;
  if v_item.status::text not in ('intake', 'evaluating', 'offer_made') then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;

  select customer.name,
         coalesce(nullif(customer.phone_e164, ''), customer.phone_raw, '')
    into v_customer_name, v_customer_phone
    from public.customers as customer
   where customer.store_id = p_store_id
     and customer.id = v_item.customer_id
   for share;

  if not found
     or lower(regexp_replace(btrim(coalesce(v_customer_name, '')), '[[:space:]]+', ' ', 'g'))
          <> lower(regexp_replace(
               btrim(coalesce(p_agreement_snapshot -> 'seller' ->> 'name', '')),
               '[[:space:]]+', ' ', 'g'
             ))
     or regexp_replace(coalesce(v_customer_phone, ''), '[^0-9]', '', 'g')
          <> regexp_replace(
               coalesce(p_agreement_snapshot -> 'seller' ->> 'phone', ''),
               '[^0-9]', '', 'g'
             ) then
    return jsonb_build_object('ok', false, 'code', 'seller_mismatch');
  end if;

  v_quote := coalesce(p_item_patch -> 'quote_payload' -> 'buyback_quote', '{}'::jsonb);
  v_device := coalesce(p_item_patch -> 'quote_payload' -> 'buyback_device', '{}'::jsonb);
  v_declarations := coalesce(p_agreement_snapshot -> 'declarations', '{}'::jsonb);
  v_amount := round(coalesce((p_item_patch ->> 'buyback_price')::numeric, 0), 2);

  if coalesce(v_quote ->> 'intent_outcome', '') <> 'accepted' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;
  if coalesce((v_quote ->> 'hard_block')::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'hard_blocked');
  end if;
  if v_amount <= 0
     or round(coalesce((v_quote ->> 'final_offer')::numeric, 0), 2) <> v_amount
     or round(coalesce((p_agreement_snapshot -> 'quote' ->> 'amount')::numeric, 0), 2) <> v_amount then
    return jsonb_build_object('ok', false, 'code', 'quote_mismatch');
  end if;
  if nullif(btrim(coalesce(p_item_patch ->> 'serial_or_imei', '')), '') is null
     or coalesce(p_agreement_snapshot -> 'device' ->> 'serial_or_imei', '') <> p_item_patch ->> 'serial_or_imei' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  v_serial := lower(btrim(p_item_patch ->> 'serial_or_imei'));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('buyback-serial:' || p_store_id::text || ':' || v_serial, 0)
  );
  if exists (
    select 1
      from public.inventory_items as other_item
     where other_item.store_id = p_store_id
       and other_item.id <> v_item.id
       and lower(btrim(coalesce(other_item.serial_or_imei, ''))) = v_serial
       and other_item.status::text not in ('cancelled', 'returned', 'recycled')
  ) then
    return jsonb_build_object('ok', false, 'code', 'evidence_mismatch');
  end if;

  if coalesce(p_quality_check ->> 'imei_check_status', '') <> 'pass'
     or coalesce(p_quality_check ->> 'activation_lock_status', '') <> 'pass'
     or coalesce(p_quality_check ->> 'data_wipe_status', '') = 'fail' then
    return jsonb_build_object('ok', false, 'code', 'inspection_blocked');
  end if;
  if exists (
    select 1
      from jsonb_array_elements_text(
        jsonb_build_array(
          p_quality_check ->> 'screen_status',
          p_quality_check ->> 'touch_status',
          p_quality_check ->> 'camera_status',
          p_quality_check ->> 'buttons_status',
          p_quality_check ->> 'ports_status',
          p_quality_check ->> 'speaker_status',
          p_quality_check ->> 'microphone_status',
          p_quality_check ->> 'wifi_status',
          p_quality_check ->> 'bluetooth_status',
          p_quality_check ->> 'cellular_status'
        )
      ) as required_status(value)
     where coalesce(required_status.value, '') not in ('pass', 'fail')
  ) then
    return jsonb_build_object('ok', false, 'code', 'inspection_missing');
  end if;

  if coalesce((v_declarations ->> 'ownership_confirmed')::boolean, false) is not true
     or coalesce((v_declarations ->> 'data_wipe_authorized')::boolean, false) is not true
     or coalesce((v_declarations ->> 'privacy_notice_accepted')::boolean, false) is not true
     or coalesce((v_declarations ->> 'agreement_accepted')::boolean, false) is not true
     or (coalesce((v_device ->> 'purchase_proof')::boolean, false) is false
         and coalesce((v_declarations ->> 'no_invoice_confirmed')::boolean, false) is not true)
     or (coalesce((v_device ->> 'box_included')::boolean, false) is false
         and coalesce((v_declarations ->> 'no_box_confirmed')::boolean, false) is not true) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if coalesce(p_agreement_snapshot -> 'seller' ->> 'name', '') = ''
     or coalesce(p_agreement_snapshot -> 'seller' ->> 'phone', '') = ''
     or coalesce(p_agreement_snapshot -> 'seller' ->> 'document_type', '') <> p_document_type
     or coalesce(p_agreement_snapshot -> 'seller' ->> 'document_no_last4', '') <> coalesce(p_document_no_last4, '')
     or coalesce(p_agreement_snapshot ->> 'agreement_version', '') <> p_agreement_version
     or coalesce(p_agreement_snapshot ->> 'privacy_notice_version', '') <> p_privacy_notice_version
     or coalesce(p_agreement_snapshot ->> 'language', '') <> p_language
     or coalesce(p_agreement_snapshot -> 'device' ->> 'brand', '')
          <> coalesce(btrim(p_item_patch ->> 'brand'), '')
     or coalesce(p_agreement_snapshot -> 'device' ->> 'model', '')
          <> coalesce(btrim(p_item_patch ->> 'model'), '')
     or coalesce(p_agreement_snapshot -> 'device' ->> 'storage_capacity', '')
          <> coalesce(btrim(p_item_patch ->> 'storage_capacity'), '')
     or coalesce(p_agreement_snapshot -> 'device' ->> 'serial_or_imei', '')
          <> coalesce(btrim(p_item_patch ->> 'serial_or_imei'), '')
     or coalesce(p_agreement_snapshot -> 'device' ->> 'purchase_proof', 'false')
          <> coalesce(v_device ->> 'purchase_proof', 'false')
     or coalesce(p_agreement_snapshot -> 'device' ->> 'box_included', 'false')
          <> coalesce(v_device ->> 'box_included', 'false')
     or coalesce(p_agreement_snapshot -> 'payment' ->> 'method', '') <> v_payment_method then
    return jsonb_build_object('ok', false, 'code', 'signature_stale');
  end if;

  perform attachment.id
    from public.inventory_attachments as attachment
   where attachment.store_id = p_store_id
     and attachment.item_id = v_item.id
     and attachment.id::text = any(p_evidence_attachment_ids)
   for update;

  select count(distinct attachment.id), array_agg(distinct attachment.kind)
    into v_evidence_count, v_evidence_kinds
    from public.inventory_attachments as attachment
   where attachment.store_id = p_store_id
     and attachment.item_id = v_item.id
     and attachment.id::text = any(p_evidence_attachment_ids)
     and attachment.storage_bucket = 'repairdesk-buyback-evidence'
     and attachment.sensitivity = 'restricted'
     and attachment.evidence_status = 'staged'
     and attachment.staging_expires_at > v_now;

  if v_evidence_count <> cardinality(p_evidence_attachment_ids)
     or not ('device_photo' = any(coalesce(v_evidence_kinds, array[]::text[])))
     or not ('id_front' = any(coalesce(v_evidence_kinds, array[]::text[])))
     or not ('signature' = any(coalesce(v_evidence_kinds, array[]::text[])))
     or (p_document_type <> 'passport'
         and not ('id_back' = any(coalesce(v_evidence_kinds, array[]::text[])))) then
    return jsonb_build_object('ok', false, 'code', 'evidence_missing');
  end if;
  select signature.id
    into v_signature_attachment_id
    from public.inventory_attachments as signature
   where signature.store_id = p_store_id
     and signature.item_id = v_item.id
     and signature.id::text = p_signature_attachment_id
     and signature.id::text = any(p_evidence_attachment_ids)
     and signature.kind = 'signature'
     and signature.storage_bucket = 'repairdesk-buyback-evidence'
     and signature.sensitivity = 'restricted'
     and signature.evidence_status = 'staged'
     and signature.staging_expires_at > v_now
     and signature.agreement_hash = p_agreement_hash
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'signature_stale');
  end if;
  if exists (
    select 1
      from public.inventory_attachments as identity_file
     where identity_file.store_id = p_store_id
       and identity_file.item_id = v_item.id
       and identity_file.id::text = any(p_evidence_attachment_ids)
       and identity_file.kind in ('id_front', 'id_back')
       and (
         identity_file.storage_bucket <> 'repairdesk-buyback-evidence'
         or identity_file.sensitivity <> 'restricted'
       )
  ) then
    return jsonb_build_object('ok', false, 'code', 'evidence_mismatch');
  end if;

  insert into public.inventory_quality_checks (
    id, store_id, item_id,
    screen_status, touch_status, camera_status, buttons_status, ports_status,
    speaker_status, microphone_status, wifi_status, bluetooth_status, cellular_status,
    battery_health, cosmetic_grade, functional_grade,
    imei_check_status, activation_lock_status, data_wipe_status,
    notes, checked_by, checked_at, created_at
  )
  select quality.id, quality.store_id, quality.item_id,
         quality.screen_status, quality.touch_status, quality.camera_status,
         quality.buttons_status, quality.ports_status, quality.speaker_status,
         quality.microphone_status, quality.wifi_status, quality.bluetooth_status,
         quality.cellular_status, quality.battery_health, quality.cosmetic_grade,
         quality.functional_grade, quality.imei_check_status,
         quality.activation_lock_status, quality.data_wipe_status,
         quality.notes, quality.checked_by, quality.checked_at, quality.created_at
    from jsonb_populate_record(
      null::public.inventory_quality_checks,
      jsonb_build_object(
        'id', v_quality_id,
        'store_id', p_store_id,
        'item_id', v_item.id,
        'screen_status', p_quality_check ->> 'screen_status',
        'touch_status', p_quality_check ->> 'touch_status',
        'camera_status', p_quality_check ->> 'camera_status',
        'buttons_status', p_quality_check ->> 'buttons_status',
        'ports_status', p_quality_check ->> 'ports_status',
        'speaker_status', p_quality_check ->> 'speaker_status',
        'microphone_status', p_quality_check ->> 'microphone_status',
        'wifi_status', p_quality_check ->> 'wifi_status',
        'bluetooth_status', p_quality_check ->> 'bluetooth_status',
        'cellular_status', p_quality_check ->> 'cellular_status',
        'battery_health', nullif(p_quality_check ->> 'battery_health', ''),
        'cosmetic_grade', coalesce(nullif(p_quality_check ->> 'cosmetic_grade', ''), 'unknown'),
        'functional_grade', coalesce(nullif(p_quality_check ->> 'functional_grade', ''), 'untested'),
        'imei_check_status', p_quality_check ->> 'imei_check_status',
        'activation_lock_status', p_quality_check ->> 'activation_lock_status',
        'data_wipe_status', coalesce(nullif(p_quality_check ->> 'data_wipe_status', ''), 'unchecked'),
        'checked_by', p_actor_id,
        'checked_at', v_now,
        'created_at', v_now
      )
    ) as quality;

  with typed_item_patch as (
    select patch.*
      from jsonb_populate_record(
        null::public.inventory_items,
        jsonb_build_object(
          'category', coalesce(nullif(btrim(p_item_patch ->> 'category'), ''), v_item.category),
          'brand', coalesce(nullif(btrim(p_item_patch ->> 'brand'), ''), v_item.brand),
          'model', coalesce(nullif(btrim(p_item_patch ->> 'model'), ''), v_item.model),
          'color', nullif(btrim(p_item_patch ->> 'color'), ''),
          'storage_capacity', nullif(btrim(p_item_patch ->> 'storage_capacity'), ''),
          'serial_or_imei', nullif(btrim(p_item_patch ->> 'serial_or_imei'), ''),
          'buyback_price', v_amount,
          'list_price', round(coalesce((p_item_patch ->> 'list_price')::numeric, 0), 2),
          'repair_cost_amount', round(coalesce((p_item_patch ->> 'repair_cost_amount')::numeric, 0), 2),
          'payment_method', v_payment_method,
          'notes', nullif(btrim(p_item_patch ->> 'notes'), ''),
          'legacy_payload', (
            coalesce(v_item.legacy_payload, '{}'::jsonb)
              - 'buyback_quote'
              - 'buyback_device'
              - 'buyback_repair_plan'
              - 'buyback_function_checks'
              - 'buyback_customer'
              - 'buyback_declarations'
          ) || coalesce(p_item_patch -> 'quote_payload', '{}'::jsonb),
          'battery_health', nullif(p_quality_check ->> 'battery_health', ''),
          'cosmetic_grade', coalesce(nullif(p_quality_check ->> 'cosmetic_grade', ''), 'unknown'),
          'functional_grade', coalesce(nullif(p_quality_check ->> 'functional_grade', ''), 'untested'),
          'imei_check_status', p_quality_check ->> 'imei_check_status',
          'activation_lock_status', p_quality_check ->> 'activation_lock_status',
          'data_wipe_status', coalesce(nullif(p_quality_check ->> 'data_wipe_status', ''), 'unchecked'),
          'status', 'purchased',
          'purchased_at', v_now,
          'updated_by', p_actor_id,
          'updated_at', v_now
        )
      ) as patch
  )
  update public.inventory_items as item
     set category = patch.category,
         brand = patch.brand,
         model = patch.model,
         color = patch.color,
         storage_capacity = patch.storage_capacity,
         serial_or_imei = patch.serial_or_imei,
         buyback_price = patch.buyback_price,
         list_price = patch.list_price,
         repair_cost_amount = patch.repair_cost_amount,
         payment_method = patch.payment_method,
         notes = patch.notes,
         legacy_payload = patch.legacy_payload,
         battery_health = patch.battery_health,
         cosmetic_grade = patch.cosmetic_grade,
         functional_grade = patch.functional_grade,
         imei_check_status = patch.imei_check_status,
         activation_lock_status = patch.activation_lock_status,
         data_wipe_status = patch.data_wipe_status,
         status = patch.status,
         purchased_at = patch.purchased_at,
         updated_by = patch.updated_by,
         updated_at = patch.updated_at
    from typed_item_patch as patch
   where item.store_id = p_store_id
     and item.id = v_item.id;

  insert into public.inventory_transactions (
    id, store_id, item_id, transaction_type, amount, currency_code,
    method, note, actor_id, created_at
  )
  select payment.id, payment.store_id, payment.item_id, payment.transaction_type,
         payment.amount, payment.currency_code, payment.method, payment.note,
         payment.actor_id, payment.created_at
    from jsonb_populate_record(
      null::public.inventory_transactions,
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'store_id', p_store_id,
        'item_id', v_item.id,
        'transaction_type', 'buyback_payment',
        'amount', v_amount,
        'currency_code', 'EUR',
        'method', v_payment_method,
        'note', '回收成交付款',
        'actor_id', p_actor_id,
        'created_at', v_now
      )
    ) as payment
  returning id into v_payment_id;

  insert into public.buyback_agreements (
    id, store_id, item_id, idempotency_key, actor_id, actor_name_snapshot,
    payment_transaction_id, signature_attachment_id, evidence_attachment_ids,
    document_type, document_no_last4, agreement_version, privacy_notice_version,
    language, agreement_hash, agreement_snapshot, item_updated_at_before,
    item_updated_at_after, signed_at, created_at
  )
  select agreement.id, agreement.store_id, agreement.item_id,
         agreement.idempotency_key, agreement.actor_id, agreement.actor_name_snapshot,
         agreement.payment_transaction_id, agreement.signature_attachment_id,
         agreement.evidence_attachment_ids, agreement.document_type,
         agreement.document_no_last4, agreement.agreement_version,
         agreement.privacy_notice_version, agreement.language,
         agreement.agreement_hash, agreement.agreement_snapshot,
         agreement.item_updated_at_before, agreement.item_updated_at_after,
         agreement.signed_at, agreement.created_at
    from jsonb_populate_record(
      null::public.buyback_agreements,
      jsonb_build_object(
        'id', v_agreement_id,
        'store_id', p_store_id,
        'item_id', v_item.id,
        'idempotency_key', p_idempotency_key,
        'actor_id', p_actor_id,
        'actor_name_snapshot', v_actor_name,
        'payment_transaction_id', v_payment_id,
        'signature_attachment_id', v_signature_attachment_id,
        'evidence_attachment_ids', to_jsonb(p_evidence_attachment_ids),
        'document_type', p_document_type,
        'document_no_last4', nullif(btrim(coalesce(p_document_no_last4, '')), ''),
        'agreement_version', p_agreement_version,
        'privacy_notice_version', p_privacy_notice_version,
        'language', p_language,
        'agreement_hash', p_agreement_hash,
        'agreement_snapshot', p_agreement_snapshot,
        'item_updated_at_before', v_item.updated_at,
        'item_updated_at_after', v_now,
        'signed_at', v_now,
        'created_at', v_now
      )
    ) as agreement;

  update public.inventory_attachments
     set agreement_id = v_agreement_id,
         evidence_status = 'bound',
         bound_at = v_now,
         staging_expires_at = null,
         updated_at = v_now
   where store_id = p_store_id
     and item_id = v_item.id
     and id::text = any(p_evidence_attachment_ids);

  insert into public.inventory_events (
    id, store_id, item_id, event_type, from_status, to_status,
    payload, operator_user_id, operator_name, operator_email, created_at
  )
  select event.id, event.store_id, event.item_id, event.event_type,
         event.from_status, event.to_status, event.payload,
         event.operator_user_id, event.operator_name, event.operator_email,
         event.created_at
    from jsonb_populate_record(
      null::public.inventory_events,
      jsonb_build_object(
        'id', gen_random_uuid(),
        'store_id', p_store_id,
        'item_id', v_item.id,
        'event_type', 'buyback_finalized',
        'from_status', v_item.status::text,
        'to_status', 'purchased',
        'payload', jsonb_build_object(
          'agreement_id', v_agreement_id,
          'payment_id', v_payment_id,
          'amount', v_amount,
          'currency_code', 'EUR'
        ),
        'operator_user_id', p_actor_id,
        'operator_name', v_actor_name,
        'operator_email', v_actor_email,
        'created_at', v_now
      )
    ) as event;

  insert into public.audit_logs (
    id, actor_id, actor_email, actor_name, store_id,
    action, entity_type, entity_id, metadata, created_at
  )
  select audit.id, audit.actor_id, audit.actor_email, audit.actor_name,
         audit.store_id, audit.action, audit.entity_type, audit.entity_id,
         audit.metadata, audit.created_at
    from jsonb_populate_record(
      null::public.audit_logs,
      jsonb_build_object(
        'id', gen_random_uuid(),
        'actor_id', p_actor_id,
        'actor_email', v_actor_email,
        'actor_name', v_actor_name,
        'store_id', p_store_id,
        'action', 'finalize_buyback',
        'entity_type', 'inventory_item',
        'entity_id', v_item.id::text,
        'metadata', jsonb_build_object(
          'agreement_id', v_agreement_id,
          'payment_id', v_payment_id,
          'evidence_count', cardinality(p_evidence_attachment_ids)
        ),
        'created_at', v_now
      )
    ) as audit;

  return jsonb_build_object(
    'ok', true,
    'code', 'finalized',
    'item_id', v_item.id::text,
    'agreement_id', v_agreement_id::text,
    'payment_id', v_payment_id::text,
    'updated_at', v_now
  );
end;
$$;

revoke all on function public.repairdesk_finalize_buyback(
  uuid, text, uuid, timestamptz, uuid, jsonb, jsonb, jsonb, text,
  text, text, text, text, text, text, text[], text
) from public, anon, authenticated;

grant execute on function public.repairdesk_finalize_buyback(
  uuid, text, uuid, timestamptz, uuid, jsonb, jsonb, jsonb, text,
  text, text, text, text, text, text, text[], text
) to service_role;

comment on table public.buyback_agreements is
  'Restricted immutable buyback agreement snapshot and atomic finalize idempotency ledger. Full document numbers are intentionally not stored.';

comment on function public.repairdesk_finalize_buyback(
  uuid, text, uuid, timestamptz, uuid, jsonb, jsonb, jsonb, text,
  text, text, text, text, text, text, text[], text
) is
  'Server-only atomic buyback finalize command. Locks the item and idempotency key, binds staged evidence, records quality, payment, event and audit in one transaction.';
