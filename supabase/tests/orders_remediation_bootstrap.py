"""Print isolated PG17 domain fixture + EXACT repository SQL; never connects to a DB.
Run only in an empty task-owned database. This is not a full production schema test.
"""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
print('''
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create table public.stores(id uuid primary key,status text not null default 'active');
create table public.staff_profiles(id uuid primary key,status text not null default 'active',display_name text,email text);
create table public.store_memberships(id uuid primary key,store_id uuid references public.stores(id),user_id uuid references public.staff_profiles(id),role text,status text,display_name text);
create type public.approval_status as enum('pending','approved','rejected');
create table public.repair_orders(
 id uuid primary key,store_id uuid references public.stores(id),status text,workflow_status text,
 assignee_membership_id uuid references public.store_memberships(id),exception_status text,
 approval_status public.approval_status default 'pending',approval_flow_status text,approval_confirmed_at timestamptz,
 parts_status text,notify_status text,approval_sent_at timestamptz,completed_at timestamptz,delivered_at timestamptz,
 cancel_reason text,diagnosis_result text,device_custody_status text,device_unlock_method text,
 device_unlock_value text,device_unlock_pattern integer[],record_state text default 'active',deleted_at timestamptz,
 updated_at timestamptz not null default now()
);
create table public.order_events(id uuid primary key,store_id uuid references public.stores(id),order_id uuid references public.repair_orders(id),event_type text,payload jsonb,operator_name text,created_at timestamptz);
''')
workflow = (ROOT / 'supabase/migrations/20260611164138_order_workflow_statuses.sql').read_text()
print(workflow[:workflow.index('\ninsert into public.order_workflow_statuses')])
atomic = (ROOT / 'supabase/migrations/20260717182220_order_custody_retain_unlock_credentials.sql').read_text()
start=atomic.index('create or replace function public.repairdesk_apply_order_atomic_mutation(')
end=atomic.index('\ncomment on function public.repairdesk_apply_order_atomic_mutation(',start)
print(atomic[start:end])
print((ROOT / 'supabase/migrations/20260926093439_order_workflow_atomic_and_transition_receipts.sql').read_text())
print('grant usage on schema public to service_role; grant select,insert,update,delete on all tables in schema public to service_role;')

# Exact production lifecycle write fence, applied to relevant synthetic domain tables.
lifecycle = (ROOT / 'supabase/migrations/20260720013000_store_lifecycle_business_fence_and_close_recheck.sql').read_text()
start = lifecycle.index('create or replace function public.repairdesk_enforce_active_store_write()')
end = lifecycle.index('\nrevoke all on function public.repairdesk_enforce_active_store_write()', start)
print("create table public.store_lifecycles(store_id uuid primary key references public.stores(id), phase text not null default 'active');")
print(lifecycle[start:end])
for table in ['repair_orders', 'order_workflow_statuses', 'order_workflow_transitions']:
    print(f"create trigger lifecycle_write before insert or update or delete on public.{table} for each row execute function public.repairdesk_enforce_active_store_write();")
print('grant select on public.store_lifecycles to service_role;')
