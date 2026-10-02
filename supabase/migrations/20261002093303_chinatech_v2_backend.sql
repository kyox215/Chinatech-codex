SET local check_function_bodies = off;

-- Dedicated server-only role; a password is provisioned privately per environment.
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chinatech_runtime') THEN
    CREATE ROLE chinatech_runtime WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
  END IF;
END
$role$;

CREATE SCHEMA "chinatech_v2_private";

CREATE SCHEMA "chinatech_v2";

CREATE TABLE "chinatech_v2"."accounts" (
  "id"             uuid                     NOT NULL,
  "display_name"   text                     NOT NULL DEFAULT ''::text,
  "email"          text                     NOT NULL,
  "account_status" text                     NOT NULL DEFAULT 'pending'::text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "accounts_account_status_check" CHECK ((account_status = ANY (ARRAY['pending'::text, 'active'::text, 'disabled'::text]))),
  CONSTRAINT "accounts_pkey" PRIMARY KEY (id)
);

ALTER TABLE "chinatech_v2"."accounts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "chinatech_v2"."store_memberships" (
  "id"                uuid    NOT NULL DEFAULT gen_random_uuid(),
  "store_id"          uuid    NOT NULL,
  "user_id"           uuid    NOT NULL,
  "role"              text    NOT NULL,
  "membership_status" text    NOT NULL DEFAULT 'pending'::text,
  "permissions"       text[]  NOT NULL DEFAULT '{}'::text[],
  "revision"          integer NOT NULL DEFAULT 1,
  CONSTRAINT "store_memberships_membership_status_check" CHECK ((membership_status = ANY (ARRAY['pending'::text, 'active'::text, 'disabled'::text]))),
  CONSTRAINT "store_memberships_permissions_check1" CHECK (((NOT ('financial.edit'::text = ANY (permissions))) OR ('financial.read'::text = ANY (permissions)))),
  CONSTRAINT "store_memberships_permissions_check"
    CHECK
    ((permissions <@ ARRAY['retail.view'::text, 'retail.edit'::text, 'retail.inspect'::text, 'retail.price'::text, 'retail.sell'::text, 'sale.payment'::text,
    'sale.reconcile'::text,
    'sale.deliver'::text,
    'sale.debt'::text,
    'sale.refund'::text,
    'sale.aftersales'::text,
    'financial.read'::text,
    'financial.edit'::text, 'repairs.view'::text, 'repairs.edit'::text, 'customers.view'::text, 'customers.edit'::text, 'settings.edit'::text, 'staff.manage'::text])),
  CONSTRAINT "store_memberships_pkey" PRIMARY KEY (id),
  CONSTRAINT "store_memberships_revision_check" CHECK ((revision > 0)),
  CONSTRAINT "store_memberships_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'sales'::text, 'technician'::text, 'viewer'::text]))),
  CONSTRAINT "store_memberships_store_id_user_id_key" UNIQUE (store_id, user_id)
);

ALTER TABLE "chinatech_v2"."store_memberships"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "chinatech_v2"."stores" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stores_name_check" CHECK (((length(name) >= 1) AND (length(name) <= 200))),
  CONSTRAINT "stores_pkey" PRIMARY KEY (id)
);

ALTER TABLE "chinatech_v2"."stores"
  ENABLE ROW LEVEL SECURITY;

-- Immutable actor UUIDs remain available if an Auth account is deleted.
CREATE TABLE "chinatech_v2_private"."audit_events" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "store_id"   uuid                     NOT NULL,
  "actor_id"   uuid                     NOT NULL,
  "request_id" uuid                     NOT NULL,
  "kind"       text                     NOT NULL,
  "entity_id"  text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "audit_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "chinatech_v2_private"."audit_events"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "chinatech_v2_private"."audit_events"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "chinatech_v2_private"."command_receipts" (
  "store_id"   uuid                     NOT NULL,
  "actor_id"   uuid                     NOT NULL,
  "request_id" uuid                     NOT NULL,
  "digest"     text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "command_receipts_pkey" PRIMARY KEY (store_id, actor_id, request_id)
);

