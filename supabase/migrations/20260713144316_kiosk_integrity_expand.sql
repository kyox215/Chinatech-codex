-- WP05-B customer Kiosk integrity expansion.
--
-- This migration deliberately stays independent from the unresolved physical
-- types of customer_kiosk_sessions.order_id/customer_id in the linked
-- database. The corresponding same-store foreign keys belong to a later,
-- separately approved migration after a read-only format_type preflight.
--
-- Constraints are added NOT VALID so they protect new writes immediately
-- without claiming that historical rows have already been reconciled. A later
-- migration may VALIDATE them only after anomaly counts and any repair plan are
-- approved.

-- Fail instead of waiting indefinitely for conflicting production activity.
-- These bounds are intentionally conservative; a timeout requires a new
-- reviewed window, never an improvised retry with weaker limits.
set lock_timeout = '5s';
set statement_timeout = '2min';

create unique index store_kiosk_devices_id_store_id_uidx
  on public.store_kiosk_devices (id, store_id);

create index customer_kiosk_sessions_device_store_idx
  on public.customer_kiosk_sessions (device_id, store_id);

alter table public.customer_kiosk_sessions
  add constraint customer_kiosk_sessions_device_same_store_fkey
  foreign key (device_id, store_id)
  references public.store_kiosk_devices (id, store_id)
  on update cascade
  on delete restrict
  not valid;

alter table public.customer_kiosk_sessions
  add constraint customer_kiosk_sessions_submission_version_nonnegative
  check (submission_version >= 0)
  not valid;

alter table public.customer_kiosk_sessions
  add constraint customer_kiosk_sessions_expiry_after_creation
  check (expires_at > created_at)
  not valid;

alter table public.customer_kiosk_sessions
  add constraint customer_kiosk_sessions_submission_state_shape
  check (
    status not in ('submitted', 'accepted', 'returned')
    or (submission_payload is not null and submitted_at is not null)
  )
  not valid;

alter table public.customer_kiosk_sessions
  add constraint customer_kiosk_sessions_accepted_state_shape
  check (
    status <> 'accepted'
    or (
      accepted_at is not null
      and nullif(btrim(accepted_by), '') is not null
    )
  )
  not valid;

alter table public.customer_kiosk_sessions
  add constraint customer_kiosk_sessions_returned_state_shape
  check (
    status <> 'returned'
    or (
      returned_at is not null
      and nullif(btrim(submission_payload ->> 'customer_return_reason'), '') is not null
    )
  )
  not valid;

alter table public.customer_kiosk_sessions
  add constraint customer_kiosk_sessions_cancelled_state_shape
  check (status <> 'cancelled' or cancelled_at is not null)
  not valid;

alter table public.store_kiosk_devices
  add constraint store_kiosk_devices_token_hash_format
  check (device_token_hash is null or device_token_hash ~ '^[a-f0-9]{64}$')
  not valid;

alter table public.store_kiosk_devices
  add constraint store_kiosk_devices_pairing_hash_format
  check (pairing_code_hash is null or pairing_code_hash ~ '^[a-f0-9]{64}$')
  not valid;

alter table public.store_kiosk_devices
  add constraint store_kiosk_devices_pairing_state_shape
  check (
    status <> 'pairing'
    or (
      device_token_hash is null
      and pairing_code_hash is not null
      and pairing_code_expires_at is not null
      and pairing_code_expires_at > created_at
    )
  )
  not valid;

alter table public.store_kiosk_devices
  add constraint store_kiosk_devices_active_state_shape
  check (
    status <> 'active'
    or (
      device_token_hash is not null
      and paired_at is not null
      and pairing_code_hash is null
      and pairing_code_expires_at is null
    )
  )
  not valid;

alter table public.store_kiosk_devices
  add constraint store_kiosk_devices_revoked_state_shape
  check (
    status <> 'revoked'
    or (
      device_token_hash is null
      and pairing_code_hash is null
      and pairing_code_expires_at is null
      and revoked_at is not null
    )
  )
  not valid;

create index customer_kiosk_sessions_open_expiry_idx
  on public.customer_kiosk_sessions (store_id, expires_at)
  where status in ('queued', 'active', 'returned');

comment on constraint customer_kiosk_sessions_device_same_store_fkey
  on public.customer_kiosk_sessions is
  'Expand-phase tenant guard. NOT VALID until linked historical rows pass the approved preflight and repair gate.';

comment on constraint customer_kiosk_sessions_submission_state_shape
  on public.customer_kiosk_sessions is
  'Expand-phase Kiosk state guard. NOT VALID means historical rows are not yet certified.';

select pg_notify('pgrst', 'reload schema');

reset statement_timeout;
reset lock_timeout;
