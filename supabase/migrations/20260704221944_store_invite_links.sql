create table if not exists public.store_invite_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  label text,
  role public.staff_role not null default 'viewer',
  token_hash text not null unique,
  status public.store_membership_status not null default 'active',
  expires_at timestamptz not null,
  max_uses integer,
  used_count integer not null default 0,
  created_by uuid,
  revoked_by uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_invite_links_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete cascade,
  constraint store_invite_links_created_by_fkey
    foreign key (created_by) references auth.users(id)
    on update cascade on delete set null,
  constraint store_invite_links_revoked_by_fkey
    foreign key (revoked_by) references auth.users(id)
    on update cascade on delete set null,
  constraint store_invite_links_role_not_owner_check
    check (role <> 'owner'::public.staff_role),
  constraint store_invite_links_status_check
    check (status in ('active'::public.store_membership_status, 'inactive'::public.store_membership_status)),
  constraint store_invite_links_label_length_check
    check (label is null or char_length(label) <= 40),
  constraint store_invite_links_token_hash_format_check
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint store_invite_links_max_uses_check
    check (max_uses is null or (max_uses >= 1 and max_uses <= 50)),
  constraint store_invite_links_used_count_check
    check (used_count >= 0 and (max_uses is null or used_count <= max_uses))
);

create table if not exists public.store_invite_link_attempts (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  ip_hash text,
  code_hash text not null,
  store_id uuid,
  result text not null,
  created_at timestamptz not null default now(),
  constraint store_invite_link_attempts_actor_fkey
    foreign key (actor_id) references auth.users(id)
    on update cascade on delete set null,
  constraint store_invite_link_attempts_store_fkey
    foreign key (store_id) references public.stores(id)
    on update cascade on delete cascade,
  constraint store_invite_link_attempts_code_hash_format_check
    check (code_hash ~ '^[a-f0-9]{64}$'),
  constraint store_invite_link_attempts_ip_hash_format_check
    check (ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$'),
  constraint store_invite_link_attempts_result_check
    check (result in (
      'success',
      'existing_invitation',
      'rate_limited',
      'not_found',
      'expired',
      'over_limit',
      'already_member',
      'claim_failed',
      'insert_failed'
    ))
);

create index if not exists store_invite_links_store_status_idx
  on public.store_invite_links (store_id, status, created_at desc);

create index if not exists store_invite_links_active_expiry_idx
  on public.store_invite_links (status, expires_at)
  where status = 'active'::public.store_membership_status;

create index if not exists store_invite_link_attempts_actor_created_idx
  on public.store_invite_link_attempts (actor_id, created_at desc)
  where actor_id is not null;

create index if not exists store_invite_link_attempts_ip_created_idx
  on public.store_invite_link_attempts (ip_hash, created_at desc)
  where ip_hash is not null;

create index if not exists store_invite_link_attempts_code_created_idx
  on public.store_invite_link_attempts (code_hash, created_at desc);

alter table public.store_invite_links enable row level security;
alter table public.store_invite_link_attempts enable row level security;

revoke all on table public.store_invite_links from anon, authenticated;
revoke all on table public.store_invite_link_attempts from anon, authenticated;
grant all on table public.store_invite_links to service_role;
grant all on table public.store_invite_link_attempts to service_role;

create or replace function public.claim_store_invite_link(p_token_hash text)
returns table (
  id uuid,
  store_id uuid,
  label text,
  role public.staff_role,
  status public.store_membership_status,
  expires_at timestamptz,
  max_uses integer,
  used_count integer,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  update public.store_invite_links link
     set used_count = link.used_count + 1,
         updated_at = now()
   where link.token_hash = p_token_hash
     and link.status = 'active'::public.store_membership_status
     and link.expires_at > now()
     and (link.max_uses is null or link.used_count < link.max_uses)
   returning
     link.id,
     link.store_id,
     link.label,
     link.role,
     link.status,
     link.expires_at,
     link.max_uses,
     link.used_count,
     link.created_by,
     link.created_at,
     link.updated_at;
end;
$$;

revoke all on function public.claim_store_invite_link(text) from public, anon, authenticated;
grant execute on function public.claim_store_invite_link(text) to service_role;

select pg_notify('pgrst', 'reload schema');
