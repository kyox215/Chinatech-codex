-- Forward compatibility for the atomic self-service store-create RPC.
-- This migration removes only the obsolete request-claim check; the function's
-- exact signature, SECURITY DEFINER, empty search_path, validation, transaction,
-- idempotency, rate limit, DML and return shape remain unchanged.
-- The ACL below is the authority boundary: browser roles are explicitly denied
-- and only service_role may execute this function.
-- No tables, columns, indexes, RLS policies, data or backfills are changed here.

create or replace function public.repairdesk_create_store_atomic_rpc(
  p_request_id uuid,
  p_request_hash text,
  p_store_id uuid,
  p_actor_id uuid,
  p_verified_email text,
  p_display_name text,
  p_store_code text,
  p_name text,
  p_slug text,
  p_timezone text,
  p_currency_code text,
  p_address text,
  p_provisioning jsonb
)
returns table (
  id uuid,
  name text,
  slug text,
  status public.store_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_email text;
  v_existing public.store_creation_operations%rowtype;
  v_store public.stores%rowtype;
  v_now timestamptz := now();
  v_settings jsonb;
begin
  if p_request_id is null
     or p_store_id is null
     or p_actor_id is null
     or p_request_hash !~ '^[0-9a-f]{64}$'
     or length(trim(coalesce(p_name, ''))) not between 2 and 80
     or length(coalesce(p_address, '')) > 500
     or p_timezone <> 'Europe/Rome'
     or p_currency_code <> 'EUR'
     or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
     or length(trim(coalesce(p_store_code, ''))) not between 3 and 32
     or jsonb_typeof(p_provisioning) <> 'object'
     or jsonb_typeof(p_provisioning -> 'settings') <> 'object'
     or jsonb_typeof(p_provisioning -> 'templates') <> 'array'
     or jsonb_typeof(p_provisioning -> 'statuses') <> 'array'
     or jsonb_typeof(p_provisioning -> 'transitions') <> 'array'
     or jsonb_array_length(p_provisioning -> 'templates') < 1
     or jsonb_array_length(p_provisioning -> 'statuses') < 1
     or jsonb_array_length(p_provisioning -> 'transitions') < 1 then
    raise exception using errcode = '22023', message = 'STORE_CREATE_INVALID_INPUT';
  end if;

  select lower(trim(users.email))
    into v_auth_email
    from auth.users users
   where users.id = p_actor_id
     and users.email_confirmed_at is not null;
  if v_auth_email is null or v_auth_email <> lower(trim(coalesce(p_verified_email, ''))) then
    raise exception using errcode = '42501', message = 'STORE_CREATE_EMAIL_NOT_VERIFIED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('store-create:' || p_actor_id::text, 0)
  );

  select operation.*
    into v_existing
    from public.store_creation_operations operation
   where operation.actor_id = p_actor_id
     and operation.request_id = p_request_id;
  if v_existing.request_id is not null then
    if v_existing.request_hash <> p_request_hash then
      raise exception using errcode = '23505', message = 'STORE_CREATE_IDEMPOTENCY_CONFLICT';
    end if;
    return query
      select store.id, store.name, store.slug, store.status
        from public.stores store
       where store.id = v_existing.created_store_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'STORE_CREATE_REPLAY_UNAVAILABLE';
    end if;
    return;
  end if;

  if (
    select count(*)
      from public.stores store
     where store.owner_user_id = p_actor_id
       and store.created_at >= v_now - interval '1 hour'
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'STORE_CREATE_RATE_LIMITED';
  end if;

  insert into public.staff_profiles (
    id, email, display_name, role, status, created_at, updated_at
  ) values (
    p_actor_id,
    v_auth_email,
    left(coalesce(nullif(trim(p_display_name), ''), split_part(v_auth_email, '@', 1)), 120),
    'viewer',
    'active',
    v_now,
    v_now
  )
  on conflict on constraint staff_profiles_pkey do nothing;

  insert into public.stores (
    id, store_code, name, slug, owner_user_id, status, plan,
    timezone, currency_code, created_at, updated_at
  ) values (
    p_store_id, trim(p_store_code), trim(p_name), p_slug, p_actor_id, 'active', 'starter',
    p_timezone, p_currency_code, v_now, v_now
  )
  returning * into v_store;

  if not exists (
    select 1 from public.store_lifecycles lifecycle
     where lifecycle.store_id = v_store.id and lifecycle.phase = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'STORE_CREATE_LIFECYCLE_MISSING';
  end if;

  v_settings := p_provisioning -> 'settings';
  insert into public.store_settings (
    id, store_id, store_name, store_address, store_phone, store_whatsapp, store_email,
    default_order_warranty_text, default_order_warranty_months,
    default_inventory_warranty_months, print_footer, message_signature,
    updated_by, created_at, updated_at
  ) values (
    v_settings ->> 'id', v_store.id, trim(p_name), coalesce(p_address, ''), '', '', '',
    coalesce(v_settings ->> 'default_order_warranty_text', '6个月'),
    coalesce((v_settings ->> 'default_order_warranty_months')::integer, 6),
    coalesce((v_settings ->> 'default_inventory_warranty_months')::integer, 12),
    coalesce(v_settings ->> 'print_footer', ''), trim(p_name),
    p_actor_id, v_now, v_now
  );

  insert into public.message_templates (
    id, store_id, domain, kind, channel, language, label, body_template,
    enabled, sort_order, updated_by, created_at, updated_at
  )
  select template.id, v_store.id, template.domain, template.kind, template.channel,
         template.language, template.label, template.body_template,
         template.enabled, template.sort_order, p_actor_id, v_now, v_now
    from jsonb_to_recordset(p_provisioning -> 'templates') as template(
      id text, domain text, kind text, channel text, language text, label text,
      body_template text, enabled boolean, sort_order integer
    );

  insert into public.order_workflow_statuses (
    id, store_id, code, label, short_label, tone, bucket, sort_order, enabled,
    show_in_order_filters, allowed_for_create, is_default_create_status, is_system,
    created_by, updated_by, created_at, updated_at
  )
  select item.id, v_store.id, item.code, item.label, item.short_label, item.tone,
         item.bucket, item.sort_order, item.enabled, item.show_in_order_filters,
         item.allowed_for_create, item.is_default_create_status, item.is_system,
         p_actor_id, p_actor_id, v_now, v_now
    from jsonb_to_recordset(p_provisioning -> 'statuses') as item(
      id uuid, code text, label text, short_label text, tone text, bucket text,
      sort_order integer, enabled boolean, show_in_order_filters boolean,
      allowed_for_create boolean, is_default_create_status boolean, is_system boolean
    );

  if (
    select count(*) from public.order_workflow_statuses status_row
     where status_row.store_id = v_store.id
       and status_row.enabled
       and status_row.is_default_create_status
  ) <> 1 then
    raise exception using errcode = '22023', message = 'STORE_CREATE_INVALID_DEFAULT_STATUS';
  end if;

  insert into public.order_workflow_transitions (
    id, store_id, from_status_code, to_status_code, is_primary, sort_order, enabled,
    created_by, updated_by, created_at, updated_at
  )
  select item.id, v_store.id, item.from_status_code, item.to_status_code,
         item.is_primary, item.sort_order, item.enabled,
         p_actor_id, p_actor_id, v_now, v_now
    from jsonb_to_recordset(p_provisioning -> 'transitions') as item(
      id uuid, from_status_code text, to_status_code text,
      is_primary boolean, sort_order integer, enabled boolean
    );

  insert into public.store_memberships (
    store_id, user_id, email, display_name, role, status, created_at, updated_at
  ) values (
    v_store.id, p_actor_id, v_auth_email,
    coalesce(nullif(trim(p_display_name), ''), split_part(v_auth_email, '@', 1)),
    'owner', 'active', v_now, v_now
  );

  insert into public.audit_logs (
    id, actor_id, actor_name, store_id, action, entity_type, entity_id,
    after_data, metadata, created_at
  ) values (
    extensions.gen_random_uuid()::text, p_actor_id, 'store-owner', v_store.id,
    'create', 'store', v_store.id::text,
    jsonb_build_object('id', v_store.id, 'status', 'active'),
    jsonb_build_object('request_id', p_request_id), v_now
  );

  insert into public.store_creation_operations (
    actor_id, request_id, request_hash, created_store_id, completed_at
  ) values (
    p_actor_id, p_request_id, p_request_hash, v_store.id, v_now
  );

  return query select v_store.id, v_store.name, v_store.slug, v_store.status;
end;
$$;

revoke all on function public.repairdesk_create_store_atomic_rpc(
  uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.repairdesk_create_store_atomic_rpc(
  uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
