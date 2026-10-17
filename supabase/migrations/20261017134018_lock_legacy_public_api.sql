-- Public signup must not grant access to the preserved legacy application's
-- Data API. This project uses chinatech_v2/private through its restricted BFF.
-- Exact production inventory: 15 legacy tables and one owned sequence.
-- Keep every legacy row, policy, owner, PUBLIC/default ACL and service_role grant.
-- Conditional existence also supports new isolated databases without legacy DDL.
do $legacy_public_api$
declare relation_name text;
begin
  foreach relation_name in array array[
    'audit_logs',
    'inventory_create_idempotency',
    'inventory_items',
    'message_templates',
    'onboarding_requests',
    'parts',
    'platform_admins',
    'platform_audit_logs',
    'profiles',
    'staff_profiles',
    'store_invitations',
    'store_memberships',
    'stores',
    'ticket_parts',
    'tickets'
  ] loop
    if pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(relation_name)) is not null then
      execute pg_catalog.format('revoke all privileges on table public.%I from anon, authenticated', relation_name);
    end if;
  end loop;
  if pg_catalog.to_regclass('public.inventory_item_public_no_seq') is not null then
    revoke all privileges on sequence public.inventory_item_public_no_seq from anon, authenticated;
  end if;
end
$legacy_public_api$;
