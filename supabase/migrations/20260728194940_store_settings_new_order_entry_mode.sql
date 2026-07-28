set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.store_settings
  add column new_order_entry_mode text not null default 'professional';

alter table public.store_settings
  add constraint store_settings_new_order_entry_mode_check
  check (new_order_entry_mode in ('simple', 'professional'))
  not valid;

alter table public.store_settings
  validate constraint store_settings_new_order_entry_mode_check;

comment on column public.store_settings.new_order_entry_mode is
  'Store-scoped default presentation mode for new order intake. Active sessions snapshot this value; allowed values are simple and professional.';

reset statement_timeout;
reset lock_timeout;
