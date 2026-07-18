-- Future tenant rows must start without a shared store identity. Existing rows
-- are intentionally untouched and remain protected by the application output gate.
set lock_timeout = '5s';

alter table public.store_settings
  alter column store_name set default '',
  alter column store_address set default '',
  alter column print_footer set default '',
  alter column message_signature set default '';

reset lock_timeout;