ALTER TABLE "chinatech_v2_private"."command_receipts"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "chinatech_v2_private"."command_receipts"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "chinatech_v2_private"."customer_devices" (
  "id"          uuid  NOT NULL DEFAULT gen_random_uuid(),
  "store_id"    uuid  NOT NULL,
  "customer_id" uuid  NOT NULL,
  "data"        jsonb NOT NULL,
  CONSTRAINT "customer_devices_data_check" CHECK ((jsonb_typeof(data) = 'object'::text)),
  CONSTRAINT "customer_devices_pkey" PRIMARY KEY (id),
  CONSTRAINT "customer_devices_store_id_id_key" UNIQUE (store_id, id)
);

ALTER TABLE "chinatech_v2_private"."customer_devices"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "chinatech_v2_private"."customer_devices"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "chinatech_v2_private"."customers" (
  "id"               uuid  NOT NULL DEFAULT gen_random_uuid(),
  "store_id"         uuid  NOT NULL,
  "normalized_phone" text  NOT NULL,
  "data"             jsonb NOT NULL,
  CONSTRAINT "customers_data_check" CHECK ((jsonb_typeof(data) = 'object'::text)),
  CONSTRAINT "customers_pkey" PRIMARY KEY (id),
  CONSTRAINT "customers_store_id_id_key" UNIQUE (store_id, id),
  CONSTRAINT "customers_store_id_normalized_phone_key" UNIQUE (store_id, normalized_phone)
);

ALTER TABLE "chinatech_v2_private"."customers"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "chinatech_v2_private"."customers"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "chinatech_v2_private"."procurement_records" (
  "store_id"  uuid  NOT NULL,
  "id"        text  NOT NULL,
  "repair_id" text  NOT NULL,
  "data"      jsonb NOT NULL,
  CONSTRAINT "procurement_records_data_check" CHECK ((jsonb_typeof(data) = 'object'::text)),
  CONSTRAINT "procurement_records_pkey" PRIMARY KEY (store_id, id)
);

ALTER TABLE "chinatech_v2_private"."procurement_records"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "chinatech_v2_private"."procurement_records"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "chinatech_v2_private"."repair_intakes" (
  "store_id"    uuid  NOT NULL,
  "id"          text  NOT NULL,
  "data"        jsonb NOT NULL,
  "customer_id" uuid  NOT NULL,
  "device_id"   uuid  NOT NULL,
  "signatures"  jsonb NOT NULL DEFAULT '[]'::jsonb,
  "workflow"    jsonb,
  CONSTRAINT "repair_intakes_data_check" CHECK ((jsonb_typeof(data) = 'object'::text)),
  CONSTRAINT "repair_intakes_pkey" PRIMARY KEY (store_id, id),
  CONSTRAINT "repair_intakes_signatures_check" CHECK ((jsonb_typeof(signatures) = 'array'::text))
);

ALTER TABLE "chinatech_v2_private"."repair_intakes"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "chinatech_v2_private"."repair_intakes"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "chinatech_v2_private"."retail_units" (
  "store_id" uuid  NOT NULL,
  "id"       text  NOT NULL,
  "data"     jsonb NOT NULL,
  CONSTRAINT "retail_units_data_check" CHECK ((jsonb_typeof(data) = 'object'::text)),
  CONSTRAINT "retail_units_pkey" PRIMARY KEY (store_id, id)
);

ALTER TABLE "chinatech_v2_private"."retail_units"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "chinatech_v2_private"."retail_units"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "chinatech_v2_private"."store_state" (
  "store_id"    uuid   NOT NULL,
  "revision"    bigint NOT NULL DEFAULT 0,
  "settings"    jsonb  NOT NULL,
  "staff_audit" jsonb  NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT "store_state_pkey" PRIMARY KEY (store_id),
  CONSTRAINT "store_state_revision_check" CHECK ((revision >= 0)),
  CONSTRAINT "store_state_staff_audit_check" CHECK ((jsonb_typeof(staff_audit) = 'array'::text))
);

