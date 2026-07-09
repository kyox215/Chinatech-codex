-- Customer Kiosk iPad MVP.
--
-- Expand-only draft. It adds store-bound kiosk devices and customer kiosk
-- sessions without changing existing repair order semantics.

create table if not exists public.store_kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete cascade,
  label text not null,
  status text not null default 'pairing',
  device_token_hash text,
  pairing_code_hash text,
  pairing_code_expires_at timestamptz,
  paired_by text,
  paired_at timestamptz,
  last_seen_at timestamptz,
  revoked_by text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_kiosk_devices_status_check
    check (status in ('pairing', 'active', 'suspended', 'revoked')),
  constraint store_kiosk_devices_label_nonempty
    check (length(btrim(label)) > 0),
  constraint store_kiosk_devices_pairing_shape
    check (
      (status = 'pairing' and pairing_code_hash is not null and pairing_code_expires_at is not null)
      or status <> 'pairing'
    )
);

create unique index if not exists store_kiosk_devices_token_hash_uidx
  on public.store_kiosk_devices (device_token_hash)
  where device_token_hash is not null;

create unique index if not exists store_kiosk_devices_pairing_code_hash_uidx
  on public.store_kiosk_devices (pairing_code_hash)
  where pairing_code_hash is not null;

create index if not exists store_kiosk_devices_store_status_idx
  on public.store_kiosk_devices (store_id, status, updated_at desc);

create table if not exists public.customer_kiosk_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on update cascade on delete cascade,
  device_id uuid not null references public.store_kiosk_devices(id) on update cascade on delete restrict,
  order_id text,
  customer_id text,
  session_type text not null,
  status text not null default 'queued',
  request_payload jsonb not null default '{}'::jsonb,
  submission_payload jsonb,
  submission_version integer not null default 0,
  requested_by text,
  accepted_by text,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  accepted_at timestamptz,
  returned_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_kiosk_sessions_type_check
    check (session_type in ('intake_contact', 'order_contact_signature', 'pickup_signature')),
  constraint customer_kiosk_sessions_status_check
    check (status in ('queued', 'active', 'submitted', 'accepted', 'returned', 'cancelled', 'expired')),
  constraint customer_kiosk_sessions_request_payload_object
    check (jsonb_typeof(request_payload) = 'object'),
  constraint customer_kiosk_sessions_submission_payload_object
    check (submission_payload is null or jsonb_typeof(submission_payload) = 'object'),
  constraint customer_kiosk_sessions_pickup_requires_order
    check (session_type <> 'pickup_signature' or order_id is not null)
);

create unique index if not exists customer_kiosk_sessions_one_open_per_device_uidx
  on public.customer_kiosk_sessions (device_id)
  where status in ('queued', 'active', 'submitted', 'returned');

create index if not exists customer_kiosk_sessions_store_status_idx
  on public.customer_kiosk_sessions (store_id, status, created_at desc);

create index if not exists customer_kiosk_sessions_order_idx
  on public.customer_kiosk_sessions (store_id, order_id, created_at desc)
  where order_id is not null;

alter table public.store_kiosk_devices enable row level security;
alter table public.customer_kiosk_sessions enable row level security;

revoke all on table public.store_kiosk_devices from anon, authenticated;
revoke all on table public.customer_kiosk_sessions from anon, authenticated;

grant all on table public.store_kiosk_devices to service_role;
grant all on table public.customer_kiosk_sessions to service_role;

select pg_notify('pgrst', 'reload schema');
