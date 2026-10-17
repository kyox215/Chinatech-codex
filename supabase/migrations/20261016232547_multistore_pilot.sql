-- Free pilot: immutable tenant ownership, invitation admission and atomic quotas.
create table chinatech_v2_private.pilot_control (
  singleton boolean primary key default true check(singleton), max_stores integer not null default 20 check(max_stores>0)
);
insert into chinatech_v2_private.pilot_control values(true,20);
create table chinatech_v2_private.store_entitlements (
  store_id uuid primary key references chinatech_v2.stores(id),
  plan_version text not null default 'free-pilot-v1',
  attachment_limit bigint not null default 1000000000 check(attachment_limit>=0),
  member_limit integer not null default 5 check(member_limit>=1)
);
insert into chinatech_v2_private.store_entitlements(store_id) select id from chinatech_v2.stores;
create table chinatech_v2_private.store_creation_receipts (
  actor_id uuid not null references chinatech_v2.accounts(id), request_id uuid not null,
  store_id uuid not null references chinatech_v2.stores(id), name text not null,
  created_at timestamptz not null default now(), primary key(actor_id,request_id)
);
create table chinatech_v2_private.store_invitations (
  id uuid primary key, store_id uuid not null references chinatech_v2.stores(id),
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references chinatech_v2.accounts(id),
  expires_at timestamptz not null default now()+interval '7 days', revoked_at timestamptz,
  applicant_id uuid references chinatech_v2.accounts(id), consumed_at timestamptz,
  created_at timestamptz not null default now(), unique(store_id,id),
  check((applicant_id is null)=(consumed_at is null)), check(expires_at>created_at)
);
create table chinatech_v2_private.store_applications (
  id uuid primary key, store_id uuid not null, invitation_id uuid not null unique,
  applicant_id uuid not null references chinatech_v2.accounts(id),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  reviewed_by uuid references chinatech_v2.accounts(id), reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(store_id,invitation_id) references chinatech_v2_private.store_invitations(store_id,id)
);
create unique index store_application_pending on chinatech_v2_private.store_applications(store_id,applicant_id) where status='pending';
create table chinatech_v2_private.attachment_reservations (
  store_id uuid not null references chinatech_v2.stores(id), id uuid not null,
  actor_id uuid not null references chinatech_v2.accounts(id),
  bytes bigint not null check(bytes between 4 and 240000),
  content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'reserved' check(status in ('reserved','confirmed','cancelled')),
  created_at timestamptz not null default now(), primary key(store_id,id)
);
-- Legacy bytes remain included. New objects retain their immutable byte/hash ledger.
create table chinatech_v2_private.attachment_usage (
  store_id uuid not null references chinatech_v2.stores(id), id uuid not null,
  bytes bigint not null check(bytes>=4), content_hash text not null,
  object_path text not null unique, created_at timestamptz not null default now(),
  primary key(store_id,id), foreign key(store_id,id) references chinatech_v2_private.attachment_reservations(store_id,id)
);

