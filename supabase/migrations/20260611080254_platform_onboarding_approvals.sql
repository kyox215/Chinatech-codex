do $$
begin
  create type public.platform_admin_status as enum ('active', 'inactive');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.onboarding_request_type as enum ('create_store', 'join_store');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.onboarding_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.platform_admins (
  user_id uuid primary key,
  email text not null unique,
  display_name text,
  status public.platform_admin_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admins_user_fkey
    foreign key (user_id) references auth.users(id)
    on update cascade on delete cascade
);

create table if not exists public.onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null,
  email text not null,
  display_name text,
  request_type public.onboarding_request_type not null,
  desired_store_name text,
  target_store_id uuid,
  target_store_name text,
  requested_role public.staff_role not null default 'viewer',
  status public.onboarding_request_status not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  decision_note text,
  resulting_store_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_requests_user_fkey
    foreign key (requester_user_id) references auth.users(id)
    on update cascade on delete cascade,
  constraint onboarding_requests_target_store_fkey
    foreign key (target_store_id) references public.stores(id)
    on update cascade on delete set null,
  constraint onboarding_requests_result_store_fkey
    foreign key (resulting_store_id) references public.stores(id)
    on update cascade on delete set null,
  constraint onboarding_requests_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id)
    on update cascade on delete set null,
  constraint onboarding_requests_kind_data
    check (
      (request_type = 'create_store' and desired_store_name is not null)
      or (request_type = 'join_store' and target_store_id is not null)
    )
);

create table if not exists public.platform_audit_logs (
  id text primary key,
  actor_id uuid,
  actor_email text,
  actor_name text not null default 'system',
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint platform_audit_logs_before_object
    check (before_data is null or jsonb_typeof(before_data) = 'object'),
  constraint platform_audit_logs_after_object
    check (after_data is null or jsonb_typeof(after_data) = 'object'),
  constraint platform_audit_logs_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists platform_admins_status_idx on public.platform_admins (status);
create index if not exists onboarding_requests_requester_status_idx
  on public.onboarding_requests (requester_user_id, status, created_at desc);
create index if not exists onboarding_requests_status_created_idx
  on public.onboarding_requests (status, created_at asc);
create index if not exists onboarding_requests_target_store_idx
  on public.onboarding_requests (target_store_id, status);
create unique index if not exists onboarding_requests_one_pending_per_user_idx
  on public.onboarding_requests (requester_user_id)
  where status = 'pending';
create index if not exists platform_audit_logs_entity_idx
  on public.platform_audit_logs (entity_type, entity_id, created_at desc);
create index if not exists platform_audit_logs_actor_created_idx
  on public.platform_audit_logs (actor_id, created_at desc);

alter table public.platform_admins enable row level security;
alter table public.onboarding_requests enable row level security;
alter table public.platform_audit_logs enable row level security;

grant all on table public.platform_admins to service_role;
grant all on table public.onboarding_requests to service_role;
grant all on table public.platform_audit_logs to service_role;

select pg_notify('pgrst', 'reload schema');
