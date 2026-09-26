-- Additive sales workflow. Original sales, payment and warranty facts remain unchanged.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.inventory_sales_workflows (
  sale_order_id uuid not null, store_id uuid not null,
  version bigint not null check (version between 1 and 9007199254740991),
  fiscal_revision bigint not null default 0 check (fiscal_revision >= 0),
  document_type text check (document_type in ('receipt','invoice','other')),
  fiscal_reference text check (char_length(btrim(fiscal_reference)) between 1 and 128),
  fiscal_issued_at timestamptz check (isfinite(fiscal_issued_at)),
  fiscal_recorded_at timestamptz, fiscal_verified_at timestamptz,
  fiscal_verified_by uuid references auth.users(id), fiscal_verified_by_name text,
  assignee_membership_id uuid, follow_up_at timestamptz check (isfinite(follow_up_at)),
  followup_note text check (char_length(followup_note) <= 1000),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (sale_order_id,store_id),
  foreign key (sale_order_id,store_id) references public.inventory_sale_orders(id,store_id),
  foreign key (assignee_membership_id,store_id) references public.store_memberships(id,store_id),
  check ((fiscal_revision=0 and document_type is null and fiscal_reference is null and fiscal_issued_at is null and fiscal_recorded_at is null)
    or (fiscal_revision>0 and document_type is not null and fiscal_reference is not null and fiscal_issued_at is not null and fiscal_recorded_at is not null)),
  check ((fiscal_verified_at is null and fiscal_verified_by is null and fiscal_verified_by_name is null)
    or (fiscal_revision>0 and fiscal_verified_at is not null and fiscal_verified_by is not null and fiscal_verified_by_name is not null))
);
create table public.inventory_sales_workflow_issues (
  id uuid primary key default gen_random_uuid(), store_id uuid not null, sale_order_id uuid not null,
  kind text not null check (kind in ('payment_mismatch','fiscal_document','customer_request','delivery','other')),
  summary text not null check (char_length(btrim(summary)) between 1 and 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  opened_at timestamptz not null default clock_timestamp(), resolved_at timestamptz,
  resolution text check (char_length(btrim(resolution)) between 1 and 1000),
  foreign key (sale_order_id,store_id) references public.inventory_sales_workflows(sale_order_id,store_id),
  check ((status='open' and resolved_at is null and resolution is null) or (status='resolved' and resolved_at is not null and resolution is not null))
);
create index inventory_sales_workflow_issues_order_idx on public.inventory_sales_workflow_issues(store_id,sale_order_id,status,opened_at desc,id);
create table public.inventory_sales_workflow_events (
  id uuid primary key default gen_random_uuid(), store_id uuid not null, sale_order_id uuid not null,
  workflow_version bigint not null, actor_id uuid not null references auth.users(id), actor_name text not null,
  command text not null check (command in ('fiscal.record','fiscal.verify','followup.set','issue.open','issue.resolve')),
  idempotency_key uuid not null, request jsonb not null check (jsonb_typeof(request)='object'),
  payload jsonb not null check (jsonb_typeof(payload)='object'), response jsonb not null check (jsonb_typeof(response)='object'),
  created_at timestamptz not null default clock_timestamp(),
  unique (store_id,idempotency_key), unique (sale_order_id,store_id,workflow_version),
  foreign key (sale_order_id,store_id) references public.inventory_sales_workflows(sale_order_id,store_id)
);
create index inventory_sales_workflow_events_history_idx on public.inventory_sales_workflow_events(store_id,sale_order_id,workflow_version desc);
create index inventory_sales_workflow_due_idx on public.inventory_sales_workflows(store_id,follow_up_at) where follow_up_at is not null;
create index inventory_sales_workflow_assignee_idx on public.inventory_sales_workflows(store_id,assignee_membership_id);
create index inventory_sales_report_agreed_idx on public.inventory_sale_orders(store_id,agreed_at);
create index inventory_sales_report_collected_idx on public.inventory_sale_payment_entries(store_id,occurred_at);
alter table public.inventory_sales_workflows enable row level security;
alter table public.inventory_sales_workflow_issues enable row level security;
alter table public.inventory_sales_workflow_events enable row level security;
revoke all on public.inventory_sales_workflows,public.inventory_sales_workflow_issues,public.inventory_sales_workflow_events from public,anon,authenticated,service_role;
create trigger inventory_sales_workflow_events_immutable before update or delete on public.inventory_sales_workflow_events
  for each row execute function private.inventory_sales_append_only();
-- Every workflow success bumps the existing inventory revision in the same transaction.
create trigger inventory_sales_workflow_revision after insert or update on public.inventory_sales_workflows
  for each row execute function private.bump_repairdesk_inventory_domain_version();

-- Only service RPCs invoke this helper. Role is derived from active authoritative rows.
-- Locks fence membership/staff/store revocation through the end of the transaction.
create function private.inventory_sales_workflow_actor(p_store_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text; v_name text; v_membership uuid; v_finance boolean:=false;
begin
  select m.role::text,coalesce(nullif(m.display_name,''),s.display_name,'Staff'),m.id
    into v_role,v_name,v_membership from public.store_memberships m
    join public.staff_profiles s on s.id=m.user_id join public.stores t on t.id=m.store_id
    where m.store_id=p_store_id and m.user_id=p_actor_id and m.status::text='active'
      and s.status::text='active' and t.status::text='active' for share of m,s,t;
  -- inventory:read + inventory:sale currently permit exactly these three roles.
  if v_role is null or v_role not in ('owner','manager','sales') then return null; end if;
  if v_role='owner' then v_finance:=true;
  elsif v_role='manager' then
    perform 1 from public.store_member_permission_grants g where g.store_id=p_store_id
      and g.membership_id=v_membership and g.user_id=p_actor_id and g.action='finance:aggregate_read'
      and g.revoked_at is null for share of g;
    v_finance:=found;
  end if;
  return jsonb_build_object('role',v_role,'name',v_name,'membership_id',v_membership,'finance',v_finance);
end;
$$;
revoke all on function private.inventory_sales_workflow_actor(uuid,uuid) from public,anon,authenticated,service_role;

create function public.repairdesk_inventory_sales_workflow_command(
  p_store_id uuid,p_actor_id uuid,p_sale_order_id uuid,p_expected_workflow_version bigint,
  p_idempotency_key uuid,p_command text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb; v_work public.inventory_sales_workflows%rowtype; v_existing public.inventory_sales_workflow_events%rowtype;
  v_request jsonb; v_event_payload jsonb; v_result jsonb; v_now timestamptz:=clock_timestamp();
  v_event uuid:=gen_random_uuid(); v_issue uuid; v_assignee uuid; v_follow_at timestamptz; v_issued_at timestamptz;
  v_old_fiscal jsonb; v_keys text[]; v_required text[];
begin
  if p_store_id is null or p_actor_id is null or p_sale_order_id is null or p_idempotency_key is null
    or p_expected_workflow_version is null or p_expected_workflow_version not between 0 and 9007199254740990
    or jsonb_typeof(p_payload) is distinct from 'object' then return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  v_actor:=private.inventory_sales_workflow_actor(p_store_id,p_actor_id);
  if v_actor is null or (p_command='fiscal.verify' and v_actor->>'role' not in ('owner','manager')) then
    return jsonb_build_object('ok',false,'code','actor_forbidden'); end if;
  if p_command is null or p_command not in ('fiscal.record','fiscal.verify','followup.set','issue.open','issue.resolve') then
    return jsonb_build_object('ok',false,'code','invalid_command'); end if;
  v_request:=jsonb_build_object('sale_order_id',p_sale_order_id,'expected_workflow_version',p_expected_workflow_version,'command',p_command,'payload',p_payload);
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||':sales-workflow-key:'||p_idempotency_key::text,0));
  select * into v_existing from public.inventory_sales_workflow_events where store_id=p_store_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.actor_id<>p_actor_id or v_existing.request<>v_request then return jsonb_build_object('ok',false,'code','idempotency_conflict'); end if;
    return v_existing.response||jsonb_build_object('code','idempotent_replay');
  end if;
  -- Serializes version-zero creation as well as all later commands without touching sale facts.
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||':sales-workflow-order:'||p_sale_order_id::text,0));
  if not exists(select 1 from public.inventory_sale_orders where id=p_sale_order_id and store_id=p_store_id) then
    return jsonb_build_object('ok',false,'code','not_found'); end if;
  select * into v_work from public.inventory_sales_workflows where sale_order_id=p_sale_order_id and store_id=p_store_id for update;
  if not found then v_work.sale_order_id:=p_sale_order_id; v_work.store_id:=p_store_id; v_work.version:=0; v_work.fiscal_revision:=0; end if;
  if v_work.version<>p_expected_workflow_version then return jsonb_build_object('ok',false,'code','stale_version'); end if;
  v_event_payload:=p_payload;
  case p_command
    when 'fiscal.record' then v_keys:=array['document_type','reference','issued_at','correction_reason'];v_required:=array['document_type','reference','issued_at'];
    when 'fiscal.verify' then v_keys:=array['expected_fiscal_revision','note'];v_required:=array['expected_fiscal_revision'];
    when 'followup.set' then v_keys:=array['assignee_membership_id','follow_up_at','note'];v_required:=array['assignee_membership_id','follow_up_at'];
    when 'issue.open' then v_keys:=array['kind','summary'];v_required:=v_keys;
    when 'issue.resolve' then v_keys:=array['issue_id','resolution'];v_required:=v_keys;
  end case;
  if not (p_payload ?& v_required) or exists(select 1 from jsonb_object_keys(p_payload) k where not k=any(v_keys)) then
    return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
  if p_payload ? 'note' and (jsonb_typeof(p_payload->'note')<>'string' or char_length(p_payload->>'note')>1000) then
    return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
  if p_command='fiscal.record' then
    if jsonb_typeof(p_payload->'document_type')<>'string' or p_payload->>'document_type' not in ('receipt','invoice','other')
      or jsonb_typeof(p_payload->'reference')<>'string' or char_length(btrim(p_payload->>'reference')) not between 1 and 128
      or jsonb_typeof(p_payload->'issued_at')<>'string'
      or (p_payload ? 'correction_reason' and (jsonb_typeof(p_payload->'correction_reason')<>'string' or char_length(btrim(p_payload->>'correction_reason')) not between 1 and 1000)) then
      return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
    v_issued_at:=(p_payload->>'issued_at')::timestamptz;
    if not isfinite(v_issued_at) then return jsonb_build_object('ok',false,'code','invalid_time'); end if;
    if v_work.fiscal_revision>0 and coalesce(btrim(p_payload->>'correction_reason'),'')='' then
      return jsonb_build_object('ok',false,'code','correction_reason_required'); end if;
    v_old_fiscal:=case when v_work.fiscal_revision>0 then jsonb_build_object('revision',v_work.fiscal_revision,'document_type',v_work.document_type,
      'reference',v_work.fiscal_reference,'issued_at',v_work.fiscal_issued_at,'recorded_at',v_work.fiscal_recorded_at,
      'verified_at',v_work.fiscal_verified_at,'verified_by_name',v_work.fiscal_verified_by_name) else null end;
    v_work.fiscal_revision:=v_work.fiscal_revision+1; v_work.document_type:=p_payload->>'document_type';
    v_work.fiscal_reference:=btrim(p_payload->>'reference'); v_work.fiscal_issued_at:=v_issued_at; v_work.fiscal_recorded_at:=v_now;
    v_work.fiscal_verified_at:=null;v_work.fiscal_verified_by:=null;v_work.fiscal_verified_by_name:=null;
    v_event_payload:=p_payload||jsonb_build_object('previous_fiscal',v_old_fiscal,'fiscal_revision',v_work.fiscal_revision);
  elsif p_command='fiscal.verify' then
    if jsonb_typeof(p_payload->'expected_fiscal_revision')<>'number' or (p_payload->>'expected_fiscal_revision')!~'^[1-9][0-9]*$' then
      return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
    if v_work.fiscal_revision=0 then return jsonb_build_object('ok',false,'code','fiscal_required'); end if;
    if (p_payload->>'expected_fiscal_revision')::bigint<>v_work.fiscal_revision then return jsonb_build_object('ok',false,'code','stale_fiscal_revision'); end if;
    v_work.fiscal_verified_at:=v_now;v_work.fiscal_verified_by:=p_actor_id;v_work.fiscal_verified_by_name:=v_actor->>'name';
  elsif p_command='followup.set' then
    if jsonb_typeof(p_payload->'assignee_membership_id') not in ('string','null') or jsonb_typeof(p_payload->'follow_up_at') not in ('string','null') then
      return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
    v_assignee:=(p_payload->>'assignee_membership_id')::uuid;v_follow_at:=(p_payload->>'follow_up_at')::timestamptz;
    if v_follow_at is not null and not isfinite(v_follow_at) then return jsonb_build_object('ok',false,'code','invalid_time'); end if;
    if v_assignee is not null then
      perform 1 from public.store_memberships m join public.staff_profiles s on s.id=m.user_id
        where m.id=v_assignee and m.store_id=p_store_id and m.status::text='active' and m.role::text in ('owner','manager','sales')
          and s.status::text='active' for share of m,s;
      if not found then return jsonb_build_object('ok',false,'code','invalid_assignee'); end if;
    end if;
    v_work.assignee_membership_id:=v_assignee;v_work.follow_up_at:=v_follow_at;v_work.followup_note:=nullif(btrim(p_payload->>'note'),'');
  elsif p_command='issue.open' then
    if jsonb_typeof(p_payload->'kind')<>'string' or p_payload->>'kind' not in ('payment_mismatch','fiscal_document','customer_request','delivery','other')
      or jsonb_typeof(p_payload->'summary')<>'string' or char_length(btrim(p_payload->>'summary')) not between 1 and 1000 then
      return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
    v_issue:=gen_random_uuid();v_event_payload:=p_payload||jsonb_build_object('issue_id',v_issue);
  elsif p_command='issue.resolve' then
    if jsonb_typeof(p_payload->'issue_id')<>'string' or jsonb_typeof(p_payload->'resolution')<>'string'
      or char_length(btrim(p_payload->>'resolution')) not between 1 and 1000 then return jsonb_build_object('ok',false,'code','invalid_payload'); end if;
    v_issue:=(p_payload->>'issue_id')::uuid;
    perform 1 from public.inventory_sales_workflow_issues where id=v_issue and store_id=p_store_id and sale_order_id=p_sale_order_id and status='open' for update;
    if not found then return jsonb_build_object('ok',false,'code','issue_not_open'); end if;
  end if;
  v_work.version:=v_work.version+1;v_work.updated_at:=v_now;
  insert into public.inventory_sales_workflows select (v_work).*
    on conflict (sale_order_id,store_id) do update set version=excluded.version,fiscal_revision=excluded.fiscal_revision,
      document_type=excluded.document_type,fiscal_reference=excluded.fiscal_reference,fiscal_issued_at=excluded.fiscal_issued_at,
      fiscal_recorded_at=excluded.fiscal_recorded_at,fiscal_verified_at=excluded.fiscal_verified_at,
      fiscal_verified_by=excluded.fiscal_verified_by,fiscal_verified_by_name=excluded.fiscal_verified_by_name,
      assignee_membership_id=excluded.assignee_membership_id,follow_up_at=excluded.follow_up_at,followup_note=excluded.followup_note,updated_at=excluded.updated_at;
  if p_command='issue.open' then
    insert into public.inventory_sales_workflow_issues(id,store_id,sale_order_id,kind,summary,opened_at)
      values(v_issue,p_store_id,p_sale_order_id,p_payload->>'kind',btrim(p_payload->>'summary'),v_now);
  elsif p_command='issue.resolve' then
    update public.inventory_sales_workflow_issues set status='resolved',resolution=btrim(p_payload->>'resolution'),resolved_at=v_now
      where id=v_issue and store_id=p_store_id and sale_order_id=p_sale_order_id;
  end if;
  v_result:=jsonb_build_object('ok',true,'code','completed','sale_order_id',p_sale_order_id,'workflow_version',v_work.version,'event_id',v_event);
  insert into public.inventory_sales_workflow_events(id,store_id,sale_order_id,workflow_version,actor_id,actor_name,command,idempotency_key,request,payload,response,created_at)
    values(v_event,p_store_id,p_sale_order_id,v_work.version,p_actor_id,v_actor->>'name',p_command,p_idempotency_key,v_request,v_event_payload,v_result,v_now);
  return v_result;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
  return jsonb_build_object('ok',false,'code','invalid_payload');
