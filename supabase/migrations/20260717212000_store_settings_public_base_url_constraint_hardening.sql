alter table public.store_settings
  add column if not exists public_base_url text not null default '';

alter table public.store_settings
  drop constraint if exists store_settings_public_base_url_check;

alter table public.store_settings
  add constraint store_settings_public_base_url_check
  check (
    public_base_url = ''
    or (
      length(public_base_url) <= 2048
      and public_base_url !~ '[[:space:]@?#]'
      and (
        public_base_url ~ '^https://[^[:space:]@?#]+$'
        or public_base_url ~ '^http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?(/[^[:space:]@?#]*)?$'
      )
    )
  ) not valid;

alter table public.store_settings
  validate constraint store_settings_public_base_url_check;

comment on column public.store_settings.public_base_url is
  'Optional store-owned public customer portal base URL. Empty means customer-visible messages omit external portal links.';