ALTER TABLE "chinatech_v2_private"."store_state"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "chinatech_v2_private"."store_state"
  FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION chinatech_v2_private.live_user()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select auth.uid() is not null and exists(
    select 1 from auth.users u join chinatech_v2.accounts a on a.id=u.id
    join auth.sessions s on s.user_id=u.id
    where u.id=auth.uid() and u.email_confirmed_at is not null and a.account_status='active'
    and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now())
  );
$function$;

CREATE OR REPLACE FUNCTION chinatech_v2_private.member_access (
  target_store uuid,
  permission   text DEFAULT NULL::text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select chinatech_v2_private.live_user() and exists(select 1 from chinatech_v2.store_memberships m
    where m.store_id=target_store and m.user_id=auth.uid() and m.membership_status='active'
    and (permission is null or permission=any(m.permissions)));
$function$;

CREATE OR REPLACE FUNCTION chinatech_v2_private.sync_account()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  -- Shared Auth also serves legacy phone/anonymous accounts.
  if new.email is null or btrim(new.email) = '' then return new; end if;
  insert into chinatech_v2.accounts(id,display_name,email,account_status)
  values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),80),lower(new.email),case when new.email_confirmed_at is null then 'pending' else 'active' end)
  on conflict(id) do update set email=excluded.email,account_status=case when chinatech_v2.accounts.account_status='disabled' then 'disabled' when new.email_confirmed_at is null then 'pending' else 'active' end;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION chinatech_v2_private.verified_account (
  target_store uuid,
  target_email text
)
  RETURNS TABLE (
    id             uuid,
    display_name   text,
    email          text,
    account_status text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select a.id,a.display_name,a.email,a.account_status from chinatech_v2.accounts a join auth.users u on u.id=a.id
  where chinatech_v2_private.member_access(target_store,'staff.manage') and a.email=lower(target_email) and lower(u.email)=lower(target_email) and a.account_status='active' and u.email_confirmed_at is not null;
$function$;

ALTER TABLE "chinatech_v2"."accounts"
  ADD CONSTRAINT "accounts_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "chinatech_v2"."store_memberships"
  ADD CONSTRAINT "store_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES chinatech_v2.accounts(id) ON DELETE CASCADE;

ALTER TABLE "chinatech_v2"."store_memberships"
  ADD CONSTRAINT "store_memberships_store_id_fkey" FOREIGN KEY (store_id) REFERENCES chinatech_v2.stores(id);


ALTER TABLE "chinatech_v2_private"."audit_events"
  ADD CONSTRAINT "audit_events_store_id_fkey" FOREIGN KEY (store_id) REFERENCES chinatech_v2.stores(id);


ALTER TABLE "chinatech_v2_private"."command_receipts"
  ADD CONSTRAINT "command_receipts_store_id_fkey" FOREIGN KEY (store_id) REFERENCES chinatech_v2.stores(id);

ALTER TABLE "chinatech_v2_private"."customer_devices"
  ADD CONSTRAINT "customer_devices_store_id_fkey" FOREIGN KEY (store_id) REFERENCES chinatech_v2.stores(id);

ALTER TABLE "chinatech_v2_private"."customers"
  ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY (store_id) REFERENCES chinatech_v2.stores(id);

ALTER TABLE "chinatech_v2_private"."customer_devices"
  ADD CONSTRAINT "customer_devices_store_id_customer_id_fkey" FOREIGN KEY (store_id, customer_id) REFERENCES chinatech_v2_private.customers(store_id, id);

ALTER TABLE "chinatech_v2_private"."procurement_records"
  ADD CONSTRAINT "procurement_records_store_id_repair_id_fkey" FOREIGN KEY (store_id, repair_id) REFERENCES chinatech_v2_private.repair_intakes(store_id, id);

ALTER TABLE "chinatech_v2_private"."repair_intakes"
  ADD CONSTRAINT "repair_intakes_store_id_customer_id_fkey" FOREIGN KEY (store_id, customer_id) REFERENCES chinatech_v2_private.customers(store_id, id);

ALTER TABLE "chinatech_v2_private"."repair_intakes"
  ADD CONSTRAINT "repair_intakes_store_id_device_id_fkey" FOREIGN KEY (store_id, device_id) REFERENCES chinatech_v2_private.customer_devices(store_id, id);

ALTER TABLE "chinatech_v2_private"."repair_intakes"
  ADD CONSTRAINT "repair_intakes_store_id_fkey" FOREIGN KEY (store_id) REFERENCES chinatech_v2.stores(id);

ALTER TABLE "chinatech_v2_private"."retail_units"
  ADD CONSTRAINT "retail_units_store_id_fkey" FOREIGN KEY (store_id) REFERENCES chinatech_v2.stores(id);

ALTER TABLE "chinatech_v2_private"."store_state"
  ADD CONSTRAINT "store_state_store_id_fkey" FOREIGN KEY (store_id) REFERENCES chinatech_v2.stores(id);

CREATE INDEX store_memberships_user_idx ON chinatech_v2.store_memberships USING btree (user_id, store_id);

CREATE INDEX audit_events_actor_idx ON chinatech_v2_private.audit_events USING btree (actor_id);

CREATE INDEX audit_events_store_idx ON chinatech_v2_private.audit_events USING btree (store_id, created_at);

CREATE INDEX command_receipts_actor_idx ON chinatech_v2_private.command_receipts USING btree (actor_id);

CREATE INDEX customer_devices_customer_idx ON chinatech_v2_private.customer_devices USING btree (store_id, customer_id);

CREATE INDEX customers_store_idx ON chinatech_v2_private.customers USING btree (store_id);

CREATE INDEX procurement_records_repair_idx ON chinatech_v2_private.procurement_records USING btree (store_id, repair_id);

CREATE INDEX repair_intakes_customer_idx ON chinatech_v2_private.repair_intakes USING btree (store_id, customer_id);

CREATE INDEX repair_intakes_device_idx ON chinatech_v2_private.repair_intakes USING btree (store_id, device_id);

CREATE TRIGGER chinatech_v2_account_created
  AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION chinatech_v2_private.sync_account();

CREATE POLICY "own_account" ON "chinatech_v2"."accounts"
  FOR SELECT
  TO "authenticated"
  USING ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "runtime_accounts" ON "chinatech_v2"."accounts"
  FOR SELECT
  TO "chinatech_runtime"
  USING (((id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM chinatech_v2.store_memberships m
  WHERE ((m.user_id = accounts.id) AND chinatech_v2_private.member_access(m.store_id, 'staff.manage'::text))))));