-- New tenant creation is the only privileged bootstrap path. Caller cannot choose
-- an existing tenant or another owner. A global row lock protects the pilot cap.
create function chinatech_v2_private.create_store(target_request uuid, target_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid; previous record; owner_permissions text[];
begin
  if not chinatech_v2_private.live_user() then raise exception 'Invalid session' using errcode='42501'; end if;
  if target_name is null or length(btrim(target_name)) not between 1 and 100 then raise exception 'Invalid store name' using errcode='22023'; end if;
  perform 1 from chinatech_v2_private.pilot_control where singleton for update;
  select * into previous from chinatech_v2_private.store_creation_receipts where actor_id=actor and request_id=target_request;
  if found then
    if previous.name<>btrim(target_name) then raise exception 'Request conflict' using errcode='22023'; end if;
    return previous.store_id;
  end if;
  if (select count(*) from chinatech_v2_private.store_creation_receipts where actor_id=actor and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=3 then raise exception 'Daily store limit' using errcode='P0001'; end if;
  if (select count(*) from chinatech_v2.stores)>=(select max_stores from chinatech_v2_private.pilot_control where singleton) then raise exception 'Pilot store limit' using errcode='P0001'; end if;
  result:=gen_random_uuid();
  owner_permissions:=array['retail.view','retail.edit','retail.inspect','retail.price','retail.sell','sale.payment','sale.reconcile','sale.deliver','sale.debt','sale.refund','sale.aftersales','financial.read','financial.edit','repairs.view','repairs.edit','customers.view','customers.edit','settings.edit','staff.manage'];
  insert into chinatech_v2.stores(id,name) values(result,btrim(target_name));
  insert into chinatech_v2_private.store_entitlements(store_id) values(result) on conflict do nothing;
  insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(result,actor,'owner','active',owner_permissions);
  insert into chinatech_v2_private.store_state(store_id,settings) values(result,jsonb_build_object('revision',0,'shopName',btrim(target_name),'address','','phone','','paper','a4','repairWarrantyMonths',6,'retailWarrantyMonths',12,'suppliers','[]'::jsonb,'finance','[]'::jsonb));
  insert into chinatech_v2_private.store_creation_receipts(actor_id,request_id,store_id,name) values(actor,target_request,result,btrim(target_name));
  insert into chinatech_v2_private.audit_events(store_id,actor_id,request_id,kind,entity_id) values(result,actor,target_request,'store.created',result::text);
  return result;
end $$;
revoke all on function chinatech_v2_private.create_store(uuid,text) from public,anon,authenticated,service_role;
grant execute on function chinatech_v2_private.create_store(uuid,text) to chinatech_runtime;

-- Invitations expose only the requested store name to a verified account.
create function chinatech_v2_private.invitation_action(token_digest text, apply_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation record; existing record; actor uuid:=auth.uid();
begin
  if not chinatech_v2_private.live_user() or token_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid session' using errcode='42501'; end if;
  select i.*,s.name into invitation from chinatech_v2_private.store_invitations i join chinatech_v2.stores s on s.id=i.store_id where i.token_hash=token_digest for update of i;
  if not found or invitation.revoked_at is not null or invitation.expires_at<=now() or (invitation.applicant_id is not null and invitation.applicant_id<>actor) then raise exception 'Invitation unavailable' using errcode='P0001'; end if;
  if apply_request is not null then
    if exists(select 1 from chinatech_v2.store_memberships where store_id=invitation.store_id and user_id=actor and membership_status='active') then raise exception 'Already a member' using errcode='P0001'; end if;
    select * into existing from chinatech_v2_private.store_applications where invitation_id=invitation.id;
    if found then
      if existing.applicant_id<>actor or existing.id<>apply_request then raise exception 'Request conflict' using errcode='22023'; end if;
      return jsonb_build_object('id',existing.id,'storeName',invitation.name,'status',existing.status);
    end if;
    update chinatech_v2_private.store_invitations set applicant_id=actor,consumed_at=now() where id=invitation.id;
    insert into chinatech_v2_private.store_applications(id,store_id,invitation_id,applicant_id) values(apply_request,invitation.store_id,invitation.id,actor);
    return jsonb_build_object('id',apply_request,'storeName',invitation.name,'status','pending');
  end if;
  return jsonb_build_object('storeName',invitation.name,'expiresAt',invitation.expires_at,'applied',invitation.applicant_id=actor);
end $$;
revoke all on function chinatech_v2_private.invitation_action(text,uuid) from public,anon,authenticated,service_role;
grant execute on function chinatech_v2_private.invitation_action(text,uuid) to chinatech_runtime;

-- Enforce staff boundaries even when SQL bypasses the application command layer.
create function chinatech_v2_private.guard_membership() returns trigger language plpgsql security definer set search_path='' as $$
declare actor record; entitlement integer;
begin
  -- Trusted bootstrap/admin migrations only. Runtime cannot SET ROLE to owner.
  if current_setting('role',true) in ('postgres','supabase_admin') or session_user in ('postgres','supabase_admin') and current_setting('role',true) in ('none','') then return new; end if;
  -- A create_store invocation runs with the function owner's effective role,
  -- but must only bypass for the first membership of its brand new empty store.
  if tg_op='INSERT' and new.role='owner' and new.user_id=auth.uid() and not exists(select 1 from chinatech_v2.store_memberships where store_id=new.store_id) and exists(select 1 from chinatech_v2_private.store_entitlements where store_id=new.store_id) and not exists(select 1 from chinatech_v2_private.store_state where store_id=new.store_id) then return new; end if;
  perform 1 from chinatech_v2_private.store_state where store_id=new.store_id for update;
  select * into actor from chinatech_v2.store_memberships where store_id=new.store_id and user_id=auth.uid() and membership_status='active';
  if not chinatech_v2_private.live_user() or not found or not ('staff.manage'=any(actor.permissions)) then raise exception 'Membership denied' using errcode='42501'; end if;
  if tg_op='UPDATE' and (new.store_id<>old.store_id or new.user_id<>old.user_id or new.id<>old.id) then raise exception 'Membership identity immutable' using errcode='42501'; end if;
  if (new.role='owner' and (tg_op='INSERT' or old.role<>'owner')) or (actor.role<>'owner' and (new.role='owner' or (tg_op='UPDATE' and old.role='owner'))) then raise exception 'Owner role protected' using errcode='42501'; end if;
  if new.user_id=auth.uid() then raise exception 'Cannot edit own membership' using errcode='42501'; end if;
  if not (new.permissions <@ actor.permissions) or (actor.role<>'owner' and 'staff.manage'=any(new.permissions) and (tg_op='INSERT' or not ('staff.manage'=any(old.permissions)))) then raise exception 'Cannot delegate permission' using errcode='42501'; end if;
  if tg_op='INSERT' and not exists(select 1 from chinatech_v2_private.store_applications a join chinatech_v2_private.store_invitations i on i.id=a.invitation_id where a.store_id=new.store_id and a.applicant_id=new.user_id and a.status='approved' and i.revoked_at is null and i.expires_at>now()) then raise exception 'Invitation approval required' using errcode='42501'; end if;
  if new.membership_status='active' and (tg_op='INSERT' or old.membership_status<>'active') then
    select member_limit into entitlement from chinatech_v2_private.store_entitlements where store_id=new.store_id for update;
    if (select count(*) from chinatech_v2.store_memberships where store_id=new.store_id and membership_status='active')>=entitlement then raise exception 'Member quota exceeded' using errcode='P0001'; end if;
  end if;
  if tg_op='UPDATE' and old.role='owner' and old.membership_status='active' and (new.role<>'owner' or new.membership_status<>'active') and not exists(select 1 from chinatech_v2.store_memberships where store_id=new.store_id and role='owner' and membership_status='active' and id<>new.id) then raise exception 'Last owner protected' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function chinatech_v2_private.guard_membership() from public,anon,authenticated,service_role,chinatech_runtime;
create trigger membership_guard before insert or update on chinatech_v2.store_memberships for each row execute function chinatech_v2_private.guard_membership();

-- Limit read exposure: applicant identity is visible only for the current store's
-- reviewers; ordinary colleagues retain their own identity projection.
drop policy runtime_accounts on chinatech_v2.accounts;
create policy runtime_accounts on chinatech_v2.accounts for select to chinatech_runtime using(id=auth.uid() or exists(select 1 from chinatech_v2.store_memberships m where m.user_id=accounts.id and m.store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(m.store_id,'staff.manage')) or exists(select 1 from chinatech_v2_private.store_applications a where a.applicant_id=accounts.id and a.store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(a.store_id,'staff.manage')));

-- Private tables: no Data API or anonymous grants. Runtime writes are narrowly
-- scoped; ownership creation and token consumption are callable functions only.
do $$ declare t text; begin
  foreach t in array array['pilot_control','store_entitlements','store_creation_receipts','store_invitations','store_applications','attachment_reservations','attachment_usage'] loop
    execute format('alter table chinatech_v2_private.%I enable row level security',t);
    execute format('revoke all on chinatech_v2_private.%I from public,anon,authenticated,service_role,chinatech_runtime',t);
  end loop;
end $$;
grant select on chinatech_v2_private.store_entitlements,chinatech_v2_private.store_creation_receipts to chinatech_runtime;
grant select,insert,update on chinatech_v2_private.store_invitations,chinatech_v2_private.store_applications,chinatech_v2_private.attachment_reservations to chinatech_runtime;
grant select,insert on chinatech_v2_private.attachment_usage to chinatech_runtime;
create policy entitlement_read on chinatech_v2_private.store_entitlements for select to chinatech_runtime using(chinatech_v2_private.member_access(store_id) and store_id::text=current_setting('app.store_id',true));
create policy creation_receipt_read on chinatech_v2_private.store_creation_receipts for select to chinatech_runtime using(actor_id=auth.uid() and chinatech_v2_private.live_user());
create policy invitations_read on chinatech_v2_private.store_invitations for select to chinatech_runtime using(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'staff.manage'));
create policy invitations_write on chinatech_v2_private.store_invitations for insert to chinatech_runtime with check(store_id::text=current_setting('app.store_id',true) and created_by=auth.uid() and chinatech_v2_private.member_access(store_id,'staff.manage') and expires_at<=now()+interval '7 days' and applicant_id is null and consumed_at is null and revoked_at is null);
create policy invitations_revoke on chinatech_v2_private.store_invitations for update to chinatech_runtime using(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'staff.manage')) with check(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'staff.manage'));
create policy applications_read on chinatech_v2_private.store_applications for select to chinatech_runtime using((applicant_id=auth.uid() and chinatech_v2_private.live_user()) or(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'staff.manage')));
create policy applications_review on chinatech_v2_private.store_applications for update to chinatech_runtime using(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'staff.manage')) with check(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'staff.manage'));
create policy reservations_scope on chinatech_v2_private.attachment_reservations for all to chinatech_runtime using(store_id::text=current_setting('app.store_id',true) and actor_id=auth.uid() and chinatech_v2_private.member_access(store_id,'repairs.edit')) with check(store_id::text=current_setting('app.store_id',true) and actor_id=auth.uid() and chinatech_v2_private.member_access(store_id,'repairs.edit'));
create policy usage_read on chinatech_v2_private.attachment_usage for select to chinatech_runtime using(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'repairs.view'));
create policy usage_write on chinatech_v2_private.attachment_usage for insert to chinatech_runtime with check(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'repairs.edit') and object_path=store_id::text||'/'||id::text||'.jpg');