end;
$$;

create function public.repairdesk_inventory_sales_workflow_read(p_store_id uuid,p_actor_id uuid,p_sale_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb;v_result jsonb;
begin
  v_actor:=private.inventory_sales_workflow_actor(p_store_id,p_actor_id);
  if v_actor is null then return jsonb_build_object('ok',false,'code','actor_forbidden'); end if;
  -- One statement snapshot keeps workflow version, issue state and audit history coherent.
  select jsonb_build_object(
    'workflow',jsonb_build_object('sale_order_id',o.id,'version',coalesce(w.version,0),
      'fiscal',case when coalesce(w.fiscal_revision,0)=0 then null else jsonb_build_object(
        'revision',w.fiscal_revision,'document_type',w.document_type,'reference',w.fiscal_reference,
        'issued_at',w.fiscal_issued_at,'recorded_at',w.fiscal_recorded_at,'verified_at',w.fiscal_verified_at,'verified_by_name',w.fiscal_verified_by_name) end,
      'followup',jsonb_build_object('assignee_membership_id',w.assignee_membership_id,
        'assignee_name',(select coalesce(nullif(m.display_name,''),s.display_name,'Staff') from public.store_memberships m join public.staff_profiles s on s.id=m.user_id
          where m.id=w.assignee_membership_id and m.store_id=p_store_id),
        'follow_up_at',w.follow_up_at,'note',w.followup_note),
      'issues',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'kind',q.kind,'summary',q.summary,'status',q.status,
        'opened_at',q.opened_at,'resolved_at',q.resolved_at,'resolution',q.resolution) order by q.status,q.opened_at desc,q.id)
        from (select * from public.inventory_sales_workflow_issues i where i.store_id=p_store_id and i.sale_order_id=o.id
          order by i.status,i.opened_at desc,i.id limit 100) q),'[]'::jsonb)),
    'history',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'command',q.command,'actor_name',q.actor_name,'created_at',q.created_at,'payload',q.payload) order by q.workflow_version desc)
      from (select * from public.inventory_sales_workflow_events e where e.store_id=p_store_id and e.sale_order_id=o.id order by e.workflow_version desc limit 50) q),'[]'::jsonb),
    'truncated',jsonb_build_object('issues',(select count(*)>100 from public.inventory_sales_workflow_issues i where i.store_id=p_store_id and i.sale_order_id=o.id),
      'history',(select count(*)>50 from public.inventory_sales_workflow_events e where e.store_id=p_store_id and e.sale_order_id=o.id)),
    'assignees',coalesce((select jsonb_agg(jsonb_build_object('membership_id',m.id,'display_name',coalesce(nullif(m.display_name,''),s.display_name,'Staff'),'role',m.role::text) order by coalesce(nullif(m.display_name,''),s.display_name,'Staff'),m.id)
      from public.store_memberships m join public.staff_profiles s on s.id=m.user_id where m.store_id=p_store_id and m.status::text='active'
        and s.status::text='active' and m.role::text in ('owner','manager','sales')),'[]'::jsonb),
    'capabilities',jsonb_build_object('can_edit',true,'can_verify',v_actor->>'role' in ('owner','manager'),'can_report_finance',(v_actor->>'finance')::boolean))
    into v_result from public.inventory_sale_orders o left join public.inventory_sales_workflows w on w.sale_order_id=o.id and w.store_id=o.store_id
    where o.id=p_sale_order_id and o.store_id=p_store_id;
  if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
  return jsonb_build_object('ok',true,'data',v_result);