CREATE POLICY "own_membership" ON "chinatech_v2"."store_memberships"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "runtime_member_insert" ON "chinatech_v2"."store_memberships"
  FOR INSERT
  TO "chinatech_runtime"
  WITH CHECK ((chinatech_v2_private.member_access(store_id, 'staff.manage'::text) AND (role <> 'owner'::text)));

CREATE POLICY "runtime_member_update" ON "chinatech_v2"."store_memberships"
  FOR UPDATE
  TO "chinatech_runtime"
  USING (chinatech_v2_private.member_access(store_id, 'staff.manage'::text))
  WITH CHECK (chinatech_v2_private.member_access(store_id, 'staff.manage'::text));

CREATE POLICY "runtime_members" ON "chinatech_v2"."store_memberships"
  FOR SELECT
  TO "chinatech_runtime"
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR chinatech_v2_private.member_access(store_id, 'staff.manage'::text)));

CREATE POLICY "runtime_stores" ON "chinatech_v2"."stores"
  FOR SELECT
  TO "chinatech_runtime"
  USING (chinatech_v2_private.member_access(id));

CREATE POLICY "tenant_scope" ON "chinatech_v2_private"."audit_events"
  FOR ALL
  TO "chinatech_runtime"
  USING ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))))
  WITH CHECK ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))));

