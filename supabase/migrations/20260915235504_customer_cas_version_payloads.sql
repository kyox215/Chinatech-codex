-- Keep legacy bulk import/apply/rollback timestamps unchanged. Customer CAS writers
-- now generate their strictly newer payload from the user's frozen expected version.
-- Atomic tag replacement continues to advance its version within its transaction.
set lock_timeout = '5s';
set statement_timeout = '60s';
drop trigger if exists repairdesk_customer_monotonic_version on public.customers;
drop trigger if exists repairdesk_device_monotonic_version on public.devices;