-- Only grant mutable columns, never token/tenant/identity changes.
revoke update on chinatech_v2_private.store_invitations,chinatech_v2_private.store_applications from chinatech_runtime;
grant update(revoked_at) on chinatech_v2_private.store_invitations to chinatech_runtime;
grant update(status,reviewed_by,reviewed_at) on chinatech_v2_private.store_applications to chinatech_runtime;
create function chinatech_v2_private.read_store_usage(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not chinatech_v2_private.member_access(target) or target::text<>current_setting('app.store_id',true) then raise exception 'Store denied' using errcode='42501';end if;
 select jsonb_build_object('usedBytes',(select coalesce(sum(octet_length(bytes)),0) from chinatech_v2_private.intake_photos where store_id=target)+(select coalesce(sum(bytes),0) from chinatech_v2_private.attachment_usage where store_id=target),'reservedBytes',(select coalesce(sum(bytes),0) from chinatech_v2_private.attachment_reservations where store_id=target and status='reserved'),'limitBytes',e.attachment_limit,'memberLimit',e.member_limit,'memberCount',(select count(*) from chinatech_v2.store_memberships where store_id=target and membership_status='active'),'planVersion',e.plan_version) into result from chinatech_v2_private.store_entitlements e where store_id=target;
 return result;
end $$;
revoke all on function chinatech_v2_private.read_store_usage(uuid) from public,anon,authenticated,service_role;
grant execute on function chinatech_v2_private.read_store_usage(uuid) to chinatech_runtime;

create table chinatech_v2_private.intake_photo_objects (
 store_id uuid not null, repair_id text not null, id uuid not null,
 slot text not null check(slot in ('front','back','other')), mime text not null check(mime='image/jpeg'),
 primary key(store_id,repair_id,id),
 foreign key(store_id,repair_id) references chinatech_v2_private.repair_intakes(store_id,id),
 foreign key(store_id,id) references chinatech_v2_private.attachment_usage(store_id,id)
);
alter table chinatech_v2_private.intake_photo_objects enable row level security;
alter table chinatech_v2_private.intake_photo_objects force row level security;
revoke all on chinatech_v2_private.intake_photo_objects from public,anon,authenticated,service_role,chinatech_runtime;
grant select,insert on chinatech_v2_private.intake_photo_objects to chinatech_runtime;
create policy photo_object_read on chinatech_v2_private.intake_photo_objects for select to chinatech_runtime using(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'repairs.view'));
create policy photo_object_write on chinatech_v2_private.intake_photo_objects for insert to chinatech_runtime with check(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'repairs.edit') and chinatech_v2_private.member_access(store_id,'repairs.view'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('chinatech-private-attachments','chinatech-private-attachments',false,240000,array['image/jpeg']) on conflict(id) do nothing;
create function chinatech_v2_private.storage_attachment_access(object_name text, writing boolean, object_metadata jsonb default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from chinatech_v2_private.attachment_reservations r where object_name=r.store_id::text||'/'||r.id::text||'.jpg' and chinatech_v2_private.member_access(r.store_id,case when writing then 'repairs.edit' else 'repairs.view' end) and (not writing or (r.actor_id=auth.uid() and r.status='reserved' and (object_metadata->>'size')::bigint=r.bytes)));
$$;
revoke all on function chinatech_v2_private.storage_attachment_access(text,boolean,jsonb) from public,anon,service_role;
grant usage on schema chinatech_v2_private to authenticated;
grant execute on function chinatech_v2_private.storage_attachment_access(text,boolean,jsonb) to authenticated;
create policy chinatech_attachment_upload on storage.objects for insert to authenticated with check(bucket_id='chinatech-private-attachments' and chinatech_v2_private.storage_attachment_access(name,true,metadata));
create policy chinatech_attachment_read on storage.objects for select to authenticated using(bucket_id='chinatech-private-attachments' and chinatech_v2_private.storage_attachment_access(name,false));

-- Retail originals retain their supported formats and 250 KiB limit.
alter table chinatech_v2_private.attachment_reservations drop constraint attachment_reservations_bytes_check;
alter table chinatech_v2_private.attachment_reservations add constraint attachment_reservations_bytes_check check(bytes between 4 and 256000);
alter table chinatech_v2_private.attachment_reservations add column domain text not null default 'repairs' check(domain in ('repairs','retail'));
alter table chinatech_v2_private.attachment_reservations add column mime text not null default 'image/jpeg' check(mime in ('image/jpeg','image/png','image/webp'));
alter table chinatech_v2_private.attachment_usage add column mime text not null default 'image/jpeg';
update storage.buckets set file_size_limit=256000,allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='chinatech-private-attachments';
drop policy reservations_scope on chinatech_v2_private.attachment_reservations;
create policy reservations_scope on chinatech_v2_private.attachment_reservations for all to chinatech_runtime using(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,domain||'.edit')) with check(store_id::text=current_setting('app.store_id',true) and actor_id=auth.uid() and chinatech_v2_private.member_access(store_id,domain||'.edit'));
drop policy usage_read on chinatech_v2_private.attachment_usage;
create policy usage_read on chinatech_v2_private.attachment_usage for select to chinatech_runtime using(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id));
drop policy usage_write on chinatech_v2_private.attachment_usage;
create policy usage_write on chinatech_v2_private.attachment_usage for insert to chinatech_runtime with check(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id) and object_path=store_id::text||'/'||id::text||'.jpg' and exists(select 1 from chinatech_v2_private.attachment_reservations r where r.store_id=attachment_usage.store_id and r.id=attachment_usage.id and r.actor_id=auth.uid() and chinatech_v2_private.member_access(r.store_id,r.domain||'.edit') and r.bytes=attachment_usage.bytes and r.content_hash=attachment_usage.content_hash and r.mime=attachment_usage.mime));
create or replace function chinatech_v2_private.storage_attachment_access(object_name text, writing boolean, object_metadata jsonb default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from chinatech_v2_private.attachment_reservations r where object_name=r.store_id::text||'/'||r.id::text||'.jpg' and chinatech_v2_private.member_access(r.store_id,r.domain||case when writing then '.edit' else '.view' end) and (not writing or (r.actor_id=auth.uid() and r.status='reserved' and (object_metadata->>'size')::bigint=r.bytes)));
$$;