CREATE POLICY "tenant_scope" ON "chinatech_v2_private"."command_receipts"
  FOR ALL
  TO "chinatech_runtime"
  USING ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))))
  WITH CHECK ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))));

CREATE POLICY "tenant_scope" ON "chinatech_v2_private"."customer_devices"
  FOR ALL
  TO "chinatech_runtime"
  USING ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))))
  WITH CHECK ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))));

CREATE POLICY "tenant_scope" ON "chinatech_v2_private"."customers"
  FOR ALL
  TO "chinatech_runtime"
  USING ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))))
  WITH CHECK ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))));

CREATE POLICY "tenant_scope" ON "chinatech_v2_private"."procurement_records"
  FOR ALL
  TO "chinatech_runtime"
  USING ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))))
  WITH CHECK ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))));

CREATE POLICY "tenant_scope" ON "chinatech_v2_private"."repair_intakes"
  FOR ALL
  TO "chinatech_runtime"
  USING ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))))
  WITH CHECK ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))));

CREATE POLICY "tenant_scope" ON "chinatech_v2_private"."retail_units"
  FOR ALL
  TO "chinatech_runtime"
  USING ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))))
  WITH CHECK ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))));

CREATE POLICY "tenant_scope" ON "chinatech_v2_private"."store_state"
  FOR ALL
  TO "chinatech_runtime"
  USING ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))))
  WITH CHECK ((chinatech_v2_private.member_access(store_id) AND ((store_id)::text = ( SELECT current_setting('app.store_id'::text, true) AS current_setting))));

REVOKE ALL ON FUNCTION "chinatech_v2_private"."live_user"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "chinatech_v2_private"."live_user"() TO "chinatech_runtime";

REVOKE ALL ON FUNCTION "chinatech_v2_private"."member_access"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "chinatech_v2_private"."member_access"(uuid, text) TO "chinatech_runtime";

REVOKE ALL ON FUNCTION "chinatech_v2_private"."sync_account"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "chinatech_v2_private"."verified_account"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "chinatech_v2_private"."verified_account"(uuid, text) TO "chinatech_runtime";

GRANT USAGE ON SCHEMA "chinatech_v2" TO "chinatech_runtime";

GRANT USAGE ON SCHEMA "chinatech_v2_private" TO "chinatech_runtime";




GRANT SELECT ON TABLE "chinatech_v2"."accounts" TO "chinatech_runtime";



GRANT INSERT, SELECT, UPDATE ON TABLE "chinatech_v2"."store_memberships" TO "chinatech_runtime";



GRANT SELECT ON TABLE "chinatech_v2"."stores" TO "chinatech_runtime";


GRANT INSERT, SELECT ON TABLE "chinatech_v2_private"."audit_events" TO "chinatech_runtime";

GRANT INSERT, SELECT ON TABLE "chinatech_v2_private"."command_receipts" TO "chinatech_runtime";

GRANT INSERT, SELECT, UPDATE ON TABLE "chinatech_v2_private"."customer_devices" TO "chinatech_runtime";

GRANT INSERT, SELECT, UPDATE ON TABLE "chinatech_v2_private"."customers" TO "chinatech_runtime";

GRANT INSERT, SELECT, UPDATE ON TABLE "chinatech_v2_private"."procurement_records" TO "chinatech_runtime";

GRANT INSERT, SELECT, UPDATE ON TABLE "chinatech_v2_private"."repair_intakes" TO "chinatech_runtime";

GRANT INSERT, SELECT, UPDATE ON TABLE "chinatech_v2_private"."retail_units" TO "chinatech_runtime";

GRANT INSERT, SELECT, UPDATE ON TABLE "chinatech_v2_private"."store_state" TO "chinatech_runtime";


-- Browser roles never read or write business tables through the Data API.
REVOKE ALL ON SCHEMA chinatech_v2, chinatech_v2_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA chinatech_v2, chinatech_v2_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA chinatech_v2_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO chinatech_runtime;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO chinatech_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA chinatech_v2, chinatech_v2_private REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA chinatech_v2_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