end;
$$;

create function public.repairdesk_inventory_sales_workflow_report(
  p_store_id uuid,p_actor_id uuid,p_business_date date,p_offset integer default 0,p_limit integer default 30
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb;v_start timestamptz;v_end timestamptz;v_now timestamptz:=clock_timestamp();v_result jsonb;
begin
  v_actor:=private.inventory_sales_workflow_actor(p_store_id,p_actor_id);
  if v_actor is null then return jsonb_build_object('ok',false,'code','actor_forbidden'); end if;
  if p_business_date is null or not isfinite(p_business_date) or p_offset is null or p_offset not between 0 and 100000 or p_limit is null or p_limit not between 1 and 100 then
    return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  -- Local midnights deliberately yield 23/25-hour intervals on DST transitions.
  v_start:=p_business_date::timestamp at time zone 'Europe/Rome';
  v_end:=(p_business_date+1)::timestamp at time zone 'Europe/Rome';
  with scoped as materialized (
    select o.id as sale_order_id,o.inventory_item_id,o.sale_number,o.status,w.follow_up_at,
      (select coalesce(nullif(m.display_name,''),s.display_name,'Staff') from public.store_memberships m join public.staff_profiles s on s.id=m.user_id
        where m.id=w.assignee_membership_id and m.store_id=p_store_id) as assignee_name,
      coalesce(w.fiscal_revision,0)=0 as missing_fiscal,
      coalesce(w.fiscal_revision,0)>0 and w.fiscal_verified_at is null as unverified_fiscal,
      (select count(*) from public.inventory_sales_workflow_issues i where i.sale_order_id=o.id and i.store_id=p_store_id and i.status='open') as open_issue_count
    from public.inventory_sale_orders o left join public.inventory_sales_workflows w on w.sale_order_id=o.id and w.store_id=o.store_id
    where o.store_id=p_store_id and (v_actor->>'role' in ('owner','manager')
      or w.assignee_membership_id=(v_actor->>'membership_id')::uuid
      or (w.assignee_membership_id is null and o.created_by=p_actor_id))
  ), pending as materialized (
    select * from scoped where status in ('awaiting_payment','paid_pending_pickup') or missing_fiscal or unverified_fiscal or open_issue_count>0 or follow_up_at<v_now
  ), collected as materialized (
    select p.* from public.inventory_sale_payment_entries p where (v_actor->>'finance')::boolean
      and p.store_id=p_store_id and p.occurred_at>=v_start and p.occurred_at<v_end
  ), agreed as materialized (
    select o.* from public.inventory_sale_orders o where (v_actor->>'finance')::boolean
      and o.store_id=p_store_id and o.agreed_at>=v_start and o.agreed_at<v_end
  ), differences as materialized (
    -- Current ledger reconciliation is independent of day attribution; no mirrored transaction is summed.
    select o.paid_cents-coalesce((select sum(p.amount_cents) from public.inventory_sale_payment_entries p where p.store_id=p_store_id and p.sale_order_id=o.id),0) as difference
    from public.inventory_sale_orders o where (v_actor->>'finance')::boolean and o.store_id=p_store_id
  )
  select jsonb_build_object('business_date',p_business_date,'timezone','Europe/Rome','generated_at',v_now,
    'finance',case when (v_actor->>'finance')::boolean then jsonb_build_object(
      'agreed_sale_count',(select count(*) from agreed),'agreed_sales_cents',(select coalesce(sum(price_cents),0) from agreed),
      'collected_payment_count',(select count(*) from collected),'collected_cents',(select coalesce(sum(amount_cents),0) from collected),
      'collected_by_method',jsonb_build_object(
        'cash',(select coalesce(sum(amount_cents),0) from collected where method='cash'),
        'card',(select coalesce(sum(amount_cents),0) from collected where method='card'),
        'bancomat',(select coalesce(sum(amount_cents),0) from collected where method='bancomat'),
        'transfer',(select coalesce(sum(amount_cents),0) from collected where method='transfer'),
        'other',(select coalesce(sum(amount_cents),0) from collected where method='other')),
      'ledger_mismatch_count',(select count(*) from differences where difference<>0),
      'ledger_difference_cents',(select coalesce(sum(difference),0) from differences)) else null end,
    'pending',jsonb_build_object('scope',case when v_actor->>'role' in ('owner','manager') then 'store' else 'mine' end,
      'awaiting_payment_count',count(*) filter(where status='awaiting_payment'),
      'paid_pending_pickup_count',count(*) filter(where status='paid_pending_pickup'),
      'missing_fiscal_count',count(*) filter(where missing_fiscal),
      'unverified_fiscal_count',count(*) filter(where unverified_fiscal),
      'open_issue_count',coalesce(sum(open_issue_count),0),
      'overdue_followup_count',count(*) filter(where follow_up_at<v_now),
      'rows',coalesce((select jsonb_agg(to_jsonb(q) order by q.follow_up_at nulls last,q.sale_order_id) from
        (select * from pending order by follow_up_at nulls last,sale_order_id offset p_offset limit p_limit) q),'[]'::jsonb),
      'total',(select count(*) from pending),'offset',p_offset,'limit',p_limit)) into v_result from scoped;
  return jsonb_build_object('ok',true,'data',v_result);
end;
$$;

revoke all on function public.repairdesk_inventory_sales_workflow_command(uuid,uuid,uuid,bigint,uuid,text,jsonb),
  public.repairdesk_inventory_sales_workflow_read(uuid,uuid,uuid),
  public.repairdesk_inventory_sales_workflow_report(uuid,uuid,date,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.repairdesk_inventory_sales_workflow_command(uuid,uuid,uuid,bigint,uuid,text,jsonb),
  public.repairdesk_inventory_sales_workflow_read(uuid,uuid,uuid),
  public.repairdesk_inventory_sales_workflow_report(uuid,uuid,date,integer,integer) to service_role;
comment on table public.inventory_sales_workflow_events is 'Private append-only sales workflow audit and idempotency results. Never broadcast payloads or customer notes.';
commit;