-- The historical embedded retail originals also consume attachment allowance.
-- Distinct immutable originals are counted once per store, including snapshots.
create table chinatech_v2_private.retail_legacy_photo_usage (
 store_id uuid not null references chinatech_v2.stores(id),hash text not null,bytes bigint not null check(bytes>0),primary key(store_id,hash)
);
alter table chinatech_v2_private.retail_legacy_photo_usage enable row level security;
revoke all on chinatech_v2_private.retail_legacy_photo_usage from public,anon,authenticated,service_role,chinatech_runtime;
insert into chinatech_v2_private.retail_legacy_photo_usage(store_id,hash,bytes)
 select distinct r.store_id,encode(sha256(decode(split_part(p.photo#>>'{}',',',2),'base64')),'hex'),octet_length(decode(split_part(p.photo#>>'{}',',',2),'base64')) from chinatech_v2_private.retail_units r cross join lateral jsonb_path_query(r.data,'$.**.photos[*]') p(photo) where jsonb_typeof(p.photo)='string' and p.photo#>>'{}' ~ '^data:image/(jpeg|png|webp);base64,' on conflict do nothing;
create or replace function chinatech_v2_private.read_store_usage(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not chinatech_v2_private.member_access(target) or target::text<>current_setting('app.store_id',true) then raise exception 'Store denied' using errcode='42501';end if;
 select jsonb_build_object('usedBytes',(select coalesce(sum(octet_length(bytes)),0) from chinatech_v2_private.intake_photos where store_id=target)+(select coalesce(sum(bytes),0) from chinatech_v2_private.attachment_usage where store_id=target)+(select coalesce(sum(bytes),0) from chinatech_v2_private.retail_legacy_photo_usage where store_id=target),'reservedBytes',(select coalesce(sum(bytes),0) from chinatech_v2_private.attachment_reservations where store_id=target and status='reserved'),'limitBytes',e.attachment_limit,'memberLimit',e.member_limit,'memberCount',(select count(*) from chinatech_v2.store_memberships where store_id=target and membership_status='active'),'planVersion',e.plan_version) into result from chinatech_v2_private.store_entitlements e where store_id=target;
 return result;
end $$;
create function chinatech_v2_private.guard_attachment_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare usage jsonb;
begin
 if new.store_id::text<>current_setting('app.store_id',true) or not chinatech_v2_private.member_access(new.store_id,new.domain||'.edit') or new.actor_id<>auth.uid() then raise exception 'Attachment denied' using errcode='42501';end if;
 perform 1 from chinatech_v2_private.store_state where store_id=new.store_id for update;
 if tg_op='INSERT' then
  usage:=chinatech_v2_private.read_store_usage(new.store_id);
  if (usage->>'usedBytes')::bigint+(usage->>'reservedBytes')::bigint+new.bytes>(usage->>'limitBytes')::bigint then raise exception 'Attachment quota exceeded' using errcode='P0001';end if;
 elsif (new.store_id,new.id,new.actor_id,new.bytes,new.content_hash,new.domain,new.mime,new.created_at) is distinct from (old.store_id,old.id,old.actor_id,old.bytes,old.content_hash,old.domain,old.mime,old.created_at) or old.status<>'reserved' and new.status<>old.status then raise exception 'Attachment immutable' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function chinatech_v2_private.guard_attachment_reservation() from public,anon,authenticated,service_role,chinatech_runtime;
create trigger reservation_guard before insert or update on chinatech_v2_private.attachment_reservations for each row execute function chinatech_v2_private.guard_attachment_reservation();
-- All ordinary membership mutation remains confined to the transaction scope.
drop policy runtime_member_update on chinatech_v2.store_memberships;
create policy runtime_member_update on chinatech_v2.store_memberships for update to chinatech_runtime using(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'staff.manage')) with check(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'staff.manage'));

-- GET-only authorization prevents creation of bearer signed download URLs.
-- Uncommitted uploads are readable only by their uploader for byte/hash checks.
create or replace function chinatech_v2_private.storage_attachment_access(object_name text, writing boolean, object_metadata jsonb default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from chinatech_v2_private.attachment_reservations r where object_name=r.store_id::text||'/'||r.id::text||'.jpg' and chinatech_v2_private.member_access(r.store_id,r.domain||case when writing then '.edit' else '.view' end) and
 case when writing then r.actor_id=auth.uid() and r.status='reserved' and (object_metadata->>'size')::bigint=r.bytes
 else (r.status='reserved' and r.actor_id=auth.uid()) or (r.status='confirmed' and (
  (r.domain='repairs' and exists(select 1 from chinatech_v2_private.intake_photo_objects p join chinatech_v2_private.repair_intakes i on i.store_id=p.store_id and i.id=p.repair_id where p.store_id=r.store_id and p.id=r.id and i.data->'photos' @> jsonb_build_array(jsonb_build_object('id',r.id::text))))
  or (r.domain='retail' and exists(select 1 from chinatech_v2_private.retail_units u where u.store_id=r.store_id and u.data->'photos' @> jsonb_build_array('ct-photo:'||r.id::text)))
 )) end);
$$;
drop policy chinatech_attachment_read on storage.objects;
create policy chinatech_attachment_read on storage.objects for select to authenticated using(bucket_id='chinatech-private-attachments' and storage.allow_only_operation('object.get_authenticated') and chinatech_v2_private.storage_attachment_access(name,false));

-- Storage inserts an authorization placeholder before it knows metadata.size.
-- Reserve the bucket's maximum object size until exact bytes/hash are confirmed.
-- This bounds even a malicious direct upload without trusting client size claims.
alter table chinatech_v2_private.attachment_reservations add column reserved_bytes bigint not null default 256000 check(reserved_bytes=256000);
create or replace function chinatech_v2_private.read_store_usage(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not chinatech_v2_private.member_access(target) or target::text<>current_setting('app.store_id',true) then raise exception 'Store denied' using errcode='42501';end if;
 select jsonb_build_object('usedBytes',(select coalesce(sum(octet_length(bytes)),0) from chinatech_v2_private.intake_photos where store_id=target)+(select coalesce(sum(bytes),0) from chinatech_v2_private.attachment_usage where store_id=target)+(select coalesce(sum(bytes),0) from chinatech_v2_private.retail_legacy_photo_usage where store_id=target),'reservedBytes',(select coalesce(sum(reserved_bytes),0) from chinatech_v2_private.attachment_reservations where store_id=target and status='reserved'),'limitBytes',e.attachment_limit,'memberLimit',e.member_limit,'memberCount',(select count(*) from chinatech_v2.store_memberships where store_id=target and membership_status='active'),'planVersion',e.plan_version) into result from chinatech_v2_private.store_entitlements e where store_id=target;
 return result;
end $$;
create or replace function chinatech_v2_private.guard_attachment_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare usage jsonb;
begin
 if new.store_id::text<>current_setting('app.store_id',true) or not chinatech_v2_private.member_access(new.store_id,new.domain||'.edit') or new.actor_id<>auth.uid() then raise exception 'Attachment denied' using errcode='42501';end if;
 perform 1 from chinatech_v2_private.store_state where store_id=new.store_id for update;
 if tg_op='INSERT' then
  usage:=chinatech_v2_private.read_store_usage(new.store_id);
  if (usage->>'usedBytes')::bigint+(usage->>'reservedBytes')::bigint+new.reserved_bytes>(usage->>'limitBytes')::bigint then raise exception 'Attachment quota exceeded' using errcode='P0001';end if;
 elsif (new.store_id,new.id,new.actor_id,new.bytes,new.content_hash,new.domain,new.mime,new.created_at,new.reserved_bytes) is distinct from (old.store_id,old.id,old.actor_id,old.bytes,old.content_hash,old.domain,old.mime,old.created_at,old.reserved_bytes) or old.status<>'reserved' and new.status<>old.status then raise exception 'Attachment immutable' using errcode='42501';
 end if;
 if new.status='cancelled' and exists(select 1 from storage.objects where bucket_id='chinatech-private-attachments' and name=new.store_id::text||'/'||new.id::text||'.jpg') then raise exception 'Uploaded original remains charged' using errcode='42501';end if;
 return new;
end $$;
create or replace function chinatech_v2_private.storage_attachment_access(object_name text, writing boolean, object_metadata jsonb default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from chinatech_v2_private.attachment_reservations r where object_name=r.store_id::text||'/'||r.id::text||'.jpg' and chinatech_v2_private.member_access(r.store_id,r.domain||case when writing then '.edit' else '.view' end) and
 case when writing then r.actor_id=auth.uid() and r.status='reserved'
 else (r.status='reserved' and r.actor_id=auth.uid()) or (r.status='confirmed' and (
  (r.domain='repairs' and exists(select 1 from chinatech_v2_private.intake_photo_objects p join chinatech_v2_private.repair_intakes i on i.store_id=p.store_id and i.id=p.repair_id where p.store_id=r.store_id and p.id=r.id and i.data->'photos' @> jsonb_build_array(jsonb_build_object('id',r.id::text))))
  or (r.domain='retail' and exists(select 1 from chinatech_v2_private.retail_units u where u.store_id=r.store_id and u.data->'photos' @> jsonb_build_array('ct-photo:'||r.id::text)))
 )) end);
$$;

-- Old bytea originals are read-only after cutover to object uploads.
revoke insert on chinatech_v2_private.intake_photos from chinatech_runtime;
create function chinatech_v2_private.guard_retail_photo_refs() returns trigger language plpgsql security definer set search_path='' as $$
declare photo jsonb; value text; photo_id uuid;
begin
 if session_user in ('postgres','supabase_admin') and current_setting('role',true) in ('none','','postgres','supabase_admin') then return new; end if;
 for photo in select jsonb_path_query(new.data,'$.**.photos[*]') loop
  value:=photo#>>'{}';
  if value like 'data:image/%' and not exists(select 1 from chinatech_v2_private.retail_legacy_photo_usage l where l.store_id=new.store_id and l.hash=encode(sha256(decode(split_part(value,',',2),'base64')),'hex')) then raise exception 'New originals require private storage' using errcode='42501';
  elsif value like 'ct-photo:%' then
   begin photo_id:=substring(value from 10)::uuid; exception when invalid_text_representation then raise exception 'Invalid photo reference' using errcode='42501';end;
   if not exists(select 1 from chinatech_v2_private.attachment_usage u join chinatech_v2_private.attachment_reservations r on r.store_id=u.store_id and r.id=u.id where u.store_id=new.store_id and u.id=photo_id and r.status='confirmed' and r.domain='retail') then raise exception 'Cross-store photo reference' using errcode='42501';end if;
  end if;
 end loop;
 return new;
end $$;
revoke all on function chinatech_v2_private.guard_retail_photo_refs() from public,anon,authenticated,service_role,chinatech_runtime;
create trigger retail_photo_refs_guard before insert or update on chinatech_v2_private.retail_units for each row execute function chinatech_v2_private.guard_retail_photo_refs();
create function chinatech_v2_private.provision_store_entitlement() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into chinatech_v2_private.store_entitlements(store_id) values(new.id) on conflict do nothing; return new;end $$;
revoke all on function chinatech_v2_private.provision_store_entitlement() from public,anon,authenticated,service_role,chinatech_runtime;
create trigger provision_store_entitlement after insert on chinatech_v2.stores for each row execute function chinatech_v2_private.provision_store_entitlement();

-- Restrictive guards protect this bucket even if a legacy project has broad
-- permissive policies for unrelated buckets. Originals cannot be mutated.
create policy chinatech_attachment_read_guard on storage.objects as restrictive for select to public using(bucket_id<>'chinatech-private-attachments' or (storage.allow_only_operation('object.get_authenticated') and chinatech_v2_private.storage_attachment_access(name,false)));
create policy chinatech_attachment_insert_guard on storage.objects as restrictive for insert to public with check(bucket_id<>'chinatech-private-attachments' or chinatech_v2_private.storage_attachment_access(name,true,metadata));
create policy chinatech_attachment_update_guard on storage.objects as restrictive for update to public using(bucket_id<>'chinatech-private-attachments') with check(bucket_id<>'chinatech-private-attachments');
create policy chinatech_attachment_delete_guard on storage.objects as restrictive for delete to public using(bucket_id<>'chinatech-private-attachments');
create function chinatech_v2_private.sync_store_name() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.settings->>'shopName' is distinct from old.settings->>'shopName' then
  update chinatech_v2.stores set name=new.settings->>'shopName' where id=new.store_id;
 end if;
 return new;
end $$;
revoke all on function chinatech_v2_private.sync_store_name() from public,anon,authenticated,service_role,chinatech_runtime;
create trigger sync_store_name after update of settings on chinatech_v2_private.store_state for each row execute function chinatech_v2_private.sync_store_name();


-- Lock upload admission against cancellation/revocation and deny signed uploads.
create or replace function chinatech_v2_private.storage_attachment_allowed(object_name text, writing boolean, object_metadata jsonb default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from chinatech_v2_private.attachment_reservations r where object_name=r.store_id::text||'/'||r.id::text||'.jpg' and chinatech_v2_private.member_access(r.store_id,r.domain||case when writing then '.edit' else '.view' end) and
 case when writing then r.actor_id=auth.uid() and r.status='reserved'
 else (r.status='reserved' and r.actor_id=auth.uid()) or (r.status='confirmed' and (
  (r.domain='repairs' and exists(select 1 from chinatech_v2_private.intake_photo_objects p join chinatech_v2_private.repair_intakes i on i.store_id=p.store_id and i.id=p.repair_id where p.store_id=r.store_id and p.id=r.id and i.data->'photos' @> jsonb_build_array(jsonb_build_object('id',r.id::text))))
  or (r.domain='retail' and exists(select 1 from chinatech_v2_private.retail_units u where u.store_id=r.store_id and u.data->'photos' @> jsonb_build_array('ct-photo:'||r.id::text)))
 )) end);
$$;
revoke all on function chinatech_v2_private.storage_attachment_allowed(text,boolean,jsonb) from public,anon,authenticated,service_role,chinatech_runtime;
create or replace function chinatech_v2_private.storage_attachment_access(object_name text, writing boolean, object_metadata jsonb default null) returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 if writing then
  if not storage.allow_only_operation('object.upload') then return false;end if;
  perform 1 from chinatech_v2_private.attachment_reservations r where object_name=r.store_id::text||'/'||r.id::text||'.jpg' and r.actor_id=auth.uid() and r.status='reserved' for share;
  if not found then return false;end if;
 end if;
 return chinatech_v2_private.storage_attachment_allowed(object_name,writing,object_metadata);
end $$;

create or replace function chinatech_v2_private.storage_attachment_access(object_name text, writing boolean, object_metadata jsonb default null) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare target uuid;
begin
 if writing then
  if not storage.allow_only_operation('object.upload') then return false;end if;
  select r.store_id into target from chinatech_v2_private.attachment_reservations r where object_name=r.store_id::text||'/'||r.id::text||'.jpg' and r.actor_id=auth.uid() and r.status='reserved';
  if not found then return false;end if;
  perform 1 from chinatech_v2_private.login_sessions l where l.user_id=auth.uid() and l.session_id::text=auth.jwt()->>'session_id' for share;
  perform 1 from chinatech_v2.store_memberships m where m.store_id=target and m.user_id=auth.uid() for share;
  perform 1 from chinatech_v2_private.attachment_reservations r where object_name=r.store_id::text||'/'||r.id::text||'.jpg' and r.actor_id=auth.uid() and r.status='reserved' for share;
  if not found then return false;end if;
 end if;
 return chinatech_v2_private.storage_attachment_allowed(object_name,writing,object_metadata);
end $$;


-- Row locks alone do not refresh a serializable cancellation snapshot. Persist
-- an irreversible admission fact so every started upload remains conservatively
-- charged, and a waiter must retry when that reservation version changes.
alter table chinatech_v2_private.attachment_reservations add column upload_started boolean not null default false;
revoke update on chinatech_v2_private.attachment_reservations from chinatech_runtime;
grant update(status) on chinatech_v2_private.attachment_reservations to chinatech_runtime;
create or replace function chinatech_v2_private.guard_attachment_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare usage jsonb;
begin
 if new.store_id::text<>current_setting('app.store_id',true) or not chinatech_v2_private.member_access(new.store_id,new.domain||'.edit') or new.actor_id<>auth.uid() then raise exception 'Attachment denied' using errcode='42501';end if;
 perform 1 from chinatech_v2_private.store_state where store_id=new.store_id for update;
 if tg_op='INSERT' then
  usage:=chinatech_v2_private.read_store_usage(new.store_id);
  if (usage->>'usedBytes')::bigint+(usage->>'reservedBytes')::bigint+new.reserved_bytes>(usage->>'limitBytes')::bigint then raise exception 'Attachment quota exceeded' using errcode='P0001';end if;
 elsif (new.store_id,new.id,new.actor_id,new.bytes,new.content_hash,new.domain,new.mime,new.created_at,new.reserved_bytes) is distinct from (old.store_id,old.id,old.actor_id,old.bytes,old.content_hash,old.domain,old.mime,old.created_at,old.reserved_bytes) or old.status<>'reserved' and new.status<>old.status then raise exception 'Attachment immutable' using errcode='42501';
 end if;
 if tg_op='INSERT' and new.upload_started then raise exception 'Upload admission must be server controlled' using errcode='42501';end if;
 if tg_op='UPDATE' and old.upload_started and not new.upload_started then raise exception 'Upload admission is irreversible' using errcode='42501';end if;
 if new.status='cancelled' and ((tg_op='UPDATE' and old.upload_started) or exists(select 1 from storage.objects where bucket_id='chinatech-private-attachments' and name=new.store_id::text||'/'||new.id::text||'.jpg')) then raise exception 'Uploaded original remains charged' using errcode='42501';end if;
 return new;
end $$;
create or replace function chinatech_v2_private.storage_attachment_access(object_name text, writing boolean, object_metadata jsonb default null) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare target uuid;
begin
 if writing then
  if not storage.allow_only_operation('object.upload') then return false;end if;
  select r.store_id into target from chinatech_v2_private.attachment_reservations r where object_name=r.store_id::text||'/'||r.id::text||'.jpg' and r.actor_id=auth.uid() and r.status='reserved';
  if not found then return false;end if;
  perform 1 from chinatech_v2_private.login_sessions l where l.user_id=auth.uid() and l.session_id::text=auth.jwt()->>'session_id' for share;
  perform 1 from chinatech_v2_private.store_state s where s.store_id=target for update;
  perform 1 from chinatech_v2.store_memberships m where m.store_id=target and m.user_id=auth.uid() for share;
  perform 1 from chinatech_v2_private.attachment_reservations r where object_name=r.store_id::text||'/'||r.id::text||'.jpg' and r.actor_id=auth.uid() and r.status='reserved' for update;
  if not found then return false;end if;
  if not chinatech_v2_private.storage_attachment_allowed(object_name,true,object_metadata) then return false;end if;
  perform set_config('app.store_id',target::text,true);
  update chinatech_v2_private.attachment_reservations set upload_started=true where store_id=target and object_name=store_id::text||'/'||id::text||'.jpg' and not upload_started;
 end if;
 return chinatech_v2_private.storage_attachment_allowed(object_name,writing,object_metadata);
end $$;

-- Per-account and trusted edge-address budgets survive business rollbacks.
-- Only keyed address digests are retained; no raw IP or request/token content.
create table chinatech_v2_private.store_api_rate (
 key text primary key,period_start timestamptz not null,hits integer not null check(hits between 1 and 1000000)
);
alter table chinatech_v2_private.store_api_rate enable row level security;
revoke all on chinatech_v2_private.store_api_rate from public,anon,authenticated,service_role,chinatech_runtime;
create function chinatech_v2_private.consume_store_api_rate(ip_digest text,writing boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare minute timestamptz:=date_trunc('minute',clock_timestamp()); account_hits integer; ip_hits integer; category text:=case when writing then ':write' else ':read' end;
begin
 if not chinatech_v2_private.live_user() or ip_digest !~ '^[a-f0-9]{64}$' then raise exception 'Invalid rate context' using errcode='42501';end if;
 insert into chinatech_v2_private.store_api_rate as r(key,period_start,hits) values('account:'||auth.uid()::text||category,minute,1) on conflict(key) do update set period_start=excluded.period_start,hits=case when r.period_start=excluded.period_start then least(r.hits+1,1000000) else 1 end returning hits into account_hits;
 insert into chinatech_v2_private.store_api_rate as r(key,period_start,hits) values('ip:'||ip_digest||category,minute,1) on conflict(key) do update set period_start=excluded.period_start,hits=case when r.period_start=excluded.period_start then least(r.hits+1,1000000) else 1 end returning hits into ip_hits;
 return account_hits<=case when writing then 60 else 300 end and ip_hits<=case when writing then 300 else 1200 end;
end $$;
revoke all on function chinatech_v2_private.consume_store_api_rate(text,boolean) from public,anon,authenticated,service_role;
grant execute on function chinatech_v2_private.consume_store_api_rate(text,boolean) to chinatech_runtime;


-- Free pilot has no expiry. Dates are entitlement metadata for later billing,
-- with no payment, automatic expiry or data-removal behavior enabled here.
alter table chinatech_v2_private.store_entitlements add column starts_at timestamptz not null default now();
alter table chinatech_v2_private.store_entitlements add column ends_at timestamptz;
alter table chinatech_v2_private.store_entitlements add constraint entitlement_period check(ends_at is null or ends_at>starts_at);
create or replace function chinatech_v2_private.read_store_usage(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not chinatech_v2_private.member_access(target) or target::text<>current_setting('app.store_id',true) then raise exception 'Store denied' using errcode='42501';end if;
 select jsonb_build_object('usedBytes',(select coalesce(sum(octet_length(bytes)),0) from chinatech_v2_private.intake_photos where store_id=target)+(select coalesce(sum(bytes),0) from chinatech_v2_private.attachment_usage where store_id=target)+(select coalesce(sum(bytes),0) from chinatech_v2_private.retail_legacy_photo_usage where store_id=target),'reservedBytes',(select coalesce(sum(reserved_bytes),0) from chinatech_v2_private.attachment_reservations where store_id=target and status='reserved'),'limitBytes',e.attachment_limit,'memberLimit',e.member_limit,'memberCount',(select count(*) from chinatech_v2.store_memberships where store_id=target and membership_status='active'),'planVersion',e.plan_version,'sampledAt',clock_timestamp(),'validFrom',e.starts_at,'validUntil',e.ends_at,'recordCounts',jsonb_build_object('repairs',case when chinatech_v2_private.member_access(target,'repairs.view') then (select count(*) from chinatech_v2_private.repair_intakes where store_id=target) else null end,'procurement',case when chinatech_v2_private.member_access(target,'repairs.view') then (select count(*) from chinatech_v2_private.procurement_records where store_id=target) else null end,'customers',case when chinatech_v2_private.member_access(target,'customers.view') then (select count(*) from chinatech_v2_private.customers where store_id=target) else null end,'retail',case when chinatech_v2_private.member_access(target,'retail.view') then (select count(*) from chinatech_v2_private.retail_units where store_id=target) else null end)) into result from chinatech_v2_private.store_entitlements e where store_id=target;
 return result;
end $$;

drop policy photo_object_write on chinatech_v2_private.intake_photo_objects;
create policy photo_object_write on chinatech_v2_private.intake_photo_objects for insert to chinatech_runtime with check(store_id::text=current_setting('app.store_id',true) and chinatech_v2_private.member_access(store_id,'repairs.edit') and chinatech_v2_private.member_access(store_id,'repairs.view') and exists(select 1 from chinatech_v2_private.attachment_reservations r where r.store_id=intake_photo_objects.store_id and r.id=intake_photo_objects.id and r.domain='repairs' and r.status='confirmed'));
